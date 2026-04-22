import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { SupabaseService } from '../../modules/supabase/supabase.service';

export interface RequestUser {
  id: string;
  authId: string;
  tenantId: string;
  role: string;
  email: string;
  /**
   * Optional FK into public.custom_roles. When null, the user's effective
   * capabilities come from the system role keyed by `role`. When set,
   * permissions come from that custom_role's role_permissions rows — used
   * by tenant-defined roles added through the settings UI.
   */
  customRoleId: string | null;
  /** True when the caller is a cross-tenant support/developer user. */
  isSuperAdmin: boolean;
  /** True when the active tenant context was switched via X-Tenant-Id header. */
  isImpersonating: boolean;
  /** The caller's home tenant — always their own, even when impersonating. */
  homeTenantId: string;
}

@Injectable()
export class TenantGuard implements CanActivate {
  constructor(private readonly supabase: SupabaseService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers['authorization'] as string | undefined;

    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing authorization token');
    }

    const token = authHeader.slice(7);
    const client = this.supabase.getClient();

    const { data, error } = await client.auth.getUser(token);
    if (error || !data.user) {
      throw new UnauthorizedException('Invalid or expired token');
    }

    // Look up user row to get tenant_id, role, super-admin flag, and
    // (optionally) a pointer to a custom role that supersedes the string role.
    const { data: userRow, error: userError } = await client
      .from('users')
      .select('id, tenant_id, role, custom_role_id, email, is_super_admin, is_active')
      .eq('auth_id', data.user.id)
      .single();

    if (userError || !userRow) {
      throw new UnauthorizedException('User not found in system');
    }

    if (userRow.is_active === false) {
      throw new UnauthorizedException('Account has been deactivated');
    }

    // Super admins can switch tenant context by setting X-Tenant-Id.
    // For everyone else the header is ignored — you're always scoped to
    // your own tenant.
    const overrideTenant = request.headers['x-tenant-id'] as string | undefined;
    const isSuperAdmin = !!userRow.is_super_admin;
    const tenantId =
      isSuperAdmin && overrideTenant ? overrideTenant : userRow.tenant_id;

    const reqUser: RequestUser = {
      id: userRow.id,
      authId: data.user.id,
      tenantId,
      role: userRow.role,
      customRoleId: (userRow.custom_role_id as string | null) ?? null,
      email: userRow.email,
      isSuperAdmin,
      isImpersonating: isSuperAdmin && !!overrideTenant && overrideTenant !== userRow.tenant_id,
      homeTenantId: userRow.tenant_id,
    };

    request.user = reqUser;
    return true;
  }
}
