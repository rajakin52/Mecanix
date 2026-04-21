import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import * as crypto from 'crypto';
import { SupabaseService } from '../supabase/supabase.service';
import { WhatsAppService } from '../notifications/whatsapp.service';

const PROMOTER_DELAY_MS = 24 * 60 * 60 * 1000; // 24h

@Injectable()
export class SurveysService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly whatsapp: WhatsAppService,
  ) {}

  async submit(tenantId: string, input: {
    jobCardId: string; customerId: string; rating: number; npsScore?: number; feedback?: string; source?: string;
  }) {
    if (input.rating < 1 || input.rating > 5) throw new BadRequestException('Rating must be 1-5');

    // Schedule a review prompt 24h out for promoters (NPS >= 9).
    // Detractors and passives don't get prompted — asking them is
    // net-negative for the flywheel.
    const isPromoter = (input.npsScore ?? 0) >= 9;
    const scheduledAt = isPromoter
      ? new Date(Date.now() + PROMOTER_DELAY_MS).toISOString()
      : null;
    const token = isPromoter ? crypto.randomBytes(12).toString('hex') : null;

    const { data, error } = await this.supabase.getClient()
      .from('satisfaction_surveys').insert({
        tenant_id: tenantId, job_card_id: input.jobCardId, customer_id: input.customerId,
        rating: input.rating, nps_score: input.npsScore ?? null,
        feedback: input.feedback ?? null, source: input.source ?? 'manual',
        review_prompt_scheduled_at: scheduledAt,
        review_prompt_token: token,
      }).select().single();
    if (error) throw error;
    return data;
  }

  /**
   * Picks up all due prompts for the tenant and sends them via
   * WhatsApp. Called by the cron worker on the same schedule as
   * payment reminders. Promoter + scheduled_at <= now + not yet sent.
   */
  async processDueReviewPrompts(tenantId: string) {
    const client = this.supabase.getClient();

    const { data: urlRow } = await client
      .from('tenant_settings')
      .select('value')
      .eq('tenant_id', tenantId)
      .eq('key', 'google_review_url')
      .maybeSingle();
    const reviewUrl = (urlRow?.value as string | undefined) ?? null;
    if (!reviewUrl) return { sent: 0, reason: 'google_review_url not set in tenant settings' as const };

    const nowIso = new Date().toISOString();
    const { data: due } = await client
      .from('satisfaction_surveys')
      .select('id, review_prompt_token, customer:customers(phone, full_name)')
      .eq('tenant_id', tenantId)
      .is('review_prompt_sent_at', null)
      .not('review_prompt_scheduled_at', 'is', null)
      .lte('review_prompt_scheduled_at', nowIso);

    const rows = (due ?? []) as Array<Record<string, unknown>>;
    const base = process.env.PUBLIC_APP_URL ?? '';
    let sent = 0;

    for (const row of rows) {
      const cust = Array.isArray(row.customer)
        ? (row.customer[0] as Record<string, unknown> | undefined)
        : (row.customer as Record<string, unknown> | null);
      const phone = cust?.phone as string | undefined;
      const token = row.review_prompt_token as string | null;
      if (!phone || !token) continue;

      const trackedUrl = base ? `${base.replace(/\/+$/, '')}/r/${token}` : reviewUrl;
      const msg = `Olá ${cust?.full_name ?? ''}! Obrigado pelos 10/10 \u2b50. Se puder partilhar a sua experiência no Google ajuda muito os próximos clientes: ${trackedUrl}`;

      try {
        await this.whatsapp.sendText(phone, msg);
        await client
          .from('satisfaction_surveys')
          .update({ review_prompt_sent_at: new Date().toISOString() })
          .eq('id', row.id)
          .eq('tenant_id', tenantId);
        sent++;
      } catch {
        // Swallow send-level errors; leave sent_at null so the cron retries.
      }
    }

    return { sent, total_due: rows.length };
  }

  /**
   * Lightweight redirect for the tracked review URL. Logs click time
   * and returns the tenant's Google review URL. No auth — the token
   * is the authorisation.
   */
  async resolveReviewClick(token: string): Promise<string> {
    const client = this.supabase.getClient();
    const { data } = await client
      .from('satisfaction_surveys')
      .select('id, tenant_id')
      .eq('review_prompt_token', token)
      .limit(1)
      .maybeSingle();
    if (!data) throw new NotFoundException('Unknown review link');

    await client
      .from('satisfaction_surveys')
      .update({ review_click_at: new Date().toISOString() })
      .eq('id', data.id);

    const { data: urlRow } = await client
      .from('tenant_settings')
      .select('value')
      .eq('tenant_id', data.tenant_id as string)
      .eq('key', 'google_review_url')
      .maybeSingle();
    const reviewUrl = (urlRow?.value as string | undefined) ?? null;
    return reviewUrl ?? 'https://google.com';
  }

  /**
   * Reviews-sent / clicks KPIs for a date range. Dashboard card
   * reads this to show the flywheel working.
   */
  async reviewMetrics(tenantId: string, startDate?: string, endDate?: string) {
    let q = this.supabase
      .getClient()
      .from('satisfaction_surveys')
      .select('review_prompt_sent_at, review_click_at')
      .eq('tenant_id', tenantId);
    if (startDate) q = q.gte('submitted_at', startDate);
    if (endDate) q = q.lte('submitted_at', endDate);
    const { data } = await q;
    const rows = data ?? [];
    const sent = rows.filter((r) => r.review_prompt_sent_at != null).length;
    const clicked = rows.filter((r) => r.review_click_at != null).length;
    return { sent, clicked, clickRate: sent > 0 ? Math.round((clicked / sent) * 100) : 0 };
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
