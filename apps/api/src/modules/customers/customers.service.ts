import { Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import type { CreateCustomerInput, UpdateCustomerInput, PaginationInput } from '@mecanix/validators';
import { sanitizeSearch } from '../../common/utils/sanitize';

@Injectable()
export class CustomersService {
  constructor(private readonly supabase: SupabaseService) {}

  async list(tenantId: string, pagination: PaginationInput) {
    const client = this.supabase.getClient();
    const { page, pageSize, search, sortBy, sortOrder } = pagination;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = client
      .from('customers')
      .select('*', { count: 'exact' })
      .eq('tenant_id', tenantId)
      .is('deleted_at', null);

    if (search) {
      const s = sanitizeSearch(search);
      query = query.or(`full_name.ilike.%${s}%,phone.ilike.%${s}%`);
    }

    if (sortBy) {
      query = query.order(sortBy, { ascending: sortOrder === 'asc' });
    } else {
      query = query.order('created_at', { ascending: false });
    }

    const { data, count, error } = await query.range(from, to);

    if (error) throw error;

    return {
      data: data ?? [],
      meta: {
        page,
        pageSize,
        total: count ?? 0,
        totalPages: Math.ceil((count ?? 0) / pageSize),
      },
    };
  }

  async getById(tenantId: string, id: string) {
    const { data, error } = await this.supabase
      .getClient()
      .from('customers')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .single();

    if (error || !data) {
      throw new NotFoundException('Customer not found');
    }

    return data;
  }

  async create(tenantId: string, userId: string, input: CreateCustomerInput) {
    const { data, error } = await this.supabase
      .getClient()
      .from('customers')
      .insert({
        tenant_id: tenantId,
        full_name: input.fullName,
        phone: input.phone,
        whatsapp_number: input.whatsappNumber || null,
        email: input.email || null,
        tax_id: input.taxId || null,
        address: input.address || null,
        address_street: input.addressStreet || null,
        address_city: input.addressCity || null,
        address_state: input.addressState || null,
        address_postal: input.addressPostal || null,
        address_country: input.addressCountry || null,
        payment_terms: input.paymentTerms || null,
        notes: input.notes || null,
        is_corporate: input.isCorporate ?? false,
        is_account_customer: input.isAccountCustomer ?? false,
        credit_terms_days: input.creditTermsDays ?? 30,
        company_name: input.companyName || null,
        billing_contact: input.billingContact || null,
        credit_limit: input.creditLimit ?? null,
        price_group_id: input.priceGroupId || null,
        preferred_channel: input.preferredChannel ?? 'whatsapp',
        vat_captive_pct: input.vatCaptivePct ?? 0,
        withholds_service_retention: input.withholdsServiceRetention ?? false,
        created_by: userId,
        updated_by: userId,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async update(tenantId: string, id: string, userId: string, input: UpdateCustomerInput) {
    // Verify it exists and belongs to tenant
    await this.getById(tenantId, id);

    const updateData: Record<string, unknown> = { updated_by: userId };
    if (input.fullName !== undefined) updateData['full_name'] = input.fullName;
    if (input.phone !== undefined) updateData['phone'] = input.phone;
    if (input.whatsappNumber !== undefined) updateData['whatsapp_number'] = input.whatsappNumber || null;
    if (input.email !== undefined) updateData['email'] = input.email || null;
    if (input.taxId !== undefined) updateData['tax_id'] = input.taxId || null;
    if (input.address !== undefined) updateData['address'] = input.address || null;
    if (input.addressStreet !== undefined) updateData['address_street'] = input.addressStreet || null;
    if (input.addressCity !== undefined) updateData['address_city'] = input.addressCity || null;
    if (input.addressState !== undefined) updateData['address_state'] = input.addressState || null;
    if (input.addressPostal !== undefined) updateData['address_postal'] = input.addressPostal || null;
    if (input.addressCountry !== undefined) updateData['address_country'] = input.addressCountry || null;
    if (input.paymentTerms !== undefined) updateData['payment_terms'] = input.paymentTerms || null;
    if (input.notes !== undefined) updateData['notes'] = input.notes || null;
    if (input.isCorporate !== undefined) updateData['is_corporate'] = input.isCorporate;
    if (input.isAccountCustomer !== undefined) updateData['is_account_customer'] = input.isAccountCustomer;
    if (input.creditTermsDays !== undefined) updateData['credit_terms_days'] = input.creditTermsDays;
    if (input.companyName !== undefined) updateData['company_name'] = input.companyName || null;
    if (input.billingContact !== undefined) updateData['billing_contact'] = input.billingContact || null;
    if (input.creditLimit !== undefined) updateData['credit_limit'] = input.creditLimit ?? null;
    if (input.priceGroupId !== undefined) updateData['price_group_id'] = input.priceGroupId || null;
    if (input.preferredChannel !== undefined) updateData['preferred_channel'] = input.preferredChannel;
    if (input.vatCaptivePct !== undefined) updateData['vat_captive_pct'] = input.vatCaptivePct;
    if (input.withholdsServiceRetention !== undefined) updateData['withholds_service_retention'] = input.withholdsServiceRetention;

    const { data, error } = await this.supabase
      .getClient()
      .from('customers')
      .update(updateData)
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async delete(tenantId: string, id: string, userId: string) {
    await this.getById(tenantId, id);

    const { error } = await this.supabase
      .getClient()
      .from('customers')
      .update({
        deleted_at: new Date().toISOString(),
        deleted_by: userId,
      })
      .eq('id', id)
      .eq('tenant_id', tenantId);

    if (error) throw error;
    return { deleted: true };
  }

  async search(tenantId: string, query: string) {
    const { data, error } = await this.supabase
      .getClient()
      .from('customers')
      .select('id, full_name, phone, email')
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .or(`full_name.ilike.%${sanitizeSearch(query)}%,phone.ilike.%${sanitizeSearch(query)}%`)
      .limit(20);

    if (error) throw error;
    return data ?? [];
  }

  /**
   * Intake-time duplicate detector. Called from the new-customer
   * form as the receptionist types. Three signals ranked by
   * strength:
   *   - phone exact (last 9 digits normalised) — strongest
   *   - email exact (lowercased) — strong
   *   - name similarity > 0.5 via pg_trgm — weak, noisy on common
   *     first names, but catches "Joao Silva" vs "João Silva"
   *
   * Returns a deduped array with match_reason so the UI can show
   * "matches by phone" vs "matches by name".
   */
  async findDuplicates(
    tenantId: string,
    input: { phone?: string; email?: string; fullName?: string },
  ) {
    const client = this.supabase.getClient();
    const matches = new Map<
      string,
      { id: string; full_name: string; phone: string | null; email: string | null; tax_id: string | null; match_reason: string; match_score: number }
    >();

    const recordMatch = (
      row: Record<string, unknown>,
      reason: string,
      score: number,
    ) => {
      const id = row.id as string;
      const existing = matches.get(id);
      if (!existing || score > existing.match_score) {
        matches.set(id, {
          id,
          full_name: row.full_name as string,
          phone: (row.phone as string | null) ?? null,
          email: (row.email as string | null) ?? null,
          tax_id: (row.tax_id as string | null) ?? null,
          match_reason: reason,
          match_score: score,
        });
      }
    };

    // Phone: normalise to last 9 digits (handles country-code variation).
    if (input.phone) {
      const normalised = input.phone.replace(/[^0-9]/g, '').slice(-9);
      if (normalised.length >= 6) {
        const { data } = await client
          .from('customers')
          .select('id, full_name, phone, email, tax_id')
          .eq('tenant_id', tenantId)
          .is('deleted_at', null)
          .ilike('phone', `%${normalised}%`)
          .limit(10);
        for (const row of data ?? []) {
          const rowNorm = ((row.phone as string | null) ?? '').replace(/[^0-9]/g, '').slice(-9);
          if (rowNorm === normalised) {
            recordMatch(row, 'phone', 1.0);
          }
        }
      }
    }

    // Email: case-insensitive exact match.
    if (input.email) {
      const lower = input.email.trim().toLowerCase();
      if (lower.includes('@')) {
        const { data } = await client
          .from('customers')
          .select('id, full_name, phone, email, tax_id')
          .eq('tenant_id', tenantId)
          .is('deleted_at', null)
          .ilike('email', lower)
          .limit(10);
        for (const row of data ?? []) {
          recordMatch(row, 'email', 0.95);
        }
      }
    }

    // Name: trigram similarity ≥ 0.5 using a stored-proc-less raw
    // query. Supabase's REST layer doesn't expose similarity()
    // directly, so we use ilike + client-side rank as a proxy
    // anchored on first/last-name tokens. Good enough to catch
    // "João Silva" vs "Joao Silva" or "Maria Carvalho" vs "M.
    // Carvalho" without a DB function.
    if (input.fullName && input.fullName.trim().length >= 3) {
      const tokens = input.fullName
        .trim()
        .toLowerCase()
        .split(/\s+/)
        .filter((t) => t.length >= 3)
        .slice(0, 3);
      if (tokens.length > 0) {
        const { data } = await client
          .from('customers')
          .select('id, full_name, phone, email, tax_id')
          .eq('tenant_id', tenantId)
          .is('deleted_at', null)
          .or(tokens.map((t) => `full_name.ilike.%${t}%`).join(','))
          .limit(10);
        for (const row of data ?? []) {
          const rowLower = (row.full_name as string).toLowerCase();
          const hits = tokens.filter((t) => rowLower.includes(t)).length;
          const score = hits / tokens.length;
          if (score >= 0.5) {
            recordMatch(row, 'name', 0.5 + score * 0.4);
          }
        }
      }
    }

    return Array.from(matches.values()).sort((a, b) => b.match_score - a.match_score);
  }
}
