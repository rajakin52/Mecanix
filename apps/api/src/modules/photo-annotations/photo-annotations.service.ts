import { Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

interface Annotation {
  type: 'circle' | 'arrow' | 'text' | 'rectangle';
  x: number;
  y: number;
  width?: number;
  height?: number;
  color: string;
  text?: string;
}

@Injectable()
export class PhotoAnnotationsService {
  constructor(private readonly supabase: SupabaseService) {}

  async create(
    tenantId: string,
    userId: string,
    input: {
      photoUrl: string;
      annotations: Annotation[];
      entityType: string;
      entityId: string;
    },
  ) {
    const { data, error } = await this.supabase
      .getClient()
      .from('photo_annotations')
      .insert({
        tenant_id: tenantId,
        created_by: userId,
        photo_url: input.photoUrl,
        annotations: input.annotations,
        entity_type: input.entityType,
        entity_id: input.entityId,
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async getByEntity(tenantId: string, entityType: string, entityId: string) {
    const { data, error } = await this.supabase
      .getClient()
      .from('photo_annotations')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('entity_type', entityType)
      .eq('entity_id', entityId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  }

  async update(tenantId: string, id: string, annotations: Annotation[]) {
    const { data, error } = await this.supabase
      .getClient()
      .from('photo_annotations')
      .update({ annotations })
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single();
    if (error) throw error;
    if (!data) throw new NotFoundException('Photo annotation not found');
    return data;
  }
}
