import { Injectable } from '@nestjs/common';

export interface VinInfo {
  make: string;
  model: string;
  year: number | null;
  engineSize: string | null;
  fuelType: string | null;
  bodyType: string | null;
  country: string | null;
}

@Injectable()
export class VinService {
  /**
   * Decode VIN using NHTSA free API (works for most vehicles worldwide)
   */
  async decode(vin: string): Promise<VinInfo | null> {
    if (!vin || vin.length !== 17) return null;

    try {
      const res = await fetch(
        `https://vpic.nhtsa.dot.gov/api/vehicles/decodevinvalues/${vin}?format=json`,
      );
      const data = await res.json();
      const result = data.Results?.[0];

      if (!result || result.ErrorCode !== '0') {
        return this.decodeManually(vin);
      }

      return {
        make: result.Make || null,
        model: result.Model || null,
        year: result.ModelYear ? parseInt(result.ModelYear, 10) : null,
        engineSize: result.DisplacementL ? `${result.DisplacementL}L` : null,
        fuelType: result.FuelTypePrimary?.toLowerCase() || null,
        bodyType: result.BodyClass || null,
        country: result.PlantCountry || null,
      };
    } catch {
      return this.decodeManually(vin);
    }
  }

  /**
   * Basic VIN decode from the VIN structure (works offline)
   * WMI (chars 1-3) = manufacturer, VDS (4-9) = vehicle descriptor, VIS (10-17) = identifier
   */
  private decodeManually(vin: string): VinInfo | null {
    const wmi = vin.substring(0, 3).toUpperCase();
    const yearChar = vin.charAt(9);

    const manufacturers: Record<string, string> = {
      JTD: 'Toyota',
      JTE: 'Toyota',
      JTN: 'Toyota',
      JN1: 'Nissan',
      JN3: 'Nissan',
      JA3: 'Mitsubishi',
      JA4: 'Mitsubishi',
      JMB: 'Mitsubishi',
      JMY: 'Mitsubishi',
      WAU: 'Audi',
      WBA: 'BMW',
      WDB: 'Mercedes-Benz',
      WF0: 'Ford',
      WVW: 'Volkswagen',
      ZFA: 'Fiat',
      SAL: 'Land Rover',
      SAJ: 'Jaguar',
      KMH: 'Hyundai',
      KNA: 'Kia',
      '1HG': 'Honda',
      '2HG': 'Honda',
    };

    const yearCodes: Record<string, number> = {
      A: 2010,
      B: 2011,
      C: 2012,
      D: 2013,
      E: 2014,
      F: 2015,
      G: 2016,
      H: 2017,
      J: 2018,
      K: 2019,
      L: 2020,
      M: 2021,
      N: 2022,
      P: 2023,
      R: 2024,
      S: 2025,
      T: 2026,
      V: 2027,
    };

    const make = manufacturers[wmi] ?? null;
    const year = yearCodes[yearChar.toUpperCase()] ?? null;

    return {
      make: make ?? 'Unknown',
      model: 'Unknown',
      year,
      engineSize: null,
      fuelType: null,
      bodyType: null,
      country: null,
    };
  }
}
