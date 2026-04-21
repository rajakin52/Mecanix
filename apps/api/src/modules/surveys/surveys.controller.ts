import { Body, Controller, Get, Param, Post, Query, Redirect, UseGuards } from '@nestjs/common';
import { SurveysService } from './surveys.service';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { TenantId } from '../../common/decorators/user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { submitSurveySchema, type SubmitSurveyInput } from '@mecanix/validators';

@Controller('surveys')
@UseGuards(TenantGuard)
export class SurveysController {
  constructor(private readonly surveysService: SurveysService) {}

  @Post()
  async submit(
    @TenantId() tenantId: string,
    @Body(new ZodValidationPipe(submitSurveySchema)) body: SubmitSurveyInput,
  ) {
    return this.surveysService.submit(tenantId, body);
  }

  @Get('job/:jobId')
  async getByJob(@TenantId() tenantId: string, @Param('jobId') jobId: string) {
    return this.surveysService.getByJob(tenantId, jobId);
  }

  @Get('summary')
  async summary(
    @TenantId() tenantId: string,
    @Query('startDate') s?: string,
    @Query('endDate') e?: string,
  ) {
    return this.surveysService.summary(tenantId, s, e);
  }

  @Get('review-metrics')
  async reviewMetrics(
    @TenantId() tenantId: string,
    @Query('startDate') s?: string,
    @Query('endDate') e?: string,
  ) {
    return this.surveysService.reviewMetrics(tenantId, s, e);
  }

  @Post('process/review-prompts')
  async processReviewPrompts(@TenantId() tenantId: string) {
    return this.surveysService.processDueReviewPrompts(tenantId);
  }
}

// Public redirect — no auth, no tenant guard. The token *is* the auth.
@Controller('r')
export class SurveysRedirectController {
  constructor(private readonly surveysService: SurveysService) {}

  @Get(':token')
  @Redirect()
  async followReviewLink(@Param('token') token: string) {
    const url = await this.surveysService.resolveReviewClick(token);
    return { url, statusCode: 302 };
  }
}
