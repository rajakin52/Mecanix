-- ═══════════════════════════════════════════════════════════════
-- Provision the saft-exports storage bucket.
--
-- Supabase storage buckets are managed as rows in storage.buckets.
-- Creating the bucket here (rather than via dashboard) keeps fresh
-- environments reproducible and stops the monthly SAF-T generator
-- failing its first run with "bucket not found".
-- ═══════════════════════════════════════════════════════════════

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'saft-exports',
  'saft-exports',
  true,                                     -- public download URLs
  52428800,                                 -- 50 MB cap per file
  ARRAY['application/xml', 'text/xml']
)
ON CONFLICT (id) DO UPDATE
  SET public             = EXCLUDED.public,
      file_size_limit    = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;
