import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { DocumentNumberingService } from './document-numbering.service';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CapabilityGuard } from '../../common/guards/capability.guard';
import { TenantId } from '../../common/decorators/user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RequiresCapability } from '../../common/decorators/requires-capability.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import {
  updateDocumentNumberingSchema,
  type UpdateDocumentNumberingInput,
} from '@mecanix/validators';

@Controller('document-numbering')
@UseGuards(TenantGuard, RolesGuard, CapabilityGuard)
export class DocumentNumberingController {
  constructor(private readonly svc: DocumentNumberingService) {}

  @Get()
  async list(@TenantId() tenantId: string) {
    return this.svc.list(tenantId);
  }

  @Patch(':type')
  @Roles('owner')
  @RequiresCapability('settings.numbering')
  async update(
    @TenantId() tenantId: string,
    @Param('type') type: string,
    @Body(new ZodValidationPipe(updateDocumentNumberingSchema)) body: UpdateDocumentNumberingInput,
  ) {
    return this.svc.update(tenantId, type, body);
  }
}
