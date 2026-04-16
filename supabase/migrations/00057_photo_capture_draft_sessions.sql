-- Allow photo capture sessions without a job card (draft sessions for wizard flow)
-- and add configurable photo policy setting

-- 1. Make job_card_id nullable so sessions can be created before the job card exists
ALTER TABLE public.photo_capture_sessions
  ALTER COLUMN job_card_id DROP NOT NULL;

-- 2. Add a mode column: 'camera' (take new) or 'gallery' (upload existing)
ALTER TABLE public.photo_capture_sessions
  ADD COLUMN IF NOT EXISTS capture_mode text NOT NULL DEFAULT 'camera'
  CHECK (capture_mode IN ('camera', 'gallery'));

-- 3. Add update policy for photo_capture_sessions (needed to link draft → job card)
CREATE POLICY "photo_sessions_update" ON public.photo_capture_sessions
  FOR UPDATE USING (tenant_id = public.get_tenant_id());

-- 4. Insert default photo policy setting for existing tenants (flexible = allow skip)
-- New tenants will get 'strict' by default via application code
-- This is informational — the app reads from tenant_settings with a default fallback
