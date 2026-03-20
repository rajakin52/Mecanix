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
import { CustomersService } from './customers.service';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { CurrentUser, TenantId } from '../../common/decorators/user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { createCustomerSchema, updateCustomerSchema, paginationSchema } from '@mecanix/validators';
import type { CreateCustomerInput, UpdateCustomerInput, PaginationInput } from '@mecanix/validators';
import type { RequestUser } from '../../common/guards/tenant.guard';

@Controller('customers')
@UseGuards(TenantGuard)
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Get()
  async list(
    @TenantId() tenantId: string,
    @Query(new ZodValidationPipe(paginationSchema)) query: PaginationInput,
  ) {
    return this.customersService.list(tenantId, query);
  }

  @Get('search')
  async search(
    @TenantId() tenantId: string,
    @Query('q') q: string,
  ) {
    return this.customersService.search(tenantId, q ?? '');
  }

  @Get(':id')
  async getById(
    @TenantId() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.customersService.getById(tenantId, id);
  }

  @Post()
  async create(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Body(new ZodValidationPipe(createCustomerSchema)) body: CreateCustomerInput,
  ) {
    return this.customersService.create(tenantId, user.id, body);
  }

  @Patch(':id')
  async update(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateCustomerSchema)) body: UpdateCustomerInput,
  ) {
    return this.customersService.update(tenantId, id, user.id, body);
  }

  @Delete(':id')
  async delete(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
  ) {
    return this.customersService.delete(tenantId, id, user.id);
  }
}
