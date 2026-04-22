import { SetMetadata } from '@nestjs/common';

export const REQUIRES_CAPABILITY_KEY = 'requires_capability';

/**
 * Gate a controller method on one or more capability keys from the
 * `capabilities` table (seeded by 00098_custom_roles.sql). The caller
 * must hold ALL listed capabilities — use-case-specific "or" gates
 * should be expressed by adding both capabilities to each role that
 * needs it, not by weakening the decorator.
 *
 * Apply on top of @UseGuards(TenantGuard, CapabilityGuard). For the
 * transition period it is safe to keep @Roles(...) alongside — both
 * guards must succeed, so behaviour is never loosened by adding this
 * decorator.
 */
export const RequiresCapability = (...capabilities: string[]) =>
  SetMetadata(REQUIRES_CAPABILITY_KEY, capabilities);
