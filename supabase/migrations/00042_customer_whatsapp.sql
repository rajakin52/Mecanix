-- Add WhatsApp number to customers (may differ from registered phone)
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS whatsapp_number text;

COMMENT ON COLUMN public.customers.whatsapp_number IS
  'WhatsApp contact number, if different from the registered phone number';
