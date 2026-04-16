import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AiService } from './ai.service';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { TenantId } from '../../common/decorators/user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { aiRespondSchema, aiDiagnoseSchema } from '@mecanix/validators';

@Controller('ai')
@UseGuards(TenantGuard)
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Get('configured')
  async isConfigured() {
    return { configured: this.aiService.isConfigured() };
  }

  @Post('respond')
  async respond(
    @TenantId() tenantId: string,
    @Body(new ZodValidationPipe(aiRespondSchema)) body: { customerPhone: string; message: string },
  ) {
    const reply = await this.aiService.generateResponse(tenantId, body.customerPhone, body.message);
    return { reply };
  }

  @Post('diagnose')
  async diagnose(
    @Body(new ZodValidationPipe(aiDiagnoseSchema)) body: {
      reportedProblem: string;
      vehicleMake: string;
      vehicleModel: string;
      vehicleYear?: number;
    },
  ) {
    const suggestion = await this.aiService.getRepairSuggestions(
      body.reportedProblem,
      body.vehicleMake,
      body.vehicleModel,
      body.vehicleYear,
    );
    return { suggestion };
  }

  @Get('chat-history/:phone')
  async getChatHistory(
    @TenantId() tenantId: string,
    @Param('phone') phone: string,
  ) {
    return this.aiService.getChatHistory(tenantId, phone);
  }

  /** AI Writing Assistant — rewrite tech notes for customers */
  @Post('rewrite')
  async rewrite(
    @Body() body: { text: string; locale?: string },
  ) {
    const result = await this.aiService.rewriteForCustomer(body.text, body.locale);
    return { result };
  }

  /** Smart Technician Assignment */
  @Post('suggest-technician/:jobId')
  async suggestTechnician(
    @TenantId() tenantId: string,
    @Param('jobId') jobId: string,
  ) {
    return this.aiService.suggestTechnician(tenantId, jobId);
  }

  /** Predictive Maintenance for a vehicle */
  @Get('predict-maintenance/:vehicleId')
  async predictMaintenance(
    @TenantId() tenantId: string,
    @Param('vehicleId') vehicleId: string,
  ) {
    const prediction = await this.aiService.predictMaintenance(tenantId, vehicleId);
    return { prediction };
  }

  /** AI Estimate Generator — suggest labour + parts from symptoms */
  @Post('generate-estimate')
  async generateEstimate(
    @TenantId() tenantId: string,
    @Body() body: {
      reportedProblem: string;
      symptomCodes: string[];
      vehicleMake: string;
      vehicleModel: string;
      vehicleYear?: number;
    },
  ) {
    return this.aiService.generateEstimate(tenantId, body);
  }
}
