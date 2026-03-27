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

    // Insert DVI items if provided
    if (input.dviItems && Array.isArray(input.dviItems) && input.dviItems.length > 0) {
      const items = (input.dviItems as Array<Record<string, unknown>>).map((item, i) => ({
        tenant_id: tenantId,
        inspection_id: data.id,
        name: item.name as string,
        category: (item.category as string) ?? 'general',
        status: (item.status as string) ?? 'not_inspected',
        notes: (item.notes as string) ?? null,
        recommendation: (item.recommendation as string) ?? null,
        photos: (item.photos as string[]) ?? [],
        sort_order: i,
      }));

      await client.from('inspection_items').insert(items);
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
    if (!data) return null;

    // Fetch DVI items
    const { data: dviItems } = await client
      .from('inspection_items')
      .select('*')
      .eq('inspection_id', data.id)
      .eq('tenant_id', tenantId)
      .order('sort_order');

    return { ...data, dvi_items: dviItems ?? [] };
  }

  // ── Inspection Templates ──────────────────────────────────

  async listTemplates(tenantId: string) {
    const { data, error } = await this.supabase
      .getClient()
      .from('inspection_templates')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .order('is_default', { ascending: false })
      .order('name');

    if (error) throw error;
    return data ?? [];
  }

  async createTemplate(tenantId: string, userId: string, input: Record<string, unknown>) {
    const { data, error } = await this.supabase
      .getClient()
      .from('inspection_templates')
      .insert({
        tenant_id: tenantId,
        name: input.name,
        description: input.description || null,
        type: input.type ?? 'multi_point',
        items: input.items ?? [],
        is_default: input.isDefault ?? false,
        created_by: userId,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async initializeDefaultTemplate(tenantId: string, userId: string) {
    // Check if default already exists
    const { data: existing } = await this.supabase
      .getClient()
      .from('inspection_templates')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('is_default', true)
      .maybeSingle();

    if (existing) return existing;

    const defaultItems = [
      // Brakes
      { name: 'Brake Pads - Front', category: 'brakes' },
      { name: 'Brake Pads - Rear', category: 'brakes' },
      { name: 'Brake Discs/Rotors', category: 'brakes' },
      { name: 'Brake Fluid Level', category: 'brakes' },
      { name: 'Handbrake', category: 'brakes' },
      // Engine
      { name: 'Engine Oil Level', category: 'engine' },
      { name: 'Engine Oil Condition', category: 'engine' },
      { name: 'Coolant Level', category: 'engine' },
      { name: 'Drive Belts', category: 'engine' },
      { name: 'Air Filter', category: 'engine' },
      { name: 'Battery Condition', category: 'electrical' },
      { name: 'Battery Terminals', category: 'electrical' },
      // Suspension & Steering
      { name: 'Shock Absorbers - Front', category: 'suspension' },
      { name: 'Shock Absorbers - Rear', category: 'suspension' },
      { name: 'Steering Play', category: 'suspension' },
      { name: 'CV Boots', category: 'suspension' },
      // Tires
      { name: 'Tire Condition - Front Left', category: 'tires' },
      { name: 'Tire Condition - Front Right', category: 'tires' },
      { name: 'Tire Condition - Rear Left', category: 'tires' },
      { name: 'Tire Condition - Rear Right', category: 'tires' },
      { name: 'Tire Pressure', category: 'tires' },
      { name: 'Spare Tire', category: 'tires' },
      // Lights
      { name: 'Headlights', category: 'lights' },
      { name: 'Tail Lights', category: 'lights' },
      { name: 'Brake Lights', category: 'lights' },
      { name: 'Turn Signals', category: 'lights' },
      { name: 'Dashboard Warning Lights', category: 'lights' },
      // Fluids
      { name: 'Transmission Fluid', category: 'fluids' },
      { name: 'Power Steering Fluid', category: 'fluids' },
      { name: 'Windshield Washer Fluid', category: 'fluids' },
      // Body & Interior
      { name: 'Wipers', category: 'body' },
      { name: 'Horn', category: 'body' },
      { name: 'Mirrors', category: 'body' },
      { name: 'Seat Belts', category: 'body' },
      // Exhaust
      { name: 'Exhaust System', category: 'exhaust' },
      { name: 'Exhaust Emissions', category: 'exhaust' },
      // HVAC
      { name: 'A/C System', category: 'hvac' },
      { name: 'Heater', category: 'hvac' },
      { name: 'Cabin Filter', category: 'hvac' },
    ];

    return this.createTemplate(tenantId, userId, {
      name: 'Standard Multi-Point Inspection',
      description: '38-point inspection covering brakes, engine, suspension, tires, lights, fluids, and body',
      type: 'multi_point',
      items: defaultItems,
      isDefault: true,
    });
  }

  // ── DVI Item Management ───────────────────────────────────

  async updateDviItem(tenantId: string, itemId: string, input: Record<string, unknown>) {
    const updates: Record<string, unknown> = {};
    if (input.status !== undefined) updates.status = input.status;
    if (input.notes !== undefined) updates.notes = input.notes;
    if (input.recommendation !== undefined) updates.recommendation = input.recommendation;
    if (input.photos !== undefined) updates.photos = input.photos;

    const { data, error } = await this.supabase
      .getClient()
      .from('inspection_items')
      .update(updates)
      .eq('id', itemId)
      .eq('tenant_id', tenantId)
      .select()
      .single();

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
