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
import { CatalogService } from './catalog.service';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { CurrentUser, TenantId } from '../../common/decorators/user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { createCatalogItemSchema, updateCatalogItemSchema } from '@mecanix/validators';
import type { CreateCatalogItemInput, UpdateCatalogItemInput } from '@mecanix/validators';
import type { RequestUser } from '../../common/guards/tenant.guard';

@Controller('catalog')
@UseGuards(TenantGuard)
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  @Get()
  async list(
    @TenantId() tenantId: string,
    @Query('type') type?: string,
    @Query('category') category?: string,
    @Query('quickAccess') quickAccess?: string,
    @Query('search') search?: string,
  ) {
    return this.catalogService.list(
      tenantId,
      type,
      category,
      quickAccess === 'true',
      search,
    );
  }

  @Get('categories')
  async categories(@TenantId() tenantId: string) {
    return this.catalogService.categories(tenantId);
  }

  @Get(':id')
  async getById(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.catalogService.getById(tenantId, id);
  }

  @Post()
  async create(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Body(new ZodValidationPipe(createCatalogItemSchema)) body: CreateCatalogItemInput,
  ) {
    return this.catalogService.create(tenantId, user.id, body);
  }

  @Patch(':id')
  async update(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateCatalogItemSchema)) body: UpdateCatalogItemInput,
  ) {
    return this.catalogService.update(tenantId, id, body);
  }

  @Delete(':id')
  async delete(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.catalogService.delete(tenantId, id);
  }

  @Post(':id/apply-to-job/:jobId')
  async applyToJob(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Param('jobId') jobId: string,
  ) {
    return this.catalogService.applyToJob(tenantId, user.id, jobId, id);
  }
}
