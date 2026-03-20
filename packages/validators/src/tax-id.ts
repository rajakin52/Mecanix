import { z } from 'zod';

/** Angola NIF: 10 digits */
export const angolaNifSchema = z.string().regex(/^\d{10}$/, 'NIF must be 10 digits');

/** Mozambique NUIT: 9 digits */
export const mozambiqueNuitSchema = z.string().regex(/^\d{9}$/, 'NUIT must be 9 digits');

/** Brazil CPF: 11 digits */
export const brazilCpfSchema = z.string().regex(/^\d{11}$/, 'CPF must be 11 digits');

/** Brazil CNPJ: 14 digits */
export const brazilCnpjSchema = z.string().regex(/^\d{14}$/, 'CNPJ must be 14 digits');

/** Portugal NIF: 9 digits */
export const portugalNifSchema = z.string().regex(/^\d{9}$/, 'NIF must be 9 digits');

export function getTaxIdValidator(country: string) {
  switch (country) {
    case 'AO': return angolaNifSchema;
    case 'MZ': return mozambiqueNuitSchema;
    case 'BR': return brazilCpfSchema; // or CNPJ based on context
    case 'PT': return portugalNifSchema;
    default: return z.string().min(1);
  }
}
