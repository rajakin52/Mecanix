import { Country, Currency } from './enums';

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  country: Country;
  currency: Currency;
  timezone: string;
  locale: string;
  phone?: string;
  email?: string;
  address?: string;
  tax_id?: string;
  logo_url?: string;
  settings: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}
