import { Controller, Post, Headers, UnauthorizedException } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { SupabaseService } from '../supabase/supabase.service';

/**
 * Internal cron endpoints — no tenant auth required.
 * Protected by CRON_SECRET header instead.
 * Processes ALL tenants in one call.
 */
@Controller('cron')
export class CronController {
  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly supabase: SupabaseService,
  ) {}

  private validateCronSecret(secret: string | undefined) {
    const expected = process.env['CRON_SECRET'] ?? 'mecanix-cron-2026';
    if (secret !== expected) {
      throw new UnauthorizedException('Invalid cron secret');
    }
  }

  @Post('appointment-reminders')
  async appointmentReminders(@Headers('x-cron-secret') secret: string) {
    this.validateCronSecret(secret);

    // Get all tenants
    const { data: tenants } = await this.supabase.getClient()
      .from('tenants')
      .select('id')
      .eq('is_active', true);

    let totalSent = 0;
    for (const tenant of tenants ?? []) {
      try {
        const result = await this.notificationsService.processAppointmentReminders(tenant.id);
        totalSent += result.sent;
      } catch { /* continue processing other tenants */ }
    }

    return { processed: (tenants ?? []).length, sent: totalSent };
  }

  @Post('payment-reminders')
  async paymentReminders(@Headers('x-cron-secret') secret: string) {
    this.validateCronSecret(secret);

    const { data: tenants } = await this.supabase.getClient()
      .from('tenants')
      .select('id')
      .eq('is_active', true);

    let totalSent = 0;
    for (const tenant of tenants ?? []) {
      try {
        const result = await this.notificationsService.processPaymentReminders(tenant.id);
        totalSent += result.sent;
      } catch { /* continue processing other tenants */ }
    }

    return { processed: (tenants ?? []).length, sent: totalSent };
  }
}
