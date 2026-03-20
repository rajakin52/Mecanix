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

    // Look up user row to get tenant_id and role
    const { data: userRow, error: userError } = await client
      .from('users')
      .select('id, tenant_id, role, email')
      .eq('auth_id', data.user.id)
      .single();

    if (userError || !userRow) {
      throw new UnauthorizedException('User not found in system');
    }

    const reqUser: RequestUser = {
      id: userRow.id,
      authId: data.user.id,
      tenantId: userRow.tenant_id,
      role: userRow.role,
      email: userRow.email,
    };

    request.user = reqUser;
    return true;
  }
}
