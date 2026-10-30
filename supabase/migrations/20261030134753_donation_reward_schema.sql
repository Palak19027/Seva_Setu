/*
# Donation status model, reservations, rewards and food-location schema

Plain English: moves SevaSetu to the full donation lifecycle (AVAILABLE, REQUESTED, RESERVED,
PICKUP_SCHEDULED, PICKED_UP, DELIVERED, COMPLETED, RESERVATION_EXPIRED, REACTIVATED, CANCELLED,
EXPIRED). Adds the records needed for location-based NGO alerts, time-limited reservations,
pickup confirmations, NGO feedback, donor rewards and admin-controlled settings.

## 1. Modified tables
- donations: status values renamed (POSTED -> AVAILABLE, ACCEPTED -> RESERVED, existing history rows
  updated to match). New columns: latitude, longitude (pickup location), reservation_expires_at,
  reactivation_count. Food donations must now carry a pickup location.
- donation_requests: status may also be EXPIRED.
- organizations: new columns latitude and longitude (receiving location).

## 2. New tables
- platform_settings: notification radius (5, 10 or 15 km) and reservation duration in minutes.
- reservations: one active reservation per donation, with the accepting NGO and expiry time.
- pickup_confirmations: stored proof of each pickup and delivery step.
- ngo_notifications: each nearby-alert sent to an organization, with distance and channel.
- ngo_feedback: genuine NGO feedback (ratings are optional individually, at least one required).
- donor_rewards, donor_badges, donor_certificates: points, levels, achievements and milestones.

## 3. Security
- Every new table has row level security enabled. Read access is limited to the people involved
  and admins. There are no direct write policies: writes happen only through secure functions.
- Open donation details are no longer readable by every verified organization directly. Verified
  organizations browse open donations through the public list, which hides addresses and contacts.
  They see full details only after they hold a reservation or request.

## 4. Important notes
1. Nothing is deleted. Existing POSTED and ACCEPTED values are converted to their new names.
2. Re-running this migration is safe: statements use IF EXISTS / IF NOT EXISTS and policies are dropped first.
*/

ALTER TABLE donations DROP CONSTRAINT IF EXISTS donations_status_check;

UPDATE donations SET status = 'AVAILABLE' WHERE status = 'POSTED';
UPDATE donations SET status = 'RESERVED' WHERE status = 'ACCEPTED';
UPDATE donation_history SET from_status = 'AVAILABLE' WHERE from_status = 'POSTED';
UPDATE donation_history SET to_status = 'AVAILABLE' WHERE to_status = 'POSTED';
UPDATE donation_history SET from_status = 'RESERVED' WHERE from_status = 'ACCEPTED';
UPDATE donation_history SET to_status = 'RESERVED' WHERE to_status = 'ACCEPTED';

ALTER TABLE donations ADD CONSTRAINT donations_status_check CHECK (status IN (
  'AVAILABLE', 'REQUESTED', 'RESERVED', 'PICKUP_SCHEDULED', 'PICKED_UP', 'DELIVERED', 'COMPLETED',
  'RESERVATION_EXPIRED', 'REACTIVATED', 'CANCELLED', 'EXPIRED'));
ALTER TABLE donations ALTER COLUMN status SET DEFAULT 'AVAILABLE';

ALTER TABLE donations ADD COLUMN IF NOT EXISTS latitude double precision;
ALTER TABLE donations ADD COLUMN IF NOT EXISTS longitude double precision;
ALTER TABLE donations ADD COLUMN IF NOT EXISTS reservation_expires_at timestamptz;
ALTER TABLE donations ADD COLUMN IF NOT EXISTS reactivation_count integer NOT NULL DEFAULT 0;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'donations_latitude_range') THEN
    ALTER TABLE donations ADD CONSTRAINT donations_latitude_range CHECK (latitude IS NULL OR latitude BETWEEN -90 AND 90);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'donations_longitude_range') THEN
    ALTER TABLE donations ADD CONSTRAINT donations_longitude_range CHECK (longitude IS NULL OR longitude BETWEEN -180 AND 180);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'food_donations_need_location') THEN
    ALTER TABLE donations ADD CONSTRAINT food_donations_need_location CHECK (
      category <> 'food' OR (latitude IS NOT NULL AND longitude IS NOT NULL));
  END IF;
END $$;

ALTER TABLE donation_requests DROP CONSTRAINT IF EXISTS donation_requests_status_check;
ALTER TABLE donation_requests ADD CONSTRAINT donation_requests_status_check
  CHECK (status IN ('PENDING', 'ACCEPTED', 'REJECTED', 'CANCELLED', 'EXPIRED'));

ALTER TABLE organizations ADD COLUMN IF NOT EXISTS latitude double precision;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS longitude double precision;

CREATE TABLE IF NOT EXISTS platform_settings (
  key text PRIMARY KEY,
  value integer NOT NULL,
  updated_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT platform_settings_allowed CHECK (
    (key = 'notification_radius_km' AND value IN (5, 10, 15))
    OR (key = 'reservation_minutes' AND value BETWEEN 15 AND 720)
  )
);

INSERT INTO platform_settings (key, value) VALUES ('notification_radius_km', 10), ('reservation_minutes', 120)
ON CONFLICT (key) DO NOTHING;

CREATE TABLE IF NOT EXISTS reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  donation_id uuid NOT NULL REFERENCES donations(id) ON DELETE CASCADE,
  request_id uuid NOT NULL REFERENCES donation_requests(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('ACTIVE', 'PICKED_UP', 'EXPIRED', 'CANCELLED', 'RELEASED')),
  reserved_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  closed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_reservations_one_active ON reservations(donation_id) WHERE status = 'ACTIVE';
CREATE INDEX IF NOT EXISTS idx_reservations_expiry ON reservations(expires_at) WHERE status = 'ACTIVE';
CREATE INDEX IF NOT EXISTS idx_reservations_org ON reservations(org_id);

CREATE TABLE IF NOT EXISTS pickup_confirmations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  donation_id uuid NOT NULL REFERENCES donations(id) ON DELETE CASCADE,
  reservation_id uuid REFERENCES reservations(id) ON DELETE SET NULL,
  org_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  stage text NOT NULL CHECK (stage IN ('PICKED_UP', 'DELIVERED')),
  confirmed_at timestamptz NOT NULL DEFAULT now(),
  confirmed_by uuid REFERENCES profiles(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_pickup_confirmations_donation ON pickup_confirmations(donation_id);

CREATE TABLE IF NOT EXISTS ngo_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  donation_id uuid NOT NULL REFERENCES donations(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  event text NOT NULL CHECK (event IN ('NEW_DONATION', 'REACTIVATED')),
  cycle integer NOT NULL DEFAULT 0,
  distance_km numeric(8, 2) NOT NULL,
  radius_km integer NOT NULL,
  channel text NOT NULL DEFAULT 'in_app' CHECK (channel IN ('in_app', 'email', 'push')),
  delivery_status text NOT NULL DEFAULT 'delivered' CHECK (delivery_status IN ('pending', 'delivered', 'failed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ngo_notifications_unique_event UNIQUE (donation_id, org_id, event, cycle)
);

CREATE INDEX IF NOT EXISTS idx_ngo_notifications_org ON ngo_notifications(org_id, created_at DESC);

CREATE TABLE IF NOT EXISTS ngo_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  donation_id uuid NOT NULL UNIQUE REFERENCES donations(id) ON DELETE CASCADE,
  donor_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  food_quality smallint CHECK (food_quality BETWEEN 1 AND 5),
  timely_pickup smallint CHECK (timely_pickup BETWEEN 1 AND 5),
  overall_experience smallint CHECK (overall_experience BETWEEN 1 AND 5),
  written_appreciation text NOT NULL DEFAULT '' CHECK (char_length(written_appreciation) <= 1000),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ngo_feedback_has_rating CHECK (
    food_quality IS NOT NULL OR timely_pickup IS NOT NULL OR overall_experience IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_ngo_feedback_donor ON ngo_feedback(donor_id);

CREATE TABLE IF NOT EXISTS donor_rewards (
  donor_id uuid PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  points integer NOT NULL DEFAULT 0 CHECK (points >= 0),
  completed_donations integer NOT NULL DEFAULT 0 CHECK (completed_donations >= 0),
  meals_contributed integer NOT NULL DEFAULT 0 CHECK (meals_contributed >= 0),
  level text NOT NULL DEFAULT 'Bronze' CHECK (level IN ('Bronze', 'Silver', 'Gold')),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS donor_badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  donor_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  badge_key text NOT NULL CHECK (badge_key IN ('first_donation', 'verified_social_impact_partner', 'hundred_meals')),
  awarded_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT donor_badges_unique UNIQUE (donor_id, badge_key)
);

CREATE TABLE IF NOT EXISTS donor_certificates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  donor_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  milestone integer NOT NULL CHECK (milestone IN (1, 5, 10, 25, 50)),
  issued_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT donor_certificates_unique UNIQUE (donor_id, milestone)
);

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
  RETURN NEW;
END;
$$;

ALTER TABLE platform_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE pickup_confirmations ENABLE ROW LEVEL SECURITY;
ALTER TABLE ngo_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE ngo_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE donor_rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE donor_badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE donor_certificates ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON platform_settings TO authenticated;
GRANT SELECT ON reservations TO authenticated;
GRANT SELECT ON pickup_confirmations TO authenticated;
GRANT SELECT ON ngo_notifications TO authenticated;
GRANT SELECT ON ngo_feedback TO authenticated;
GRANT SELECT ON donor_rewards TO authenticated;
GRANT SELECT ON donor_badges TO authenticated;
GRANT SELECT ON donor_certificates TO authenticated;

DROP POLICY IF EXISTS "Signed in users read platform settings" ON platform_settings;
CREATE POLICY "Signed in users read platform settings" ON platform_settings FOR SELECT
TO authenticated USING (true);

DROP POLICY IF EXISTS "Read reservations as org, donor or admin" ON reservations;
CREATE POLICY "Read reservations as org, donor or admin" ON reservations FOR SELECT
TO authenticated USING (org_id = auth.uid() OR public.donation_is_mine(donation_id) OR public.is_admin());

DROP POLICY IF EXISTS "Read pickups as org, donor or admin" ON pickup_confirmations;
CREATE POLICY "Read pickups as org, donor or admin" ON pickup_confirmations FOR SELECT
TO authenticated USING (org_id = auth.uid() OR public.donation_is_mine(donation_id) OR public.is_admin());

DROP POLICY IF EXISTS "Read own nearby alerts or admin" ON ngo_notifications;
CREATE POLICY "Read own nearby alerts or admin" ON ngo_notifications FOR SELECT
TO authenticated USING (org_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "Read feedback as donor, org or admin" ON ngo_feedback;
CREATE POLICY "Read feedback as donor, org or admin" ON ngo_feedback FOR SELECT
TO authenticated USING (donor_id = auth.uid() OR org_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "Donors read own rewards or admin" ON donor_rewards;
CREATE POLICY "Donors read own rewards or admin" ON donor_rewards FOR SELECT
TO authenticated USING (donor_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "Donors read own badges or admin" ON donor_badges;
CREATE POLICY "Donors read own badges or admin" ON donor_badges FOR SELECT
TO authenticated USING (donor_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "Donors read own certificates or admin" ON donor_certificates;
CREATE POLICY "Donors read own certificates or admin" ON donor_certificates FOR SELECT
TO authenticated USING (donor_id = auth.uid() OR public.is_admin());

GRANT INSERT (latitude, longitude) ON donations TO authenticated;
GRANT UPDATE (latitude, longitude) ON donations TO authenticated;

DROP POLICY IF EXISTS "Read donations by role and ownership" ON donations;
CREATE POLICY "Read donations by role and ownership" ON donations FOR SELECT
TO authenticated USING (
  donor_id = auth.uid()
  OR public.is_admin()
  OR public.org_has_request_on(id)
);

DROP POLICY IF EXISTS "Donors insert own donations" ON donations;
CREATE POLICY "Donors insert own donations" ON donations FOR INSERT
TO authenticated WITH CHECK (
  donor_id = auth.uid()
  AND public.current_account_role() IN ('individual', 'business')
  AND status = 'AVAILABLE'
);

DROP POLICY IF EXISTS "Donors edit own posted donations" ON donations;
DROP POLICY IF EXISTS "Donors edit own available donations" ON donations;
CREATE POLICY "Donors edit own available donations" ON donations FOR UPDATE
TO authenticated USING (donor_id = auth.uid() AND status = 'AVAILABLE')
WITH CHECK (donor_id = auth.uid() AND status = 'AVAILABLE');

DROP POLICY IF EXISTS "Donors delete own inactive donations" ON donations;
CREATE POLICY "Donors delete own inactive donations" ON donations FOR DELETE
TO authenticated USING (donor_id = auth.uid() AND status IN ('AVAILABLE', 'CANCELLED', 'EXPIRED'));
