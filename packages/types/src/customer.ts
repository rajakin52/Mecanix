export interface Customer {
  id: string;
  tenant_id: string;
  full_name: string;
  phone: string;
  email?: string;
  tax_id?: string;
  address?: string;
  notes?: string;
  payment_terms?: string;
  price_group_id?: string;
  is_corporate?: boolean;
  company_name?: string;
  billing_contact?: string;
  credit_limit?: number;
  current_balance?: number;
  // Materials-charge overrides (null = inherit from insurance/tenant)
  materials_rate_refinish?: number | null;
  materials_rate_body?: number | null;
  shop_supplies_pct?: number | null;
  shop_supplies_cap?: number | null;
  // Locale override for outbound comms. null → tenant.locale.
  preferred_language?: 'en' | 'pt-PT' | 'pt-BR' | null;
  created_at: string;
  updated_at: string;
  created_by?: string;
  updated_by?: string;
}

// DTOs use camelCase to match Zod validator schemas
export interface CreateCustomerDto {
  fullName: string;
  phone: string;
  email?: string;
  taxId?: string;
  address?: string;
  notes?: string;
  isCorporate?: boolean;
  companyName?: string;
  billingContact?: string;
  creditLimit?: number;
  paymentTerms?: string;
  priceGroupId?: string;
  preferredChannel?: 'email' | 'sms' | 'whatsapp' | 'phone';
}

export interface UpdateCustomerDto {
  fullName?: string;
  phone?: string;
  email?: string;
  taxId?: string;
  address?: string;
  notes?: string;
}
