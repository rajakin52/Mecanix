import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { BLOCKED_WHEN_IMPERSONATING_KEY } from '../decorators/blocked-when-impersonating.decorator';
import type { RequestUser } from './tenant.guard';

/**
 * Short-circuits requests flagged with @BlockedWhenImpersonating() when
 * the caller is acting on a tenant other than their own (i.e. a super-
 * admin using the X-Tenant-Id header to impersonate). Pure pass-through
 * for every other request.
 *
 * Must run AFTER TenantGuard so `request.user.isImpersonating` is set.
 * Safe to list before CapabilityGuard — this check is cheaper and
 * failing it avoids any DB round-trip in the permissions service.
 */
@Injectable()
export class ImpersonationBlockGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const meta = this.reflector.getAllAndOverride<string | true | undefined>(
      BLOCKED_WHEN_IMPERSONATING_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (meta === undefined) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user as RequestUser | undefined;
    if (!user) return true; // TenantGuard will already have thrown

    if (user.isImpersonating) {
      const reason =
        typeof meta === 'string'
          ? meta
          : 'This action is blocked while impersonating another tenant.';
      throw new ForbiddenException(reason);
    }
    return true;
  }
}
