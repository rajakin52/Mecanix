-- ============================================================
-- Storage bucket for vehicle photos
-- ============================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('vehicle-photos', 'vehicle-photos', true);

-- Allow authenticated users to upload to their tenant folder
CREATE POLICY "vehicle_photos_insert" ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'vehicle-photos'
    AND (storage.foldername(name))[1] = (
      SELECT tenant_id::text
      FROM public.users
      WHERE auth_id = auth.uid()
      LIMIT 1
    )
  );

-- Allow authenticated users to read photos from their tenant
CREATE POLICY "vehicle_photos_select" ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'vehicle-photos'
    AND (storage.foldername(name))[1] = (
      SELECT tenant_id::text
      FROM public.users
      WHERE auth_id = auth.uid()
      LIMIT 1
    )
  );

-- Allow public read for vehicle photos (they're public URLs)
CREATE POLICY "vehicle_photos_public_read" ON storage.objects
  FOR SELECT
  TO anon
  USING (bucket_id = 'vehicle-photos');

-- Allow users to delete their own tenant's photos
CREATE POLICY "vehicle_photos_delete" ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'vehicle-photos'
    AND (storage.foldername(name))[1] = (
      SELECT tenant_id::text
      FROM public.users
      WHERE auth_id = auth.uid()
      LIMIT 1
    )
  );
