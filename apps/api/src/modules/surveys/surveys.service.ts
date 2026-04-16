import { Injectable, BadRequestException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class SurveysService {
  constructor(private readonly supabase: SupabaseService) {}

  async submit(tenantId: string, input: {
    jobCardId: string; customerId: string; rating: number; npsScore?: number; feedback?: string; source?: string;
  }) {
    if (input.rating < 1 || input.rating > 5) throw new BadRequestException('Rating must be 1-5');
    const { data, error } = await this.supabase.getClient()
      .from('satisfaction_surveys').insert({
        tenant_id: tenantId, job_card_id: input.jobCardId, customer_id: input.customerId,
        rating: input.rating, nps_score: input.npsScore ?? null,
        feedback: input.feedback ?? null, source: input.source ?? 'manual',
      }).select().single();
    if (error) throw error;
    return data;
  }

  async getByJob(tenantId: string, jobCardId: string) {
    const { data } = await this.supabase.getClient()
      .from('satisfaction_surveys').select('*').eq('job_card_id', jobCardId).eq('tenant_id', tenantId).maybeSingle();
    return data;
  }

  async summary(tenantId: string, startDate?: string, endDate?: string) {
    let query = this.supabase.getClient()
      .from('satisfaction_surveys').select('rating, nps_score').eq('tenant_id', tenantId);
    if (startDate) query = query.gte('submitted_at', startDate);
    if (endDate) query = query.lte('submitted_at', endDate);

    const { data } = await query;
    const surveys = data ?? [];
    const total = surveys.length;
    if (total === 0) return { total: 0, avgRating: 0, nps: 0 };

    const avgRating = Math.round(surveys.reduce((s, r) => s + (r.rating as number), 0) / total * 10) / 10;
    const npsScores = surveys.filter(r => r.nps_score != null);
    let nps = 0;
    if (npsScores.length > 0) {
      const promoters = npsScores.filter(r => (r.nps_score as number) >= 9).length;
      const detractors = npsScores.filter(r => (r.nps_score as number) <= 6).length;
      nps = Math.round((promoters - detractors) / npsScores.length * 100);
    }
    return { total, avgRating, nps };
  }
}
