import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class TecDocService {
  private readonly apiKey: string;
  private readonly apiUrl = 'https://webservice.tecalliance.services/pegasus-3-0/services/TecdocToCatDLB.jsonEndpoint';

  constructor(private readonly config: ConfigService) {
    this.apiKey = this.config.get<string>('TECDOC_API_KEY', '');
  }

  async searchByVehicle(make: string, model: string, year?: number) {
    if (!this.apiKey) {
      return this.getMockParts(make, model);
    }

    try {
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          getArticles: {
            provider: this.apiKey,
            searchQuery: `${make} ${model}`,
            searchType: 10,
            perPage: 20,
            page: 1,
          },
        }),
      });
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('TecDoc API error:', error);
      return this.getMockParts(make, model);
    }
  }

  async searchByPartNumber(partNumber: string) {
    if (!this.apiKey) {
      return [{
        partNumber,
        description: `Part ${partNumber}`,
        brand: 'Generic',
        price: null,
      }];
    }
    // Real API call here
    return [];
  }

  async getVehicleTypes(make: string) {
    if (!this.apiKey) {
      return this.getMockVehicleTypes(make);
    }
    return [];
  }

  private getMockParts(make: string, model: string) {
    const commonParts = [
      { partNumber: 'OC-47', description: 'Oil Filter', brand: 'Mahle', category: 'Filters', avgPrice: 1500 },
      { partNumber: 'LA-181', description: 'Air Filter', brand: 'Mahle', category: 'Filters', avgPrice: 2500 },
      { partNumber: 'LX-1780', description: 'Air Filter Element', brand: 'Mahle', category: 'Filters', avgPrice: 3200 },
      { partNumber: 'BP-1234', description: 'Brake Pad Set (Front)', brand: 'TRW', category: 'Brakes', avgPrice: 8500 },
      { partNumber: 'BP-5678', description: 'Brake Pad Set (Rear)', brand: 'TRW', category: 'Brakes', avgPrice: 7500 },
      { partNumber: 'BD-9012', description: 'Brake Disc (Front)', brand: 'Brembo', category: 'Brakes', avgPrice: 12000 },
      { partNumber: 'SP-3456', description: 'Spark Plug Set', brand: 'NGK', category: 'Ignition', avgPrice: 4500 },
      { partNumber: 'TB-7890', description: 'Timing Belt Kit', brand: 'Gates', category: 'Engine', avgPrice: 25000 },
      { partNumber: 'WP-2345', description: 'Water Pump', brand: 'SKF', category: 'Cooling', avgPrice: 18000 },
      { partNumber: 'CB-6789', description: 'Serpentine Belt', brand: 'Continental', category: 'Engine', avgPrice: 5500 },
    ];
    return commonParts.map(p => ({ ...p, vehicle: `${make} ${model}` }));
  }

  private getMockVehicleTypes(make: string) {
    const types: Record<string, string[]> = {
      Toyota: ['Hilux', 'Corolla', 'Land Cruiser', 'RAV4', 'Fortuner', 'Yaris', 'Prado'],
      Nissan: ['Navara', 'Patrol', 'X-Trail', 'Frontier', 'Qashqai'],
      Mitsubishi: ['L200', 'Pajero', 'Outlander', 'ASX'],
      Honda: ['Civic', 'CR-V', 'HR-V', 'Accord', 'Fit'],
      Hyundai: ['Tucson', 'Creta', 'i20', 'Santa Fe', 'Elantra'],
      Kia: ['Sportage', 'Seltos', 'Picanto', 'Sorento'],
      Ford: ['Ranger', 'Everest', 'EcoSport', 'Focus'],
      Volkswagen: ['Polo', 'Tiguan', 'Amarok', 'Golf'],
      BMW: ['3 Series', '5 Series', 'X3', 'X5'],
      Mercedes: ['C-Class', 'E-Class', 'GLC', 'GLE'],
    };
    return (types[make] ?? ['Unknown']).map(model => ({ make, model }));
  }
}
