-- ============================================================
-- MECANIX Core Schema
-- Multi-tenant workshop management
-- ============================================================

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- Helper: extract tenant_id from JWT
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_tenant_id()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    (current_setting('request.jwt.claims', true)::json->>'tenant_id')::uuid,
    NULL
  )
$$;

-- ============================================================
-- Helper: auto-update updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- ============================================================
-- TENANTS
-- ============================================================
CREATE TABLE public.tenants (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  slug        text NOT NULL UNIQUE,
  country     text NOT NULL CHECK (country IN ('AO', 'MZ', 'BR', 'PT')),
  currency    text NOT NULL CHECK (currency IN ('AOA', 'MZN', 'BRL', 'EUR')),
  timezone    text NOT NULL DEFAULT 'UTC',
  locale      text NOT NULL DEFAULT 'pt-PT',
  phone       text,
  email       text,
  address     text,
  tax_id      text,
  logo_url    text,
  settings    jsonb NOT NULL DEFAULT '{}',
  created_at  timestamptz NOT NULL DEFAULT NOW(),
  updated_at  timestamptz NOT NULL DEFAULT NOW()
);

CREATE TRIGGER tenants_updated_at
  BEFORE UPDATE ON public.tenants
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Tenants RLS
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenants_select_own" ON public.tenants
  FOR SELECT USING (id = public.get_tenant_id());

CREATE POLICY "tenants_update_own" ON public.tenants
  FOR UPDATE USING (id = public.get_tenant_id());

-- ============================================================
-- USERS
-- ============================================================
CREATE TABLE public.users (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  auth_id     uuid NOT NULL UNIQUE,
  email       text NOT NULL,
  full_name   text NOT NULL,
  role        text NOT NULL CHECK (role IN ('owner', 'manager', 'technician', 'receptionist')),
  phone       text,
  avatar_url  text,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT NOW(),
  updated_at  timestamptz NOT NULL DEFAULT NOW(),
  created_by  uuid REFERENCES public.users(id),
  updated_by  uuid REFERENCES public.users(id)
);

CREATE INDEX idx_users_tenant ON public.users(tenant_id);
CREATE INDEX idx_users_auth ON public.users(auth_id);
CREATE INDEX idx_users_email ON public.users(tenant_id, email);

CREATE TRIGGER users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Users RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_select_own_tenant" ON public.users
  FOR SELECT USING (tenant_id = public.get_tenant_id());

CREATE POLICY "users_insert_own_tenant" ON public.users
  FOR INSERT WITH CHECK (tenant_id = public.get_tenant_id());

CREATE POLICY "users_update_own_tenant" ON public.users
  FOR UPDATE USING (tenant_id = public.get_tenant_id());

-- ============================================================
-- CUSTOMERS
-- ============================================================
CREATE TABLE public.customers (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  full_name   text NOT NULL,
  phone       text NOT NULL,
  email       text,
  tax_id      text,
  address     text,
  notes       text,
  created_at  timestamptz NOT NULL DEFAULT NOW(),
  updated_at  timestamptz NOT NULL DEFAULT NOW(),
  created_by  uuid REFERENCES public.users(id),
  updated_by  uuid REFERENCES public.users(id),
  deleted_at  timestamptz,
  deleted_by  uuid REFERENCES public.users(id)
);

CREATE INDEX idx_customers_tenant ON public.customers(tenant_id);
CREATE INDEX idx_customers_phone ON public.customers(tenant_id, phone);
CREATE INDEX idx_customers_name_trgm ON public.customers USING gin (full_name gin_trgm_ops);
CREATE INDEX idx_customers_phone_trgm ON public.customers USING gin (phone gin_trgm_ops);

CREATE TRIGGER customers_updated_at
  BEFORE UPDATE ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Customers RLS
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "customers_select_own_tenant" ON public.customers
  FOR SELECT USING (tenant_id = public.get_tenant_id());

CREATE POLICY "customers_insert_own_tenant" ON public.customers
  FOR INSERT WITH CHECK (tenant_id = public.get_tenant_id());

CREATE POLICY "customers_update_own_tenant" ON public.customers
  FOR UPDATE USING (tenant_id = public.get_tenant_id());

CREATE POLICY "customers_delete_own_tenant" ON public.customers
  FOR DELETE USING (tenant_id = public.get_tenant_id());

-- ============================================================
-- VEHICLES
-- ============================================================
CREATE TABLE public.vehicles (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  plate       text NOT NULL,
  vin         text,
  make        text NOT NULL,
  model       text NOT NULL,
  year        integer,
  color       text,
  fuel_type   text CHECK (fuel_type IN ('petrol', 'diesel', 'electric', 'hybrid', 'lpg')),
  engine_size text,
  mileage     integer,
  notes       text,
  photos      text[] NOT NULL DEFAULT '{}',
  created_at  timestamptz NOT NULL DEFAULT NOW(),
  updated_at  timestamptz NOT NULL DEFAULT NOW(),
  created_by  uuid REFERENCES public.users(id),
  updated_by  uuid REFERENCES public.users(id),
  deleted_at  timestamptz,
  deleted_by  uuid REFERENCES public.users(id),

  CONSTRAINT uq_vehicles_tenant_plate UNIQUE (tenant_id, plate)
);

CREATE INDEX idx_vehicles_tenant ON public.vehicles(tenant_id);
CREATE INDEX idx_vehicles_customer ON public.vehicles(tenant_id, customer_id);
CREATE INDEX idx_vehicles_plate ON public.vehicles(tenant_id, plate);
CREATE INDEX idx_vehicles_plate_trgm ON public.vehicles USING gin (plate gin_trgm_ops);

CREATE TRIGGER vehicles_updated_at
  BEFORE UPDATE ON public.vehicles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Vehicles RLS
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "vehicles_select_own_tenant" ON public.vehicles
  FOR SELECT USING (tenant_id = public.get_tenant_id());

CREATE POLICY "vehicles_insert_own_tenant" ON public.vehicles
  FOR INSERT WITH CHECK (tenant_id = public.get_tenant_id());

CREATE POLICY "vehicles_update_own_tenant" ON public.vehicles
  FOR UPDATE USING (tenant_id = public.get_tenant_id());

CREATE POLICY "vehicles_delete_own_tenant" ON public.vehicles
  FOR DELETE USING (tenant_id = public.get_tenant_id());
