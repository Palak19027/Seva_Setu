/*
# Restrict open donation details to verified organizations

Plain English: previously any registered receiving organization could read the full details of open
donations, including the pickup address and contact information. Now only organizations that an admin
has verified can see them. Unverified organizations can still sign in and submit verification documents.

## 1. Modified policy
- donations: the "Read donations by role and ownership" SELECT policy now requires a verified
  organization (not just an organization account) to see open donations.

## 2. Security
- Donors, admins and organizations that already requested a donation keep their access unchanged.

## 3. Important notes
1. The policy is dropped and recreated, so this migration is safe to re-run.
*/

DROP POLICY IF EXISTS "Read donations by role and ownership" ON donations;
CREATE POLICY "Read donations by role and ownership" ON donations FOR SELECT
TO authenticated USING (
  donor_id = auth.uid()
  OR public.is_admin()
  OR (public.is_verified_org() AND status IN ('POSTED', 'REQUESTED'))
  OR public.org_has_request_on(id)
);
