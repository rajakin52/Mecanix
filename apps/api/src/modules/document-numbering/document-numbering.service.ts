import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import type { UpdateDocumentNumberingInput } from '@mecanix/validators';
import { DOCUMENT_NUMBERING_TYPES } from '@mecanix/validators';

@Injectable()
export class DocumentNumberingService {
  constructor(private readonly supabase: SupabaseService) {}

  async list(tenantId: string) {
    const { data, error } = await this.supabase
      .getClient()
      .from('document_numbering_config')
      .select(
        'id, document_type, prefix, padding, reset_policy, year_format, separator, current_period_key, current_number, updated_at',
      )
      .eq('tenant_id', tenantId)
      .order('document_type', { ascending: true });

    if (error) throw new BadRequestException(error.message);
    return data ?? [];
  }

  async update(tenantId: string, type: string, body: UpdateDocumentNumberingInput) {
    if (!DOCUMENT_NUMBERING_TYPES.includes(type as (typeof DOCUMENT_NUMBERING_TYPES)[number])) {
      throw new BadRequestException(`Unknown document type: ${type}`);
    }

    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (body.prefix !== undefined) patch['prefix'] = body.prefix;
    if (body.padding !== undefined) patch['padding'] = body.padding;
    if (body.resetPolicy !== undefined) patch['reset_policy'] = body.resetPolicy;
    if (body.yearFormat !== undefined) patch['year_format'] = body.yearFormat;
    if (body.separator !== undefined) patch['separator'] = body.separator;

    // Reset the period key when the policy changes — next issued number
    // will trigger a fresh period.
    if (body.resetPolicy !== undefined) {
      patch['current_period_key'] = null;
    }

    const { data, error } = await this.supabase
      .getClient()
      .from('document_numbering_config')
      .update(patch)
      .eq('tenant_id', tenantId)
      .eq('document_type', type)
      .select()
      .single();

    if (error) throw new BadRequestException(error.message);
    if (!data) throw new NotFoundException(`No numbering config for type ${type}`);
    return data;
  }

  /**
   * Preview the next number without consuming it. Pure formatting — never
   * touches `current_number`. Useful to show a live preview as the user
   * edits the format.
   */
  preview(config: {
    prefix: string;
    padding: number;
    year_format: 'none' | 'prefix' | 'embedded';
    separator: string;
    current_number: number;
    reset_policy: 'never' | 'yearly' | 'monthly';
    current_period_key?: string | null;
  }): string {
    const year = new Date().getFullYear().toString();
    const nextNum = config.reset_policy !== 'never' && !config.current_period_key
      ? 1
      : config.current_number + 1;
    const yearPart =
      config.year_format === 'none' ? '' : `${year}${config.separator}`;
    return `${config.prefix}${yearPart}${String(nextNum).padStart(config.padding, '0')}`;
  }
}
