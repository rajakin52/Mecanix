-- Add contact phone for the person who drops off the vehicle
-- For corporate accounts, this is often a driver, not the account holder
ALTER TABLE public.vehicle_receptions
  ADD COLUMN IF NOT EXISTS contact_phone text;
