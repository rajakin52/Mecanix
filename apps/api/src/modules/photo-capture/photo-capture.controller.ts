import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { PhotoCaptureService } from './photo-capture.service';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { CurrentUser, TenantId } from '../../common/decorators/user.decorator';
import type { RequestUser } from '../../common/guards/tenant.guard';

@Controller('photo-capture')
export class PhotoCaptureController {
  constructor(private readonly photoCaptureService: PhotoCaptureService) {}

  // ── Authenticated endpoints (advisor at desk) ──

  @Post('sessions')
  @UseGuards(TenantGuard)
  async createSession(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Body() body: Record<string, unknown>,
  ) {
    return this.photoCaptureService.createSession(tenantId, user.id, body as never);
  }

  @Patch('sessions/:sessionId/link')
  @UseGuards(TenantGuard)
  async linkToJob(
    @TenantId() tenantId: string,
    @Param('sessionId') sessionId: string,
    @Body() body: { jobCardId: string },
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

  // ── Public endpoints (phone camera — no auth, token-based) ──

  @Get('session/:token')
  async getSession(@Param('token') token: string) {
    return this.photoCaptureService.getByToken(token);
  }

  @Post('session/:token/upload')
  async uploadPhoto(
    @Param('token') token: string,
    @Body() body: { photoType: string; storageUrl: string; fileSize?: number },
  ) {
    return this.photoCaptureService.uploadPhoto(token, body);
  }
}
