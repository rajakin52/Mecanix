-- ============================================================
-- MECANIX — Parts Requests & Purchase Requests (Module 15)
-- Delivery-app-style technician → warehouse → procurement flow
-- ============================================================

-- ============================================================
-- PARTS REQUESTS (technician → warehouse order)
-- ============================================================
CREATE TABLE public.parts_requests (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  job_card_id     uuid NOT NULL REFERENCES public.job_cards(id),
  request_number  text NOT NULL,
  requested_by    uuid NOT NULL REFERENCES public.users(id),
  handled_by      uuid REFERENCES public.users(id),
  status          text NOT NULL DEFAULT 'requested'
                  CHECK (status IN ('requested', 'picking', 'ready', 'issued', 'partial', 'cancelled')),
  priority        text NOT NULL DEFAULT 'normal' CHECK (priority IN ('normal', 'urgent')),
  old_part_photo  text,
  old_part_note   text,
  warehouse_id    uuid REFERENCES public.warehouses(id),
  requested_at    timestamptz NOT NULL DEFAULT NOW(),
  picked_at       timestamptz,
  ready_at        timestamptz,
  issued_at       timestamptz,
  cancelled_at    timestamptz,
  cancel_reason   text,
  created_at      timestamptz NOT NULL DEFAULT NOW(),
  updated_at      timestamptz NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_parts_request_number UNIQUE (tenant_id, request_number)
);

CREATE INDEX idx_parts_requests_tenant ON public.parts_requests(tenant_id);
CREATE INDEX idx_parts_requests_job ON public.parts_requests(job_card_id);
CREATE INDEX idx_parts_requests_status ON public.parts_requests(tenant_id, status);
CREATE INDEX idx_parts_requests_handler ON public.parts_requests(handled_by) WHERE handled_by IS NOT NULL;

CREATE TRIGGER parts_requests_updated_at
  BEFORE UPDATE ON public.parts_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.parts_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pr_select" ON public.parts_requests FOR SELECT USING (tenant_id = public.get_tenant_id());
CREATE POLICY "pr_insert" ON public.parts_requests FOR INSERT WITH CHECK (tenant_id = public.get_tenant_id());
CREATE POLICY "pr_update" ON public.parts_requests FOR UPDATE USING (tenant_id = public.get_tenant_id());

-- ============================================================
-- PARTS REQUEST ITEMS
-- ============================================================
CREATE TABLE public.parts_request_items (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  parts_request_id  uuid NOT NULL REFERENCES public.parts_requests(id) ON DELETE CASCADE,
  part_id           uuid NOT NULL REFERENCES public.parts(id),
  part_name         text NOT NULL,
  part_number       text,
  quantity          integer NOT NULL CHECK (quantity > 0),
  available         boolean,
  picked            boolean NOT NULL DEFAULT false,
  issued            boolean NOT NULL DEFAULT false,
  scanned_barcode   text,
  warehouse_id      uuid REFERENCES public.warehouses(id),
  bin_location      text,
  notes             text,
  created_at        timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_pri_request ON public.parts_request_items(parts_request_id);
CREATE INDEX idx_pri_part ON public.parts_request_items(part_id);

ALTER TABLE public.parts_request_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pri_select" ON public.parts_request_items FOR SELECT USING (tenant_id = public.get_tenant_id());
CREATE POLICY "pri_insert" ON public.parts_request_items FOR INSERT WITH CHECK (tenant_id = public.get_tenant_id());
CREATE POLICY "pri_update" ON public.parts_request_items FOR UPDATE USING (tenant_id = public.get_tenant_id());

-- ============================================================
-- PURCHASE REQUESTS (triggered when parts unavailable)
-- ============================================================
CREATE TABLE public.purchase_requests (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  pr_number           text NOT NULL,
  parts_request_id    uuid REFERENCES public.parts_requests(id),
  job_card_id         uuid NOT NULL REFERENCES public.job_cards(id),
  requested_by        uuid NOT NULL REFERENCES public.users(id),
  status              text NOT NULL DEFAULT 'draft'
                      CHECK (status IN ('draft', 'pending_approval', 'approved', 'rejected', 'ordered', 'partial_received', 'received', 'cancelled')),
  estimated_cost      numeric(12,2) NOT NULL DEFAULT 0,
  approval_threshold  numeric(12,2),
  approved_by         uuid REFERENCES public.users(id),
  approved_at         timestamptz,
  approved_via        text CHECK (approved_via IN ('app', 'whatsapp')),
  rejected_by         uuid REFERENCES public.users(id),
  rejected_at         timestamptz,
  rejection_reason    text,
  vendor_id           uuid REFERENCES public.vendors(id),
  purchase_order_id   uuid REFERENCES public.purchase_orders(id),
  expected_delivery   date,
  received_at         timestamptz,
  received_by         uuid REFERENCES public.users(id),
  notes               text,
  created_at          timestamptz NOT NULL DEFAULT NOW(),
  updated_at          timestamptz NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_purchase_request_number UNIQUE (tenant_id, pr_number)
);

CREATE INDEX idx_purchase_requests_tenant ON public.purchase_requests(tenant_id);
CREATE INDEX idx_purchase_requests_status ON public.purchase_requests(tenant_id, status);
CREATE INDEX idx_purchase_requests_job ON public.purchase_requests(job_card_id);

CREATE TRIGGER purchase_requests_updated_at
  BEFORE UPDATE ON public.purchase_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.purchase_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "purchreq_select" ON public.purchase_requests FOR SELECT USING (tenant_id = public.get_tenant_id());
CREATE POLICY "purchreq_insert" ON public.purchase_requests FOR INSERT WITH CHECK (tenant_id = public.get_tenant_id());
CREATE POLICY "purchreq_update" ON public.purchase_requests FOR UPDATE USING (tenant_id = public.get_tenant_id());

-- ============================================================
-- PURCHASE REQUEST ITEMS
-- ============================================================
CREATE TABLE public.purchase_request_items (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  purchase_request_id   uuid NOT NULL REFERENCES public.purchase_requests(id) ON DELETE CASCADE,
  part_id               uuid NOT NULL REFERENCES public.parts(id),
  part_name             text NOT NULL,
  part_number           text,
  quantity              integer NOT NULL CHECK (quantity > 0),
  estimated_unit_cost   numeric(10,2),
  received_quantity     integer NOT NULL DEFAULT 0,
  notes                 text,
  created_at            timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_purchreq_items_request ON public.purchase_request_items(purchase_request_id);

ALTER TABLE public.purchase_request_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "purchreqi_select" ON public.purchase_request_items FOR SELECT USING (tenant_id = public.get_tenant_id());
CREATE POLICY "purchreqi_insert" ON public.purchase_request_items FOR INSERT WITH CHECK (tenant_id = public.get_tenant_id());
CREATE POLICY "purchreqi_update" ON public.purchase_request_items FOR UPDATE USING (tenant_id = public.get_tenant_id());

-- ============================================================
-- PUT-AWAY TASKS (stock replenishment after goods receipt)
-- ============================================================
CREATE TABLE public.putaway_tasks (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  task_number           text NOT NULL,
  purchase_order_id     uuid REFERENCES public.purchase_orders(id),
  purchase_request_id   uuid REFERENCES public.purchase_requests(id),
  warehouse_id          uuid NOT NULL REFERENCES public.warehouses(id),
  assigned_to           uuid REFERENCES public.users(id),
  status                text NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'in_progress', 'completed')),
  target_sla            timestamptz,
  started_at            timestamptz,
  completed_at          timestamptz,
  created_at            timestamptz NOT NULL DEFAULT NOW(),
  updated_at            timestamptz NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_putaway_task_number UNIQUE (tenant_id, task_number)
);

CREATE INDEX idx_putaway_tasks_tenant ON public.putaway_tasks(tenant_id);
CREATE INDEX idx_putaway_tasks_status ON public.putaway_tasks(tenant_id, status);

CREATE TRIGGER putaway_tasks_updated_at
  BEFORE UPDATE ON public.putaway_tasks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.putaway_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pt_select" ON public.putaway_tasks FOR SELECT USING (tenant_id = public.get_tenant_id());
CREATE POLICY "pt_insert" ON public.putaway_tasks FOR INSERT WITH CHECK (tenant_id = public.get_tenant_id());
CREATE POLICY "pt_update" ON public.putaway_tasks FOR UPDATE USING (tenant_id = public.get_tenant_id());

-- ============================================================
-- PUT-AWAY TASK ITEMS
-- ============================================================
CREATE TABLE public.putaway_task_items (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  putaway_task_id   uuid NOT NULL REFERENCES public.putaway_tasks(id) ON DELETE CASCADE,
  part_id           uuid NOT NULL REFERENCES public.parts(id),
  quantity          integer NOT NULL CHECK (quantity > 0),
  suggested_location text,
  actual_location   text,
  reserved_job_card uuid REFERENCES public.job_cards(id),
  scanned_barcode   text,
  placed            boolean NOT NULL DEFAULT false,
  created_at        timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_putaway_items_task ON public.putaway_task_items(putaway_task_id);

ALTER TABLE public.putaway_task_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pti_select" ON public.putaway_task_items FOR SELECT USING (tenant_id = public.get_tenant_id());
CREATE POLICY "pti_insert" ON public.putaway_task_items FOR INSERT WITH CHECK (tenant_id = public.get_tenant_id());
CREATE POLICY "pti_update" ON public.putaway_task_items FOR UPDATE USING (tenant_id = public.get_tenant_id());

-- ============================================================
-- SEQUENCE GENERATORS
-- ============================================================
CREATE OR REPLACE FUNCTION public.generate_parts_request_number(p_tenant_id uuid)
RETURNS text LANGUAGE plpgsql AS $$
DECLARE next_num integer;
BEGIN
  SELECT COALESCE(MAX(
    CAST(NULLIF(regexp_replace(request_number, '[^0-9]', '', 'g'), '') AS integer)
  ), 0) + 1 INTO next_num
  FROM public.parts_requests WHERE tenant_id = p_tenant_id;
  RETURN 'REQ-' || LPAD(next_num::text, 5, '0');
END; $$;

CREATE OR REPLACE FUNCTION public.generate_purchase_request_number(p_tenant_id uuid)
RETURNS text LANGUAGE plpgsql AS $$
DECLARE next_num integer;
BEGIN
  SELECT COALESCE(MAX(
    CAST(NULLIF(regexp_replace(pr_number, '[^0-9]', '', 'g'), '') AS integer)
  ), 0) + 1 INTO next_num
  FROM public.purchase_requests WHERE tenant_id = p_tenant_id;
  RETURN 'PR-' || LPAD(next_num::text, 5, '0');
END; $$;

CREATE OR REPLACE FUNCTION public.generate_putaway_task_number(p_tenant_id uuid)
RETURNS text LANGUAGE plpgsql AS $$
DECLARE next_num integer;
BEGIN
  SELECT COALESCE(MAX(
    CAST(NULLIF(regexp_replace(task_number, '[^0-9]', '', 'g'), '') AS integer)
  ), 0) + 1 INTO next_num
  FROM public.putaway_tasks WHERE tenant_id = p_tenant_id;
  RETURN 'PA-' || LPAD(next_num::text, 5, '0');
END; $$;
