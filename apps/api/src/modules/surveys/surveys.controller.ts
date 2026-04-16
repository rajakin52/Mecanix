import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { SurveysService } from './surveys.service';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { TenantId } from '../../common/decorators/user.decorator';

@Controller('surveys')
@UseGuards(TenantGuard)
export class SurveysController {
  constructor(private readonly surveysService: SurveysService) {}

  @Post()
  async submit(@TenantId() tenantId: string, @Body() body: Record<string, unknown>) { return this.surveysService.submit(tenantId, body as never); }

  @Get('job/:jobId')
  async getByJob(@TenantId() tenantId: string, @Param('jobId') jobId: string) { return this.surveysService.getByJob(tenantId, jobId); }

  @Get('summary')
  async summary(@TenantId() tenantId: string, @Query('startDate') s?: string, @Query('endDate') e?: string) { return this.surveysService.summary(tenantId, s, e); }
}
