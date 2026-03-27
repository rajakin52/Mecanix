-- ============================================================
-- MECANIX — Gate Pass Workflow Revision
-- Test drive, sublet, final exit types with return tracking
-- ============================================================

ALTER TABLE public.gate_passes
  ADD COLUMN IF NOT EXISTS expected_return_at timestamptz,
  ADD COLUMN IF NOT EXISTS actual_return_at timestamptz,
  ADD COLUMN IF NOT EXISTS destination text,
  ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES public.users(id),
  ADD COLUMN IF NOT EXISTS pass_status text DEFAULT 'active'
    CHECK (pass_status IN ('pending', 'approved', 'active', 'returned', 'closed'));

-- Update pass_type to include new types
-- Note: pass_type CHECK may need dropping and recreating if it exists
-- For safety, we add the column if it doesn't have the right values
ALTER TABLE public.gate_passes
  DROP CONSTRAINT IF EXISTS gate_passes_pass_type_check;

-- Allow new pass types
ALTER TABLE public.gate_passes
  ADD CONSTRAINT gate_passes_pass_type_check
    CHECK (pass_type IN ('entry', 'exit', 'test_drive', 'sublet', 'final_exit'));
