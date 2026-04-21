import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { BranchesService } from './branches.service';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { CurrentUser, TenantId } from '../../common/decorators/user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import {
  createBranchSchema,
  updateBranchSchema,
  branchTransferSchema,
} from '@mecanix/validators';
import type {
  CreateBranchInput,
  UpdateBranchInput,
  BranchTransferInput,
} from '@mecanix/validators';
import type { RequestUser } from '../../common/guards/tenant.guard';

@Controller('branches')
@UseGuards(TenantGuard)
export class BranchesController {
  constructor(private readonly service: BranchesService) {}

  @Get()
  async list(@TenantId() tenantId: string) {
    return this.service.list(tenantId);
  }

  @Get('me')
  async listForMe(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.listForCurrentUser(tenantId, user.id);
  }

  @Get('stock-by-part')
  async stockByBranch(
    @TenantId() tenantId: string,
    @Query('partId') partId: string,
  ) {
    return this.service.getStockByBranch(tenantId, partId);
  }

  @Get(':id')
  async getById(
    @TenantId() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.service.getById(tenantId, id);
  }

  @Post()
  async create(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Body(new ZodValidationPipe(createBranchSchema)) body: CreateBranchInput,
  ) {
    return this.service.create(tenantId, user.id, body);
  }

  @Patch(':id')
  async update(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateBranchSchema)) body: UpdateBranchInput,
  ) {
    return this.service.update(tenantId, id, body, user.id);
  }

  @Delete(':id')
  async deactivate(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
  ) {
    return this.service.deactivate(tenantId, id, user.id);
  }

  @Post('transfer-stock')
  async transferStock(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Body(new ZodValidationPipe(branchTransferSchema)) body: BranchTransferInput,
  ) {
    return this.service.transferStock(tenantId, user.id, body);
  }
}
