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
    @Body() body: { name: string; type?: string; sortOrder?: number },
  ) {
    return this.baysService.create(tenantId, body);
  }

  @Patch(':id')
  async update(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body() body: { name?: string; type?: string; sortOrder?: number },
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
