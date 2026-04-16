import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class DiscoveryService {
  constructor(private readonly supabase: SupabaseService) {}

  async searchWorkshops(
    lat: number,
    lng: number,
    radius?: number,
    specialization?: string,
  ) {
    const client = this.supabase.getClient();
    const radiusKm = radius ?? 25;

    // Fetch discoverable tenants with their coordinates
    let query = client
      .from('tenants')
      .select(
        'id, name, slug, address, phone, latitude, longitude, specializations, cover_photo_url, operating_hours',
      )
      .eq('is_discoverable', true)
      .eq('is_active', true);

    if (specialization) {
      query = query.contains('specializations', [specialization]);
    }

    const { data, error } = await query;
    if (error) throw error;

    // Calculate distance in-memory using Haversine and filter by radius
    const workshops = (data ?? [])
      .filter((t) => t.latitude != null && t.longitude != null)
      .map((t) => {
        const distance = this.haversineKm(
          lat,
          lng,
          Number(t.latitude),
          Number(t.longitude),
        );
        return { ...t, distance_km: Math.round(distance * 10) / 10 };
      })
      .filter((t) => t.distance_km <= radiusKm)
      .sort((a, b) => a.distance_km - b.distance_km);

    return workshops;
  }

  async getWorkshopProfile(tenantId: string) {
    const client = this.supabase.getClient();

    const { data: tenant, error } = await client
      .from('tenants')
      .select(
        'id, name, slug, address, phone, operating_hours, specializations, cover_photo_url, logo_url, about',
      )
      .eq('id', tenantId)
      .eq('is_discoverable', true)
      .single();

    if (error || !tenant) {
      throw new NotFoundException('Workshop not found');
    }

    // Aggregate rating stats
    const { data: stats } = await client
      .from('workshop_ratings')
      .select('rating')
      .eq('tenant_id', tenantId)
      .eq('is_public', true);

    const reviews = stats ?? [];
    const totalReviews = reviews.length;
    const avgRating =
      totalReviews > 0
        ? Math.round(
            (reviews.reduce((sum, r) => sum + Number(r.rating), 0) /
              totalReviews) *
              10,
          ) / 10
        : null;

    return {
      ...tenant,
      avg_rating: avgRating,
      total_reviews: totalReviews,
    };
  }

  async getWorkshopReviews(tenantId: string, page: number, pageSize: number) {
    const client = this.supabase.getClient();
    const offset = (page - 1) * pageSize;

    const { data, error, count } = await client
      .from('workshop_ratings')
      .select('id, customer_name, rating, title, review, reply, created_at, replied_at', {
        count: 'exact',
      })
      .eq('tenant_id', tenantId)
      .eq('is_public', true)
      .order('created_at', { ascending: false })
      .range(offset, offset + pageSize - 1);

    if (error) throw error;

    return {
      data: data ?? [],
      meta: { page, pageSize, total: count ?? 0 },
    };
  }

  async submitRating(
    tenantId: string,
    input: {
      customerId: string;
      jobCardId?: string;
      rating: number;
      title?: string;
      review?: string;
    },
  ) {
    if (input.rating < 1 || input.rating > 5) {
      throw new BadRequestException('Rating must be between 1 and 5');
    }

    const client = this.supabase.getClient();

    // Look up customer name for denormalized display
    const { data: customer } = await client
      .from('customers')
      .select('full_name')
      .eq('id', input.customerId)
      .maybeSingle();

    const { data, error } = await client
      .from('workshop_ratings')
      .insert({
        tenant_id: tenantId,
        customer_id: input.customerId,
        customer_name: customer?.full_name ?? 'Anonymous',
        job_card_id: input.jobCardId ?? null,
        rating: input.rating,
        title: input.title ?? null,
        review: input.review ?? null,
        is_public: true,
      } as never)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async replyToRating(tenantId: string, ratingId: string, reply: string) {
    const client = this.supabase.getClient();

    const { data, error } = await client
      .from('workshop_ratings')
      .update({
        reply,
        replied_at: new Date().toISOString(),
      } as never)
      .eq('id', ratingId)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error) throw error;
    if (!data) throw new NotFoundException('Rating not found');
    return data;
  }

  // ── Helpers ───────────────────────────────────────────────

  private haversineKm(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ): number {
    const R = 6371;
    const dLat = this.deg2rad(lat2 - lat1);
    const dLon = this.deg2rad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.deg2rad(lat1)) *
        Math.cos(this.deg2rad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private deg2rad(deg: number): number {
    return deg * (Math.PI / 180);
  }
}
