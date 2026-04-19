import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { BaysService } from './bays.service';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { TenantId } from '../../common/decorators/user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import {
  createBaySchema,
  updateBaySchema,
  type CreateBayInput,
  type UpdateBayInput,
} from '@mecanix/validators';

@Controller('bays')
@UseGuards(TenantGuard)
export class BaysController {
  constructor(private readonly baysService: BaysService) {}

  @Get()
  async list(@TenantId() tenantId: string) {
    return this.baysService.list(tenantId);
  }

  @Post()
  async create(
    @TenantId() tenantId: string,
    @Body(new ZodValidationPipe(createBaySchema)) body: CreateBayInput,
  ) {
    return this.baysService.create(tenantId, body);
  }

  @Patch(':id')
  async update(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateBaySchema)) body: UpdateBayInput,
  ) {
    return this.baysService.update(tenantId, id, body);
  }

  @Delete(':id')
  async delete(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.baysService.delete(tenantId, id);
  }

  @Get('floor-view')
  async getFloorView(@TenantId() tenantId: string) {
    return this.baysService.getFloorView(tenantId);
  }
}
