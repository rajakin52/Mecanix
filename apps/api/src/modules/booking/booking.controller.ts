import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { BookingService } from './booking.service';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { CurrentUser, TenantId } from '../../common/decorators/user.decorator';
import type { RequestUser } from '../../common/guards/tenant.guard';

/**
 * Public booking endpoints (no auth) at /booking/public/:slug
 * Authenticated management endpoints at /booking/requests
 */
@Controller('booking')
export class BookingController {
  constructor(private readonly bookingService: BookingService) {}

  // ── Public endpoints (no auth required) ──

  @Get('public/:slug')
  async getWorkshop(@Param('slug') slug: string) {
    return this.bookingService.getWorkshopBySlug(slug);
  }

  @Get('public/:slug/services')
  async getServices(@Param('slug') slug: string) {
    const workshop = await this.bookingService.getWorkshopBySlug(slug);
    return this.bookingService.getServices(workshop.id);
  }

  @Get('public/:slug/slots')
  async getSlots(@Param('slug') slug: string, @Query('date') date: string) {
    const workshop = await this.bookingService.getWorkshopBySlug(slug);
    return this.bookingService.getAvailableSlots(workshop.id, date);
  }

  @Post('public/:slug/request')
  async submitRequest(@Param('slug') slug: string, @Body() body: Record<string, unknown>) {
    const workshop = await this.bookingService.getWorkshopBySlug(slug);
    return this.bookingService.submitBookingRequest(workshop.id, body as never);
  }

  // ── Authenticated endpoints (workshop staff) ──

  @Get('requests')
  @UseGuards(TenantGuard)
  async listRequests(
    @TenantId() tenantId: string,
    @Query('status') status?: string,
  ) {
    return this.bookingService.listRequests(tenantId, status);
  }

  @Post('requests/:id/confirm')
  @UseGuards(TenantGuard)
  async confirmRequest(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() body: { scheduledStart: string; scheduledEnd: string; technicianId?: string },
  ) {
    return this.bookingService.confirmRequest(tenantId, user.id, id, body);
  }
}
