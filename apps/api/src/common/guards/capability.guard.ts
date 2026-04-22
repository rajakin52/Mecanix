import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { REQUIRES_CAPABILITY_KEY } from '../decorators/requires-capability.decorator';
import { PermissionsService } from '../permissions/permissions.service';
import type { RequestUser } from './tenant.guard';

/**
 * Checks that the request's user holds every capability listed on the
 * controller/handler. Super-admins bypass the check — they're the
 * support/developer escape hatch and already gated by the super-admin
 * flag in TenantGuard plus the audit-log is_cross_tenant flag.
 *
 * Must be composed AFTER TenantGuard so request.user is populated.
 */
@Injectable()
export class CapabilityGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly permissions: PermissionsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<string[] | undefined>(
      REQUIRES_CAPABILITY_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!required || required.length === 0) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user as RequestUser | undefined;

    if (!user) throw new ForbiddenException('Not authenticated');

    // Super-admins bypass capability checks. Intentional — the whole
    // point of the flag is to let support act anywhere. Every such
    // action lands in the audit log with is_cross_tenant=true so the
    // target tenant can see what happened.
    if (user.isSuperAdmin) return true;

    const principal = { role: user.role, customRoleId: user.customRoleId };
    // Fetch once, test each capability against the cached set — saves
    // N round-trips when multiple caps are required on a handler.
    const caps = await this.permissions.capabilitiesFor(principal);
    for (const cap of required) {
      if (!caps.has(cap)) {
        throw new ForbiddenException(
          `Missing capability: ${cap} (role: ${user.role}${user.customRoleId ? ` / custom ${user.customRoleId}` : ''})`,
        );
      }
    }
    return true;
  }
}
