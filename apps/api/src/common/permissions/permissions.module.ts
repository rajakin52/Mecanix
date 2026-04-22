import { Global, Module } from '@nestjs/common';
import { PermissionsService } from './permissions.service';

/**
 * Global so every module that wants to gate by capability can inject
 * PermissionsService and use the CapabilityGuard without having to
 * import a provider graph in every feature module.
 */
@Global()
@Module({
  providers: [PermissionsService],
  exports: [PermissionsService],
})
export class PermissionsModule {}
