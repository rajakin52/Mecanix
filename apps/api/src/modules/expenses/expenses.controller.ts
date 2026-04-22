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
import { ExpensesService } from './expenses.service';
import { AiService } from '../ai/ai.service';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CapabilityGuard } from '../../common/guards/capability.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RequiresCapability } from '../../common/decorators/requires-capability.decorator';
import { CurrentUser, TenantId } from '../../common/decorators/user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import {
  createExpenseSchema,
  updateExpenseSchema,
  paginationSchema,
  ocrReceiptSchema,
} from '@mecanix/validators';
import type {
  CreateExpenseInput,
  UpdateExpenseInput,
  PaginationInput,
  OcrReceiptInput,
} from '@mecanix/validators';
import type { RequestUser } from '../../common/guards/tenant.guard';

@Controller('expenses')
@UseGuards(TenantGuard, RolesGuard, CapabilityGuard)
@Roles('owner', 'manager')
@RequiresCapability('expenses.manage')
export class ExpensesController {
  constructor(
    private readonly expensesService: ExpensesService,
    private readonly aiService: AiService,
  ) {}

  @Post('ocr')
  async ocr(
    @Body(new ZodValidationPipe(ocrReceiptSchema)) body: OcrReceiptInput,
  ) {
    return this.aiService.ocrReceipt(body);
  }

  @Get()
  async list(
    @TenantId() tenantId: string,
    @Query(new ZodValidationPipe(paginationSchema)) query: PaginationInput,
    @Query('category') category?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.expensesService.list(tenantId, query, category, startDate, endDate);
  }

  @Get('summary')
  async getByCategory(
    @TenantId() tenantId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.expensesService.getByCategory(tenantId, startDate, endDate);
  }

  @Get(':id')
  async getById(
    @TenantId() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.expensesService.getById(tenantId, id);
  }

  @Post()
  async create(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Body(new ZodValidationPipe(createExpenseSchema)) body: CreateExpenseInput,
  ) {
    return this.expensesService.create(tenantId, user.id, body);
  }

  @Patch(':id')
  async update(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateExpenseSchema)) body: UpdateExpenseInput,
  ) {
    return this.expensesService.update(tenantId, id, user.id, body);
  }

  @Delete(':id')
  async delete(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
  ) {
    return this.expensesService.delete(tenantId, id, user.id);
  }
}
