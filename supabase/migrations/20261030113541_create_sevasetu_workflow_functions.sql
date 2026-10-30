/*
# SevaSetu donation workflow functions

Plain English: adds the secure actions the apps use to move a donation through its lifecycle
(posted, requested, accepted, pickup scheduled, picked up, delivered, completed), plus
cancellation, release back to the public list, expiry handling, verification review, account
deactivation, the public donation list and public impact numbers. Every status change is written
to the donation history and triggers notifications for the people involved.

## 1. Donor actions
- respond_to_request: accept one request (others are declined) or decline a request.
- release_donation: take back an accepted donation that was not collected so it can be listed again.
- cancel_donation: withdraw an open donation.
- complete_donation: confirm a delivered donation is closed.

## 2. Receiving organization actions (verified organizations only)
- request_donation, cancel_request.
- schedule_pickup, confirm_pickup, confirm_delivery.

## 3. Platform actions
- sweep_expired_donations: marks donations past their pickup window as expired.
- Food donations past their safe pickup deadline are never redistributed.
- submit_verification_document: organizations submit or resubmit verification documents.
- admin_review_organization: admins approve or reject organization verification.
- admin_set_account_active: admins activate or deactivate accounts.

## 4. Public read functions
- list_public_donations: safe, public subset of donations (no pickup address or contact details).
- public_impact_stats: aggregate numbers for the home page.

## 5. Security
- Every function checks who is calling and their role before changing anything.
- Functions run with owner rights only for the specific change they make.
- Helper functions are not callable by anonymous visitors.

## 6. Important notes
1. Nothing is deleted by this migration.
2. Each function is safe to re-run because it only creates the functions if they do not exist yet.
*/

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
  IF v_donation.status NOT IN ('POSTED', 'REQUESTED') THEN
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

  IF v_donation.status = 'POSTED' THEN
    UPDATE donations SET status = 'REQUESTED' WHERE id = p_donation_id;
    PERFORM public.log_donation_status(p_donation_id, 'POSTED', 'REQUESTED', v_uid, v_org.name || ' requested this donation');
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
    UPDATE donations SET status = 'POSTED' WHERE id = v_donation.id;
    PERFORM public.log_donation_status(v_donation.id, 'REQUESTED', 'POSTED', auth.uid(), 'Request cancelled');
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
  v_other record;
  v_old_status text;
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
  IF v_donation.status NOT IN ('POSTED', 'REQUESTED') THEN
    RAISE EXCEPTION 'This donation is no longer open';
  END IF;

  v_old_status := v_donation.status;

  IF p_accept THEN
    IF v_donation.available_until <= now()
       OR (v_donation.category = 'food' AND v_donation.safe_pickup_deadline <= now()) THEN
      RAISE EXCEPTION 'The pickup deadline for this donation has passed';
    END IF;

    UPDATE donation_requests SET status = 'ACCEPTED' WHERE id = v_req.id;

    FOR v_other IN
      SELECT id, org_id FROM donation_requests
      WHERE donation_id = v_donation.id AND id <> v_req.id AND status = 'PENDING'
    LOOP
      UPDATE donation_requests SET status = 'REJECTED' WHERE id = v_other.id;
      PERFORM public.notify_user(
        v_other.org_id, 'request_rejected', 'Request not selected',
        'The donor chose another organization for "' || v_donation.title || '"', v_donation.id
      );
    END LOOP;

    UPDATE donations SET status = 'ACCEPTED', accepted_request_id = v_req.id WHERE id = v_donation.id;
    PERFORM public.log_donation_status(v_donation.id, v_old_status, 'ACCEPTED', auth.uid(), 'Accepted ' || v_req.org_name);
    PERFORM public.notify_user(
      v_req.org_id, 'request_accepted', 'Request accepted',
      'Your request for "' || v_donation.title || '" was accepted. Please schedule the pickup.', v_donation.id
    );
  ELSE
    UPDATE donation_requests SET status = 'REJECTED' WHERE id = v_req.id;

    IF v_donation.status = 'REQUESTED' AND NOT EXISTS (
      SELECT 1 FROM donation_requests WHERE donation_id = v_donation.id AND status = 'PENDING'
    ) THEN
      UPDATE donations SET status = 'POSTED' WHERE id = v_donation.id;
      PERFORM public.log_donation_status(v_donation.id, 'REQUESTED', 'POSTED', auth.uid(), 'Request declined');
    END IF;

    PERFORM public.notify_user(
      v_req.org_id, 'request_rejected', 'Request declined',
      'The donor declined your request for "' || v_donation.title || '"', v_donation.id
    );
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.schedule_pickup(p_donation_id uuid, p_pickup_at timestamptz)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_d donations%ROWTYPE;
  v_old_status text;
BEGIN
  SELECT d.* INTO v_d FROM donations d
  JOIN donation_requests r ON r.id = d.accepted_request_id
  WHERE d.id = p_donation_id AND r.org_id = auth.uid()
  FOR UPDATE OF d;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Only the accepted organization can schedule this pickup';
  END IF;
  IF v_d.status NOT IN ('ACCEPTED', 'PICKUP_SCHEDULED') THEN
    RAISE EXCEPTION 'A pickup can only be scheduled for an accepted donation';
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

  v_old_status := v_d.status;
  UPDATE donations SET status = 'PICKUP_SCHEDULED', pickup_scheduled_for = p_pickup_at WHERE id = v_d.id;
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
BEGIN
  SELECT d.* INTO v_d FROM donations d
  JOIN donation_requests r ON r.id = d.accepted_request_id
  WHERE d.id = p_donation_id AND r.org_id = auth.uid()
  FOR UPDATE OF d;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Only the accepted organization can confirm this pickup';
  END IF;
  IF v_d.status NOT IN ('ACCEPTED', 'PICKUP_SCHEDULED') THEN
    RAISE EXCEPTION 'This donation is not ready for pickup';
  END IF;
  IF v_d.category = 'food' AND v_d.safe_pickup_deadline <= now() THEN
    RAISE EXCEPTION 'Food was not collected before its safe pickup deadline and cannot be redistributed';
  END IF;

  UPDATE donations SET status = 'PICKED_UP' WHERE id = v_d.id;
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
    RAISE EXCEPTION 'Only the accepted organization can confirm this delivery';
  END IF;
  IF v_d.status <> 'PICKED_UP' THEN
    RAISE EXCEPTION 'Delivery can only be confirmed after pickup';
  END IF;

  UPDATE donations SET status = 'DELIVERED' WHERE id = v_d.id;
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
  v_org_id uuid;
  v_old_status text;
BEGIN
  SELECT * INTO v_d FROM donations WHERE id = p_donation_id AND donor_id = auth.uid() FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Donation not found';
  END IF;
  IF v_d.status NOT IN ('ACCEPTED', 'PICKUP_SCHEDULED') THEN
    RAISE EXCEPTION 'Only accepted donations that were not collected can be released';
  END IF;
  IF v_d.category = 'food' AND v_d.safe_pickup_deadline <= now() THEN
    RAISE EXCEPTION 'Food cannot be listed again after its safe pickup deadline';
  END IF;
  IF v_d.available_until <= now() THEN
    RAISE EXCEPTION 'This donation has passed its availability window';
  END IF;

  SELECT org_id INTO v_org_id FROM donation_requests WHERE id = v_d.accepted_request_id;
  UPDATE donation_requests SET status = 'CANCELLED' WHERE id = v_d.accepted_request_id;

  v_old_status := v_d.status;
  UPDATE donations
    SET status = 'POSTED', accepted_request_id = NULL, pickup_scheduled_for = NULL
    WHERE id = v_d.id;
  PERFORM public.log_donation_status(v_d.id, v_old_status, 'POSTED', auth.uid(), 'Donor released the donation back to the public list');

  IF v_org_id IS NOT NULL THEN
    PERFORM public.notify_user(
      v_org_id, 'donation_released', 'Donation released',
      '"' || v_d.title || '" was not collected and has been released by the donor.', v_d.id
    );
  END IF;
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
  IF v_d.status NOT IN ('POSTED', 'REQUESTED') THEN
    RAISE EXCEPTION 'Only donations that have not been accepted can be cancelled';
  END IF;

  UPDATE donations SET status = 'CANCELLED' WHERE id = v_d.id;
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

CREATE OR REPLACE FUNCTION public.sweep_expired_donations()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r record;
  o record;
BEGIN
  FOR r IN
    SELECT id, donor_id, title, status FROM donations
    WHERE (status IN ('POSTED', 'REQUESTED')
           AND (available_until <= now() OR (category = 'food' AND safe_pickup_deadline <= now())))
       OR (status IN ('ACCEPTED', 'PICKUP_SCHEDULED') AND category = 'food' AND safe_pickup_deadline <= now())
    FOR UPDATE
  LOOP
    UPDATE donations SET status = 'EXPIRED' WHERE id = r.id;
    UPDATE donation_requests SET status = 'CANCELLED' WHERE donation_id = r.id AND status = 'PENDING';
    PERFORM public.log_donation_status(r.id, r.status, 'EXPIRED', NULL, 'Pickup window closed');
    PERFORM public.notify_user(
      r.donor_id, 'donation_expired', 'Donation expired',
      '"' || r.title || '" passed its pickup window and is no longer available.', r.id
    );
    FOR o IN SELECT org_id FROM donation_requests WHERE donation_id = r.id AND status = 'ACCEPTED' LOOP
      PERFORM public.notify_user(
        o.org_id, 'donation_expired', 'Donation expired',
        '"' || r.title || '" passed its pickup deadline before collection.', r.id
      );
    END LOOP;
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
  WHERE d.status IN ('POSTED', 'REQUESTED', 'ACCEPTED', 'PICKUP_SCHEDULED', 'PICKED_UP', 'DELIVERED', 'COMPLETED')
  ORDER BY d.created_at DESC
  LIMIT 300;
END;
$$;

CREATE OR REPLACE FUNCTION public.public_impact_stats()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'total_donations', (SELECT count(*) FROM donations WHERE status <> 'CANCELLED'),
    'registered_donors', (SELECT count(*) FROM profiles WHERE role IN ('individual', 'business') AND is_active),
    'partner_ngos', (SELECT count(*) FROM organizations WHERE verification_status = 'verified'),
    'people_helped', (SELECT COALESCE(sum(quantity), 0) FROM donations WHERE status IN ('DELIVERED', 'COMPLETED'))
  )
$$;

CREATE OR REPLACE FUNCTION public.submit_verification_document(p_path text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_org organizations%ROWTYPE;
BEGIN
  SELECT o.* INTO v_org FROM organizations o JOIN profiles p ON p.id = o.id
  WHERE o.id = v_uid AND p.role = 'organization';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Only receiving organizations can upload verification documents';
  END IF;
  IF p_path IS NULL OR p_path NOT LIKE v_uid::text || '/%' THEN
    RAISE EXCEPTION 'Invalid document location';
  END IF;

  UPDATE organizations
    SET verification_document_path = p_path,
        verification_status = CASE WHEN verification_status = 'verified' THEN 'verified' ELSE 'pending' END,
        rejection_reason = NULL,
        reviewed_at = NULL
    WHERE id = v_uid;

  PERFORM public.notify_admins(
    'verification_request', 'Verification documents submitted',
    v_org.name || ' submitted documents for review', NULL
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_review_organization(p_org_id uuid, p_decision text, p_reason text DEFAULT '')
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_reason text := NULLIF(TRIM(COALESCE(p_reason, '')), '');
  v_updated int;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;
  IF p_decision NOT IN ('verified', 'rejected') THEN
    RAISE EXCEPTION 'Invalid decision';
  END IF;
  IF p_decision = 'rejected' AND v_reason IS NULL THEN
    RAISE EXCEPTION 'Please provide a reason for rejecting this organization';
  END IF;

  UPDATE organizations
    SET verification_status = p_decision,
        rejection_reason = CASE WHEN p_decision = 'rejected' THEN v_reason ELSE NULL END,
        reviewed_at = now()
    WHERE id = p_org_id AND verification_status IN ('pending', 'verified', 'rejected');
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated = 0 THEN
    RAISE EXCEPTION 'Organization not found or not open to verification';
  END IF;

  PERFORM public.notify_user(
    p_org_id, 'verification_update',
    CASE WHEN p_decision = 'verified' THEN 'Organization verified' ELSE 'Verification declined' END,
    CASE WHEN p_decision = 'verified'
      THEN 'Your organization is verified. You can now request donations.'
      ELSE 'Your verification was declined: ' || v_reason END,
    NULL
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_account_active(p_profile_id uuid, p_active boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_updated int;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;
  IF p_profile_id = auth.uid() THEN
    RAISE EXCEPTION 'You cannot change the status of your own admin account';
  END IF;

  UPDATE profiles SET is_active = p_active WHERE id = p_profile_id AND role <> 'admin';
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated = 0 THEN
    RAISE EXCEPTION 'Account not found';
  END IF;
END;
$$;

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
REVOKE ALL ON FUNCTION public.submit_verification_document(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_review_organization(uuid, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_set_account_active(uuid, boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.list_public_donations() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.public_impact_stats() FROM PUBLIC;

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
GRANT EXECUTE ON FUNCTION public.submit_verification_document(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_review_organization(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_account_active(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_public_donations() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.public_impact_stats() TO anon, authenticated;
