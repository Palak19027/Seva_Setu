/*
# SevaSetu file storage buckets

Plain English: creates two storage areas. Donation photos are stored in a public bucket so they can
be shown on the explore and dashboard pages. Verification documents (registration certificates and
similar) are stored in a private bucket that only the organization that uploaded them and admins can open.

## 1. Buckets
- donation-images: public read, images only (JPG, PNG, WEBP), up to 5 MB per file.
- verification-docs: private, PDF or image files, up to 10 MB per file.

## 2. Security
- Every upload must go into a folder named after the uploader's user ID, so people cannot write into
  someone else's folder.
- Donors can update and remove only their own donation photos.
- Organizations can read and remove only their own verification documents; admins can read all of them.

## 3. Important notes
1. Bucket settings are updated in place if they already exist, so this migration can be re-run safely.
*/

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'donation-images', 'donation-images', true, 5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'verification-docs', 'verification-docs', false, 10485760,
  ARRAY['application/pdf', 'image/jpeg', 'image/png']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Donors upload donation images to own folder" ON storage.objects;
CREATE POLICY "Donors upload donation images to own folder" ON storage.objects FOR INSERT
TO authenticated WITH CHECK (
  bucket_id = 'donation-images' AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "Donors update own donation images" ON storage.objects;
CREATE POLICY "Donors update own donation images" ON storage.objects FOR UPDATE
TO authenticated USING (
  bucket_id = 'donation-images' AND (storage.foldername(name))[1] = auth.uid()::text
) WITH CHECK (
  bucket_id = 'donation-images' AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "Donors delete own donation images" ON storage.objects;
CREATE POLICY "Donors delete own donation images" ON storage.objects FOR DELETE
TO authenticated USING (
  bucket_id = 'donation-images' AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "Organizations upload verification docs to own folder" ON storage.objects;
CREATE POLICY "Organizations upload verification docs to own folder" ON storage.objects FOR INSERT
TO authenticated WITH CHECK (
  bucket_id = 'verification-docs' AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "Owners and admins read verification docs" ON storage.objects;
CREATE POLICY "Owners and admins read verification docs" ON storage.objects FOR SELECT
TO authenticated USING (
  bucket_id = 'verification-docs'
  AND ((storage.foldername(name))[1] = auth.uid()::text OR public.is_admin())
);

DROP POLICY IF EXISTS "Organizations delete own verification docs" ON storage.objects;
CREATE POLICY "Organizations delete own verification docs" ON storage.objects FOR DELETE
TO authenticated USING (
  bucket_id = 'verification-docs' AND (storage.foldername(name))[1] = auth.uid()::text
);
