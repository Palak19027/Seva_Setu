/*
# SevaSetu core schema: profiles, organizations, donations and supporting tables

Plain English: sets up the data layer for SevaSetu. Every person who signs up gets a profile
with an account type (individual donor, business donor, or receiving organization). Business
donors and receiving organizations also get an organization record. Donations, requests made by
organizations, a status history, notifications and reports each live in their own table.

## 1. New tables
- profiles: one row per user (account type, name, contact details, active flag).
- organizations: organization details and verification status (pending, verified, rejected, not_required).
- donations: items posted by donors, including images, pickup info, food safety fields and status.
- donation_requests: an organization asking to receive a donation (pending, accepted, rejected, cancelled).
- donation_history: audit trail of every donation status change.
- notifications: in-app messages for each user.
- reports: user reports about a donation listing.

## 2. Automation
- New sign-ups create a profile, plus an organization record for business and receiving accounts.
- The donor name and donor type are copied onto each donation from the donor profile.
- Admins receive notifications for new registrations and new donations.
- Each new donation writes its first history entry.
- updated_at timestamps refresh automatically.

## 3. Security
- Row Level Security is enabled on every table.
- Users can read their own records; admins can read everything.
- Users cannot change their own account type, verification status, or active flag.
- The "admin" account type can never be selected during sign-up.
- Status changes happen through controlled database functions in a follow-up migration.

## 4. Important notes
1. Food donations must include preparation time, vegetarian status and a safe pickup deadline.
2. Nothing is deleted or altered destructively by this migration.
*/

CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('individual', 'business', 'organization', 'admin')),
  full_name text NOT NULL,
  email text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  address text NOT NULL DEFAULT '',
  city text NOT NULL DEFAULT '',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS organizations (
  id uuid PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT '',
  org_type text NOT NULL DEFAULT '',
  registration_number text NOT NULL DEFAULT '',
  contact_person text NOT NULL DEFAULT '',
  address text NOT NULL DEFAULT '',
  city text NOT NULL DEFAULT '',
  verification_status text NOT NULL DEFAULT 'pending'
    CHECK (verification_status IN ('pending', 'verified', 'rejected', 'not_required')),
  verification_document_path text,
  rejection_reason text,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS donations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  donor_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  donor_name text NOT NULL DEFAULT '',
  donor_type text NOT NULL DEFAULT 'individual',
  title text NOT NULL,
  category text NOT NULL CHECK (category IN ('food', 'clothes', 'books', 'toys', 'stationery', 'groceries', 'footwear', 'household', 'others')),
  description text NOT NULL DEFAULT '',
  quantity numeric NOT NULL CHECK (quantity > 0),
  unit text NOT NULL,
  item_condition text NOT NULL CHECK (item_condition IN ('new', 'like_new', 'good', 'fair')),
  image_paths text[] NOT NULL DEFAULT '{}',
  pickup_address text NOT NULL,
  city text NOT NULL,
  available_until timestamptz NOT NULL,
  contact_info text NOT NULL,
  food_prepared_at timestamptz,
  food_veg_type text CHECK (food_veg_type IN ('vegetarian', 'non_vegetarian')),
  food_storage_conditions text,
  food_allergen_info text,
  safe_pickup_deadline timestamptz,
  status text NOT NULL DEFAULT 'POSTED' CHECK (status IN (
    'POSTED', 'REQUESTED', 'ACCEPTED', 'PICKUP_SCHEDULED', 'PICKED_UP',
    'DELIVERED', 'COMPLETED', 'CANCELLED', 'EXPIRED')),
  accepted_request_id uuid,
  pickup_scheduled_for timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT food_donations_need_safety_fields CHECK (
    category <> 'food' OR (
      food_prepared_at IS NOT NULL AND food_veg_type IS NOT NULL AND safe_pickup_deadline IS NOT NULL
    )
  )
);

CREATE TABLE IF NOT EXISTS donation_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  donation_id uuid NOT NULL REFERENCES donations(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  org_name text NOT NULL DEFAULT '',
  org_type text NOT NULL DEFAULT '',
  message text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'ACCEPTED', 'REJECTED', 'CANCELLED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS donation_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  donation_id uuid NOT NULL REFERENCES donations(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  from_status text,
  to_status text NOT NULL,
  note text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type text NOT NULL,
  title text NOT NULL,
  body text NOT NULL DEFAULT '',
  donation_id uuid REFERENCES donations(id) ON DELETE CASCADE,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  donation_id uuid NOT NULL REFERENCES donations(id) ON DELETE CASCADE,
  reason text NOT NULL CHECK (reason IN ('spam', 'wrong_information', 'unsafe', 'other')),
  details text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'RESOLVED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'donations_accepted_request_fk'
  ) THEN
    ALTER TABLE donations
      ADD CONSTRAINT donations_accepted_request_fk
      FOREIGN KEY (accepted_request_id) REFERENCES donation_requests(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_donations_status ON donations(status);
CREATE INDEX IF NOT EXISTS idx_donations_donor ON donations(donor_id);
CREATE INDEX IF NOT EXISTS idx_donation_requests_donation ON donation_requests(donation_id);
CREATE INDEX IF NOT EXISTS idx_donation_requests_org ON donation_requests(org_id);
CREATE INDEX IF NOT EXISTS idx_donation_history_donation ON donation_history(donation_id);
CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON notifications(recipient_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_donation_requests_one_active
  ON donation_requests(donation_id, org_id) WHERE status IN ('PENDING', 'ACCEPTED');

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.current_account_role()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.role FROM profiles p WHERE p.id = auth.uid() AND p.is_active
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(public.current_account_role() = 'admin', false)
$$;

CREATE OR REPLACE FUNCTION public.is_verified_org()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM organizations o JOIN profiles p ON p.id = o.id
    WHERE o.id = auth.uid() AND o.verification_status = 'verified' AND p.is_active
  )
$$;

CREATE OR REPLACE FUNCTION public.donation_is_mine(p_donation_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM donations WHERE id = p_donation_id AND donor_id = auth.uid())
$$;

CREATE OR REPLACE FUNCTION public.org_has_request_on(p_donation_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM donation_requests WHERE donation_id = p_donation_id AND org_id = auth.uid())
$$;

CREATE OR REPLACE FUNCTION public.notify_user(p_recipient uuid, p_type text, p_title text, p_body text, p_donation_id uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO notifications (recipient_id, type, title, body, donation_id)
  VALUES (p_recipient, p_type, p_title, p_body, p_donation_id)
$$;

CREATE OR REPLACE FUNCTION public.notify_admins(p_type text, p_title text, p_body text, p_donation_id uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO notifications (recipient_id, type, title, body, donation_id)
  SELECT id, p_type, p_title, p_body, p_donation_id FROM profiles WHERE role = 'admin' AND is_active
$$;

CREATE OR REPLACE FUNCTION public.log_donation_status(p_donation_id uuid, p_from text, p_to text, p_actor uuid, p_note text)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO donation_history (donation_id, actor_id, from_status, to_status, note)
  VALUES (p_donation_id, p_actor, p_from, p_to, COALESCE(p_note, ''))
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_meta jsonb := COALESCE(NEW.raw_user_meta_data, '{}'::jsonb);
  v_role text := v_meta->>'account_type';
BEGIN
  IF v_role NOT IN ('individual', 'business', 'organization') THEN
    v_role := 'individual';
  END IF;

  INSERT INTO profiles (id, role, full_name, email, phone, address, city)
  VALUES (
    NEW.id,
    v_role,
    COALESCE(NULLIF(TRIM(v_meta->>'full_name'), ''), split_part(COALESCE(NEW.email, 'member@sevasetu'), '@', 1)),
    COALESCE(NEW.email, ''),
    COALESCE(v_meta->>'phone', ''),
    COALESCE(v_meta->>'address', ''),
    COALESCE(v_meta->>'city', '')
  );

  IF v_role IN ('business', 'organization') THEN
    INSERT INTO organizations (id, name, org_type, registration_number, contact_person, address, city, verification_status)
    VALUES (
      NEW.id,
      COALESCE(v_meta->>'organization_name', ''),
      COALESCE(v_meta->>'organization_type', ''),
      COALESCE(v_meta->>'registration_number', ''),
      COALESCE(v_meta->>'contact_person', ''),
      COALESCE(v_meta->>'organization_address', ''),
      COALESCE(v_meta->>'city', ''),
      CASE WHEN v_role = 'organization' THEN 'pending' ELSE 'not_required' END
    );
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.profiles_after_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.notify_admins(
    'new_registration',
    'New ' || CASE NEW.role WHEN 'organization' THEN 'organization' WHEN 'business' THEN 'business donor' ELSE 'donor' END || ' registered',
    NEW.full_name || ' (' || NEW.email || ') joined SevaSetu',
    NULL
  );
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.donations_before_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_profile profiles%ROWTYPE;
BEGIN
  SELECT * INTO v_profile FROM profiles WHERE id = NEW.donor_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Donor profile not found';
  END IF;
  NEW.donor_name := v_profile.full_name;
  NEW.donor_type := v_profile.role;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.donations_after_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.log_donation_status(NEW.id, NULL, 'POSTED', NEW.donor_id, 'Donation posted');
  PERFORM public.notify_admins(
    'new_donation',
    'New donation posted',
    NEW.donor_name || ' posted "' || NEW.title || '" (' || NEW.category || ')',
    NEW.id
  );
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.profiles_after_insert() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.donations_before_insert() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.donations_after_insert() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_user(uuid, text, text, text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_admins(text, text, text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.log_donation_status(uuid, text, text, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.current_account_role() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_verified_org() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.donation_is_mine(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.org_has_request_on(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_account_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_verified_org() TO authenticated;
GRANT EXECUTE ON FUNCTION public.donation_is_mine(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.org_has_request_on(uuid) TO authenticated;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

DROP TRIGGER IF EXISTS profiles_set_updated_at ON profiles;
CREATE TRIGGER profiles_set_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS profiles_notify_admins ON profiles;
CREATE TRIGGER profiles_notify_admins AFTER INSERT ON profiles
  FOR EACH ROW EXECUTE FUNCTION public.profiles_after_insert();

DROP TRIGGER IF EXISTS organizations_set_updated_at ON organizations;
CREATE TRIGGER organizations_set_updated_at BEFORE UPDATE ON organizations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS donations_set_updated_at ON donations;
CREATE TRIGGER donations_set_updated_at BEFORE UPDATE ON donations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS donation_requests_set_updated_at ON donation_requests;
CREATE TRIGGER donation_requests_set_updated_at BEFORE UPDATE ON donation_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS reports_set_updated_at ON reports;
CREATE TRIGGER reports_set_updated_at BEFORE UPDATE ON reports
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS donations_before_insert ON donations;
CREATE TRIGGER donations_before_insert BEFORE INSERT ON donations
  FOR EACH ROW EXECUTE FUNCTION public.donations_before_insert();

DROP TRIGGER IF EXISTS donations_after_insert ON donations;
CREATE TRIGGER donations_after_insert AFTER INSERT ON donations
  FOR EACH ROW EXECUTE FUNCTION public.donations_after_insert();

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE donations ENABLE ROW LEVEL SECURITY;
ALTER TABLE donation_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE donation_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON profiles TO authenticated;
GRANT UPDATE (full_name, phone, address, city) ON profiles TO authenticated;

DROP POLICY IF EXISTS "Users read own profile or admins read all" ON profiles;
CREATE POLICY "Users read own profile or admins read all" ON profiles FOR SELECT
TO authenticated USING (id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "Users update own profile details" ON profiles;
CREATE POLICY "Users update own profile details" ON profiles FOR UPDATE
TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());

GRANT SELECT ON organizations TO authenticated;
GRANT UPDATE (name, org_type, registration_number, contact_person, address, city) ON organizations TO authenticated;

DROP POLICY IF EXISTS "Users and admins read organizations" ON organizations;
CREATE POLICY "Users and admins read organizations" ON organizations FOR SELECT
TO authenticated USING (id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "Users update own organization details" ON organizations;
CREATE POLICY "Users update own organization details" ON organizations FOR UPDATE
TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());

GRANT SELECT ON donations TO authenticated;
GRANT INSERT (title, category, description, quantity, unit, item_condition, image_paths, pickup_address, city,
  available_until, contact_info, food_prepared_at, food_veg_type, food_storage_conditions, food_allergen_info,
  safe_pickup_deadline) ON donations TO authenticated;
GRANT UPDATE (title, category, description, quantity, unit, item_condition, image_paths, pickup_address, city,
  available_until, contact_info, food_prepared_at, food_veg_type, food_storage_conditions, food_allergen_info,
  safe_pickup_deadline) ON donations TO authenticated;
GRANT DELETE ON donations TO authenticated;

DROP POLICY IF EXISTS "Read donations by role and ownership" ON donations;
CREATE POLICY "Read donations by role and ownership" ON donations FOR SELECT
TO authenticated USING (
  donor_id = auth.uid()
  OR public.is_admin()
  OR (public.current_account_role() = 'organization' AND status IN ('POSTED', 'REQUESTED'))
  OR public.org_has_request_on(id)
);

DROP POLICY IF EXISTS "Donors insert own donations" ON donations;
CREATE POLICY "Donors insert own donations" ON donations FOR INSERT
TO authenticated WITH CHECK (
  donor_id = auth.uid()
  AND public.current_account_role() IN ('individual', 'business')
  AND status = 'POSTED'
);

DROP POLICY IF EXISTS "Donors edit own posted donations" ON donations;
CREATE POLICY "Donors edit own posted donations" ON donations FOR UPDATE
TO authenticated USING (donor_id = auth.uid() AND status = 'POSTED')
WITH CHECK (donor_id = auth.uid() AND status = 'POSTED');

DROP POLICY IF EXISTS "Donors delete own inactive donations" ON donations;
CREATE POLICY "Donors delete own inactive donations" ON donations FOR DELETE
TO authenticated USING (donor_id = auth.uid() AND status IN ('POSTED', 'CANCELLED', 'EXPIRED'));

GRANT SELECT ON donation_requests TO authenticated;

DROP POLICY IF EXISTS "Read requests as requester, donor or admin" ON donation_requests;
CREATE POLICY "Read requests as requester, donor or admin" ON donation_requests FOR SELECT
TO authenticated USING (
  org_id = auth.uid() OR public.donation_is_mine(donation_id) OR public.is_admin()
);

GRANT SELECT ON donation_history TO authenticated;

DROP POLICY IF EXISTS "Read history as donor, requester or admin" ON donation_history;
CREATE POLICY "Read history as donor, requester or admin" ON donation_history FOR SELECT
TO authenticated USING (
  public.donation_is_mine(donation_id) OR public.org_has_request_on(donation_id) OR public.is_admin()
);

GRANT SELECT, DELETE ON notifications TO authenticated;
GRANT UPDATE (is_read) ON notifications TO authenticated;

DROP POLICY IF EXISTS "Users read own notifications" ON notifications;
CREATE POLICY "Users read own notifications" ON notifications FOR SELECT
TO authenticated USING (recipient_id = auth.uid());

DROP POLICY IF EXISTS "Users mark own notifications read" ON notifications;
CREATE POLICY "Users mark own notifications read" ON notifications FOR UPDATE
TO authenticated USING (recipient_id = auth.uid()) WITH CHECK (recipient_id = auth.uid());

DROP POLICY IF EXISTS "Users delete own notifications" ON notifications;
CREATE POLICY "Users delete own notifications" ON notifications FOR DELETE
TO authenticated USING (recipient_id = auth.uid());

GRANT SELECT ON reports TO authenticated;
GRANT INSERT (donation_id, reason, details) ON reports TO authenticated;
GRANT UPDATE (status) ON reports TO authenticated;

DROP POLICY IF EXISTS "Users and admins read reports" ON reports;
CREATE POLICY "Users and admins read reports" ON reports FOR SELECT
TO authenticated USING (reporter_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "Users file reports" ON reports;
CREATE POLICY "Users file reports" ON reports FOR INSERT
TO authenticated WITH CHECK (reporter_id = auth.uid());

DROP POLICY IF EXISTS "Admins resolve reports" ON reports;
CREATE POLICY "Admins resolve reports" ON reports FOR UPDATE
TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'donations'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE donations;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'donation_requests'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE donation_requests;
  END IF;
END $$;
