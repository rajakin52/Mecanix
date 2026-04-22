import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import type { RequestUser } from '../../common/guards/tenant.guard';

export interface AuditEntry {
  action: string;
  entityType?: string;
  entityId?: string;
  summary?: string;
  beforeState?: Record<string, unknown> | null;
  afterState?: Record<string, unknown> | null;
  metadata?: Record<string, unknown>;
  ipAddress?: string | null;
  userAgent?: string | null;
  /**
   * The actor's home tenant. Set automatically by recordFromUser(); only
   * pass explicitly when calling record() without a RequestUser. When
   * different from the audit row's tenant_id, the action is flagged as
   * cross-tenant (super-admin acting on behalf of another workshop).
   */
  actorHomeTenantId?: string | null;
}

export interface AuditListFilters {
  action?: string;
  entityType?: string;
  entityId?: string;
  userId?: string;
  crossTenantOnly?: boolean;
  startDate?: string;
  endDate?: string;
  limit?: number;
}

@Injectable()
export class AuditLogService {
  private readonly logger = new Logger(AuditLogService.name);

  constructor(private readonly supabase: SupabaseService) {}

  /**
   * Append an audit record. Never throws — audit failures must not
   * break the caller's primary mutation.
   *
   * Prefer recordFromUser() when a RequestUser is available — it fills
   * in impersonation/home-tenant metadata automatically.
   */
  async record(
    tenantId: string,
    userId: string | null,
    actorName: string | null,
    entry: AuditEntry,
  ): Promise<void> {
    try {
      const actorHomeTenantId = entry.actorHomeTenantId ?? null;
      const isCrossTenant = !!(actorHomeTenantId && actorHomeTenantId !== tenantId);

      await this.supabase
        .getClient()
        .from('audit_log')
        .insert({
          tenant_id: tenantId,
          user_id: userId,
          actor_name: actorName,
          action: entry.action,
          entity_type: entry.entityType ?? null,
          entity_id: entry.entityId ?? null,
          summary: entry.summary ?? null,
          before_state: entry.beforeState ?? null,
          after_state: entry.afterState ?? null,
          metadata: entry.metadata ?? {},
          ip_address: entry.ipAddress ?? null,
          user_agent: entry.userAgent ?? null,
          actor_home_tenant_id: actorHomeTenantId,
          is_cross_tenant: isCrossTenant,
        });
    } catch (err) {
      this.logger.warn(`Audit log insert failed: ${err}`);
    }
  }

  /**
   * Preferred entry point: record an audit line from a RequestUser.
   * The active tenant (user.tenantId) is used as the audit row's
   * tenant_id — that's the tenant whose data was touched. The actor's
   * own tenant (user.homeTenantId) is recorded separately so a super-
   * admin impersonation shows up as is_cross_tenant=true.
   */
  async recordFromUser(user: RequestUser, entry: AuditEntry): Promise<void> {
    return this.record(user.tenantId, user.id, user.email, {
      ...entry,
      actorHomeTenantId: user.homeTenantId,
    });
  }

  async list(tenantId: string, filters: AuditListFilters = {}) {
    let q = this.supabase
      .getClient()
      .from('audit_log')
      .select(
        '*, user:users(id, full_name, email), home_tenant:tenants!audit_log_actor_home_tenant_id_fkey(id, name)',
      )
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(filters.limit ?? 200);

    if (filters.action) q = q.eq('action', filters.action);
    if (filters.entityType) q = q.eq('entity_type', filters.entityType);
    if (filters.entityId) q = q.eq('entity_id', filters.entityId);
    if (filters.userId) q = q.eq('user_id', filters.userId);
    if (filters.crossTenantOnly) q = q.eq('is_cross_tenant', true);
    if (filters.startDate) q = q.gte('created_at', filters.startDate);
    if (filters.endDate) q = q.lte('created_at', filters.endDate);

    const { data, error } = await q;
    if (error) throw error;
    return data ?? [];
  }

  async distinctActions(tenantId: string) {
    const { data } = await this.supabase
      .getClient()
      .from('audit_log')
      .select('action')
      .eq('tenant_id', tenantId)
      .order('action');
    const set = new Set<string>();
    for (const row of data ?? []) set.add(row.action as string);
    return Array.from(set);
  }
}
