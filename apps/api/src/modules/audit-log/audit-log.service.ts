import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

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
}

export interface AuditListFilters {
  action?: string;
  entityType?: string;
  entityId?: string;
  userId?: string;
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
   */
  async record(
    tenantId: string,
    userId: string | null,
    actorName: string | null,
    entry: AuditEntry,
  ): Promise<void> {
    try {
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
        });
    } catch (err) {
      this.logger.warn(`Audit log insert failed: ${err}`);
    }
  }

  async list(tenantId: string, filters: AuditListFilters = {}) {
    let q = this.supabase
      .getClient()
      .from('audit_log')
      .select('*, user:users(id, full_name, email)')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(filters.limit ?? 200);

    if (filters.action) q = q.eq('action', filters.action);
    if (filters.entityType) q = q.eq('entity_type', filters.entityType);
    if (filters.entityId) q = q.eq('entity_id', filters.entityId);
    if (filters.userId) q = q.eq('user_id', filters.userId);
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
