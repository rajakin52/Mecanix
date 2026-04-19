-- Tighten RLS on insurance global/shared tables.
-- These tables have no tenant_id by design (cross-tenant insurance portal).
-- Writes happen exclusively via the API with service-role (bypasses RLS).
-- Authenticated reads remain so portal pages using anon/user tokens still work.
-- Dropping the "FOR ALL" policies blocks any direct writes from anon/authenticated
-- while service-role (API) continues unaffected.

DROP POLICY IF EXISTS "insurance_companies_modify" ON public.insurance_companies;
DROP POLICY IF EXISTS "assessor_actions_modify"    ON public.assessor_actions;
DROP POLICY IF EXISTS "rate_cards_modify"          ON public.rate_cards;
DROP POLICY IF EXISTS "claim_payments_modify"      ON public.claim_payments;
