import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { PhotoCaptureService } from './photo-capture.service';
import { SmsService } from '../notifications/sms.service';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { CurrentUser, TenantId } from '../../common/decorators/user.decorator';
import type { RequestUser } from '../../common/guards/tenant.guard';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import {
  createPhotoCaptureSessionSchema,
  createSignatureSessionSchema,
  linkSessionToJobSchema,
  directPhotoUploadSchema,
  publicPhotoUploadSchema,
  publicSignatureUploadSchema,
  type CreatePhotoCaptureSessionInput,
  type CreateSignatureSessionInput,
  type LinkSessionToJobInput,
  type DirectPhotoUploadInput,
  type PublicPhotoUploadInput,
  type PublicSignatureUploadInput,
} from '@mecanix/validators';

@Controller('photo-capture')
export class PhotoCaptureController {
  constructor(
    private readonly photoCaptureService: PhotoCaptureService,
    private readonly smsService: SmsService,
  ) {}

  @Get('sms-config')
  async smsConfig() {
    const twilioKeys = Object.keys(process.env)
      .filter((k) => k.toUpperCase().includes('TWILIO'))
      .sort()
      .map((k) => {
        const v = process.env[k] ?? '';
        return {
          name: k,
          length: v.length,
          prefix: v.slice(0, 3),
          suffix: v.length > 3 ? v.slice(-3) : '',
        };
      });
    return { ...this.smsService.getConfigStatus(), envKeys: twilioKeys };
  }

  // ── Authenticated endpoints (advisor at desk) ──

  @Post('sessions')
  @UseGuards(TenantGuard)
  async createSession(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Body(new ZodValidationPipe(createPhotoCaptureSessionSchema)) body: CreatePhotoCaptureSessionInput,
  ) {
    return this.photoCaptureService.createSession(tenantId, user.id, body as never);
  }

  @Patch('sessions/:sessionId/link')
  @UseGuards(TenantGuard)
  async linkToJob(
    @TenantId() tenantId: string,
    @Param('sessionId') sessionId: string,
    @Body(new ZodValidationPipe(linkSessionToJobSchema)) body: LinkSessionToJobInput,
  ) {
    return this.photoCaptureService.linkToJob(tenantId, sessionId, body.jobCardId);
  }

  @Get('sessions/:sessionId/photos')
  @UseGuards(TenantGuard)
  async getSessionPhotos(
    @Param('sessionId') sessionId: string,
  ) {
    return this.photoCaptureService.getSessionPhotos(sessionId);
  }

  @Get('job/:jobCardId')
  @UseGuards(TenantGuard)
  async listByJob(
    @TenantId() tenantId: string,
    @Param('jobCardId') jobCardId: string,
  ) {
    return this.photoCaptureService.listByJob(tenantId, jobCardId);
  }

  @Get('orphans')
  @UseGuards(TenantGuard)
  async orphans(@TenantId() tenantId: string) {
    return this.photoCaptureService.listOrphanSessions(tenantId);
  }

  /** Create a signature session and send WhatsApp/SMS link */
  @Post('signature-sessions')
  @UseGuards(TenantGuard)
  async createSignatureSession(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Body(new ZodValidationPipe(createSignatureSessionSchema)) body: CreateSignatureSessionInput,
  ) {
    return this.photoCaptureService.createSignatureSession(tenantId, user.id, body as never);
  }

  /** Direct photo upload (mobile app) — uploads to Supabase Storage and returns public URL */
  @Post('upload')
  @UseGuards(TenantGuard)
  async directUpload(
    @TenantId() tenantId: string,
    @Body(new ZodValidationPipe(directPhotoUploadSchema)) body: DirectPhotoUploadInput,
  ) {
    return this.photoCaptureService.directUpload(tenantId, body);
  }

  // ── Public endpoints (phone camera — no auth, token-based) ──

  @Get('session/:token')
  async getSession(@Param('token') token: string) {
    return this.photoCaptureService.getByToken(token);
  }

  @Post('session/:token/upload')
  async uploadPhoto(
    @Param('token') token: string,
    @Body(new ZodValidationPipe(publicPhotoUploadSchema)) body: PublicPhotoUploadInput,
  ) {
    return this.photoCaptureService.uploadPhoto(token, body);
  }

  @Post('session/:token/sign')
  async uploadSignature(
    @Param('token') token: string,
    @Body(new ZodValidationPipe(publicSignatureUploadSchema)) body: PublicSignatureUploadInput,
  ) {
    return this.photoCaptureService.uploadSignature(token, body.base64Data);
  }
}
