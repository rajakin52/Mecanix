import { Controller, Post, Headers, UnauthorizedException } from '@nestjs/common';
import { SurveysService } from './surveys.service';
import { SupabaseService } from '../supabase/supabase.service';

/**
 * Internal cron endpoint for review prompts. Mirrors the cron
 * controller in notifications — same shared secret pattern, same
 * iterate-all-tenants shape.
 */
@Controller('cron')
export class SurveysCronController {
  constructor(
    private readonly surveysService: SurveysService,
    private readonly supabase: SupabaseService,
  ) {}

  private validateCronSecret(secret: string | undefined) {
    const expected = process.env['CRON_SECRET'] ?? 'mecanix-cron-2026';
    if (secret !== expected) {
      throw new UnauthorizedException('Invalid cron secret');
    }
  }

  @Post('review-prompts')
  async reviewPrompts(@Headers('x-cron-secret') secret: string) {
    this.validateCronSecret(secret);

    const { data: tenants } = await this.supabase
      .getClient()
      .from('tenants')
      .select('id')
      .eq('is_active', true);

    let totalSent = 0;
    for (const tenant of tenants ?? []) {
      try {
        const result = await this.surveysService.processDueReviewPrompts(tenant.id);
        totalSent += (result as { sent?: number }).sent ?? 0;
      } catch {
        /* continue processing other tenants */
      }
    }

    return { processed: (tenants ?? []).length, sent: totalSent };
  }
}
