import { Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import type { CreateInspectionInput, UpdateInspectionInput } from '@mecanix/validators';

@Injectable()
export class InspectionsService {
  constructor(private readonly supabase: SupabaseService) {}

  async create(tenantId: string, userId: string, input: CreateInspectionInput) {
    const client = this.supabase.getClient();

    const { data, error } = await client
      .from('vehicle_inspections')
      .insert({
        tenant_id: tenantId,
        job_card_id: input.jobCardId,
        vehicle_id: input.vehicleId,
        mileage_in: input.mileageIn ?? null,
        fuel_level: input.fuelLevel ?? null,
        exterior_damage: input.exteriorDamage ?? [],
        has_spare_tire: input.hasSpareTire ?? false,
        has_jack: input.hasJack ?? false,
        has_tools: input.hasTools ?? false,
        has_radio: input.hasRadio ?? false,
        has_mats: input.hasMats ?? false,
        has_hubcaps: input.hasHubcaps ?? false,
        has_antenna: input.hasAntenna ?? false,
        has_documents: input.hasDocuments ?? false,
        personal_items: input.personalItems ?? null,
        notes: input.notes ?? null,
        customer_signature: input.customerSignature ?? null,
        created_by: userId,
      })
      .select()
      .single();

    if (error) throw error;

    // Update vehicle mileage if mileage_in is provided
    if (input.mileageIn) {
      await client
        .from('vehicles')
        .update({ mileage: input.mileageIn, updated_by: userId })
        .eq('id', input.vehicleId)
        .eq('tenant_id', tenantId);
    }

    return data;
  }

  async getByJobCard(tenantId: string, jobCardId: string) {
    const client = this.supabase.getClient();

    const { data, error } = await client
      .from('vehicle_inspections')
      .select('*')
      .eq('job_card_id', jobCardId)
      .eq('tenant_id', tenantId)
      .maybeSingle();

    if (error) throw error;

    return data;
  }

  async update(tenantId: string, id: string, userId: string, input: UpdateInspectionInput) {
    const client = this.supabase.getClient();

    // Verify it exists
    const { data: existing, error: findError } = await client
      .from('vehicle_inspections')
      .select('id, vehicle_id')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single();

    if (findError || !existing) {
      throw new NotFoundException('Inspection not found');
    }

    const updateData: Record<string, unknown> = {};

    const fieldMap: Record<string, string> = {
      mileageIn: 'mileage_in',
      fuelLevel: 'fuel_level',
      exteriorDamage: 'exterior_damage',
      hasSpareTire: 'has_spare_tire',
      hasJack: 'has_jack',
      hasTools: 'has_tools',
      hasRadio: 'has_radio',
      hasMats: 'has_mats',
      hasHubcaps: 'has_hubcaps',
      hasAntenna: 'has_antenna',
      hasDocuments: 'has_documents',
      personalItems: 'personal_items',
      notes: 'notes',
      customerSignature: 'customer_signature',
    };

    for (const [camel, snake] of Object.entries(fieldMap)) {
      if ((input as Record<string, unknown>)[camel] !== undefined) {
        updateData[snake] = (input as Record<string, unknown>)[camel] ?? null;
      }
    }

    const { data, error } = await client
      .from('vehicle_inspections')
      .update(updateData)
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error) throw error;

    // Update vehicle mileage if mileage_in is provided
    if (input.mileageIn) {
      await client
        .from('vehicles')
        .update({ mileage: input.mileageIn, updated_by: userId })
        .eq('id', existing.vehicle_id)
        .eq('tenant_id', tenantId);
    }

    return data;
  }
}
