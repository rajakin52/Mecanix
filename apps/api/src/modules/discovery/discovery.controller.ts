import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { DiscoveryService } from './discovery.service';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { TenantId } from '../../common/decorators/user.decorator';

@Controller('discovery')
export class DiscoveryController {
  constructor(private readonly discoveryService: DiscoveryService) {}

  // ── Public endpoints (no auth required) ──

  @Get('workshops')
  async searchWorkshops(
    @Query('lat') lat: string,
    @Query('lng') lng: string,
    @Query('radius') radius?: string,
    @Query('specialization') specialization?: string,
  ) {
    return this.discoveryService.searchWorkshops(
      parseFloat(lat),
      parseFloat(lng),
      radius ? parseFloat(radius) : undefined,
      specialization,
    );
  }

  @Get('workshops/:id/profile')
  async getWorkshopProfile(@Param('id') id: string) {
    return this.discoveryService.getWorkshopProfile(id);
  }

  @Get('workshops/:id/reviews')
  async getWorkshopReviews(
    @Param('id') id: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.discoveryService.getWorkshopReviews(
      id,
      page ? parseInt(page, 10) : 1,
      pageSize ? parseInt(pageSize, 10) : 20,
    );
  }

  @Post('workshops/:id/rate')
  async submitRating(
    @Param('id') id: string,
    @Body()
    body: {
      customerId: string;
      jobCardId?: string;
      rating: number;
      title?: string;
      review?: string;
    },
  ) {
    return this.discoveryService.submitRating(id, body);
  }

  // ── Authenticated endpoint (workshop staff replies) ──

  @Post('ratings/:id/reply')
  @UseGuards(TenantGuard)
  async replyToRating(
    @TenantId() tenantId: string,
    @Param('id') ratingId: string,
    @Body() body: { reply: string },
  ) {
    return this.discoveryService.replyToRating(tenantId, ratingId, body.reply);
  }
}
