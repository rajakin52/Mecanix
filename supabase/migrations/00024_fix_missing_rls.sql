-- Fix tables missing Row Level Security (RLS)
-- Flagged by Supabase security linter: rls_disabled_in_public
-- These tables lack tenant_id, so we use auth-based policies

-- Insurance Companies (global lookup table)
ALTER TABLE public.insurance_companies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "insurance_companies_select" ON public.insurance_companies
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "insurance_companies_modify" ON public.insurance_companies
  FOR ALL USING (auth.role() = 'authenticated');

-- Assessor Actions (linked via claim_id, no tenant_id)
ALTER TABLE public.assessor_actions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "assessor_actions_select" ON public.assessor_actions
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "assessor_actions_modify" ON public.assessor_actions
  FOR ALL USING (auth.role() = 'authenticated');

-- Rate Cards (linked via insurance_company_id, no tenant_id)
ALTER TABLE public.rate_cards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rate_cards_select" ON public.rate_cards
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "rate_cards_modify" ON public.rate_cards
  FOR ALL USING (auth.role() = 'authenticated');

-- Claim Payments (linked via claim_id, no tenant_id)
ALTER TABLE public.claim_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "claim_payments_select" ON public.claim_payments
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "claim_payments_modify" ON public.claim_payments
  FOR ALL USING (auth.role() = 'authenticated');
