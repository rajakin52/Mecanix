-- ============================================================
-- Custom Access Token Hook
-- Injects tenant_id and user_role into JWT claims
-- ============================================================

CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  claims jsonb;
  user_tenant_id uuid;
  user_role text;
BEGIN
  claims := event->'claims';

  -- Look up tenant_id and role from users table
  SELECT u.tenant_id, u.role
  INTO user_tenant_id, user_role
  FROM public.users u
  WHERE u.auth_id = (event->>'user_id')::uuid
  LIMIT 1;

  IF user_tenant_id IS NOT NULL THEN
    claims := jsonb_set(claims, '{tenant_id}', to_jsonb(user_tenant_id::text));
    claims := jsonb_set(claims, '{user_role}', to_jsonb(user_role));
  END IF;

  event := jsonb_set(event, '{claims}', claims);
  RETURN event;
END;
$$;

-- Grant execute to supabase_auth_admin
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook TO supabase_auth_admin;

-- Ensure supabase_auth_admin can read users table for the hook
GRANT SELECT ON public.users TO supabase_auth_admin;

-- Revoke from public
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook FROM anon;
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook FROM authenticated;
