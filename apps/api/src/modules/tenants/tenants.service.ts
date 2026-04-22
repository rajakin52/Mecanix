import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { PermissionsService } from '../../common/permissions/permissions.service';

@Injectable()
export class TenantsService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly audit: AuditLogService,
    private readonly permissions: PermissionsService,
  ) {}

  /**
   * Super-admin only: list every tenant on the platform. Used by the
   * tenant switcher in the support/dev console. Not tenant-scoped — the
   * controller must gate this on `user.isSuperAdmin === true`.
   */
  async listAllTenants() {
    const { data, error } = await this.supabase
      .getClient()
      .from('tenants')
      .select('id, name, country, currency, created_at')
      .order('name', { ascending: true });
    if (error) throw error;
    return data ?? [];
  }

  async getTenant(tenantId: string) {
    const { data, error } = await this.supabase
      .getClient()
      .from('tenants')
      .select('*')
      .eq('id', tenantId)
      .single();

    if (error || !data) {
      throw new NotFoundException('Tenant not found');
    }

    return data;
  }

  async listUsers(tenantId: string) {
    const { data, error } = await this.supabase
      .getClient()
      .from('users')
      .select('id, email, full_name, role, phone, avatar_url, is_active, created_at')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return data ?? [];
  }

  /**
   * Update a user within the current tenant. Actor must be owner or manager.
   * Guards:
   *  - Cannot act on a user from a different tenant.
   *  - Cannot demote the only owner (would orphan the workshop).
   *  - Cannot deactivate yourself.
   *  - Managers cannot promote to owner, and cannot demote an owner.
   */
  async updateUser(
    tenantId: string,
    actor: {
      id: string;
      role: string;
      email?: string;
      homeTenantId?: string;
      isImpersonating?: boolean;
    },
    targetId: string,
    updates: {
      fullName?: string;
      phone?: string;
      role?: 'owner' | 'manager' | 'technician' | 'receptionist';
      customRoleId?: string | null;
      isActive?: boolean;
    },
  ) {
    const client = this.supabase.getClient();

    const { data: target, error: fetchErr } = await client
      .from('users')
      .select('id, tenant_id, role, is_active')
      .eq('id', targetId)
      .eq('tenant_id', tenantId)
      .single();

    if (fetchErr || !target) {
      throw new NotFoundException('User not found');
    }

    if (actor.id === targetId && updates.isActive === false) {
      throw new BadRequestException('Cannot deactivate your own account.');
    }

    // Field-level impersonation block: super-admins can edit users while
    // impersonating (they need to unstick things), but they must not
    // hand out owner-level control of a workshop that isn't theirs.
    if (actor.isImpersonating && updates.role === 'owner') {
      throw new ForbiddenException(
        'Cannot promote a user to owner while impersonating another tenant.',
      );
    }

    const demotingOwner =
      target.role === 'owner' && updates.role && updates.role !== 'owner';
    const deactivatingOwner =
      target.role === 'owner' && updates.isActive === false;

    if (demotingOwner || deactivatingOwner) {
      const { count } = await client
        .from('users')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('role', 'owner')
        .eq('is_active', true);

      if ((count ?? 0) <= 1) {
        throw new BadRequestException(
          'At least one active owner is required on the workshop.',
        );
      }
    }

    if (actor.role !== 'owner') {
      if (updates.role === 'owner') {
        throw new BadRequestException('Only an owner can promote a user to owner.');
      }
      // After the throw above, updates.role is narrowed to exclude 'owner',
      // so any role change where the target is an owner is a demotion attempt.
      if (target.role === 'owner' && updates.role !== undefined) {
        throw new BadRequestException('Only an owner can demote another owner.');
      }
    }

    // Validate custom_role_id belongs to this tenant (or is a shared
    // system role) before assigning it. Prevents assigning a role from
    // another tenant via a crafted request.
    if (updates.customRoleId) {
      const { data: role } = await client
        .from('custom_roles')
        .select('id, tenant_id, is_system')
        .eq('id', updates.customRoleId)
        .maybeSingle();
      const okToUse = role && (role.is_system || role.tenant_id === tenantId);
      if (!okToUse) {
        throw new BadRequestException('Custom role not found in this workshop.');
      }
    }

    const payload: Record<string, unknown> = { updated_by: actor.id };
    if (updates.fullName !== undefined) payload.full_name = updates.fullName;
    if (updates.phone !== undefined) payload.phone = updates.phone;
    if (updates.role !== undefined) payload.role = updates.role;
    if (updates.customRoleId !== undefined) payload.custom_role_id = updates.customRoleId;
    if (updates.isActive !== undefined) payload.is_active = updates.isActive;

    const { data, error } = await client
      .from('users')
      .update(payload)
      .eq('id', targetId)
      .eq('tenant_id', tenantId)
      .select('id, email, full_name, role, phone, avatar_url, is_active, created_at')
      .single();

    if (error) throw error;

    // Audit — high-leverage action, always recorded. Flags as cross-tenant
    // when a super-admin is editing a user in someone else's workshop.
    const changed: string[] = [];
    if (updates.role !== undefined && updates.role !== target.role) changed.push(`role: ${target.role}→${updates.role}`);
    if (updates.isActive !== undefined && updates.isActive !== target.is_active) {
      changed.push(updates.isActive ? 'reactivated' : 'deactivated');
    }
    if (updates.fullName !== undefined) changed.push('full_name');
    if (updates.phone !== undefined) changed.push('phone');

    if (changed.length > 0) {
      await this.audit.record(tenantId, actor.id, actor.email ?? null, {
        action: 'user.updated',
        entityType: 'user',
        entityId: targetId,
        summary: `User updated (${changed.join(', ')})`,
        beforeState: { role: target.role, is_active: target.is_active },
        afterState: { role: data.role, is_active: data.is_active },
        actorHomeTenantId: actor.homeTenantId ?? null,
      });
    }

    return data;
  }

  async updateTenant(tenantId: string, updates: Record<string, unknown>) {
    const { data, error } = await this.supabase
      .getClient()
      .from('tenants')
      .update(updates)
      .eq('id', tenantId)
      .select()
      .single();

    if (error) {
      throw new NotFoundException('Tenant not found or update failed');
    }

    return data;
  }

  async setExchangeRate(tenantId: string, rate: number) {
    if (rate <= 0) {
      throw new BadRequestException('Exchange rate must be greater than 0');
    }

    const tenant = await this.getTenant(tenantId);

    if (!tenant.secondary_currency) {
      throw new BadRequestException('Set a secondary currency before setting an exchange rate');
    }

    // Update tenant record
    const { data, error } = await this.supabase
      .getClient()
      .from('tenants')
      .update({
        exchange_rate: rate,
        exchange_rate_updated_at: new Date().toISOString(),
      })
      .eq('id', tenantId)
      .select()
      .single();

    if (error) {
      throw new BadRequestException('Failed to update exchange rate');
    }

    // Insert into exchange_rates history
    await this.supabase
      .getClient()
      .from('exchange_rates')
      .insert({
        tenant_id: tenantId,
        from_currency: tenant.secondary_currency as string,
        to_currency: tenant.currency as string,
        rate,
      });

    return data;
  }

  async getExchangeRate(tenantId: string) {
    const tenant = await this.getTenant(tenantId);

    return {
      currency: tenant.currency as string,
      secondaryCurrency: (tenant.secondary_currency as string) ?? null,
      exchangeRate: tenant.exchange_rate ? Number(tenant.exchange_rate) : null,
      exchangeRateUpdatedAt: (tenant.exchange_rate_updated_at as string) ?? null,
    };
  }

  async setSecondaryCurrency(tenantId: string, currency: string | null) {
    const validCurrencies = ['USD', 'EUR', 'AOA', 'MZN', 'BRL'];

    if (currency !== null && !validCurrencies.includes(currency)) {
      throw new BadRequestException(
        `Invalid currency. Must be one of: ${validCurrencies.join(', ')}`,
      );
    }

    const updates: Record<string, unknown> = {
      secondary_currency: currency,
    };

    // If clearing the secondary currency, also clear the exchange rate
    if (!currency) {
      updates.exchange_rate = null;
      updates.exchange_rate_updated_at = null;
    }

    const { data, error } = await this.supabase
      .getClient()
      .from('tenants')
      .update(updates)
      .eq('id', tenantId)
      .select()
      .single();

    if (error) {
      throw new BadRequestException('Failed to update secondary currency');
    }

    return data;
  }

  async getSetting(tenantId: string, key: string, defaultValue?: string): Promise<string | null> {
    const { data, error } = await this.supabase
      .getClient()
      .from('tenant_settings')
      .select('value')
      .eq('tenant_id', tenantId)
      .eq('key', key)
      .single();

    if (error || !data) {
      return defaultValue ?? null;
    }

    return data.value as string;
  }

  async setSetting(
    tenantId: string,
    key: string,
    value: string,
    context?: { userId?: string; actorName?: string; actorHomeTenantId?: string },
  ): Promise<{ key: string; value: string }> {
    // Capture previous value for the audit record.
    const prev = await this.getSetting(tenantId, key);

    const { data, error } = await this.supabase
      .getClient()
      .from('tenant_settings')
      .upsert(
        { tenant_id: tenantId, key, value },
        { onConflict: 'tenant_id,key' },
      )
      .select()
      .single();

    if (error) {
      throw new BadRequestException('Failed to save setting');
    }

    // Log only when the value actually changed.
    if (prev !== value) {
      await this.audit.record(
        tenantId,
        context?.userId ?? null,
        context?.actorName ?? null,
        {
          action: 'settings.updated',
          entityType: 'tenant_setting',
          summary: `Setting "${key}" updated`,
          beforeState: { value: prev },
          afterState: { value },
          metadata: { key },
          actorHomeTenantId: context?.actorHomeTenantId ?? null,
        },
      );
    }

    return { key: data.key as string, value: data.value as string };
  }

  // ─── Custom roles ─────────────────────────────────────────────

  /** Full capability catalogue — global, used to populate the role editor. */
  async listCapabilities() {
    const { data, error } = await this.supabase
      .getClient()
      .from('capabilities')
      .select('key, label, category, description')
      .order('category')
      .order('key');
    if (error) throw error;
    return data ?? [];
  }

  /**
   * List every role visible to this tenant: the 4 system roles +
   * any tenant-scoped custom roles. Each row includes its current
   * capability_keys array so the editor can load without a second round-trip.
   */
  async listRoles(tenantId: string) {
    const client = this.supabase.getClient();
    const { data, error } = await client
      .from('custom_roles')
      .select('id, tenant_id, key, label, description, is_system, role_permissions(capability_key)')
      .or(`tenant_id.is.null,tenant_id.eq.${tenantId}`)
      .order('is_system', { ascending: false })
      .order('label');
    if (error) throw error;

    return (data ?? []).map((row) => ({
      id: row.id as string,
      tenant_id: row.tenant_id as string | null,
      key: row.key as string,
      label: row.label as string,
      description: row.description as string | null,
      is_system: row.is_system as boolean,
      capability_keys: ((row.role_permissions ?? []) as Array<{ capability_key: string }>)
        .map((r) => r.capability_key),
    }));
  }

  async createCustomRole(
    tenantId: string,
    actor: { id: string; email: string; homeTenantId: string },
    input: { key: string; label: string; description?: string; capabilities: string[] },
  ) {
    const client = this.supabase.getClient();

    // Key must not clash with a system role (owner/manager/...) or an
    // existing tenant-scoped role.
    const { data: clash } = await client
      .from('custom_roles')
      .select('id, tenant_id, is_system')
      .eq('key', input.key)
      .or(`tenant_id.is.null,tenant_id.eq.${tenantId}`)
      .limit(1)
      .maybeSingle();

    if (clash) {
      throw new BadRequestException(
        clash.is_system
          ? `Role key "${input.key}" is reserved (system role).`
          : `Role key "${input.key}" already exists in this workshop.`,
      );
    }

    const { data: role, error } = await client
      .from('custom_roles')
      .insert({
        tenant_id: tenantId,
        key: input.key,
        label: input.label,
        description: input.description ?? null,
        is_system: false,
        created_by: actor.id,
      })
      .select('id')
      .single();
    if (error || !role) throw new BadRequestException('Could not create role');

    if (input.capabilities.length > 0) {
      const rows = input.capabilities.map((cap) => ({
        role_id: role.id,
        capability_key: cap,
      }));
      const { error: pErr } = await client.from('role_permissions').insert(rows);
      if (pErr) throw pErr;
    }

    await this.audit.record(tenantId, actor.id, actor.email, {
      action: 'role.created',
      entityType: 'custom_role',
      entityId: role.id as string,
      summary: `Custom role "${input.label}" created with ${input.capabilities.length} capabilities`,
      afterState: { key: input.key, capabilities: input.capabilities },
      actorHomeTenantId: actor.homeTenantId,
    });

    return { id: role.id as string };
  }

  async updateCustomRole(
    tenantId: string,
    actor: { id: string; email: string; homeTenantId: string },
    roleId: string,
    input: { label?: string; description?: string; capabilities?: string[] },
  ) {
    const client = this.supabase.getClient();

    // Guardrails: caller can only edit tenant-scoped (non-system) rows
    // in their own tenant. System rows are global and read-only.
    const { data: target, error: fetchErr } = await client
      .from('custom_roles')
      .select('id, tenant_id, is_system, label')
      .eq('id', roleId)
      .maybeSingle();
    if (fetchErr || !target) throw new NotFoundException('Role not found');
    if (target.is_system) throw new ForbiddenException('System roles are read-only.');
    if (target.tenant_id !== tenantId) throw new NotFoundException('Role not found');

    const patch: Record<string, unknown> = {};
    if (input.label !== undefined) patch.label = input.label;
    if (input.description !== undefined) patch.description = input.description;

    if (Object.keys(patch).length > 0) {
      const { error: uErr } = await client
        .from('custom_roles')
        .update(patch)
        .eq('id', roleId);
      if (uErr) throw uErr;
    }

    if (input.capabilities !== undefined) {
      // Full replace — simpler than diffing, and role edits are rare.
      await client.from('role_permissions').delete().eq('role_id', roleId);
      if (input.capabilities.length > 0) {
        const rows = input.capabilities.map((cap) => ({
          role_id: roleId,
          capability_key: cap,
        }));
        const { error: pErr } = await client.from('role_permissions').insert(rows);
        if (pErr) throw pErr;
      }
    }

    // The in-memory cache must see the change immediately, otherwise
    // users on this role keep hitting the old capability set for up to
    // a minute (the normal custom-cache TTL).
    this.permissions.invalidateCustomRole(roleId);

    await this.audit.record(tenantId, actor.id, actor.email, {
      action: 'role.updated',
      entityType: 'custom_role',
      entityId: roleId,
      summary: `Custom role "${target.label}" updated`,
      afterState: input as Record<string, unknown>,
      actorHomeTenantId: actor.homeTenantId,
    });

    return { id: roleId };
  }

  async deleteCustomRole(
    tenantId: string,
    actor: { id: string; email: string; homeTenantId: string },
    roleId: string,
  ) {
    const client = this.supabase.getClient();

    const { data: target, error: fetchErr } = await client
      .from('custom_roles')
      .select('id, tenant_id, is_system, label')
      .eq('id', roleId)
      .maybeSingle();
    if (fetchErr || !target) throw new NotFoundException('Role not found');
    if (target.is_system) throw new ForbiddenException('System roles cannot be deleted.');
    if (target.tenant_id !== tenantId) throw new NotFoundException('Role not found');

    // Refuse if any user still holds this custom role — they'd be
    // orphaned back to their string role with surprising capabilities.
    const { count } = await client
      .from('users')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('custom_role_id', roleId);
    if ((count ?? 0) > 0) {
      throw new BadRequestException(
        `Cannot delete — ${count} user(s) still have this role. Reassign them first.`,
      );
    }

    const { error } = await client.from('custom_roles').delete().eq('id', roleId);
    if (error) throw error;

    this.permissions.invalidateCustomRole(roleId);

    await this.audit.record(tenantId, actor.id, actor.email, {
      action: 'role.deleted',
      entityType: 'custom_role',
      entityId: roleId,
      summary: `Custom role "${target.label}" deleted`,
      actorHomeTenantId: actor.homeTenantId,
    });

    return { deleted: true };
  }
}
