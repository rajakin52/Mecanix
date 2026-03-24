-- Corporate/Fleet Accounts
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS is_corporate boolean NOT NULL DEFAULT false;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS company_name text;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS billing_contact text;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS credit_limit numeric(12,2);
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS current_balance numeric(12,2) NOT NULL DEFAULT 0;
