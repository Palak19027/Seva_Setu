/*
# Reservation workflow, nearby alerts, feedback, rewards and monitoring functions

Plain English: rewrites the donation actions for the new lifecycle and adds:
- Smart acceptance: an NGO can accept a donation directly. The donation is reserved for that NGO
  inside a database transaction, so two NGOs can never claim the same donation.
- Automatic reservation expiry: if the NGO does not collect before the pickup window closes, the
  reservation ends. Food that is still safe is reactivated and nearby NGOs are alerted again.
  Unsafe food is marked EXPIRED and never reactivated.
- Nearby NGO alerts for new food donations, using the configured radius.
- Pickup and delivery confirmations are stored as records.
- Genuine NGO feedback after delivery (only the ratings the NGO actually gives are stored).
- Donor rewards: points, levels, badges and milestone certificates, recalculated when a donation completes.
- Top contributors, monthly impact, donor profile, admin monitoring and admin-controlled settings.

## 1. Modified functions
Every donation action keeps its name and parameters, but uses the new status names. Donor-facing
actions stay the same; the status they move to now follows the new lifecycle.

## 2. New functions
- reserve_donation: verified NGO accepts a donation directly.
- set_organization_location, submit_ngo_feedback, donor_profile, donor_monthly_report,
  top_contributors, admin_monitoring_summary, admin_update_setting.

## 3. Security
- Every function checks who is calling. Admin functions check admin rights.
- Internal helpers are not callable by anonymous or signed-in users directly.
- Reservations are protected by row locks and a database rule that allows only one active
  reservation per donation.

## 4. Important notes
1. Nothing is deleted. Re-running this migration is safe because functions are replaced.
*/

CREATE OR REPLACE FUNCTION public.distance_km(lat1 double precision, lng1 double precision, lat2 double precision, lng2 double precision)
RETURNS double precision LANGUAGE sql IMMUTABLE AS $$
  SELECT 2 * 6371 * asin(sqrt(
    power(sin(radians(lat2 - lat1) / 2), 2)
    + cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lng2 - lng1) / 2), 2)
  ))
$$;

CREATE OR REPLACE FUNCTION public.platform_setting(p_key text)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT value FROM platform_settings WHERE key = p_key
$$;

CREATE OR REPLACE FUNCTION public.notify_nearby_organizations(p_donation_id uuid, p_event text, p_cycle integer, p_exclude_org uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_d donations%ROWTYPE;
  v_radius integer;
  v_org record;
  v_dist double precision;
  v_title text;
  v_body text;
BEGIN
  SELECT * INTO v_d FROM donations WHERE id = p_donation_id;
  IF NOT FOUND OR v_d.category <> 'food' OR v_d.latitude IS NULL OR v_d.longitude IS NULL THEN
    RETURN;
  END IF;

  v_radius := public.platform_setting('notification_radius_km');

  FOR v_org IN
    SELECT o.id, o.name, o.latitude, o.longitude
    FROM organizations o JOIN profiles p ON p.id = o.id
    WHERE o.verification_status = 'verified' AND p.is_active AND p.role = 'organization'
      AND o.latitude IS NOT NULL AND o.longitude IS NOT NULL
      AND (p_exclude_org IS NULL OR o.id <> p_exclude_org)
  LOOP
    v_dist := public.distance_km(v_d.latitude, v_d.longitude, v_org.latitude, v_org.longitude);
    CONTINUE WHEN v_dist > v_radius;

    INSERT INTO ngo_notifications (donation_id, org_id, event, cycle, distance_km, radius_km)
    VALUES (p_donation_id, v_org.id, p_event, p_cycle, round(v_dist::numeric, 2), v_radius)
    ON CONFLICT (donation_id, org_id, event, cycle) DO NOTHING;

    IF FOUND THEN
      v_title := CASE WHEN p_event = 'REACTIVATED' THEN 'Food available again nearby' ELSE 'New food donation nearby' END;
      v_body := v_d.donor_name || ' · ' || v_d.quantity || ' ' || v_d.unit || ' of ' || v_d.title
        || ' · ' || round(v_dist::numeric, 1) || ' km away · pickup from ' || v_d.pickup_address
        || CASE WHEN v_d.safe_pickup_deadline IS NOT NULL
             THEN ' · safe pickup deadline ' || to_char(v_d.safe_pickup_deadline AT TIME ZONE 'UTC', 'DD Mon HH24:MI') || ' UTC'
             ELSE '' END;
      PERFORM public.notify_user(v_org.id, 'nearby_donation', v_title, v_body, p_donation_id);
    END IF;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.donations_after_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.log_donation_status(NEW.id, NULL, 'AVAILABLE', NEW.donor_id, 'Donation posted');
  PERFORM public.notify_admins(
    'new_donation',
    'New donation posted',
    NEW.donor_name || ' posted "' || NEW.title || '" (' || NEW.category || ')',
    NEW.id
  );
  IF NEW.category = 'food' THEN
    PERFORM public.notify_nearby_organizations(NEW.id, 'NEW_DONATION', 0, NULL);
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.start_reservation(p_request_id uuid, p_actor uuid, p_note text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_req donation_requests%ROWTYPE;
  v_d donations%ROWTYPE;
  v_other record;
  v_expires timestamptz;
BEGIN
  SELECT * INTO v_req FROM donation_requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND OR v_req.status <> 'PENDING' THEN
    RAISE EXCEPTION 'This request is no longer pending';
  END IF;

  SELECT * INTO v_d FROM donations WHERE id = v_req.donation_id FOR UPDATE;
  IF v_d.status NOT IN ('AVAILABLE', 'REQUESTED', 'REACTIVATED') THEN
    RAISE EXCEPTION 'This donation has already been reserved or is no longer available';
  END IF;
  IF v_d.available_until <= now() OR (v_d.category = 'food' AND v_d.safe_pickup_deadline <= now()) THEN
    RAISE EXCEPTION 'The pickup deadline for this donation has passed';
  END IF;

  v_expires := LEAST(now() + make_interval(mins => public.platform_setting('reservation_minutes')), v_d.available_until);
  IF v_d.category = 'food' THEN
    v_expires := LEAST(v_expires, v_d.safe_pickup_deadline);
  END IF;
  IF v_expires <= now() THEN
    RAISE EXCEPTION 'Not enough time remains to reserve this donation';
  END IF;

  UPDATE donation_requests SET status = 'ACCEPTED' WHERE id = v_req.id;

  FOR v_other IN
    SELECT id, org_id FROM donation_requests
    WHERE donation_id = v_d.id AND id <> v_req.id AND status = 'PENDING'
  LOOP
    UPDATE donation_requests SET status = 'REJECTED' WHERE id = v_other.id;
    PERFORM public.notify_user(
      v_other.org_id, 'request_rejected', 'Donation reserved by another organization',
      '"' || v_d.title || '" has been reserved by another organization.', v_d.id
    );
  END LOOP;

  INSERT INTO reservations (donation_id, request_id, org_id, status, expires_at)
  VALUES (v_d.id, v_req.id, v_req.org_id, 'ACTIVE', v_expires);

  UPDATE donations
    SET status = 'RESERVED', accepted_request_id = v_req.id, reservation_expires_at = v_expires
    WHERE id = v_d.id;
  PERFORM public.log_donation_status(v_d.id, v_d.status, 'RESERVED', p_actor, p_note);

  PERFORM public.notify_user(
    v_d.donor_id, 'reserved', 'Donation reserved',
    v_req.org_name || ' reserved "' || v_d.title || '". The pickup window is open until the reservation deadline shown on your donation.',
    v_d.id
  );
  PERFORM public.notify_user(
    v_req.org_id, 'reserved', 'Donation reserved for you',
    'You reserved "' || v_d.title || '". Schedule the pickup before the reservation deadline.',
    v_d.id
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.close_reservation(p_donation_id uuid, p_reservation_status text, p_actor uuid, p_note text, p_terminal_status text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_d donations%ROWTYPE;
  v_org_id uuid;
  v_org_name text;
  v_from text;
  v_safe boolean;
  v_cycle integer;
BEGIN
  SELECT * INTO v_d FROM donations WHERE id = p_donation_id FOR UPDATE;
  IF NOT FOUND OR v_d.status NOT IN ('RESERVED', 'PICKUP_SCHEDULED') THEN
    RETURN;
  END IF;

  SELECT org_id, org_name INTO v_org_id, v_org_name FROM donation_requests WHERE id = v_d.accepted_request_id;

  UPDATE reservations SET status = p_reservation_status, closed_at = now()
    WHERE donation_id = v_d.id AND status = 'ACTIVE';
  IF v_d.accepted_request_id IS NOT NULL THEN
    UPDATE donation_requests
      SET status = CASE WHEN p_reservation_status = 'EXPIRED' THEN 'EXPIRED' ELSE 'CANCELLED' END
      WHERE id = v_d.accepted_request_id AND status = 'ACCEPTED';
  END IF;

  v_from := v_d.status;
  v_safe := v_d.available_until > now() AND (v_d.category <> 'food' OR v_d.safe_pickup_deadline > now());

  IF p_reservation_status = 'EXPIRED' THEN
    PERFORM public.log_donation_status(v_d.id, v_from, 'RESERVATION_EXPIRED', NULL, 'Reservation window closed without pickup');
    v_from := 'RESERVATION_EXPIRED';
  END IF;

  IF p_terminal_status IS NULL AND v_safe THEN
    v_cycle := v_d.reactivation_count + 1;
    UPDATE donations
      SET status = 'REACTIVATED', accepted_request_id = NULL, reservation_expires_at = NULL,
          pickup_scheduled_for = NULL, reactivation_count = v_cycle
      WHERE id = v_d.id;
    PERFORM public.log_donation_status(v_d.id, v_from, 'REACTIVATED', p_actor, p_note || '. Donation is available again.');

    IF v_org_id IS NOT NULL THEN
      PERFORM public.notify_user(v_org_id, 'reservation_expired', 'Reservation ended',
        'Your reservation for "' || v_d.title || '" ended before pickup. The donation is available to other organizations.', v_d.id);
    END IF;
    PERFORM public.notify_user(v_d.donor_id, 'reactivated', 'Donation available again',
      '"' || v_d.title || '" was not collected in time and has been made available to nearby organizations again.', v_d.id);
    PERFORM public.notify_nearby_organizations(v_d.id, 'REACTIVATED', v_cycle, v_org_id);
  ELSE
    UPDATE donations
      SET status = COALESCE(p_terminal_status, 'EXPIRED'), reservation_expires_at = NULL, pickup_scheduled_for = NULL
      WHERE id = v_d.id;
    PERFORM public.log_donation_status(v_d.id, v_from, COALESCE(p_terminal_status, 'EXPIRED'), p_actor, p_note);

    IF v_org_id IS NOT NULL THEN
      PERFORM public.notify_user(v_org_id, 'reservation_expired', 'Reservation ended',
        '"' || v_d.title || '" is no longer available: ' || p_note || '.', v_d.id);
    END IF;
    PERFORM public.notify_user(v_d.donor_id, 'donation_expired', 'Donation closed',
      '"' || v_d.title || '" is no longer available: ' || p_note || '.', v_d.id);
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.reserve_donation(p_donation_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_org organizations%ROWTYPE;
  v_d donations%ROWTYPE;
  v_req_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Please sign in to accept donations';
  END IF;

  SELECT o.* INTO v_org FROM organizations o JOIN profiles p ON p.id = o.id
  WHERE o.id = v_uid AND p.role = 'organization' AND p.is_active;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Only receiving organizations can accept donations';
  END IF;
  IF v_org.verification_status <> 'verified' THEN
    RAISE EXCEPTION 'Your organization must be verified by an admin before you can accept donations';
  END IF;

  -- The row lock serializes competing organizations: the second claim waits, then sees RESERVED.
  SELECT * INTO v_d FROM donations WHERE id = p_donation_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Donation not found';
  END IF;
  IF v_d.status NOT IN ('AVAILABLE', 'REQUESTED', 'REACTIVATED') THEN
    RAISE EXCEPTION 'This donation has already been reserved or is no longer available';
  END IF;
  IF v_d.available_until <= now() OR (v_d.category = 'food' AND v_d.safe_pickup_deadline <= now()) THEN
    RAISE EXCEPTION 'The pickup deadline for this donation has passed';
  END IF;

  SELECT id INTO v_req_id FROM donation_requests
  WHERE donation_id = p_donation_id AND org_id = v_uid AND status = 'PENDING';
  IF v_req_id IS NULL THEN
    INSERT INTO donation_requests (donation_id, org_id, org_name, org_type, message)
    VALUES (p_donation_id, v_uid, v_org.name, v_org.org_type, 'Accepted from a nearby alert')
    RETURNING id INTO v_req_id;
  END IF;

  PERFORM public.start_reservation(v_req_id, v_uid, v_org.name || ' accepted this donation');
  RETURN v_req_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.request_donation(p_donation_id uuid, p_message text DEFAULT '')
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_org organizations%ROWTYPE;
  v_donation donations%ROWTYPE;
  v_request_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Please sign in to request donations';
  END IF;

  SELECT o.* INTO v_org FROM organizations o JOIN profiles p ON p.id = o.id
  WHERE o.id = v_uid AND p.role = 'organization' AND p.is_active;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Only receiving organizations can request donations';
  END IF;
  IF v_org.verification_status <> 'verified' THEN
    RAISE EXCEPTION 'Your organization must be verified by an admin before you can request donations';
  END IF;

  SELECT * INTO v_donation FROM donations WHERE id = p_donation_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Donation not found';
  END IF;
  IF v_donation.status NOT IN ('AVAILABLE', 'REQUESTED', 'REACTIVATED') THEN
    RAISE EXCEPTION 'This donation is no longer open for requests';
  END IF;
  IF v_donation.available_until <= now()
     OR (v_donation.category = 'food' AND v_donation.safe_pickup_deadline <= now()) THEN
    RAISE EXCEPTION 'The pickup deadline for this donation has passed';
  END IF;
  IF EXISTS (
    SELECT 1 FROM donation_requests
    WHERE donation_id = p_donation_id AND org_id = v_uid AND status IN ('PENDING', 'ACCEPTED')
  ) THEN
    RAISE EXCEPTION 'You have already requested this donation';
  END IF;

  INSERT INTO donation_requests (donation_id, org_id, org_name, org_type, message)
  VALUES (p_donation_id, v_uid, v_org.name, v_org.org_type, LEFT(TRIM(COALESCE(p_message, '')), 500))
  RETURNING id INTO v_request_id;

  IF v_donation.status IN ('AVAILABLE', 'REACTIVATED') THEN
    UPDATE donations SET status = 'REQUESTED' WHERE id = p_donation_id;
    PERFORM public.log_donation_status(p_donation_id, v_donation.status, 'REQUESTED', v_uid, v_org.name || ' requested this donation');
  END IF;

  PERFORM public.notify_user(
    v_donation.donor_id, 'new_request', 'New request for your donation',
    v_org.name || ' wants to receive "' || v_donation.title || '"', p_donation_id
  );
  RETURN v_request_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_request(p_request_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_req donation_requests%ROWTYPE;
  v_donation donations%ROWTYPE;
BEGIN
  SELECT * INTO v_req FROM donation_requests WHERE id = p_request_id AND org_id = auth.uid() FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Request not found';
  END IF;
  IF v_req.status <> 'PENDING' THEN
    RAISE EXCEPTION 'Only pending requests can be cancelled';
  END IF;

  UPDATE donation_requests SET status = 'CANCELLED' WHERE id = v_req.id;

  SELECT * INTO v_donation FROM donations WHERE id = v_req.donation_id FOR UPDATE;
  IF v_donation.status = 'REQUESTED' AND NOT EXISTS (
    SELECT 1 FROM donation_requests WHERE donation_id = v_donation.id AND status = 'PENDING'
  ) THEN
    UPDATE donations SET status = CASE WHEN v_donation.reactivation_count > 0 THEN 'REACTIVATED' ELSE 'AVAILABLE' END
      WHERE id = v_donation.id;
    PERFORM public.log_donation_status(v_donation.id, 'REQUESTED',
      CASE WHEN v_donation.reactivation_count > 0 THEN 'REACTIVATED' ELSE 'AVAILABLE' END, auth.uid(), 'Request cancelled');
  END IF;

  PERFORM public.notify_user(
    v_donation.donor_id, 'request_cancelled', 'A request was cancelled',
    v_req.org_name || ' cancelled their request for "' || v_donation.title || '"', v_donation.id
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.respond_to_request(p_request_id uuid, p_accept boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_req donation_requests%ROWTYPE;
  v_donation donations%ROWTYPE;
BEGIN
  SELECT * INTO v_req FROM donation_requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Request not found';
  END IF;

  SELECT * INTO v_donation FROM donations WHERE id = v_req.donation_id FOR UPDATE;
  IF v_donation.donor_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Only the donor can respond to this request';
  END IF;
  IF v_req.status <> 'PENDING' THEN
    RAISE EXCEPTION 'This request has already been handled';
  END IF;

  IF p_accept THEN
    PERFORM public.start_reservation(p_request_id, auth.uid(), 'Donor accepted ' || v_req.org_name);
    RETURN;
  END IF;

  IF v_donation.status NOT IN ('AVAILABLE', 'REQUESTED', 'REACTIVATED') THEN
    RAISE EXCEPTION 'This donation is no longer open';
  END IF;

  UPDATE donation_requests SET status = 'REJECTED' WHERE id = v_req.id;

  IF v_donation.status = 'REQUESTED' AND NOT EXISTS (
    SELECT 1 FROM donation_requests WHERE donation_id = v_donation.id AND status = 'PENDING'
  ) THEN
    UPDATE donations SET status = CASE WHEN v_donation.reactivation_count > 0 THEN 'REACTIVATED' ELSE 'AVAILABLE' END
      WHERE id = v_donation.id;
    PERFORM public.log_donation_status(v_donation.id, 'REQUESTED',
      CASE WHEN v_donation.reactivation_count > 0 THEN 'REACTIVATED' ELSE 'AVAILABLE' END, auth.uid(), 'Request declined');
  END IF;

  PERFORM public.notify_user(
    v_req.org_id, 'request_rejected', 'Request declined',
    'The donor declined your request for "' || v_donation.title || '"', v_donation.id
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.schedule_pickup(p_donation_id uuid, p_pickup_at timestamptz)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_d donations%ROWTYPE;
  v_old_status text;
  v_window_end timestamptz;
BEGIN
  SELECT d.* INTO v_d FROM donations d
  JOIN donation_requests r ON r.id = d.accepted_request_id
  WHERE d.id = p_donation_id AND r.org_id = auth.uid()
  FOR UPDATE OF d;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Only the reserving organization can schedule this pickup';
  END IF;
  IF v_d.status NOT IN ('RESERVED', 'PICKUP_SCHEDULED') THEN
    RAISE EXCEPTION 'A pickup can only be scheduled for a reserved donation';
  END IF;
  IF v_d.reservation_expires_at <= now() THEN
    RAISE EXCEPTION 'The reservation window has closed';
  END IF;
  IF p_pickup_at <= now() THEN
    RAISE EXCEPTION 'The pickup time must be in the future';
  END IF;
  IF p_pickup_at > v_d.available_until THEN
    RAISE EXCEPTION 'The pickup time must be before the donation availability ends';
  END IF;
  IF v_d.category = 'food' AND p_pickup_at > v_d.safe_pickup_deadline THEN
    RAISE EXCEPTION 'Food must be picked up before its safe pickup deadline';
  END IF;

  -- Pickup confirmation deadline: one hour after the agreed pickup time, never beyond safety limits.
  v_window_end := LEAST(p_pickup_at + interval '60 minutes', v_d.available_until);
  IF v_d.category = 'food' THEN
    v_window_end := LEAST(v_window_end, v_d.safe_pickup_deadline);
  END IF;

  v_old_status := v_d.status;
  UPDATE reservations SET expires_at = v_window_end WHERE donation_id = v_d.id AND status = 'ACTIVE';
  UPDATE donations
    SET status = 'PICKUP_SCHEDULED', pickup_scheduled_for = p_pickup_at, reservation_expires_at = v_window_end
    WHERE id = v_d.id;
  IF v_old_status <> 'PICKUP_SCHEDULED' THEN
    PERFORM public.log_donation_status(v_d.id, v_old_status, 'PICKUP_SCHEDULED', auth.uid(), 'Pickup scheduled');
  END IF;
  PERFORM public.notify_user(
    v_d.donor_id, 'pickup_scheduled', 'Pickup scheduled',
    'A pickup for "' || v_d.title || '" has been scheduled.', v_d.id
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.confirm_pickup(p_donation_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_d donations%ROWTYPE;
  v_res_id uuid;
BEGIN
  SELECT d.* INTO v_d FROM donations d
  JOIN donation_requests r ON r.id = d.accepted_request_id
  WHERE d.id = p_donation_id AND r.org_id = auth.uid()
  FOR UPDATE OF d;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Only the reserving organization can confirm this pickup';
  END IF;
  IF v_d.status NOT IN ('RESERVED', 'PICKUP_SCHEDULED') THEN
    RAISE EXCEPTION 'This donation is not ready for pickup';
  END IF;
  IF v_d.reservation_expires_at <= now() THEN
    RAISE EXCEPTION 'The pickup window has closed. The donation has been released to other organizations';
  END IF;
  IF v_d.category = 'food' AND v_d.safe_pickup_deadline <= now() THEN
    RAISE EXCEPTION 'Food was not collected before its safe pickup deadline and cannot be redistributed';
  END IF;

  UPDATE reservations SET status = 'PICKED_UP', closed_at = now()
    WHERE donation_id = v_d.id AND status = 'ACTIVE'
    RETURNING id INTO v_res_id;
  UPDATE donations SET status = 'PICKED_UP' WHERE id = v_d.id;

  INSERT INTO pickup_confirmations (donation_id, reservation_id, org_id, stage, confirmed_by)
  VALUES (v_d.id, v_res_id, auth.uid(), 'PICKED_UP', auth.uid());

  PERFORM public.log_donation_status(v_d.id, v_d.status, 'PICKED_UP', auth.uid(), 'Pickup confirmed');
  PERFORM public.notify_user(
    v_d.donor_id, 'picked_up', 'Donation picked up',
    '"' || v_d.title || '" has been picked up.', v_d.id
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.confirm_delivery(p_donation_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_d donations%ROWTYPE;
BEGIN
  SELECT d.* INTO v_d FROM donations d
  JOIN donation_requests r ON r.id = d.accepted_request_id
  WHERE d.id = p_donation_id AND r.org_id = auth.uid()
  FOR UPDATE OF d;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Only the reserving organization can confirm this delivery';
  END IF;
  IF v_d.status <> 'PICKED_UP' THEN
    RAISE EXCEPTION 'Delivery can only be confirmed after pickup';
  END IF;

  UPDATE donations SET status = 'DELIVERED' WHERE id = v_d.id;
  INSERT INTO pickup_confirmations (donation_id, org_id, stage, confirmed_by)
  VALUES (v_d.id, auth.uid(), 'DELIVERED', auth.uid());
  PERFORM public.log_donation_status(v_d.id, 'PICKED_UP', 'DELIVERED', auth.uid(), 'Delivery confirmed');
  PERFORM public.notify_user(
    v_d.donor_id, 'delivered', 'Donation delivered',
    '"' || v_d.title || '" was delivered successfully. Thank you for giving.', v_d.id
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_donation(p_donation_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_d donations%ROWTYPE;
  v_org_id uuid;
BEGIN
  SELECT * INTO v_d FROM donations WHERE id = p_donation_id AND donor_id = auth.uid() FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Donation not found';
  END IF;
  IF v_d.status <> 'DELIVERED' THEN
    RAISE EXCEPTION 'Only delivered donations can be marked as completed';
  END IF;

  UPDATE donations SET status = 'COMPLETED' WHERE id = v_d.id;
  PERFORM public.log_donation_status(v_d.id, 'DELIVERED', 'COMPLETED', auth.uid(), 'Donor confirmed completion');

  SELECT org_id INTO v_org_id FROM donation_requests WHERE id = v_d.accepted_request_id;
  IF v_org_id IS NOT NULL THEN
    PERFORM public.notify_user(
      v_org_id, 'completed', 'Donation completed',
      '"' || v_d.title || '" is now marked as completed.', v_d.id
    );
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.release_donation(p_donation_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_d donations%ROWTYPE;
BEGIN
  SELECT * INTO v_d FROM donations WHERE id = p_donation_id AND donor_id = auth.uid() FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Donation not found';
  END IF;
  IF v_d.status NOT IN ('RESERVED', 'PICKUP_SCHEDULED') THEN
    RAISE EXCEPTION 'Only reserved donations that were not collected can be released';
  END IF;

  PERFORM public.close_reservation(p_donation_id, 'RELEASED', auth.uid(), 'Donor released the donation', NULL);
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_donation(p_donation_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_d donations%ROWTYPE;
  v_req record;
BEGIN
  SELECT * INTO v_d FROM donations WHERE id = p_donation_id AND donor_id = auth.uid() FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Donation not found';
  END IF;
  IF v_d.status NOT IN ('AVAILABLE', 'REQUESTED', 'REACTIVATED', 'RESERVED', 'PICKUP_SCHEDULED') THEN
    RAISE EXCEPTION 'This donation can no longer be cancelled';
  END IF;

  IF v_d.status IN ('RESERVED', 'PICKUP_SCHEDULED') THEN
    PERFORM public.close_reservation(p_donation_id, 'CANCELLED', auth.uid(), 'Donor cancelled the donation', 'CANCELLED');
  END IF;

  UPDATE donations SET status = 'CANCELLED', reservation_expires_at = NULL WHERE id = v_d.id;
  PERFORM public.log_donation_status(v_d.id, v_d.status, 'CANCELLED', auth.uid(), 'Donor cancelled the donation');

  FOR v_req IN
    SELECT id, org_id FROM donation_requests WHERE donation_id = v_d.id AND status = 'PENDING'
  LOOP
    UPDATE donation_requests SET status = 'CANCELLED' WHERE id = v_req.id;
    PERFORM public.notify_user(
      v_req.org_id, 'donation_cancelled', 'Donation cancelled',
      '"' || v_d.title || '" was cancelled by the donor.', v_d.id
    );
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.expire_stale_reservations()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT d.id FROM donations d
    JOIN reservations res ON res.donation_id = d.id AND res.status = 'ACTIVE'
    WHERE d.status IN ('RESERVED', 'PICKUP_SCHEDULED') AND res.expires_at <= now()
    FOR UPDATE OF d SKIP LOCKED
  LOOP
    PERFORM public.close_reservation(r.id, 'EXPIRED', NULL, 'the reservation window closed without pickup', NULL);
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.sweep_expired_donations()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r record;
BEGIN
  PERFORM public.expire_stale_reservations();

  FOR r IN
    SELECT id, donor_id, title, status FROM donations
    WHERE status IN ('AVAILABLE', 'REQUESTED', 'REACTIVATED')
      AND (available_until <= now() OR (category = 'food' AND safe_pickup_deadline <= now()))
    FOR UPDATE SKIP LOCKED
  LOOP
    UPDATE donations SET status = 'EXPIRED' WHERE id = r.id;
    UPDATE donation_requests SET status = 'CANCELLED' WHERE donation_id = r.id AND status = 'PENDING';
    PERFORM public.log_donation_status(r.id, r.status, 'EXPIRED', NULL, 'Pickup window closed');
    PERFORM public.notify_user(
      r.donor_id, 'donation_expired', 'Donation expired',
      '"' || r.title || '" passed its pickup window and is no longer available.', r.id
    );
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.list_public_donations()
RETURNS TABLE (
  id uuid, title text, category text, description text, quantity numeric, unit text,
  item_condition text, image_paths text[], city text, donor_name text, donor_type text,
  status text, available_until timestamptz, safe_pickup_deadline timestamptz,
  food_veg_type text, food_prepared_at timestamptz, created_at timestamptz
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.sweep_expired_donations();
  RETURN QUERY
  SELECT d.id, d.title, d.category, d.description, d.quantity, d.unit,
         d.item_condition, d.image_paths, d.city, d.donor_name, d.donor_type,
         d.status, d.available_until, d.safe_pickup_deadline,
         d.food_veg_type, d.food_prepared_at, d.created_at
  FROM donations d
  WHERE d.status IN ('AVAILABLE', 'REQUESTED', 'REACTIVATED', 'RESERVED', 'PICKUP_SCHEDULED', 'PICKED_UP', 'DELIVERED', 'COMPLETED')
  ORDER BY d.created_at DESC
  LIMIT 300;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_organization_location(p_latitude double precision, p_longitude double precision)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'organization') THEN
    RAISE EXCEPTION 'Only receiving organizations can set a location';
  END IF;
  IF (p_latitude IS NULL) <> (p_longitude IS NULL) THEN
    RAISE EXCEPTION 'Please provide both latitude and longitude';
  END IF;
  IF p_latitude IS NOT NULL AND (p_latitude NOT BETWEEN -90 AND 90 OR p_longitude NOT BETWEEN -180 AND 180) THEN
    RAISE EXCEPTION 'The location is not valid';
  END IF;

  UPDATE organizations SET latitude = p_latitude, longitude = p_longitude WHERE id = auth.uid();
END;
$$;

CREATE OR REPLACE FUNCTION public.submit_ngo_feedback(p_donation_id uuid, p_food_quality integer, p_timely_pickup integer, p_overall_experience integer, p_written_appreciation text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_d donations%ROWTYPE;
  v_org_id uuid;
  v_text text := LEFT(TRIM(COALESCE(p_written_appreciation, '')), 1000);
BEGIN
  SELECT d.* INTO v_d FROM donations d WHERE d.id = p_donation_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Donation not found';
  END IF;

  SELECT org_id INTO v_org_id FROM donation_requests WHERE id = v_d.accepted_request_id;
  IF v_org_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Only the organization that received this donation can leave feedback';
  END IF;
  IF v_d.status NOT IN ('DELIVERED', 'COMPLETED') THEN
    RAISE EXCEPTION 'Feedback can be shared after the donation is delivered';
  END IF;
  IF p_food_quality IS NULL AND p_timely_pickup IS NULL AND p_overall_experience IS NULL THEN
    RAISE EXCEPTION 'Please give at least one rating you feel is genuine';
  END IF;
  IF EXISTS (SELECT 1 FROM ngo_feedback WHERE donation_id = p_donation_id) THEN
    RAISE EXCEPTION 'You have already shared feedback for this donation';
  END IF;

  INSERT INTO ngo_feedback (donation_id, donor_id, org_id, food_quality, timely_pickup, overall_experience, written_appreciation)
  VALUES (p_donation_id, v_d.donor_id, auth.uid(), p_food_quality, p_timely_pickup, p_overall_experience, v_text);

  PERFORM public.notify_user(
    v_d.donor_id, 'feedback', 'New feedback from an organization',
    'An organization shared feedback about "' || v_d.title || '".', p_donation_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.recalculate_donor_rewards(p_donor_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_role text;
  v_completed integer;
  v_points integer;
  v_meals integer;
  v_level text;
  v_milestone integer;
  v_badge text;
BEGIN
  SELECT role INTO v_role FROM profiles WHERE id = p_donor_id;

  SELECT
    count(*) FILTER (WHERE status = 'COMPLETED')::integer,
    COALESCE(sum(LEAST(FLOOR(quantity), 90) + 10) FILTER (WHERE status = 'COMPLETED'), 0)::integer,
    COALESCE(sum(FLOOR(quantity)) FILTER (WHERE status = 'COMPLETED' AND category = 'food'), 0)::integer
  INTO v_completed, v_points, v_meals
  FROM donations WHERE donor_id = p_donor_id;

  v_level := CASE WHEN v_points >= 300 THEN 'Gold' WHEN v_points >= 100 THEN 'Silver' ELSE 'Bronze' END;

  INSERT INTO donor_rewards (donor_id, points, completed_donations, meals_contributed, level, updated_at)
  VALUES (p_donor_id, v_points, v_completed, v_meals, v_level, now())
  ON CONFLICT (donor_id) DO UPDATE
    SET points = EXCLUDED.points, completed_donations = EXCLUDED.completed_donations,
        meals_contributed = EXCLUDED.meals_contributed, level = EXCLUDED.level, updated_at = now();

  IF v_completed >= 1 THEN
    INSERT INTO donor_badges (donor_id, badge_key) VALUES (p_donor_id, 'first_donation') ON CONFLICT DO NOTHING;
    IF v_role = 'business' THEN
      INSERT INTO donor_badges (donor_id, badge_key) VALUES (p_donor_id, 'verified_social_impact_partner') ON CONFLICT DO NOTHING;
    END IF;
  END IF;
  IF v_meals >= 100 THEN
    INSERT INTO donor_badges (donor_id, badge_key) VALUES (p_donor_id, 'hundred_meals') ON CONFLICT DO NOTHING;
  END IF;

  FOR v_milestone IN SELECT unnest(ARRAY[1, 5, 10, 25, 50]) LOOP
    IF v_completed >= v_milestone THEN
      INSERT INTO donor_certificates (donor_id, milestone) VALUES (p_donor_id, v_milestone) ON CONFLICT DO NOTHING;
      IF FOUND THEN
        PERFORM public.notify_user(p_donor_id, 'certificate', 'Certificate earned',
          'You completed ' || v_milestone || ' donation' || CASE WHEN v_milestone = 1 THEN '' ELSE 's' END || ' and earned a certificate of appreciation.', NULL);
      END IF;
    END IF;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.donations_after_completed()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'COMPLETED' AND OLD.status IS DISTINCT FROM 'COMPLETED' THEN
    PERFORM public.recalculate_donor_rewards(NEW.donor_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS donations_rewards_on_complete ON donations;
CREATE TRIGGER donations_rewards_on_complete AFTER UPDATE OF status ON donations
  FOR EACH ROW EXECUTE FUNCTION public.donations_after_completed();

CREATE OR REPLACE FUNCTION public.donor_profile(p_donor_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_target uuid := COALESCE(p_donor_id, auth.uid());
  v_profile profiles%ROWTYPE;
  v_reward donor_rewards%ROWTYPE;
  v_avg numeric;
  v_score integer;
BEGIN
  IF v_target IS NULL THEN
    RAISE EXCEPTION 'Please sign in to view a donor profile';
  END IF;
  IF v_target <> auth.uid() AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'You can only view your own donor profile';
  END IF;

  SELECT * INTO v_profile FROM profiles WHERE id = v_target;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Donor not found';
  END IF;
  SELECT * INTO v_reward FROM donor_rewards WHERE donor_id = v_target;

  SELECT avg(x) INTO v_avg FROM (
    SELECT food_quality::numeric AS x FROM ngo_feedback WHERE donor_id = v_target AND food_quality IS NOT NULL
    UNION ALL
    SELECT timely_pickup::numeric FROM ngo_feedback WHERE donor_id = v_target AND timely_pickup IS NOT NULL
    UNION ALL
    SELECT overall_experience::numeric FROM ngo_feedback WHERE donor_id = v_target AND overall_experience IS NOT NULL
  ) ratings;

  v_score := COALESCE(v_reward.points, 0)
    + round(COALESCE(v_reward.meals_contributed, 0) / 10.0)
    + COALESCE(round(v_avg * 20), 0);

  RETURN jsonb_build_object(
    'donor_id', v_profile.id,
    'name', v_profile.full_name,
    'role', v_profile.role,
    'city', v_profile.city,
    'address', v_profile.address,
    'total_donations', (SELECT count(*) FROM donations WHERE donor_id = v_target AND status <> 'CANCELLED'),
    'completed_donations', COALESCE(v_reward.completed_donations, 0),
    'meals_contributed', COALESCE(v_reward.meals_contributed, 0),
    'points', COALESCE(v_reward.points, 0),
    'level', COALESCE(v_reward.level, 'Bronze'),
    'average_rating', round(v_avg, 2),
    'social_impact_score', v_score,
    'badges', COALESCE((SELECT jsonb_agg(jsonb_build_object('key', b.badge_key, 'awarded_at', b.awarded_at) ORDER BY b.awarded_at)
      FROM donor_badges b WHERE b.donor_id = v_target), '[]'::jsonb),
    'certificates', COALESCE((SELECT jsonb_agg(jsonb_build_object('milestone', c.milestone, 'issued_at', c.issued_at) ORDER BY c.milestone)
      FROM donor_certificates c WHERE c.donor_id = v_target), '[]'::jsonb),
    'feedback', COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'org_name', o.name, 'donation_title', d.title, 'food_quality', f.food_quality,
        'timely_pickup', f.timely_pickup, 'overall_experience', f.overall_experience,
        'written_appreciation', f.written_appreciation, 'created_at', f.created_at)
        ORDER BY f.created_at DESC)
      FROM ngo_feedback f JOIN organizations o ON o.id = f.org_id JOIN donations d ON d.id = f.donation_id
      WHERE f.donor_id = v_target), '[]'::jsonb)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.top_contributors(p_limit integer DEFAULT 10)
RETURNS TABLE (donor_id uuid, donor_name text, city text, points integer, level text, completed_donations integer, meals_contributed integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT r.donor_id, p.full_name, p.city, r.points, r.level, r.completed_donations, r.meals_contributed
  FROM donor_rewards r JOIN profiles p ON p.id = r.donor_id
  WHERE p.role = 'business' AND p.is_active AND r.completed_donations > 0
  ORDER BY r.points DESC, r.completed_donations DESC
  LIMIT LEAST(GREATEST(p_limit, 1), 50)
$$;

CREATE OR REPLACE FUNCTION public.donor_monthly_report()
RETURNS TABLE (month_start date, donations_posted integer, completed integer, meals integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT date_trunc('month', d.created_at)::date,
         count(*)::integer,
         (count(*) FILTER (WHERE d.status = 'COMPLETED'))::integer,
         COALESCE(sum(FLOOR(d.quantity)) FILTER (WHERE d.status = 'COMPLETED' AND d.category = 'food'), 0)::integer
  FROM donations d
  WHERE d.donor_id = auth.uid() AND d.status <> 'CANCELLED'
    AND d.created_at >= date_trunc('month', now()) - interval '11 months'
  GROUP BY 1
  ORDER BY 1
$$;

CREATE OR REPLACE FUNCTION public.admin_monitoring_summary()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  RETURN jsonb_build_object(
    'total_food_donations', (SELECT count(*) FROM donations WHERE category = 'food'),
    'active_reservations', (SELECT count(*) FROM reservations WHERE status = 'ACTIVE'),
    'expired_reservations', (SELECT count(*) FROM reservations WHERE status = 'EXPIRED'),
    'reactivated_donations', (SELECT count(*) FROM donation_history WHERE to_status = 'REACTIVATED'),
    'successful_pickups', (SELECT count(*) FROM pickup_confirmations WHERE stage = 'PICKED_UP'),
    'nearing_expiry', (SELECT count(*) FROM donations
      WHERE category = 'food' AND status IN ('AVAILABLE', 'REQUESTED', 'REACTIVATED', 'RESERVED', 'PICKUP_SCHEDULED')
        AND safe_pickup_deadline > now() AND safe_pickup_deadline <= now() + interval '3 hours'),
    'meals_saved', (SELECT COALESCE(sum(FLOOR(quantity)), 0) FROM donations
      WHERE category = 'food' AND status IN ('DELIVERED', 'COMPLETED')),
    'verified_ngos', (SELECT count(*) FROM organizations WHERE verification_status = 'verified'),
    'participating_ngos', (SELECT count(DISTINCT org_id) FROM reservations),
    'top_hotel_donors', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('name', p.full_name, 'city', p.city, 'completed', r.completed_donations, 'meals', r.meals_contributed, 'points', r.points)
        ORDER BY r.meals_contributed DESC, r.points DESC)
      FROM (SELECT * FROM donor_rewards ORDER BY meals_contributed DESC, points DESC LIMIT 5) r
      JOIN profiles p ON p.id = r.donor_id
      WHERE p.role = 'business'), '[]'::jsonb),
    'expiring_soon', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id', d.id, 'title', d.title, 'donor_name', d.donor_name, 'status', d.status, 'deadline', d.safe_pickup_deadline) ORDER BY d.safe_pickup_deadline)
      FROM (SELECT * FROM donations
            WHERE category = 'food' AND status IN ('AVAILABLE', 'REQUESTED', 'REACTIVATED', 'RESERVED', 'PICKUP_SCHEDULED')
              AND safe_pickup_deadline > now()
            ORDER BY safe_pickup_deadline LIMIT 10) d), '[]'::jsonb)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_update_setting(p_key text, p_value integer)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_updated int;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  UPDATE platform_settings SET value = p_value, updated_by = auth.uid(), updated_at = now() WHERE key = p_key;
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated = 0 THEN
    RAISE EXCEPTION 'Unknown setting';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.distance_km(double precision, double precision, double precision, double precision) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.platform_setting(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_nearby_organizations(uuid, text, integer, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.start_reservation(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.close_reservation(uuid, text, uuid, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.expire_stale_reservations() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.recalculate_donor_rewards(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.donations_after_completed() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reserve_donation(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_organization_location(double precision, double precision) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.submit_ngo_feedback(uuid, integer, integer, integer, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.donor_profile(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.donor_monthly_report() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_monitoring_summary() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_update_setting(text, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.top_contributors(integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.request_donation(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.cancel_request(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.respond_to_request(uuid, boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.schedule_pickup(uuid, timestamptz) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.confirm_pickup(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.confirm_delivery(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.complete_donation(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.release_donation(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.cancel_donation(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.sweep_expired_donations() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.list_public_donations() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.reserve_donation(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_organization_location(double precision, double precision) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_ngo_feedback(uuid, integer, integer, integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.donor_profile(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.donor_monthly_report() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_monitoring_summary() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_setting(text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.top_contributors(integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.request_donation(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_request(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.respond_to_request(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.schedule_pickup(uuid, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_pickup(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_delivery(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_donation(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.release_donation(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_donation(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sweep_expired_donations() TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_public_donations() TO anon, authenticated;
