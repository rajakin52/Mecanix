import { Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { PricingService } from '../pricing/pricing.service';
import { JobsService } from '../jobs/jobs.service';
import type { CreateCatalogItemInput, UpdateCatalogItemInput } from '@mecanix/validators';

@Injectable()
export class CatalogService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly pricingService: PricingService,
    private readonly jobsService: JobsService,
  ) {}

  async list(tenantId: string, type?: string, category?: string, quickAccessOnly?: boolean, search?: string) {
    const client = this.supabase.getClient();
    let query = client
      .from('repair_catalog')
      .select('*, labour_items:repair_catalog_labour_items(*), parts_items:repair_catalog_parts_items(*)')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .order('sort_order')
      .order('name');

    if (type) query = query.eq('type', type);
    if (category) query = query.eq('category', category);
    if (quickAccessOnly) query = query.eq('quick_access', true);
    if (search) query = query.ilike('name', `%${search}%`);

    const { data, error } = await query;
    if (error) throw error;
    return data ?? [];
  }

  async getById(tenantId: string, id: string) {
    const { data, error } = await this.supabase
      .getClient()
      .from('repair_catalog')
      .select('*, labour_items:repair_catalog_labour_items(*), parts_items:repair_catalog_parts_items(*)')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single();

    if (error || !data) throw new NotFoundException('Catalog item not found');
    return data;
  }

  async create(tenantId: string, userId: string, input: CreateCatalogItemInput) {
    const client = this.supabase.getClient();

    const { data: item, error } = await client
      .from('repair_catalog')
      .insert({
        tenant_id: tenantId,
        type: input.type,
        code: input.code || null,
        name: input.name,
        description: input.description || null,
        category: input.category || null,
        vehicle_types: input.vehicleTypes || null,
        mileage_interval: input.mileageInterval || null,
        estimated_hours: input.estimatedHours || null,
        fixed_price: input.fixedPrice || null,
        quick_access: input.quickAccess ?? false,
        created_by: userId,
      })
      .select()
      .single();

    if (error) throw error;

    // Insert labour items
    if (input.labourItems?.length) {
      const { error: labourErr } = await client
        .from('repair_catalog_labour_items')
        .insert(
          input.labourItems.map((li, i) => ({
            tenant_id: tenantId,
            catalog_id: item.id,
            description: li.description,
            hours: li.hours,
            rate: li.rate,
            sort_order: i,
          })),
        );
      if (labourErr) throw labourErr;
    }

    // Insert parts items
    if (input.partsItems?.length) {
      const { error: partsErr } = await client
        .from('repair_catalog_parts_items')
        .insert(
          input.partsItems.map((pi, i) => ({
            tenant_id: tenantId,
            catalog_id: item.id,
            part_id: pi.partId || null,
            part_name: pi.partName,
            part_number: pi.partNumber || null,
            quantity: pi.quantity,
            unit_cost: pi.unitCost,
            markup_pct: pi.markupPct ?? 0,
            sort_order: i,
          })),
        );
      if (partsErr) throw partsErr;
    }

    return this.getById(tenantId, item.id);
  }

  async update(tenantId: string, id: string, input: UpdateCatalogItemInput) {
    const client = this.supabase.getClient();
    await this.getById(tenantId, id);

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (input.name !== undefined) updates.name = input.name;
    if (input.type !== undefined) updates.type = input.type;
    if (input.code !== undefined) updates.code = input.code || null;
    if (input.description !== undefined) updates.description = input.description || null;
    if (input.category !== undefined) updates.category = input.category || null;
    if (input.vehicleTypes !== undefined) updates.vehicle_types = input.vehicleTypes;
    if (input.mileageInterval !== undefined) updates.mileage_interval = input.mileageInterval;
    if (input.estimatedHours !== undefined) updates.estimated_hours = input.estimatedHours;
    if (input.fixedPrice !== undefined) updates.fixed_price = input.fixedPrice;
    if (input.quickAccess !== undefined) updates.quick_access = input.quickAccess;
    if (input.isActive !== undefined) updates.is_active = input.isActive;

    const { error } = await client
      .from('repair_catalog')
      .update(updates)
      .eq('id', id)
      .eq('tenant_id', tenantId);

    if (error) throw error;

    // Replace labour items if provided
    if (input.labourItems !== undefined) {
      await client.from('repair_catalog_labour_items').delete().eq('catalog_id', id).eq('tenant_id', tenantId);
      if (input.labourItems.length > 0) {
        await client.from('repair_catalog_labour_items').insert(
          input.labourItems.map((li, i) => ({
            tenant_id: tenantId,
            catalog_id: id,
            description: li.description,
            hours: li.hours,
            rate: li.rate,
            sort_order: i,
          })),
        );
      }
    }

    // Replace parts items if provided
    if (input.partsItems !== undefined) {
      await client.from('repair_catalog_parts_items').delete().eq('catalog_id', id).eq('tenant_id', tenantId);
      if (input.partsItems.length > 0) {
        await client.from('repair_catalog_parts_items').insert(
          input.partsItems.map((pi, i) => ({
            tenant_id: tenantId,
            catalog_id: id,
            part_id: pi.partId || null,
            part_name: pi.partName,
            part_number: pi.partNumber || null,
            quantity: pi.quantity,
            unit_cost: pi.unitCost,
            markup_pct: pi.markupPct ?? 0,
            sort_order: i,
          })),
        );
      }
    }

    return this.getById(tenantId, id);
  }

  async delete(tenantId: string, id: string) {
    const { error } = await this.supabase
      .getClient()
      .from('repair_catalog')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('tenant_id', tenantId);

    if (error) throw error;
    return { deleted: true };
  }

  async categories(tenantId: string) {
    const { data, error } = await this.supabase
      .getClient()
      .from('repair_catalog')
      .select('category')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .not('category', 'is', null);

    if (error) throw error;
    const cats = [...new Set((data ?? []).map((d) => d.category as string))].sort();
    return cats;
  }

  // Apply catalog item to a job card — creates labour + parts lines
  async applyToJob(tenantId: string, userId: string, jobCardId: string, catalogItemId: string) {
    const item = await this.getById(tenantId, catalogItemId);
    const client = this.supabase.getClient();

    // Get job's customer for pricing
    const { data: job } = await client
      .from('job_cards')
      .select('customer_id')
      .eq('id', jobCardId)
      .eq('tenant_id', tenantId)
      .single();

    // Create labour lines
    const labourItems = (item.labour_items ?? []) as Array<Record<string, unknown>>;
    for (const li of labourItems) {
      const hours = Number(li.hours) || 0;
      const rate = Number(li.rate) || 0;
      await client.from('labour_lines').insert({
        tenant_id: tenantId,
        job_card_id: jobCardId,
        description: li.description,
        hours,
        rate,
        subtotal: Math.round(hours * rate * 100) / 100,
      });
    }

    // Create parts lines with pricing
    const partsItems = (item.parts_items ?? []) as Array<Record<string, unknown>>;
    for (const pi of partsItems) {
      const qty = Number(pi.quantity) || 1;
      const unitCost = Number(pi.unit_cost) || 0;

      // Resolve markup from pricing engine
      let markupPct = Number(pi.markup_pct) || 0;
      const partCategory = (pi.part_name as string) ?? '';
      try {
        const resolved = await this.pricingService.resolveMarkup(
          tenantId,
          job?.customer_id ?? null,
          partCategory,
        );
        if (resolved.markupPct > 0) markupPct = resolved.markupPct;
      } catch { /* use catalog default */ }

      const sellPrice = Math.round(unitCost * (1 + markupPct / 100) * 100) / 100;
      const subtotal = Math.round(qty * sellPrice * 100) / 100;

      await client.from('parts_lines').insert({
        tenant_id: tenantId,
        job_card_id: jobCardId,
        part_name: pi.part_name,
        part_number: pi.part_number || null,
        part_id: pi.part_id || null,
        quantity: qty,
        unit_cost: unitCost,
        markup_pct: markupPct,
        sell_price: sellPrice,
        subtotal,
      });
    }

    // Recalculate job totals
    await this.jobsService.recalculateTotals(tenantId, jobCardId);

    return { applied: true, labourLines: labourItems.length, partsLines: partsItems.length };
  }

  /**
   * Seed default repair catalog with standard mechanical + body items.
   * Includes industry-standard timing estimates.
   */
  async seedDefaults(tenantId: string, userId: string) {
    const defaults = [
      // ── MAINTENANCE PACKAGES ──
      { type: 'maintenance_package', code: 'SVC-5K', name: '5,000km Service', category: 'Service', estimatedHours: 1.0,
        labour: [{ description: 'Oil & filter change + fluid check', hours: 1.0, rate: 0 }],
        parts: [{ partName: 'Engine Oil 5W-30 (4L)', quantity: 1 }, { partName: 'Oil Filter', quantity: 1 }] },
      { type: 'maintenance_package', code: 'SVC-10K', name: '10,000km Service', category: 'Service', estimatedHours: 1.5,
        labour: [{ description: 'Oil change + air filter + brake check + fluid top-up', hours: 1.5, rate: 0 }],
        parts: [{ partName: 'Engine Oil 5W-30 (4L)', quantity: 1 }, { partName: 'Oil Filter', quantity: 1 }, { partName: 'Air Filter', quantity: 1 }] },
      { type: 'maintenance_package', code: 'SVC-20K', name: '20,000km Service', category: 'Service', estimatedHours: 2.5,
        labour: [{ description: 'Full service: oil, filters, spark plugs, coolant, brake inspection', hours: 2.5, rate: 0 }],
        parts: [{ partName: 'Engine Oil (4L)', quantity: 1 }, { partName: 'Oil Filter', quantity: 1 }, { partName: 'Air Filter', quantity: 1 }, { partName: 'Spark Plugs (set)', quantity: 1 }, { partName: 'Cabin Filter', quantity: 1 }] },
      { type: 'maintenance_package', code: 'SVC-MAJOR', name: 'Major Service', category: 'Service', estimatedHours: 5.0,
        labour: [{ description: 'Comprehensive 50-point service with timing belt inspection', hours: 5.0, rate: 0 }],
        parts: [] },
      { type: 'maintenance_package', code: 'SVC-AC', name: 'A/C Service', category: 'HVAC', estimatedHours: 1.5,
        labour: [{ description: 'A/C regas + leak check + cabin filter', hours: 1.5, rate: 0 }],
        parts: [{ partName: 'Refrigerant R134a', quantity: 1 }, { partName: 'Cabin Filter', quantity: 1 }] },

      // ── BRAKES ──
      { type: 'standard_repair', code: 'REP-BRAKE-PAD-F', name: 'Brake Pads - Front', category: 'Brakes', estimatedHours: 1.0,
        labour: [{ description: 'Replace front brake pads', hours: 1.0, rate: 0 }],
        parts: [{ partName: 'Front Brake Pads (set)', quantity: 1 }] },
      { type: 'standard_repair', code: 'REP-BRAKE-PAD-R', name: 'Brake Pads - Rear', category: 'Brakes', estimatedHours: 1.0,
        labour: [{ description: 'Replace rear brake pads', hours: 1.0, rate: 0 }],
        parts: [{ partName: 'Rear Brake Pads (set)', quantity: 1 }] },
      { type: 'standard_repair', code: 'REP-BRAKE-DISC-F', name: 'Brake Discs + Pads - Front', category: 'Brakes', estimatedHours: 2.0,
        labour: [{ description: 'Replace front brake discs and pads', hours: 2.0, rate: 0 }],
        parts: [{ partName: 'Front Brake Discs (pair)', quantity: 1 }, { partName: 'Front Brake Pads (set)', quantity: 1 }] },
      { type: 'standard_repair', code: 'REP-BRAKE-DISC-R', name: 'Brake Discs + Pads - Rear', category: 'Brakes', estimatedHours: 2.0,
        labour: [{ description: 'Replace rear brake discs and pads', hours: 2.0, rate: 0 }],
        parts: [{ partName: 'Rear Brake Discs (pair)', quantity: 1 }, { partName: 'Rear Brake Pads (set)', quantity: 1 }] },
      { type: 'standard_repair', code: 'REP-BRAKE-FLUID', name: 'Brake Fluid Change', category: 'Brakes', estimatedHours: 0.5,
        labour: [{ description: 'Brake fluid flush and bleed', hours: 0.5, rate: 0 }],
        parts: [{ partName: 'Brake Fluid DOT4 (1L)', quantity: 1 }] },

      // ── ENGINE ──
      { type: 'standard_repair', code: 'REP-TIMING-BELT', name: 'Timing Belt Replacement', category: 'Engine', estimatedHours: 4.0,
        labour: [{ description: 'Remove and replace timing belt + tensioner', hours: 4.0, rate: 0 }],
        parts: [{ partName: 'Timing Belt Kit', quantity: 1 }] },
      { type: 'standard_repair', code: 'REP-TIMING-CHAIN', name: 'Timing Chain Replacement', category: 'Engine', estimatedHours: 6.0,
        labour: [{ description: 'Remove and replace timing chain + guides', hours: 6.0, rate: 0 }],
        parts: [{ partName: 'Timing Chain Kit', quantity: 1 }] },
      { type: 'standard_repair', code: 'REP-WATERPUMP', name: 'Water Pump Replacement', category: 'Engine', estimatedHours: 3.0,
        labour: [{ description: 'Replace water pump + coolant', hours: 3.0, rate: 0 }],
        parts: [{ partName: 'Water Pump', quantity: 1 }, { partName: 'Coolant (5L)', quantity: 1 }] },
      { type: 'standard_repair', code: 'REP-THERMOSTAT', name: 'Thermostat Replacement', category: 'Engine', estimatedHours: 1.5,
        labour: [{ description: 'Replace thermostat + coolant top-up', hours: 1.5, rate: 0 }],
        parts: [{ partName: 'Thermostat', quantity: 1 }] },
      { type: 'standard_repair', code: 'REP-INJECT-CLEAN', name: 'Injector Cleaning', category: 'Engine', estimatedHours: 2.0,
        labour: [{ description: 'Remove, clean, and test fuel injectors', hours: 2.0, rate: 0 }],
        parts: [] },
      { type: 'standard_repair', code: 'REP-HEAD-GASKET', name: 'Head Gasket Replacement', category: 'Engine', estimatedHours: 8.0,
        labour: [{ description: 'Remove cylinder head, replace gasket, reassemble', hours: 8.0, rate: 0 }],
        parts: [{ partName: 'Head Gasket Set', quantity: 1 }] },

      // ── CLUTCH & DRIVETRAIN ──
      { type: 'standard_repair', code: 'REP-CLUTCH', name: 'Clutch Replacement', category: 'Drivetrain', estimatedHours: 6.0,
        labour: [{ description: 'Remove gearbox, replace clutch kit, reassemble', hours: 6.0, rate: 0 }],
        parts: [{ partName: 'Clutch Kit (disc + pressure plate + bearing)', quantity: 1 }] },
      { type: 'standard_repair', code: 'REP-CV-BOOT', name: 'CV Boot Replacement', category: 'Drivetrain', estimatedHours: 1.5,
        labour: [{ description: 'Replace CV boot + repack grease', hours: 1.5, rate: 0 }],
        parts: [{ partName: 'CV Boot Kit', quantity: 1 }] },
      { type: 'standard_repair', code: 'REP-DRIVESHAFT', name: 'Driveshaft Replacement', category: 'Drivetrain', estimatedHours: 2.0,
        labour: [{ description: 'Replace driveshaft assembly', hours: 2.0, rate: 0 }],
        parts: [{ partName: 'Driveshaft Assembly', quantity: 1 }] },

      // ── ELECTRICAL ──
      { type: 'standard_repair', code: 'REP-BATTERY', name: 'Battery Replacement', category: 'Electrical', estimatedHours: 0.5,
        labour: [{ description: 'Replace battery + terminal clean', hours: 0.5, rate: 0 }],
        parts: [{ partName: 'Battery', quantity: 1 }] },
      { type: 'standard_repair', code: 'REP-ALTERNATOR', name: 'Alternator Replacement', category: 'Electrical', estimatedHours: 2.0,
        labour: [{ description: 'Remove and replace alternator', hours: 2.0, rate: 0 }],
        parts: [{ partName: 'Alternator', quantity: 1 }] },
      { type: 'standard_repair', code: 'REP-STARTER', name: 'Starter Motor Replacement', category: 'Electrical', estimatedHours: 1.5,
        labour: [{ description: 'Remove and replace starter motor', hours: 1.5, rate: 0 }],
        parts: [{ partName: 'Starter Motor', quantity: 1 }] },

      // ── SUSPENSION ──
      { type: 'standard_repair', code: 'REP-SHOCK-F', name: 'Shock Absorbers - Front (pair)', category: 'Suspension', estimatedHours: 2.0,
        labour: [{ description: 'Replace front shock absorbers', hours: 2.0, rate: 0 }],
        parts: [{ partName: 'Front Shock Absorbers (pair)', quantity: 1 }] },
      { type: 'standard_repair', code: 'REP-SHOCK-R', name: 'Shock Absorbers - Rear (pair)', category: 'Suspension', estimatedHours: 1.5,
        labour: [{ description: 'Replace rear shock absorbers', hours: 1.5, rate: 0 }],
        parts: [{ partName: 'Rear Shock Absorbers (pair)', quantity: 1 }] },
      { type: 'standard_repair', code: 'REP-BALLJOINT', name: 'Ball Joint Replacement', category: 'Suspension', estimatedHours: 1.5,
        labour: [{ description: 'Replace ball joint + alignment check', hours: 1.5, rate: 0 }],
        parts: [{ partName: 'Ball Joint', quantity: 1 }] },
      { type: 'standard_repair', code: 'REP-TIEROD', name: 'Tie Rod End Replacement', category: 'Suspension', estimatedHours: 1.0,
        labour: [{ description: 'Replace tie rod end + alignment', hours: 1.0, rate: 0 }],
        parts: [{ partName: 'Tie Rod End', quantity: 1 }] },
      { type: 'standard_repair', code: 'REP-WHEEL-ALIGN', name: 'Wheel Alignment', category: 'Suspension', estimatedHours: 1.0,
        labour: [{ description: 'Four-wheel alignment', hours: 1.0, rate: 0 }],
        parts: [] },
      { type: 'standard_repair', code: 'REP-WHEEL-BALANCE', name: 'Wheel Balancing (4 wheels)', category: 'Tires', estimatedHours: 0.5,
        labour: [{ description: 'Balance all four wheels', hours: 0.5, rate: 0 }],
        parts: [] },

      // ── EXHAUST ──
      { type: 'standard_repair', code: 'REP-EXHAUST-MUFFLER', name: 'Muffler/Silencer Replacement', category: 'Exhaust', estimatedHours: 1.5,
        labour: [{ description: 'Replace exhaust muffler/silencer', hours: 1.5, rate: 0 }],
        parts: [{ partName: 'Exhaust Muffler', quantity: 1 }] },
      { type: 'standard_repair', code: 'REP-CATALYTIC', name: 'Catalytic Converter Replacement', category: 'Exhaust', estimatedHours: 2.0,
        labour: [{ description: 'Replace catalytic converter', hours: 2.0, rate: 0 }],
        parts: [{ partName: 'Catalytic Converter', quantity: 1 }] },

      // ── BODY ──
      { type: 'standard_repair', code: 'REP-WIPER', name: 'Wiper Blades Replacement', category: 'Body', estimatedHours: 0.3,
        labour: [{ description: 'Replace wiper blades', hours: 0.3, rate: 0 }],
        parts: [{ partName: 'Wiper Blades (set)', quantity: 1 }] },
      { type: 'standard_repair', code: 'REP-HEADLIGHT', name: 'Headlight Bulb Replacement', category: 'Body', estimatedHours: 0.5,
        labour: [{ description: 'Replace headlight bulb', hours: 0.5, rate: 0 }],
        parts: [{ partName: 'Headlight Bulb', quantity: 1 }] },
      { type: 'standard_repair', code: 'REP-WINDSCREEN', name: 'Windscreen Replacement', category: 'Body', estimatedHours: 2.0,
        labour: [{ description: 'Remove and replace windscreen', hours: 2.0, rate: 0 }],
        parts: [{ partName: 'Windscreen', quantity: 1 }] },
      { type: 'standard_repair', code: 'REP-MIRROR', name: 'Side Mirror Replacement', category: 'Body', estimatedHours: 0.5,
        labour: [{ description: 'Replace side mirror', hours: 0.5, rate: 0 }],
        parts: [{ partName: 'Side Mirror', quantity: 1 }] },

      // ── BODY REPAIR (Collision/Paint) ──
      { type: 'standard_repair', code: 'BODY-DENT-S', name: 'Dent Repair - Small', category: 'Body Repair', estimatedHours: 2.0,
        labour: [{ description: 'Small dent removal + touch-up paint', hours: 2.0, rate: 0 }],
        parts: [] },
      { type: 'standard_repair', code: 'BODY-DENT-L', name: 'Dent Repair - Large', category: 'Body Repair', estimatedHours: 4.0,
        labour: [{ description: 'Large dent repair with filler + repaint', hours: 4.0, rate: 0 }],
        parts: [{ partName: 'Body Filler', quantity: 1 }, { partName: 'Paint (matched)', quantity: 1 }] },
      { type: 'standard_repair', code: 'BODY-SCRATCH', name: 'Scratch Repair', category: 'Body Repair', estimatedHours: 1.5,
        labour: [{ description: 'Scratch polish + touch-up', hours: 1.5, rate: 0 }],
        parts: [] },
      { type: 'standard_repair', code: 'BODY-BUMPER-F', name: 'Front Bumper Repair', category: 'Body Repair', estimatedHours: 3.0,
        labour: [{ description: 'Repair + respray front bumper', hours: 3.0, rate: 0 }],
        parts: [{ partName: 'Paint (matched)', quantity: 1 }] },
      { type: 'standard_repair', code: 'BODY-BUMPER-R', name: 'Rear Bumper Repair', category: 'Body Repair', estimatedHours: 3.0,
        labour: [{ description: 'Repair + respray rear bumper', hours: 3.0, rate: 0 }],
        parts: [{ partName: 'Paint (matched)', quantity: 1 }] },
      { type: 'standard_repair', code: 'BODY-FENDER', name: 'Fender Repair', category: 'Body Repair', estimatedHours: 4.0,
        labour: [{ description: 'Fender repair + repaint', hours: 4.0, rate: 0 }],
        parts: [{ partName: 'Body Filler', quantity: 1 }, { partName: 'Paint (matched)', quantity: 1 }] },
      { type: 'standard_repair', code: 'BODY-DOOR', name: 'Door Panel Repair', category: 'Body Repair', estimatedHours: 5.0,
        labour: [{ description: 'Door panel repair + repaint', hours: 5.0, rate: 0 }],
        parts: [{ partName: 'Paint (matched)', quantity: 1 }] },
      { type: 'standard_repair', code: 'BODY-FULL-REPAINT', name: 'Full Vehicle Respray', category: 'Body Repair', estimatedHours: 40.0,
        labour: [{ description: 'Full vehicle strip, prep, prime, and repaint', hours: 40.0, rate: 0 }],
        parts: [{ partName: 'Primer (5L)', quantity: 2 }, { partName: 'Base Coat Paint (5L)', quantity: 3 }, { partName: 'Clear Coat (5L)', quantity: 2 }] },

      // ── COOLING ──
      { type: 'standard_repair', code: 'REP-RADIATOR', name: 'Radiator Replacement', category: 'Engine', estimatedHours: 2.5,
        labour: [{ description: 'Drain coolant, replace radiator, refill', hours: 2.5, rate: 0 }],
        parts: [{ partName: 'Radiator', quantity: 1 }, { partName: 'Coolant (5L)', quantity: 1 }] },

      // ── DIAGNOSTICS ──
      { type: 'standard_repair', code: 'DIAG-GENERAL', name: 'General Diagnostic', category: 'Diagnostics', estimatedHours: 1.0,
        labour: [{ description: 'OBD scan + visual inspection + test drive', hours: 1.0, rate: 0 }],
        parts: [] },
      { type: 'standard_repair', code: 'DIAG-ELECTRICAL', name: 'Electrical Diagnostic', category: 'Diagnostics', estimatedHours: 1.5,
        labour: [{ description: 'Electrical system diagnostic + wiring check', hours: 1.5, rate: 0 }],
        parts: [] },
    ];

    let created = 0;
    for (const item of defaults) {
      try {
        await this.create(tenantId, userId, {
          type: item.type as 'maintenance_package' | 'standard_repair',
          code: item.code,
          name: item.name,
          category: item.category,
          estimatedHours: item.estimatedHours,
          quickAccess: false,
          labourItems: item.labour.map((l) => ({ description: l.description, hours: l.hours, rate: l.rate })),
          partsItems: item.parts.map((p) => ({ partName: p.partName, quantity: p.quantity, unitCost: 0, markupPct: 0 })),
        });
        created++;
      } catch {
        // Skip duplicates
      }
    }

    return { seeded: created, total: defaults.length };
  }
}
