-- ═══════════════════════════════════════════════════════════════
-- Storage bucket for generated AIDA assessment PDFs.
--
-- Used by POST /aida/assessments/:id/packet. Public (signed via the
-- returned public_url) so workshops can share the link with a
-- customer or insurer without forcing them into the Mecanix app.
-- ═══════════════════════════════════════════════════════════════

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'aida-packets',
  'aida-packets',
  true,
  10485760,                                              -- 10 MB per PDF
  ARRAY['application/pdf']
)
ON CONFLICT (id) DO UPDATE
  SET public             = EXCLUDED.public,
      file_size_limit    = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;
