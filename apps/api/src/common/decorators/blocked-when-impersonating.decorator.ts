import { SetMetadata } from '@nestjs/common';

export const BLOCKED_WHEN_IMPERSONATING_KEY = 'blocked_when_impersonating';

/**
 * Mark an endpoint as unavailable while a super-admin is impersonating
 * another tenant. The target tenant's own admins must perform the
 * action — support staff should never silently create accounts, change
 * ownership, or hard-delete data in a workshop that isn't theirs.
 *
 * Requires TenantGuard (which populates `user.isImpersonating`) and
 * ImpersonationBlockGuard to be registered on the controller.
 *
 * Optional `reason` is surfaced in the 403 body so the operator sees
 * why they were blocked, not just a generic forbidden.
 */
export const BlockedWhenImpersonating = (reason?: string) =>
  SetMetadata(BLOCKED_WHEN_IMPERSONATING_KEY, reason ?? true);
