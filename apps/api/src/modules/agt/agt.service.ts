import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { HashService } from './hash.service';

@Injectable()
export class AgtService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly hashService: HashService,
  ) {}

  // ── AGT Config ────────────────────────────────────────────

  async getConfig(tenantId: string) {
    const { data } = await this.supabase
      .getClient()
      .from('agt_config')
      .select('*')
      .eq('tenant_id', tenantId)
      .maybeSingle();

    return data ?? {
      environment: 'sandbox',
      software_cert_number: null,
      taxpayer_nif: null,
      company_name: null,
      auto_submit: false,
      default_series_code: 'MECANIX',
    };
  }

  async updateConfig(tenantId: string, input: Record<string, unknown>) {
    const { data: existing } = await this.supabase
      .getClient()
      .from('agt_config')
      .select('id')
      .eq('tenant_id', tenantId)
      .maybeSingle();

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (input.environment !== undefined) updates.environment = input.environment;
    if (input.softwareCertNumber !== undefined) updates.software_cert_number = input.softwareCertNumber;
    if (input.taxpayerNif !== undefined) updates.taxpayer_nif = input.taxpayerNif;
    if (input.companyName !== undefined) updates.company_name = input.companyName;
    if (input.certificatePublicKey !== undefined) updates.certificate_public_key = input.certificatePublicKey;
    if (input.certificatePrivateKey !== undefined) updates.certificate_private_key = input.certificatePrivateKey;
    if (input.autoSubmit !== undefined) updates.auto_submit = input.autoSubmit;
    if (input.defaultSeriesCode !== undefined) updates.default_series_code = input.defaultSeriesCode;

    if (existing) {
      const { data, error } = await this.supabase
        .getClient()
        .from('agt_config')
        .update(updates)
        .eq('tenant_id', tenantId)
        .select()
        .single();
      if (error) throw error;
      return data;
    } else {
      const { data, error } = await this.supabase
        .getClient()
        .from('agt_config')
        .insert({ ...updates, tenant_id: tenantId })
        .select()
        .single();
      if (error) throw error;
      return data;
    }
  }

  async generateTestKeys(tenantId: string) {
    const keys = this.hashService.generateTestKeyPair();
    await this.updateConfig(tenantId, {
      certificatePublicKey: keys.publicKey,
      certificatePrivateKey: keys.privateKey,
    });
    return { message: 'Test keys generated. Replace with AGT-issued keys for production.' };
  }

  // ── Document Series ───────────────────────────────────────

  async listSeries(tenantId: string) {
    const { data, error } = await this.supabase
      .getClient()
      .from('document_series')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('document_type')
      .order('fiscal_year', { ascending: false });

    if (error) throw error;
    return data ?? [];
  }

  async createSeries(
    tenantId: string,
    input: { documentType: string; seriesCode: string; fiscalYear?: number },
  ) {
    const fiscalYear = input.fiscalYear ?? new Date().getFullYear();

    const { data, error } = await this.supabase
      .getClient()
      .from('document_series')
      .insert({
        tenant_id: tenantId,
        document_type: input.documentType,
        series_code: input.seriesCode,
        fiscal_year: fiscalYear,
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        throw new BadRequestException(`Series ${input.seriesCode} already exists for ${input.documentType} in ${fiscalYear}`);
      }
      throw error;
    }
    return data;
  }

  async updateSeries(tenantId: string, id: string, input: { isActive?: boolean }) {
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (input.isActive !== undefined) updates.is_active = input.isActive;

    const { data, error } = await this.supabase
      .getClient()
      .from('document_series')
      .update(updates)
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async initializeDefaultSeries(tenantId: string, seriesCode?: string) {
    const config = await this.getConfig(tenantId);
    const code = seriesCode ?? (config as Record<string, unknown>).default_series_code ?? 'MECANIX';
    const year = new Date().getFullYear();
    const types = ['FT', 'FS', 'NC', 'ND', 'RE', 'FR'];

    const results = [];
    for (const docType of types) {
      try {
        const series = await this.createSeries(tenantId, {
          documentType: docType,
          seriesCode: code as string,
          fiscalYear: year,
        });
        results.push(series);
      } catch (e) {
        // Skip if already exists
        if (e instanceof BadRequestException) continue;
        throw e;
      }
    }
    return results;
  }

  // ── Hash Chain ────────────────────────────────────────────

  /**
   * Generate hash for a document and update the series' last_hash.
   */
  async generateDocumentHash(
    tenantId: string,
    documentType: string,
    invoiceDate: string,
    systemEntryDate: string,
    grossTotal: number,
  ): Promise<{
    seriesId: string;
    saftDocumentNumber: string;
    hash: string;
    shortHash: string;
    previousHash: string;
    hashControl: string;
  }> {
    const client = this.supabase.getClient();

    // Get the private key
    const config = await this.getConfig(tenantId);
    const privateKey = (config as Record<string, unknown>).certificate_private_key as string;

    if (!privateKey) {
      throw new BadRequestException(
        'No RSA private key configured. Go to Settings → AGT and generate test keys or upload AGT-issued keys.',
      );
    }

    // Get next document number atomically
    const { data: numberData, error: numError } = await client
      .rpc('next_document_number', {
        p_tenant_id: tenantId,
        p_document_type: documentType,
      });

    if (numError || !numberData || !numberData[0]) {
      throw new BadRequestException(
        `No active document series for ${documentType}. Initialize series in Settings → AGT.`,
      );
    }

    const { series_id, saft_number, next_number } = numberData[0];

    // Get the previous hash from the series
    const { data: series } = await client
      .from('document_series')
      .select('last_hash')
      .eq('id', series_id)
      .single();

    const previousHash = (series?.last_hash as string) ?? '';

    // Format systemEntryDate to remove milliseconds
    const formattedSystemDate = systemEntryDate.replace(/\.\d{3}Z?$/, '').replace('Z', '');

    // Generate hash
    const hash = this.hashService.generateHash(
      invoiceDate,
      formattedSystemDate,
      saft_number,
      grossTotal,
      previousHash,
      privateKey,
    );

    const shortHash = this.hashService.shortHash(hash);

    // Update the series with the new last_hash
    await client
      .from('document_series')
      .update({ last_hash: hash, updated_at: new Date().toISOString() })
      .eq('id', series_id);

    return {
      seriesId: series_id,
      saftDocumentNumber: saft_number,
      hash,
      shortHash,
      previousHash,
      hashControl: '1',
    };
  }
}
