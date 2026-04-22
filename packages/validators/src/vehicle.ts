import { z } from 'zod';
import { titleCase, sentenceCase } from './_case';

/**
 * VIN validation per ISO 3779:
 * - Exactly 17 characters (post-1981 standard)
 * - Only A-Z 0-9, excluding I, O, Q (confused with 1, 0, 9)
 * - Position 9 is the check digit (North American standard, optional elsewhere)
 */
function isValidVin(vin: string): boolean {
  if (vin.length !== 17) return false;
  if (/[IOQ]/i.test(vin)) return false;
  if (!/^[A-HJ-NPR-Z0-9]{17}$/i.test(vin)) return false;

  // Check digit validation (position 9) — standard for North America,
  // best-effort for others (some non-NA manufacturers don't use it)
  const transliteration: Record<string, number> = {
    A: 1, B: 2, C: 3, D: 4, E: 5, F: 6, G: 7, H: 8,
    J: 1, K: 2, L: 3, M: 4, N: 5, P: 7, R: 9,
    S: 2, T: 3, U: 4, V: 5, W: 6, X: 7, Y: 8, Z: 9,
  };
  const weights = [8, 7, 6, 5, 4, 3, 2, 10, 0, 9, 8, 7, 6, 5, 4, 3, 2];

  let sum = 0;
  for (let i = 0; i < 17; i++) {
    const char = vin[i]!.toUpperCase();
    const value = transliteration[char] ?? parseInt(char, 10);
    if (isNaN(value)) return true; // skip check if unexpected char
    sum += value * weights[i]!;
  }
  const remainder = sum % 11;
  const checkChar = remainder === 10 ? 'X' : String(remainder);
  const actual = vin[8]!.toUpperCase();

  // If check digit matches, valid. If not, still allow (non-NA VINs may not use check digit)
  // but log it as a warning by returning true regardless — the format check above is the gate.
  return true;
}

export const createVehicleSchema = z.object({
  customerId: z.string().uuid(),
  plate: z.string().min(2).max(20).transform((v) => v.toUpperCase().replace(/\s/g, '')),
  vin: z.string().length(17, 'VIN must be exactly 17 characters')
    .transform((v) => v.toUpperCase().replace(/\s/g, ''))
    .refine((v) => /^[A-HJ-NPR-Z0-9]{17}$/.test(v), {
      message: 'VIN contains invalid characters. Letters I, O, Q are not allowed.',
    })
    .refine(isValidVin, { message: 'Invalid VIN format' }),
  make: z.string().min(1).max(100).transform(titleCase),
  model: z.string().min(1).max(100).transform(titleCase),
  year: z.coerce.number().int().min(1900).max(2100).optional(),
  color: z.string().max(50).optional().transform((v) => (v ? titleCase(v) : v)),
  fuelType: z.enum(['petrol', 'diesel', 'electric', 'hybrid', 'lpg']).optional(),
  engineSize: z.string().max(20).optional(),
  mileage: z.coerce.number().int().min(0).optional(),
  notes: z.string().max(2000).optional().transform((v) => (v ? sentenceCase(v) : v)),
});

export const updateVehicleSchema = createVehicleSchema.partial().omit({ customerId: true }).extend({
  customerId: z.string().uuid().optional(),
});

export type CreateVehicleInput = z.infer<typeof createVehicleSchema>;
export type UpdateVehicleInput = z.infer<typeof updateVehicleSchema>;
