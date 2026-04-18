import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

export interface StockPolicy {
  allowNegativeStock: boolean;
  overrideRoles: string[];
}

const DEFAULT_OVERRIDE_ROLES = ['owner'];

@Injectable()
export class StockPolicyService {
  private readonly logger = new Logger(StockPolicyService.name);

  constructor(private readonly supabase: SupabaseService) {}

  async getPolicy(tenantId: string): Promise<StockPolicy> {
    const { data } = await this.supabase
      .getClient()
      .from('tenants')
      .select('settings')
      .eq('id', tenantId)
      .single();

    const s = (data?.settings as Record<string, unknown>) ?? {};
    const roles = s.negative_stock_override_roles;
    return {
      allowNegativeStock: Boolean(s.allow_negative_stock ?? false),
      overrideRoles: Array.isArray(roles) && roles.every((r) => typeof r === 'string')
        ? (roles as string[])
        : DEFAULT_OVERRIDE_ROLES,
    };
  }

  async updatePolicy(
    tenantId: string,
    input: { allowNegativeStock?: boolean; overrideRoles?: string[] },
  ): Promise<StockPolicy> {
    const { data: tenant } = await this.supabase
      .getClient()
      .from('tenants')
      .select('settings')
      .eq('id', tenantId)
      .single();

    const current = (tenant?.settings as Record<string, unknown>) ?? {};
    const updated = { ...current };
    if (input.allowNegativeStock !== undefined) {
      updated.allow_negative_stock = input.allowNegativeStock;
    }
    if (input.overrideRoles !== undefined) {
      updated.negative_stock_override_roles = input.overrideRoles;
    }

    const { error } = await this.supabase
      .getClient()
      .from('tenants')
      .update({ settings: updated })
      .eq('id', tenantId);

    if (error) throw error;

    return this.getPolicy(tenantId);
  }

  canOverride(policy: StockPolicy, userRole: string): boolean {
    if (policy.allowNegativeStock) return true;
    return policy.overrideRoles.includes(userRole);
  }

  async assertSufficientOrOverride(
    tenantId: string,
    userRole: string,
    available: number,
    required: number,
    partLabel: string,
  ): Promise<{ overridden: boolean }> {
    if (available >= required) return { overridden: false };
    const policy = await this.getPolicy(tenantId);
    if (this.canOverride(policy, userRole)) {
      this.logger.warn(
        `Stock override: ${partLabel} (available=${available}, required=${required}) by role=${userRole}`,
      );
      return { overridden: true };
    }
    throw new BadRequestException(
      `Insufficient stock for ${partLabel}. Available: ${available}, Required: ${required}. Contact an administrator to override.`,
    );
  }
}
