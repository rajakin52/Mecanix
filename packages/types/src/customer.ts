export interface Customer {
  id: string;
  tenantId: string;
  fullName: string;
  phone: string;
  email?: string;
  taxId?: string;
  address?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  updatedBy?: string;
}

export interface CreateCustomerDto {
  fullName: string;
  phone: string;
  email?: string;
  taxId?: string;
  address?: string;
  notes?: string;
}

export interface UpdateCustomerDto {
  fullName?: string;
  phone?: string;
  email?: string;
  taxId?: string;
  address?: string;
  notes?: string;
}
