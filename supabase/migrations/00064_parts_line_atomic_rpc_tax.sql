-- Drop the previous signature so the next migration can create the
-- new signature with p_tax_code_id + p_tax_rate defaulted parameters.
-- Supabase's migration runner parses each file as a single prepared
-- statement, so DROP and CREATE have to live in separate files.
DROP FUNCTION IF EXISTS public.create_parts_line_atomic(
  uuid, uuid, uuid, text, text, numeric, numeric, numeric, numeric, numeric, boolean, numeric, boolean
);
