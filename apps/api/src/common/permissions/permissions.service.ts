import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { SupabaseService } from '../../modules/supabase/supabase.service';

/**
 * PermissionsService — resolves a user's effective capability set from
 * the role_permissions table seeded by 00098_custom_roles.sql.
 *
 * Two lookup paths:
 *   1. Legacy / built-in: user has no custom_role_id; we match on the
 *      string `users.role` against the seeded SYSTEM roles
 *      (tenant_id=NULL, is_system=true).
 *   2. Tenant-defined: user has custom_role_id set; we pull the
 *      capability set for that specific row, regardless of the string
 *      role (the string is kept for compatibility but is irrelevant).
 *
 * System-role caps live in a tiny in-memory map refreshed every 5 min.
 * Custom-role caps are cached per-id with a shorter TTL so role edits
 * take effect quickly. Both caches fail closed on any DB error.
 */

const SYSTEM_CACHE_TTL_MS = 5 * 60 * 1000;  // 5 min
const CUSTOM_CACHE_TTL_MS = 60 * 1000;      // 60 s — role edits should feel responsive

export interface RolePrincipal {
  role: string;
  customRoleId: string | null;
}

@Injectable()
export class PermissionsService implements OnModuleInit {
  private readonly logger = new Logger(PermissionsService.name);

  /** System role key ('owner' | …) → capability set. Refreshed every 5 min. */
  private systemCache: Map<string, Set<string>> = new Map();
  private systemCachedAt = 0;

  /** Custom role UUID → { caps, cachedAt }. Refreshed lazily per id. */
  private customCache: Map<string, { caps: Set<string>; cachedAt: number }> = new Map();

  constructor(private readonly supabase: SupabaseService) {}

  async onModuleInit() {
    await this.refreshSystem().catch((err) =>
      this.logger.warn(`System role pre-warm failed — will retry lazily: ${err}`),
    );
  }

  // ─── System roles ────────────────────────────────────────────────

  private async refreshSystem(): Promise<void> {
    const client = this.supabase.getClient();
    const { data, error } = await client
      .from('custom_roles')
      .select('key, role_permissions(capability_key)')
      .is('tenant_id', null)
      .eq('is_system', true);

    if (error) throw error;

    const next = new Map<string, Set<string>>();
    for (const row of data ?? []) {
      const perms = (row.role_permissions ?? []) as Array<{ capability_key: string }>;
      next.set(row.key as string, new Set(perms.map((p) => p.capability_key)));
    }
    this.systemCache = next;
    this.systemCachedAt = Date.now();
  }

  private async systemCapabilitiesFor(roleKey: string): Promise<Set<string>> {
    if (this.systemCache.size === 0 || Date.now() - this.systemCachedAt > SYSTEM_CACHE_TTL_MS) {
      await this.refreshSystem();
    }
    return this.systemCache.get(roleKey) ?? new Set();
  }

  // ─── Custom (tenant-scoped) roles ────────────────────────────────

  private async customCapabilitiesFor(roleId: string): Promise<Set<string>> {
    const cached = this.customCache.get(roleId);
    if (cached && Date.now() - cached.cachedAt < CUSTOM_CACHE_TTL_MS) {
      return cached.caps;
    }

    const client = this.supabase.getClient();
    const { data, error } = await client
      .from('role_permissions')
      .select('capability_key')
      .eq('role_id', roleId);

    if (error) {
      this.logger.error(`customCapabilitiesFor(${roleId}) failed: ${error.message}`);
      // Fall through to the stale cache if we have one — better than
      // locking users out transiently. Empty set if no previous entry.
      return cached?.caps ?? new Set();
    }

    const caps = new Set<string>((data ?? []).map((r) => r.capability_key as string));
    this.customCache.set(roleId, { caps, cachedAt: Date.now() });
    return caps;
  }

  // ─── Public API ──────────────────────────────────────────────────

  async capabilitiesFor(principal: RolePrincipal): Promise<Set<string>> {
    try {
      if (principal.customRoleId) {
        return await this.customCapabilitiesFor(principal.customRoleId);
      }
      return await this.systemCapabilitiesFor(principal.role);
    } catch (err) {
      this.logger.error(`capabilitiesFor failed: ${err}`);
      return new Set();
    }
  }

  async hasCapability(principal: RolePrincipal, capability: string): Promise<boolean> {
    const caps = await this.capabilitiesFor(principal);
    return caps.has(capability);
  }

  /** String[] variant — used by the /auth/profile endpoint to hydrate the session. */
  async capabilityKeysFor(principal: RolePrincipal): Promise<string[]> {
    const caps = await this.capabilitiesFor(principal);
    return Array.from(caps);
  }

  /**
   * Invalidate a specific custom role's cache entry — call after a
   * tenant edits their custom role's permissions. System roles only
   * change via migration and do not need per-edit invalidation.
   */
  invalidateCustomRole(roleId: string): void {
    this.customCache.delete(roleId);
  }

  /** Forced full refresh — after a migration changes the seed. */
  async invalidate(): Promise<void> {
    this.systemCachedAt = 0;
    this.customCache.clear();
    await this.refreshSystem();
  }
}
