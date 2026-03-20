export enum UserRole {
  OWNER = 'owner',
  MANAGER = 'manager',
  TECHNICIAN = 'technician',
  RECEPTIONIST = 'receptionist',
}

export enum Country {
  AO = 'AO', // Angola
  MZ = 'MZ', // Mozambique
  BR = 'BR', // Brazil
  PT = 'PT', // Portugal
}

export enum Currency {
  AOA = 'AOA',
  MZN = 'MZN',
  BRL = 'BRL',
  EUR = 'EUR',
}

export enum VehicleFuelType {
  PETROL = 'petrol',
  DIESEL = 'diesel',
  ELECTRIC = 'electric',
  HYBRID = 'hybrid',
  LPG = 'lpg',
}

export enum JobStatus {
  DRAFT = 'draft',
  AWAITING_PARTS = 'awaiting_parts',
  IN_PROGRESS = 'in_progress',
  QUALITY_CHECK = 'quality_check',
  READY = 'ready',
  DELIVERED = 'delivered',
  INVOICED = 'invoiced',
}

export enum Locale {
  PT_PT = 'pt-PT',
  PT_BR = 'pt-BR',
  EN = 'en',
}
