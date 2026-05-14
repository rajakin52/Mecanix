-- ============================================================
-- Purchase Order approval workflow
-- ------------------------------------------------------------
-- Extends the PO status pipeline with an explicit approval gate:
--
--   draft → pending_approval → approved → sent → partial → complete
--                            ↘ rejected (terminal until re-edited)
--
-- A tenant setting po_approval_threshold (numeric, in tenant currency)
-- controls when approval is required: POs with total_amount below the
-- threshold auto-approve on submit; POs at/above require an explicit
-- approve action from a user in one of the configured approver roles
-- (tenant setting po_approver_roles, default ['owner', 'manager']).
--
-- Existing POs in their current statuses are untouched.
-- ============================================================

ALTER TABLE public.purchase_orders
  DROP CONSTRAINT IF EXISTS purchase_orders_status_check;

ALTER TABLE public.purchase_orders
  ADD CONSTRAINT purchase_orders_status_check
  CHECK (status IN (
    'draft',
    'pending_approval',
    'approved',
    'rejected',
    'sent',
    'partial',
    'complete',
    'cancelled'
  ));

ALTER TABLE public.purchase_orders
  ADD COLUMN submitted_at      timestamptz,
  ADD COLUMN submitted_by      uuid REFERENCES public.users(id),
  ADD COLUMN approved_at       timestamptz,
  ADD COLUMN approved_by       uuid REFERENCES public.users(id),
  ADD COLUMN rejected_at       timestamptz,
  ADD COLUMN rejected_by       uuid REFERENCES public.users(id),
  ADD COLUMN rejection_reason  text;

CREATE INDEX idx_po_pending_approval
  ON public.purchase_orders(tenant_id)
  WHERE status = 'pending_approval';

COMMENT ON COLUMN public.purchase_orders.submitted_at IS
  'When the PO was submitted for approval (draft → pending_approval).';
COMMENT ON COLUMN public.purchase_orders.approved_at IS
  'When the PO was approved. Auto-set on submit if total < tenant po_approval_threshold.';
COMMENT ON COLUMN public.purchase_orders.rejected_at IS
  'When the PO was rejected. rejection_reason is required at reject time.';
