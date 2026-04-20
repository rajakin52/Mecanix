import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import sharp from 'sharp';
import { SupabaseService } from '../supabase/supabase.service';
import type { CreateLinePhotoInput } from '@mecanix/validators';

async function compress(buffer: Buffer): Promise<Buffer> {
  return sharp(buffer)
    .rotate()
    .resize(1600, 1600, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 75, mozjpeg: true })
    .toBuffer();
}

@Injectable()
export class LinePhotosService {
  constructor(private readonly supabase: SupabaseService) {}

  async listForJob(tenantId: string, jobCardId: string) {
    const { data, error } = await this.supabase
      .getClient()
      .from('line_photos')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('job_card_id', jobCardId)
      .order('created_at', { ascending: true });
    if (error) throw error;
    return data ?? [];
  }

  async listForLine(
    tenantId: string,
    lineKind: 'parts' | 'labour',
    lineId: string,
  ) {
    const column = lineKind === 'parts' ? 'parts_line_id' : 'labour_line_id';
    const { data, error } = await this.supabase
      .getClient()
      .from('line_photos')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq(column, lineId)
      .order('created_at', { ascending: true });
    if (error) throw error;
    return data ?? [];
  }

  async create(
    tenantId: string,
    jobCardId: string,
    userId: string,
    input: CreateLinePhotoInput,
  ) {
    const client = this.supabase.getClient();

    // Verify the line actually belongs to this job (keeps RLS honest
    // against a spoofed partsLineId/labourLineId).
    const lineId = input.lineKind === 'parts' ? input.partsLineId! : input.labourLineId!;
    const lineTable = input.lineKind === 'parts' ? 'parts_lines' : 'labour_lines';
    const { data: line } = await client
      .from(lineTable)
      .select('id, job_card_id')
      .eq('id', lineId)
      .eq('tenant_id', tenantId)
      .single();
    if (!line || line.job_card_id !== jobCardId) {
      throw new NotFoundException('Line not found on this job');
    }

    let storageUrl = input.storageUrl ?? '';
    if (input.base64Data) {
      const base64 = input.base64Data.replace(/^data:image\/\w+;base64,/, '');
      const raw = Buffer.from(base64, 'base64');
      const buffer = await compress(raw);
      const path = `${tenantId}/${jobCardId}/line-${input.lineKind}-${lineId}-${input.snapshot}-${Date.now()}.jpg`;

      const { error: uploadError } = await client.storage
        .from('vehicle-photos')
        .upload(path, buffer, { contentType: 'image/jpeg', upsert: true });
      if (uploadError) throw uploadError;

      const { data: urlData } = client.storage.from('vehicle-photos').getPublicUrl(path);
      storageUrl = urlData.publicUrl;
    }

    if (!storageUrl) {
      throw new BadRequestException('Either base64Data or storageUrl is required');
    }

    const { data, error } = await client
      .from('line_photos')
      .insert({
        tenant_id: tenantId,
        job_card_id: jobCardId,
        line_kind: input.lineKind,
        parts_line_id: input.lineKind === 'parts' ? lineId : null,
        labour_line_id: input.lineKind === 'labour' ? lineId : null,
        snapshot: input.snapshot,
        storage_url: storageUrl,
        caption: input.caption ?? null,
        created_by: userId,
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async delete(tenantId: string, photoId: string) {
    const { error } = await this.supabase
      .getClient()
      .from('line_photos')
      .delete()
      .eq('id', photoId)
      .eq('tenant_id', tenantId);
    if (error) throw error;
    return { deleted: true };
  }
}
