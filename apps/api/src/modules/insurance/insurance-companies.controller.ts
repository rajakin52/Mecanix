import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { InsuranceCompaniesService } from './insurance-companies.service';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import {
  createInsuranceCompanySchema,
  updateInsuranceCompanySchema,
} from '@mecanix/validators';
import type {
  CreateInsuranceCompanyInput,
  UpdateInsuranceCompanyInput,
} from '@mecanix/validators';

@Controller('insurance/companies')
@UseGuards(TenantGuard)
export class InsuranceCompaniesController {
  constructor(private readonly companiesService: InsuranceCompaniesService) {}

  @Get()
  async list(@Query('search') search?: string) {
    return this.companiesService.list(search);
  }

  @Get(':id')
  async getById(@Param('id') id: string) {
    return this.companiesService.getById(id);
  }

  @Post()
  async create(
    @Body(new ZodValidationPipe(createInsuranceCompanySchema)) body: CreateInsuranceCompanyInput,
  ) {
    return this.companiesService.create(body);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateInsuranceCompanySchema)) body: UpdateInsuranceCompanyInput,
  ) {
    return this.companiesService.update(id, body);
  }
}
