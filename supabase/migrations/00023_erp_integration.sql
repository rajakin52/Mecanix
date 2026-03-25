-- ══════════════════════════════════════════════════════════════
-- ERP Integration (Primavera V10 / Jasmin / SAF-T)
-- ══════════════════════════════════════════════════════════════

-- Tenant ERP connection configuration
CREATE TABLE public.erp_connections (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,

  -- Provider
  provider        text NOT NULL DEFAULT 'primavera_v10'
                  CHECK (provider IN ('primavera_v10', 'primavera_jasmin', 'saft_export', 'none')),
  is_active       boolean NOT NULL DEFAULT false,

  -- Connection details
  base_url        text,                          -- TLBS API URL
  company_code    text,                          -- Primavera company/database
  username        text,                          -- Encrypted at app level
  password        text,                          -- Encrypted at app level
  instance_name   text DEFAULT 'Default',

  -- Document series
  invoice_series  text DEFAULT 'MEC',            -- Series for FT documents
  credit_note_series text DEFAULT 'MEC',         -- Series for NC documents
  receipt_series  text DEFAULT 'MEC',            -- Series for RE documents

  -- Tax mapping (MECANIX tax code → Primavera CodIva)
  tax_mapping     jsonb NOT NULL DEFAULT '{
    "standard": "NOR",
    "reduced": "RED",
    "intermediate": "INT",
    "exempt": "ISE"
  }',

  -- Currency
  base_currency   text DEFAULT 'AOA',
  auto_exchange_rate boolean DEFAULT false,

  -- Sync settings
  auto_export_invoices boolean DEFAULT false,     -- Auto-export on invoice creation
  auto_export_payments boolean DEFAULT false,     -- Auto-export on payment receipt
  sync_customers  boolean DEFAULT true,           -- Sync customer master data
  sync_articles   boolean DEFAULT true,           -- Sync article/service master data

  -- Default article codes for MECANIX services
  default_labour_article text DEFAULT 'SRV-MO',  -- Labour article code in Primavera
  default_parts_article  text DEFAULT 'SRV-PC',  -- Parts article code in Primavera

  created_at      timestamptz NOT NULL DEFAULT NOW(),
  updated_at      timestamptz NOT NULL DEFAULT NOW(),
  created_by      uuid REFERENCES public.users(id)
);

CREATE UNIQUE INDEX idx_erp_connections_tenant ON public.erp_connections(tenant_id);

CREATE TRIGGER erp_connections_updated_at
  BEFORE UPDATE ON public.erp_connections
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.erp_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "erp_connections_select" ON public.erp_connections
  FOR SELECT USING (tenant_id = public.get_tenant_id());
CREATE POLICY "erp_connections_insert" ON public.erp_connections
  FOR INSERT WITH CHECK (tenant_id = public.get_tenant_id());
CREATE POLICY "erp_connections_update" ON public.erp_connections
  FOR UPDATE USING (tenant_id = public.get_tenant_id());

-- ──────────────────────────────────────────────────────────────
-- Export log — tracks every document exported to ERP
-- ──────────────────────────────────────────────────────────────

CREATE TABLE public.erp_export_log (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,

  -- What we're exporting
  document_type   text NOT NULL CHECK (document_type IN ('invoice', 'credit_note', 'payment')),
  mecanix_id      uuid NOT NULL,                 -- invoice.id, credit_note.id, etc.
  mecanix_ref     text,                          -- Invoice number for display

  -- ERP response
  erp_provider    text NOT NULL,
  erp_doc_number  text,                          -- Primavera-assigned: "FT MEC/2026/00001"
  erp_doc_id      text,                          -- Primavera internal ID

  -- Status
  status          text NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'processing', 'exported', 'failed', 'skipped')),
  error_message   text,
  retry_count     integer DEFAULT 0,
  max_retries     integer DEFAULT 3,

  -- Timestamps
  queued_at       timestamptz DEFAULT NOW(),
  processed_at    timestamptz,
  exported_at     timestamptz,

  created_at      timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_erp_export_log_tenant ON public.erp_export_log(tenant_id);
CREATE INDEX idx_erp_export_log_status ON public.erp_export_log(tenant_id, status);
CREATE INDEX idx_erp_export_log_document ON public.erp_export_log(mecanix_id);
-- Idempotency: one export per document
CREATE UNIQUE INDEX idx_erp_export_log_unique ON public.erp_export_log(tenant_id, document_type, mecanix_id)
  WHERE status != 'failed';

ALTER TABLE public.erp_export_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "erp_export_log_select" ON public.erp_export_log
  FOR SELECT USING (tenant_id = public.get_tenant_id());
CREATE POLICY "erp_export_log_insert" ON public.erp_export_log
  FOR INSERT WITH CHECK (tenant_id = public.get_tenant_id());
CREATE POLICY "erp_export_log_update" ON public.erp_export_log
  FOR UPDATE USING (tenant_id = public.get_tenant_id());
