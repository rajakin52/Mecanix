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
  taxId?: string;
  logoUrl?: string;
  settings: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}
