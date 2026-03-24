-- Dual Currency Support
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS secondary_currency text;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS exchange_rate numeric(12,4);
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS exchange_rate_updated_at timestamptz;

-- Exchange rate history
CREATE TABLE public.exchange_rates (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  from_currency   text NOT NULL,
  to_currency     text NOT NULL,
  rate            numeric(12,4) NOT NULL,
  effective_date  date NOT NULL DEFAULT CURRENT_DATE,
  created_at      timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_exchange_rates_tenant ON public.exchange_rates(tenant_id, effective_date DESC);

ALTER TABLE public.exchange_rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "exchange_rates_select" ON public.exchange_rates
  FOR SELECT USING (tenant_id = public.get_tenant_id());
CREATE POLICY "exchange_rates_insert" ON public.exchange_rates
  FOR INSERT WITH CHECK (tenant_id = public.get_tenant_id());
