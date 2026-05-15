import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { SupabaseService } from '../supabase/supabase.service';
import { EmailService } from '../notifications/email.service';
import { WhatsAppService } from '../notifications/whatsapp.service';
import { StatementsService, type Statement } from './statements.service';
import { SoaPdfService } from './soa-pdf.service';

export interface SoaSettings {
  enabled: boolean;
  send_day: number;
  send_hour_utc: number;
  from_name: string | null;
  from_email: string | null;
  reply_to: string | null;
  subject_template: string;
  intro_template: string;
  whatsapp_fallback: boolean;
}

export const SOA_DEFAULTS: SoaSettings = {
  enabled: false,
  send_day: 1,
  send_hour_utc: 7,
  from_name: null,
  from_email: null,
  reply_to: null,
  subject_template: 'Statement of Account — {{month}}',
  intro_template:
    'Dear {{customer_name}},\n\nPlease find your statement of account attached. Your current outstanding balance is {{total_outstanding}}.\n\nThank you for your business.',
  whatsapp_fallback: true,
};

export interface SoaSendRow {
  customer_id: string;
  customer_name: string;
  channel: 'email' | 'whatsapp' | 'skipped';
  recipient: string | null;
  status:
    | 'sent'
    | 'failed'
    | 'skipped_no_balance'
    | 'skipped_no_contact'
    | 'skipped_no_provider';
  error?: string;
  outstanding: number;
  open_invoices: number;
  provider_message_id?: string;
}

export interface SoaBatchResult {
  batch_id: string;
  tenant_id: string;
  processed: number;
  sent_email: number;
  sent_whatsapp: number;
  failed: number;
  skipped: number;
  results: SoaSendRow[];
}

interface TenantRow {
  id: string;
  name: string;
  currency: string;
  locale: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  tax_id: string | null;
  settings: Record<string, unknown>;
}

@Injectable()
export class SoaMailerService {
  private readonly logger = new Logger(SoaMailerService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly email: EmailService,
    private readonly whatsapp: WhatsAppService,
    private readonly statements: StatementsService,
    private readonly pdf: SoaPdfService,
  ) {}

  /** Read merged SOA settings for a tenant, falling back to defaults. */
  getSettings(tenantSettings: Record<string, unknown>): SoaSettings {
    const raw = (tenantSettings?.['soa'] as Record<string, unknown>) ?? {};
    return { ...SOA_DEFAULTS, ...raw } as SoaSettings;
  }

  /** Fetch live SOA settings for a tenant, merged over defaults. */
  async loadSettings(tenantId: string): Promise<SoaSettings> {
    const { data } = await this.supabase
      .getClient()
      .from('tenants')
      .select('settings')
      .eq('id', tenantId)
      .single();
    return this.getSettings((data?.settings as Record<string, unknown>) ?? {});
  }

  /** Patch SOA settings under tenants.settings.soa (preserves other keys). */
  async updateSettings(tenantId: string, patch: Partial<SoaSettings>): Promise<SoaSettings> {
    const client = this.supabase.getClient();
    const { data: row } = await client
      .from('tenants')
      .select('settings')
      .eq('id', tenantId)
      .single();
    const current = (row?.settings as Record<string, unknown>) ?? {};
    const currentSoa = (current['soa'] as Record<string, unknown>) ?? {};
    const merged: SoaSettings = { ...SOA_DEFAULTS, ...currentSoa, ...patch } as SoaSettings;
    // Light validation that bounds are sensible.
    merged.send_day = Math.max(1, Math.min(31, Math.floor(merged.send_day || 1)));
    merged.send_hour_utc = Math.max(0, Math.min(23, Math.floor(merged.send_hour_utc || 0)));
    const next = { ...current, soa: merged };
    const { error } = await client
      .from('tenants')
      .update({ settings: next })
      .eq('id', tenantId);
    if (error) throw error;
    return merged;
  }

  /**
   * Send statements to every customer of `tenantId` who has an open balance.
   * `triggeredBy` is recorded against each log row for auditability.
   * `customerIds` is optional — when provided, restricts to those customers
   * (used by the per-customer "Send statement" button).
   */
  async sendBatch(
    tenantId: string,
    triggeredBy: 'cron' | 'manual' | 'test',
    triggeredUserId: string | null,
    options: { customerIds?: string[]; periodMonths?: number } = {},
  ): Promise<SoaBatchResult> {
    const client = this.supabase.getClient();
    const batchId = randomUUID();

    // Tenant data + settings
    const { data: tenant, error: tenantErr } = await client
      .from('tenants')
      .select('id, name, currency, locale, phone, email, address, tax_id, settings')
      .eq('id', tenantId)
      .single<TenantRow>();
    if (tenantErr || !tenant) {
      throw new Error(`Tenant ${tenantId} not found: ${tenantErr?.message ?? ''}`);
    }
    const settings = this.getSettings(tenant.settings ?? {});

    // Statement period: last N months ending today (default last 6 months).
    const periodMonths = options.periodMonths ?? 6;
    const endDate = new Date();
    const startDate = new Date(endDate);
    startDate.setMonth(startDate.getMonth() - periodMonths);
    const startStr = startDate.toISOString().slice(0, 10);
    const endStr = endDate.toISOString().slice(0, 10);

    // Customers to process: either all with open balance, or restricted set.
    const balances = await this.statements.customerBalances(tenantId);
    const candidates = options.customerIds
      ? balances.filter((b) => options.customerIds!.includes(b.customer_id))
      : balances;

    const results: SoaSendRow[] = [];
    for (const c of candidates) {
      try {
        const row = await this.sendOne({
          tenant,
          settings,
          customer: c,
          batchId,
          triggeredBy,
          triggeredUserId,
          startDate: startStr,
          endDate: endStr,
        });
        results.push(row);
      } catch (err) {
        const error = err instanceof Error ? err.message : String(err);
        this.logger.error(`SOA send failed for customer ${c.customer_id}: ${error}`);
        const failed: SoaSendRow = {
          customer_id: c.customer_id,
          customer_name: c.full_name,
          channel: 'skipped',
          recipient: null,
          status: 'failed',
          error,
          outstanding: c.total_outstanding,
          open_invoices: c.open_invoices,
        };
        results.push(failed);
        await this.writeLog({
          tenantId,
          batchId,
          triggeredBy,
          triggeredUserId,
          row: failed,
        });
      }
    }

    return {
      batch_id: batchId,
      tenant_id: tenantId,
      processed: results.length,
      sent_email: results.filter((r) => r.status === 'sent' && r.channel === 'email').length,
      sent_whatsapp: results.filter((r) => r.status === 'sent' && r.channel === 'whatsapp').length,
      failed: results.filter((r) => r.status === 'failed').length,
      skipped: results.filter((r) => r.status.startsWith('skipped_')).length,
      results,
    };
  }

  private async sendOne(args: {
    tenant: TenantRow;
    settings: SoaSettings;
    customer: {
      customer_id: string;
      full_name: string;
      phone: string | null;
      email: string | null;
      open_invoices: number;
      total_outstanding: number;
    };
    batchId: string;
    triggeredBy: 'cron' | 'manual' | 'test';
    triggeredUserId: string | null;
    startDate: string;
    endDate: string;
  }): Promise<SoaSendRow> {
    const { tenant, settings, customer } = args;

    if (customer.total_outstanding <= 0) {
      const row: SoaSendRow = {
        customer_id: customer.customer_id,
        customer_name: customer.full_name,
        channel: 'skipped',
        recipient: null,
        status: 'skipped_no_balance',
        outstanding: 0,
        open_invoices: customer.open_invoices,
      };
      await this.writeLog({
        tenantId: tenant.id,
        batchId: args.batchId,
        triggeredBy: args.triggeredBy,
        triggeredUserId: args.triggeredUserId,
        row,
      });
      return row;
    }

    // No email AND no phone — nothing to do
    if (!customer.email && !customer.phone) {
      const row: SoaSendRow = {
        customer_id: customer.customer_id,
        customer_name: customer.full_name,
        channel: 'skipped',
        recipient: null,
        status: 'skipped_no_contact',
        outstanding: customer.total_outstanding,
        open_invoices: customer.open_invoices,
      };
      await this.writeLog({
        tenantId: tenant.id,
        batchId: args.batchId,
        triggeredBy: args.triggeredBy,
        triggeredUserId: args.triggeredUserId,
        row,
      });
      return row;
    }

    // Build the statement + PDF
    const statement = await this.statements.customerStatement(
      tenant.id,
      customer.customer_id,
      args.startDate,
      args.endDate,
    );
    const pdfBuffer = await this.pdf.render({
      statement,
      tenant: {
        name: tenant.name,
        currency: tenant.currency,
        locale: tenant.locale,
        address: tenant.address,
        phone: tenant.phone,
        email: tenant.email,
        tax_id: tenant.tax_id,
      },
      period: { startDate: args.startDate, endDate: args.endDate },
      generatedAt: new Date(),
    });

    // Prefer email if available and provider is configured
    if (customer.email && this.email.hasProvider()) {
      const monthName = new Date().toLocaleDateString(tenant.locale || 'pt-PT', {
        month: 'long',
        year: 'numeric',
      });
      const subject = renderTemplate(settings.subject_template, {
        month: monthName,
        customer_name: customer.full_name,
        tenant_name: tenant.name,
      });
      const intro = renderTemplate(settings.intro_template, {
        customer_name: customer.full_name,
        tenant_name: tenant.name,
        total_outstanding: this.formatMoney(
          customer.total_outstanding,
          tenant.currency,
          tenant.locale,
        ),
      });
      const html = this.buildHtml({
        tenant,
        customer,
        statement,
        intro,
        period: { startDate: args.startDate, endDate: args.endDate },
      });
      const fromName = settings.from_name?.trim() || tenant.name;
      const from = settings.from_email
        ? `${fromName} <${settings.from_email}>`
        : undefined;

      const safeName = customer.full_name.replace(/[^\w\d-]+/g, '_').slice(0, 40);
      const result = await this.email.send({
        to: customer.email,
        subject,
        html,
        from,
        replyTo: settings.reply_to ?? undefined,
        attachments: [
          {
            filename: `statement_${safeName}_${args.endDate}.pdf`,
            content: pdfBuffer,
            contentType: 'application/pdf',
          },
        ],
      });

      if (result.success) {
        const row: SoaSendRow = {
          customer_id: customer.customer_id,
          customer_name: customer.full_name,
          channel: 'email',
          recipient: customer.email,
          status: 'sent',
          outstanding: customer.total_outstanding,
          open_invoices: customer.open_invoices,
          provider_message_id: result.providerMessageId,
        };
        await this.writeLog({
          tenantId: tenant.id,
          batchId: args.batchId,
          triggeredBy: args.triggeredBy,
          triggeredUserId: args.triggeredUserId,
          row,
        });
        return row;
      }

      if ('skipped' in result) {
        // No provider — fall through to whatsapp if allowed
      } else {
        // hard email failure: still try whatsapp if allowed, otherwise record failure
        if (!(settings.whatsapp_fallback && customer.phone)) {
          const row: SoaSendRow = {
            customer_id: customer.customer_id,
            customer_name: customer.full_name,
            channel: 'email',
            recipient: customer.email,
            status: 'failed',
            error: result.error,
            outstanding: customer.total_outstanding,
            open_invoices: customer.open_invoices,
          };
          await this.writeLog({
            tenantId: tenant.id,
            batchId: args.batchId,
            triggeredBy: args.triggeredBy,
            triggeredUserId: args.triggeredUserId,
            row,
          });
          return row;
        }
      }
    }

    // WhatsApp fallback (or no provider): send a notification template.
    // The PDF cannot be attached to a template; the message tells the
    // customer their statement is ready and we owe X — they can ask us
    // to email a copy.
    if (settings.whatsapp_fallback && customer.phone) {
      const wa = await this.whatsapp.sendTemplate(
        customer.phone,
        'soa_monthly_notice',
        tenant.locale.startsWith('pt') ? 'pt_PT' : 'en',
        [
          {
            type: 'body',
            parameters: [
              { type: 'text', text: customer.full_name },
              {
                type: 'text',
                text: this.formatMoney(
                  customer.total_outstanding,
                  tenant.currency,
                  tenant.locale,
                ),
              },
              { type: 'text', text: tenant.name },
            ],
          },
        ],
        { tenantId: tenant.id, contextType: 'generic', contextId: customer.customer_id },
      );

      const row: SoaSendRow = wa.success
        ? {
            customer_id: customer.customer_id,
            customer_name: customer.full_name,
            channel: 'whatsapp',
            recipient: customer.phone,
            status: 'sent',
            outstanding: customer.total_outstanding,
            open_invoices: customer.open_invoices,
            provider_message_id: wa.messageId,
          }
        : {
            customer_id: customer.customer_id,
            customer_name: customer.full_name,
            channel: 'whatsapp',
            recipient: customer.phone,
            status: 'failed',
            error: wa.error,
            outstanding: customer.total_outstanding,
            open_invoices: customer.open_invoices,
          };
      await this.writeLog({
        tenantId: tenant.id,
        batchId: args.batchId,
        triggeredBy: args.triggeredBy,
        triggeredUserId: args.triggeredUserId,
        row,
      });
      return row;
    }

    // Nothing wired up — record as skipped (no provider)
    const row: SoaSendRow = {
      customer_id: customer.customer_id,
      customer_name: customer.full_name,
      channel: 'skipped',
      recipient: customer.email ?? customer.phone,
      status: 'skipped_no_provider',
      outstanding: customer.total_outstanding,
      open_invoices: customer.open_invoices,
    };
    await this.writeLog({
      tenantId: tenant.id,
      batchId: args.batchId,
      triggeredBy: args.triggeredBy,
      triggeredUserId: args.triggeredUserId,
      row,
    });
    return row;
  }

  private formatMoney(amount: number, currency: string, locale: string): string {
    return new Intl.NumberFormat(locale || 'pt-PT', {
      style: 'currency',
      currency: currency || 'AOA',
    }).format(amount);
  }

  private buildHtml(args: {
    tenant: TenantRow;
    customer: {
      customer_id: string;
      full_name: string;
      total_outstanding: number;
      open_invoices: number;
    };
    statement: Statement;
    intro: string;
    period: { startDate?: string; endDate?: string };
  }): string {
    const fmt = (n: number) => this.formatMoney(n, args.tenant.currency, args.tenant.locale);
    const date = (d?: string | null) =>
      d ? new Date(d).toLocaleDateString(args.tenant.locale || 'pt-PT') : '';
    const introHtml = escapeHtml(args.intro).replace(/\n/g, '<br/>');
    const a = args.statement.aging;
    const agingHtml = a
      ? `
        <table cellpadding="8" cellspacing="0" style="border-collapse:collapse;margin:16px 0;font-size:13px;">
          <tr style="background:#f3f4f6;">
            <td style="border:1px solid #e5e7eb;">Current</td>
            <td style="border:1px solid #e5e7eb;">1–30 d</td>
            <td style="border:1px solid #e5e7eb;">31–60 d</td>
            <td style="border:1px solid #e5e7eb;">60+ d</td>
            <td style="border:1px solid #e5e7eb;font-weight:600;">Total due</td>
          </tr>
          <tr>
            <td style="border:1px solid #e5e7eb;">${fmt(a.current)}</td>
            <td style="border:1px solid #e5e7eb;">${fmt(a.thirty)}</td>
            <td style="border:1px solid #e5e7eb;color:#d97706;">${fmt(a.sixty)}</td>
            <td style="border:1px solid #e5e7eb;color:#c00;">${fmt(a.ninety)}</td>
            <td style="border:1px solid #e5e7eb;font-weight:600;">${fmt(a.total)}</td>
          </tr>
        </table>`
      : '';
    return `<!doctype html>
<html><body style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#111;line-height:1.5;">
  <div style="max-width:640px;margin:0 auto;padding:24px;">
    <h2 style="margin:0 0 4px 0;">${escapeHtml(args.tenant.name)}</h2>
    <div style="color:#666;font-size:12px;margin-bottom:24px;">
      Statement of Account · ${date(args.period.startDate)} → ${date(args.period.endDate) || 'today'}
    </div>
    <div style="font-size:14px;">${introHtml}</div>
    ${agingHtml}
    <div style="font-size:14px;color:#111;margin-top:16px;">
      <strong>Open invoices:</strong> ${args.customer.open_invoices}<br/>
      <strong>Total outstanding:</strong> ${fmt(args.customer.total_outstanding)}
    </div>
    <p style="color:#666;font-size:12px;margin-top:24px;">
      The detailed statement is attached as a PDF. Please reply to this email if you have any questions.
    </p>
  </div>
</body></html>`;
  }

  private async writeLog(args: {
    tenantId: string;
    batchId: string;
    triggeredBy: 'cron' | 'manual' | 'test';
    triggeredUserId: string | null;
    row: SoaSendRow;
  }) {
    const { error } = await this.supabase
      .getClient()
      .from('soa_send_log')
      .insert({
        tenant_id: args.tenantId,
        batch_id: args.batchId,
        customer_id: args.row.customer_id,
        triggered_by: args.triggeredBy,
        triggered_user_id: args.triggeredUserId,
        channel: args.row.channel,
        recipient: args.row.recipient,
        status: args.row.status,
        error_message: args.row.error ?? null,
        outstanding: args.row.outstanding,
        open_invoices: args.row.open_invoices,
        provider_message_id: args.row.provider_message_id ?? null,
      });
    if (error) {
      this.logger.error(`Failed to write soa_send_log row: ${error.message}`);
    }
  }

  /** Return the most recent batches (header row + counts) for a tenant. */
  async listRecentBatches(tenantId: string, limit = 20) {
    const { data, error } = await this.supabase
      .getClient()
      .from('soa_send_log')
      .select('batch_id, triggered_by, channel, status, delivery_status, created_at')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(limit * 20); // pull more rows; we'll group below
    if (error) throw error;

    type Row = {
      batch_id: string;
      triggered_by: string;
      channel: string;
      status: string;
      delivery_status: string | null;
      created_at: string;
    };
    const batches = new Map<string, {
      batch_id: string;
      triggered_by: string;
      started_at: string;
      total: number;
      sent_email: number;
      sent_whatsapp: number;
      failed: number;
      skipped: number;
      // Delivery rollup from Resend webhooks. Only populated for rows
      // where status='sent' and a webhook event later landed.
      delivered: number;
      bounced: number;
      complained: number;
    }>();
    for (const r of (data ?? []) as Row[]) {
      let b = batches.get(r.batch_id);
      if (!b) {
        b = {
          batch_id: r.batch_id,
          triggered_by: r.triggered_by,
          started_at: r.created_at,
          total: 0,
          sent_email: 0,
          sent_whatsapp: 0,
          failed: 0,
          skipped: 0,
          delivered: 0,
          bounced: 0,
          complained: 0,
        };
        batches.set(r.batch_id, b);
      }
      b.total++;
      if (r.status === 'sent' && r.channel === 'email') b.sent_email++;
      if (r.status === 'sent' && r.channel === 'whatsapp') b.sent_whatsapp++;
      if (r.status === 'failed') b.failed++;
      if (r.status.startsWith('skipped_')) b.skipped++;
      if (r.delivery_status === 'delivered') b.delivered++;
      if (r.delivery_status === 'bounced') b.bounced++;
      if (r.delivery_status === 'complained') b.complained++;
    }
    return Array.from(batches.values()).slice(0, limit);
  }
}

function renderTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key) => vars[key] ?? '');
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => {
    switch (c) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      default:
        return '&#39;';
    }
  });
}
