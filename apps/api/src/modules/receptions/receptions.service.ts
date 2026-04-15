import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

interface CreateReceptionInput {
  jobCardId: string;
  vehicleId: string;
  odometerKm: number;
  fuelLevel: string;
  keyType?: string;
  keysReceived?: number;
  reportedIssues?: string;
  symptomCodes?: string[];
  damagePoints?: Array<{
    bodyZone: string;
    damageType: string;
    severity: string;
    diagramView?: string;
    coordinateX?: number;
    coordinateY?: number;
    note?: string;
  }>;
  checklistItems?: Array<{
    category: string;
    itemCode?: string;
    itemLabel: string;
    status: string;
    detail?: string;
  }>;
  signatureData?: string;
  signatureMethod?: string;
  signedByName?: string;
}

@Injectable()
export class ReceptionsService {
  constructor(private readonly supabase: SupabaseService) {}

  async create(tenantId: string, userId: string, input: CreateReceptionInput) {
    const client = this.supabase.getClient();

    // Only one reception per job card
    const { data: existing } = await client
      .from('vehicle_receptions')
      .select('id')
      .eq('job_card_id', input.jobCardId)
      .eq('tenant_id', tenantId)
      .maybeSingle();

    if (existing) {
      throw new BadRequestException('A vehicle reception already exists for this job card.');
    }

    // Validate mileage >= vehicle's last recorded
    const { data: vehicle } = await client
      .from('vehicles')
      .select('mileage')
      .eq('id', input.vehicleId)
      .eq('tenant_id', tenantId)
      .single();

    if (vehicle?.mileage != null && input.odometerKm < Number(vehicle.mileage)) {
      throw new BadRequestException(
        `Odometer (${input.odometerKm} km) cannot be lower than last recorded (${vehicle.mileage} km).`,
      );
    }

    // Create the reception
    const { data: reception, error } = await client
      .from('vehicle_receptions')
      .insert({
        tenant_id: tenantId,
        job_card_id: input.jobCardId,
        vehicle_id: input.vehicleId,
        odometer_km: input.odometerKm,
        fuel_level: input.fuelLevel,
        key_type: input.keyType ?? null,
        keys_received: input.keysReceived ?? 1,
        reported_issues: input.reportedIssues ?? null,
        symptom_codes: input.symptomCodes ?? [],
        signature_data: input.signatureData ?? null,
        signature_method: input.signatureData ? (input.signatureMethod ?? 'digital') : null,
        signed_at: input.signatureData ? new Date().toISOString() : null,
        signed_by_name: input.signedByName ?? null,
        received_by: userId,
        completed: !!input.signatureData,
      })
      .select()
      .single();

    if (error) throw error;

    // Insert damage points
    if (input.damagePoints && input.damagePoints.length > 0) {
      const points = input.damagePoints.map((dp, i) => ({
        tenant_id: tenantId,
        reception_id: reception.id,
        body_zone: dp.bodyZone,
        damage_type: dp.damageType,
        severity: dp.severity,
        diagram_view: dp.diagramView ?? 'top',
        coordinate_x: dp.coordinateX ?? null,
        coordinate_y: dp.coordinateY ?? null,
        note: dp.note ?? null,
        sort_order: i,
      }));
      await client.from('reception_damage_points').insert(points);
    }

    // Insert checklist items
    if (input.checklistItems && input.checklistItems.length > 0) {
      const items = input.checklistItems.map((ci, i) => ({
        tenant_id: tenantId,
        reception_id: reception.id,
        category: ci.category,
        item_code: ci.itemCode ?? null,
        item_label: ci.itemLabel,
        status: ci.status,
        detail: ci.detail ?? null,
        sort_order: i,
      }));
      await client.from('reception_checklist_items').insert(items);
    }

    // Update vehicle mileage
    await client
      .from('vehicles')
      .update({ mileage: input.odometerKm, updated_by: userId })
      .eq('id', input.vehicleId)
      .eq('tenant_id', tenantId);

    // Link reception to job card
    await client
      .from('job_cards')
      .update({ reception_id: reception.id })
      .eq('id', input.jobCardId)
      .eq('tenant_id', tenantId);

    return reception;
  }

  async getByJobCard(tenantId: string, jobCardId: string) {
    const client = this.supabase.getClient();

    const { data: reception, error } = await client
      .from('vehicle_receptions')
      .select('*')
      .eq('job_card_id', jobCardId)
      .eq('tenant_id', tenantId)
      .maybeSingle();

    if (error) throw error;
    if (!reception) return null;

    // Fetch related data
    const [{ data: damagePoints }, { data: photos }, { data: checklist }] = await Promise.all([
      client
        .from('reception_damage_points')
        .select('*')
        .eq('reception_id', reception.id)
        .order('sort_order'),
      client
        .from('reception_photos')
        .select('*')
        .eq('reception_id', reception.id)
        .order('sort_order'),
      client
        .from('reception_checklist_items')
        .select('*')
        .eq('reception_id', reception.id)
        .order('sort_order'),
    ]);

    return {
      ...reception,
      damage_points: damagePoints ?? [],
      photos: photos ?? [],
      checklist_items: checklist ?? [],
    };
  }

  async getById(tenantId: string, id: string) {
    const client = this.supabase.getClient();

    const { data, error } = await client
      .from('vehicle_receptions')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single();

    if (error || !data) throw new NotFoundException('Reception not found');
    return data;
  }

  async update(tenantId: string, id: string, input: Partial<CreateReceptionInput>) {
    const client = this.supabase.getClient();
    await this.getById(tenantId, id);

    const updateData: Record<string, unknown> = {};
    if (input.odometerKm !== undefined) updateData.odometer_km = input.odometerKm;
    if (input.fuelLevel !== undefined) updateData.fuel_level = input.fuelLevel;
    if (input.keyType !== undefined) updateData.key_type = input.keyType;
    if (input.keysReceived !== undefined) updateData.keys_received = input.keysReceived;
    if (input.reportedIssues !== undefined) updateData.reported_issues = input.reportedIssues;
    if (input.symptomCodes !== undefined) updateData.symptom_codes = input.symptomCodes;

    const { data, error } = await client
      .from('vehicle_receptions')
      .update(updateData)
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  // ── Damage Points ──

  async addDamagePoint(tenantId: string, receptionId: string, input: {
    bodyZone: string; damageType: string; severity: string;
    diagramView?: string; coordinateX?: number; coordinateY?: number; note?: string;
  }) {
    await this.getById(tenantId, receptionId);

    const { data, error } = await this.supabase.getClient()
      .from('reception_damage_points')
      .insert({
        tenant_id: tenantId,
        reception_id: receptionId,
        body_zone: input.bodyZone,
        damage_type: input.damageType,
        severity: input.severity,
        diagram_view: input.diagramView ?? 'top',
        coordinate_x: input.coordinateX ?? null,
        coordinate_y: input.coordinateY ?? null,
        note: input.note ?? null,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async removeDamagePoint(tenantId: string, receptionId: string, pointId: string) {
    const { error } = await this.supabase.getClient()
      .from('reception_damage_points')
      .delete()
      .eq('id', pointId)
      .eq('reception_id', receptionId)
      .eq('tenant_id', tenantId);

    if (error) throw error;
    return { deleted: true };
  }

  // ── Checklist Items ──

  async saveChecklist(tenantId: string, receptionId: string, items: Array<{
    category: string; itemCode?: string; itemLabel: string; status: string; detail?: string;
  }>) {
    const client = this.supabase.getClient();
    await this.getById(tenantId, receptionId);

    // Replace all checklist items
    await client.from('reception_checklist_items')
      .delete()
      .eq('reception_id', receptionId)
      .eq('tenant_id', tenantId);

    if (items.length > 0) {
      const rows = items.map((ci, i) => ({
        tenant_id: tenantId,
        reception_id: receptionId,
        category: ci.category,
        item_code: ci.itemCode ?? null,
        item_label: ci.itemLabel,
        status: ci.status,
        detail: ci.detail ?? null,
        sort_order: i,
      }));
      await client.from('reception_checklist_items').insert(rows);
    }

    return { saved: items.length };
  }

  // ── Signature ──

  async sign(tenantId: string, receptionId: string, input: {
    signatureData: string; signatureMethod?: string; signedByName?: string;
  }) {
    const client = this.supabase.getClient();
    await this.getById(tenantId, receptionId);

    const { data, error } = await client
      .from('vehicle_receptions')
      .update({
        signature_data: input.signatureData,
        signature_method: input.signatureMethod ?? 'digital',
        signed_at: new Date().toISOString(),
        signed_by_name: input.signedByName ?? null,
        completed: true,
      })
      .eq('id', receptionId)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  // ── Complete ──

  async complete(tenantId: string, receptionId: string) {
    const reception = await this.getById(tenantId, receptionId);

    // Validate mandatory fields
    if (!reception.odometer_km) throw new BadRequestException('Odometer reading is required');
    if (!reception.fuel_level) throw new BadRequestException('Fuel level is required');

    const { data, error } = await this.supabase.getClient()
      .from('vehicle_receptions')
      .update({ completed: true })
      .eq('id', receptionId)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Check if a completed reception exists for a job card.
   * Used by the inspection gate.
   */
  async hasReception(tenantId: string, jobCardId: string): Promise<boolean> {
    const { count, error } = await this.supabase.getClient()
      .from('vehicle_receptions')
      .select('id', { count: 'exact', head: true })
      .eq('job_card_id', jobCardId)
      .eq('tenant_id', tenantId);

    if (error) throw error;
    return (count ?? 0) > 0;
  }
}
