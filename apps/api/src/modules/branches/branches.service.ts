import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import type {
  CreateBranchInput,
  UpdateBranchInput,
  BranchTransferInput,
} from '@mecanix/validators';

@Injectable()
export class BranchesService {
  constructor(private readonly supabase: SupabaseService) {}

  async list(tenantId: string) {
    const { data, error } = await this.supabase
      .getClient()
      .from('branches')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .order('is_default', { ascending: false })
      .order('name', { ascending: true });
    if (error) throw error;
    return data ?? [];
  }

  async getById(tenantId: string, id: string) {
    const { data, error } = await this.supabase
      .getClient()
      .from('branches')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single();
    if (error || !data) throw new NotFoundException('Branch not found');
    return data;
  }

  async listForCurrentUser(tenantId: string, userId: string) {
    const client = this.supabase.getClient();
    // Users with no user_branches rows are all-branches. Preserves
    // the current single-branch behaviour for untouched tenants.
    const { data: memberships } = await client
      .from('user_branches')
      .select('branch_id, is_primary, branch:branches(*)')
      .eq('tenant_id', tenantId)
      .eq('user_id', userId);

    if (!memberships || memberships.length === 0) {
      const branches = await this.list(tenantId);
      return { branches, primaryBranchId: branches.find((b) => b.is_default)?.id ?? null };
    }

    const branches = memberships
      .map((m) => m.branch as unknown)
      .filter(Boolean) as Array<Record<string, unknown>>;
    const primary = memberships.find((m) => m.is_primary) ?? memberships[0];
    return { branches, primaryBranchId: (primary?.branch_id as string) ?? null };
  }

  async create(tenantId: string, userId: string, input: CreateBranchInput) {
    const client = this.supabase.getClient();

    // If this is marked default, clear any other default first.
    if (input.isDefault) {
      await client
        .from('branches')
        .update({ is_default: false })
        .eq('tenant_id', tenantId)
        .eq('is_default', true);
    }

    const { data, error } = await client
      .from('branches')
      .insert({
        tenant_id: tenantId,
        name: input.name,
        code: input.code,
        address: input.address || null,
        phone: input.phone || null,
        email: input.email || null,
        is_default: input.isDefault ?? false,
        notes: input.notes || null,
        created_by: userId,
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async update(tenantId: string, id: string, input: UpdateBranchInput) {
    await this.getById(tenantId, id);
    const client = this.supabase.getClient();

    if (input.isDefault) {
      await client
        .from('branches')
        .update({ is_default: false })
        .eq('tenant_id', tenantId)
        .eq('is_default', true)
        .neq('id', id);
    }

    const patch: Record<string, unknown> = {};
    if (input.name !== undefined) patch.name = input.name;
    if (input.code !== undefined) patch.code = input.code;
    if (input.address !== undefined) patch.address = input.address || null;
    if (input.phone !== undefined) patch.phone = input.phone || null;
    if (input.email !== undefined) patch.email = input.email || null;
    if (input.isDefault !== undefined) patch.is_default = input.isDefault;
    if (input.notes !== undefined) patch.notes = input.notes || null;

    const { data, error } = await client
      .from('branches')
      .update(patch)
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async deactivate(tenantId: string, id: string) {
    const { error } = await this.supabase
      .getClient()
      .from('branches')
      .update({ is_active: false })
      .eq('id', id)
      .eq('tenant_id', tenantId);
    if (error) throw error;
    return { deactivated: true };
  }

  /**
   * Aggregate stock per branch for a single part. Sums warehouse_stock
   * rows grouped by the warehouse's branch_id so the parts detail
   * page can show "5 in Luanda, 2 in Lisbon".
   */
  async getStockByBranch(tenantId: string, partId: string) {
    const client = this.supabase.getClient();

    const { data } = await client
      .from('warehouse_stock')
      .select(
        'quantity, min_quantity, bin_location, warehouse:warehouses(id, name, code, branch_id, branch:branches(id, name, code))',
      )
      .eq('tenant_id', tenantId)
      .eq('part_id', partId);

    type WarehouseLine = {
      warehouse_id: string;
      warehouse_name: string;
      warehouse_code: string;
      bin_location: string | null;
      quantity: number;
      min_quantity: number;
    };

    const byBranch = new Map<
      string,
      {
        branch_id: string | null;
        branch_name: string;
        branch_code: string | null;
        total: number;
        warehouses: WarehouseLine[];
      }
    >();

    for (const row of data ?? []) {
      const wh = Array.isArray(row.warehouse)
        ? (row.warehouse[0] as Record<string, unknown> | undefined)
        : (row.warehouse as Record<string, unknown> | null);
      if (!wh) continue;
      const branch = wh.branch && typeof wh.branch === 'object'
        ? (Array.isArray(wh.branch) ? wh.branch[0] : wh.branch) as Record<string, unknown>
        : null;
      const branchKey = (branch?.id as string) ?? 'unassigned';
      const branchName = (branch?.name as string) ?? 'Unassigned';
      const branchCode = (branch?.code as string) ?? null;

      const group = byBranch.get(branchKey) ?? {
        branch_id: (branch?.id as string) ?? null,
        branch_name: branchName,
        branch_code: branchCode,
        total: 0,
        warehouses: [] as WarehouseLine[],
      };
      const qty = Number(row.quantity) || 0;
      group.total += qty;
      group.warehouses.push({
        warehouse_id: wh.id as string,
        warehouse_name: wh.name as string,
        warehouse_code: wh.code as string,
        bin_location: (row.bin_location as string | null) ?? null,
        quantity: qty,
        min_quantity: Number(row.min_quantity) || 0,
      });
      byBranch.set(branchKey, group);
    }

    return Array.from(byBranch.values()).sort((a, b) => b.total - a.total);
  }

  /**
   * Move stock between two warehouses. Clean audit trail via
   * inventory_adjustments so the movement shows up on the part's
   * history. Refuses same-warehouse moves and insufficient-qty
   * source warehouses.
   */
  async transferStock(tenantId: string, userId: string, input: BranchTransferInput) {
    const client = this.supabase.getClient();
    if (input.fromWarehouseId === input.toWarehouseId) {
      throw new BadRequestException('Source and destination warehouse must differ.');
    }

    // Verify both warehouses belong to this tenant and pull their
    // current levels for the given part.
    const { data: sources } = await client
      .from('warehouse_stock')
      .select('id, quantity, warehouse:warehouses!inner(id, name, tenant_id)')
      .eq('tenant_id', tenantId)
      .eq('part_id', input.partId)
      .eq('warehouse_id', input.fromWarehouseId)
      .limit(1);
    const source = (sources ?? [])[0];
    if (!source) {
      throw new BadRequestException('No stock for this part in the source warehouse.');
    }
    const sourceQty = Number(source.quantity) || 0;
    if (sourceQty < input.quantity) {
      throw new BadRequestException(
        `Source warehouse has only ${sourceQty}; cannot transfer ${input.quantity}.`,
      );
    }

    const { data: dest } = await client
      .from('warehouses')
      .select('id, name')
      .eq('id', input.toWarehouseId)
      .eq('tenant_id', tenantId)
      .single();
    if (!dest) throw new NotFoundException('Destination warehouse not found.');

    // Decrement source.
    await client
      .from('warehouse_stock')
      .update({ quantity: sourceQty - input.quantity })
      .eq('id', source.id);

    // Upsert destination row.
    const { data: destRow } = await client
      .from('warehouse_stock')
      .select('id, quantity')
      .eq('tenant_id', tenantId)
      .eq('part_id', input.partId)
      .eq('warehouse_id', input.toWarehouseId)
      .maybeSingle();
    if (destRow) {
      await client
        .from('warehouse_stock')
        .update({ quantity: (Number(destRow.quantity) || 0) + input.quantity })
        .eq('id', destRow.id);
    } else {
      await client.from('warehouse_stock').insert({
        tenant_id: tenantId,
        warehouse_id: input.toWarehouseId,
        part_id: input.partId,
        quantity: input.quantity,
      });
    }

    // Audit rows — one out, one in.
    await client.from('inventory_adjustments').insert([
      {
        tenant_id: tenantId,
        part_id: input.partId,
        quantity_change: -input.quantity,
        reason: `Transfer out to ${(dest as { name: string }).name}${input.notes ? ` — ${input.notes}` : ''}`,
        reference: input.toWarehouseId,
        adjusted_by: userId,
      },
      {
        tenant_id: tenantId,
        part_id: input.partId,
        quantity_change: input.quantity,
        reason: `Transfer in from ${(((source.warehouse as unknown) as { name: string }).name) ?? 'other warehouse'}${input.notes ? ` — ${input.notes}` : ''}`,
        reference: input.fromWarehouseId,
        adjusted_by: userId,
      },
    ]);

    return { transferred: input.quantity };
  }
}
