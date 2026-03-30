import { VehicleFuelType } from './enums';

export interface Vehicle {
  id: string;
  tenant_id: string;
  customer_id: string;
  plate: string;
  vin?: string;
  make: string;
  model: string;
  year?: number;
  color?: string;
  fuel_type?: VehicleFuelType;
  engine_size?: string;
  mileage?: number;
  notes?: string;
  photos: string[];
  created_at: string;
  updated_at: string;
  created_by?: string;
  updated_by?: string;
  // Joined
  customers?: { full_name: string; phone?: string } | null;
}

// DTOs use camelCase to match Zod validator schemas
export interface CreateVehicleDto {
  customerId: string;
  plate: string;
  vin: string;
  make: string;
  model: string;
  year?: number;
  color?: string;
  fuelType?: VehicleFuelType;
  engineSize?: string;
  mileage?: number;
  notes?: string;
}

export interface UpdateVehicleDto {
  customerId?: string;
  plate?: string;
  vin?: string;
  make?: string;
  model?: string;
  year?: number;
  color?: string;
  fuelType?: VehicleFuelType;
  engineSize?: string;
  mileage?: number;
  notes?: string;
}
