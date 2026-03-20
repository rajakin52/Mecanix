import { VehicleFuelType } from './enums';

export interface Vehicle {
  id: string;
  tenantId: string;
  customerId: string;
  plate: string;
  vin?: string;
  make: string;
  model: string;
  year?: number;
  color?: string;
  fuelType?: VehicleFuelType;
  engineSize?: string;
  mileage?: number;
  notes?: string;
  photos: string[];
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  updatedBy?: string;
}

export interface CreateVehicleDto {
  customerId: string;
  plate: string;
  vin?: string;
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
