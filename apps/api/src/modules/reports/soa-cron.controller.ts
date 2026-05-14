import { Controller, Headers, Post, UnauthorizedException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { SOA_DEFAULTS, SoaMailerService } from './soa-mailer.service';

/**
 * Internal cron endpoint for the monthly Statement-of-Account fan-out.
 * Lives alongside the SoaMailerService so it can depend on it without
 * dragging the reports module into a circular dependency with notifications.
 *
 * Auth: CRON_SECRET header (same scheme as cron.controller.ts).
 *
 * Designed to be invoked once daily by an external scheduler (Railway
 * cron, Vercel cron, GitHub Actions). Each tenant picks its own
 * day-of-month in `tenants.settings.soa.send_day`; the handler skips
 * tenants whose day doesn't match today (UTC). If a tenant configures
 * day 31 in February, the handler falls back to the last day of the month.
 */
@Controller('cron')
export class SoaCronController {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly soaMailer: SoaMailerService,
  ) {}

  private validateCronSecret(secret: string | undefined) {
    const expected = process.env['CRON_SECRET'] ?? 'mecanix-cron-2026';
    if (secret !== expected) {
      throw new UnauthorizedException('Invalid cron secret');
    }
  }

  @Post('monthly-statements')
  async monthlyStatements(@Headers('x-cron-secret') secret: string) {
    this.validateCronSecret(secret);

    const today = new Date();
    const todayDay = today.getUTCDate();

    const { data: tenants } = await this.supabase.getClient()
      .from('tenants')
      .select('id, settings');

    let processed = 0;
    const summaries: Array<Record<string, unknown>> = [];
    for (const t of tenants ?? []) {
      const s = (t.settings as Record<string, unknown> | null) ?? {};
      const soa = { ...SOA_DEFAULTS, ...((s['soa'] as Record<string, unknown>) ?? {}) };
      if (!soa.enabled) continue;
      const sendDay = Number(soa.send_day) || 1;
      const lastDayOfMonth = new Date(
        today.getUTCFullYear(),
        today.getUTCMonth() + 1,
        0,
      ).getUTCDate();
      const effectiveDay = Math.min(sendDay, lastDayOfMonth);
      if (todayDay !== effectiveDay) continue;

      try {
        const result = await this.soaMailer.sendBatch(t.id as string, 'cron', null);
        processed++;
        summaries.push({
          tenant_id: t.id,
          batch_id: result.batch_id,
          processed: result.processed,
          sent_email: result.sent_email,
          sent_whatsapp: result.sent_whatsapp,
          failed: result.failed,
          skipped: result.skipped,
        });
      } catch (err) {
        summaries.push({
          tenant_id: t.id,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    return { tenants_processed: processed, summaries };
  }
}
