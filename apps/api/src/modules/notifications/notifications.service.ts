import { Injectable, Logger } from '@nestjs/common';
import { WhatsAppService } from './whatsapp.service';
import { PushService } from './push.service';
import { SupabaseService } from '../supabase/supabase.service';
import { redactPhone } from '../../common/utils/redact';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly whatsapp: WhatsAppService,
    private readonly push: PushService,
    private readonly supabase: SupabaseService,
  ) {}

  /** Send notification when job card is created */
  async onJobCreated(tenantId: string, jobCardId: string) {
    const job = await this.getJobWithCustomer(tenantId, jobCardId);
    if (!job) return;

    const message = this.getTemplate('job_created', {
      plate: job.vehicle?.plate ?? '',
      vehicle: `${job.vehicle?.make ?? ''} ${job.vehicle?.model ?? ''}`,
      jobNumber: job.job_number ?? '',
    });

    // WhatsApp
    if (job.customer?.phone) {
      try { await this.whatsapp.sendText(job.customer.phone, message); } catch (e) { this.logger.warn(`WhatsApp failed: ${e}`); }
    }

    // Push notification
    if (job.customer_id) {
      try {
        await this.push.sendToCustomer(tenantId, job.customer_id, {
          title: 'Vehicle Received',
          body: `Your ${job.vehicle?.make ?? ''} ${job.vehicle?.model ?? ''} (${job.vehicle?.plate ?? ''}) has been checked in. Job: ${job.job_number}`,
          data: { jobId: jobCardId, type: 'job_created' },
        }, 'job', jobCardId);
      } catch (e) { this.logger.warn(`Push failed: ${e}`); }
    }
  }

  /** Send when status changes to awaiting_approval (quote ready) */
  async onAwaitingApproval(tenantId: string, jobCardId: string) {
    const job = await this.getJobWithCustomer(tenantId, jobCardId);
    if (!job) return;

    const message = this.getTemplate('awaiting_approval', {
      plate: job.vehicle?.plate ?? '',
      total: String(job.grand_total ?? '0'),
      jobNumber: job.job_number ?? '',
    });

    if (job.customer?.phone) {
      try { await this.whatsapp.sendText(job.customer.phone, message); } catch (e) { this.logger.warn(`WhatsApp failed: ${e}`); }
    }

    if (job.customer_id) {
      try {
        await this.push.sendToCustomer(tenantId, job.customer_id, {
          title: 'Quote Ready — Your Approval Needed',
          body: `A repair quote of ${job.grand_total ?? 0} is ready for your ${job.vehicle?.plate ?? 'vehicle'}. Tap to review and approve.`,
          data: { jobId: jobCardId, type: 'awaiting_approval' },
        }, 'job', jobCardId);
      } catch (e) { this.logger.warn(`Push failed: ${e}`); }
    }
  }

  /** Send when vehicle is ready for collection */
  async onReadyForCollection(tenantId: string, jobCardId: string) {
    const job = await this.getJobWithCustomer(tenantId, jobCardId);
    if (!job) return;

    // If an invoice already exists, include a tokenised pay link so
    // the customer can settle before arriving — shortens pickup time.
    const invoiceId = await this.getInvoiceIdForJob(tenantId, jobCardId);
    const payUrl = invoiceId ? await this.ensurePayLinkUrl(tenantId, invoiceId) : null;

    const base = this.getTemplate('ready_collection', {
      plate: job.vehicle?.plate ?? '',
      jobNumber: job.job_number ?? '',
    });
    const message = payUrl ? `${base}\n\nPay online: ${payUrl}` : base;

    if (job.customer?.phone) {
      let status: 'sent' | 'failed' = 'sent';
      let err: string | null = null;
      try {
        await this.whatsapp.sendText(job.customer.phone, message);
      } catch (e) {
        status = 'failed';
        err = e instanceof Error ? e.message : String(e);
        this.logger.warn(`WhatsApp failed: ${e}`);
      }
      await this.logComms(tenantId, {
        customerId: job.customer_id as string | null,
        jobCardId,
        invoiceId,
        channel: 'whatsapp',
        templateKey: 'ready_collection',
        recipient: job.customer.phone,
        body: message,
        deliveryStatus: status,
        deliveryError: err,
        metadata: payUrl ? { pay_link: true } : {},
      });
    }

    if (job.customer_id) {
      try {
        await this.push.sendToCustomer(tenantId, job.customer_id, {
          title: 'Your Vehicle is Ready! 🚗',
          body: `Your ${job.vehicle?.plate ?? 'vehicle'} is ready for collection. Job: ${job.job_number}`,
          data: { jobId: jobCardId, type: 'ready_collection' },
        }, 'job', jobCardId);
      } catch (e) { this.logger.warn(`Push failed: ${e}`); }
    }
  }

  /** Send when invoice is generated */
  async onInvoiceGenerated(tenantId: string, invoiceId: string) {
    const client = this.supabase.getClient();
    const { data: invoice } = await client
      .from('invoices')
      .select(
        '*, customer:customers(full_name, phone), job_card:job_cards(job_number)',
      )
      .eq('id', invoiceId)
      .eq('tenant_id', tenantId)
      .single();

    if (!invoice?.customer?.phone) return;

    const base = this.getTemplate('invoice_generated', {
      invoiceNumber: invoice.invoice_number ?? '',
      total: String(invoice.grand_total ?? '0'),
      jobNumber: invoice.job_card?.job_number ?? '',
    });
    const payUrl = await this.ensurePayLinkUrl(tenantId, invoiceId);
    const message = payUrl ? `${base}\n\nPay online: ${payUrl}` : base;

    let status: 'sent' | 'failed' = 'sent';
    let err: string | null = null;
    try {
      await this.whatsapp.sendText(invoice.customer.phone, message);
    } catch (e) {
      status = 'failed';
      err = e instanceof Error ? e.message : String(e);
      this.logger.warn(`WhatsApp invoice failed: ${e}`);
    }
    await this.logComms(tenantId, {
      customerId: invoice.customer_id as string | null,
      jobCardId: invoice.job_card_id as string | null,
      invoiceId,
      channel: 'whatsapp',
      templateKey: 'invoice_generated',
      recipient: invoice.customer.phone,
      body: message,
      deliveryStatus: status,
      deliveryError: err,
      metadata: payUrl ? { pay_link: true } : {},
    });
    return;
  }

  /** Send appointment confirmation */
  async onAppointmentConfirmed(tenantId: string, appointmentId: string) {
    const client = this.supabase.getClient();
    const { data: appointment } = await client
      .from('appointments')
      .select(
        '*, customer:customers(full_name, phone), vehicle:vehicles(plate)',
      )
      .eq('id', appointmentId)
      .eq('tenant_id', tenantId)
      .single();

    if (!appointment?.customer?.phone) return;

    const date = appointment.date
      ? new Date(appointment.date).toLocaleDateString('pt-PT')
      : '';
    const time = appointment.time ?? '';

    const message = this.getTemplate('appointment_confirmation', {
      date,
      time,
      plate: appointment.vehicle?.plate ?? '',
      serviceType: appointment.service_type ?? '',
    });

    return this.whatsapp.sendText(appointment.customer.phone, message);
  }

  /** Send service reminder notification */
  async onServiceReminderDue(tenantId: string, reminderId: string) {
    const client = this.supabase.getClient();
    const { data: reminder } = await client
      .from('service_reminders')
      .select(
        '*, vehicle:vehicles(plate, customer:customers(full_name, phone))',
      )
      .eq('id', reminderId)
      .eq('tenant_id', tenantId)
      .single();

    if (!reminder?.vehicle?.customer?.phone) return;

    const message = this.getTemplate('service_reminder', {
      plate: reminder.vehicle?.plate ?? '',
      serviceName: reminder.service_name ?? '',
    });

    return this.whatsapp.sendText(reminder.vehicle.customer.phone, message);
  }

  /** Send a custom message */
  async sendCustomMessage(phone: string, message: string) {
    return this.whatsapp.sendText(phone, message);
  }

  // ── Estimate Notifications ────────────────────────────────

  /**
   * Send estimate for approval via selected channels.
   */
  async sendEstimate(
    tenantId: string,
    estimateId: string,
    channels: string[],
  ) {
    const client = this.supabase.getClient();

    // Get estimate with job + customer details
    const { data: estimate } = await client
      .from('estimates')
      .select('*, job_card:job_cards(*, customer:customers(*), vehicle:vehicles(*))')
      .eq('id', estimateId)
      .eq('tenant_id', tenantId)
      .single();

    if (!estimate) return { sent: false, error: 'Estimate not found' };

    const job = estimate.job_card as Record<string, unknown>;
    const customer = job?.customer as Record<string, unknown>;
    const vehicle = job?.vehicle as Record<string, unknown>;

    if (!customer) return { sent: false, error: 'No customer on job card' };

    const results: Array<{ channel: string; success: boolean; messageId?: string }> = [];

    // WhatsApp
    if (channels.includes('whatsapp') && customer.phone) {
      const phone = customer.phone as string;
      const vehicleName = vehicle ? `${vehicle.plate} ${vehicle.make} ${vehicle.model}` : '';
      const total = Number(estimate.grand_total).toFixed(2);

      const bodyText = [
        `Estimate ${estimate.estimate_number}`,
        vehicleName ? `Vehicle: ${vehicleName}` : '',
        '',
        `Total: ${total} Kz`,
        estimate.valid_until ? `Valid until: ${new Date(estimate.valid_until as string).toLocaleDateString()}` : '',
        '',
        estimate.is_revision && estimate.change_summary ? `Note: ${estimate.change_summary}` : '',
      ].filter(Boolean).join('\n');

      try {
        const result = await this.whatsapp.sendInteractiveButtons(
          phone,
          bodyText,
          [
            { id: `approve_${estimateId}`, title: 'Aprovar' },
            { id: `reject_${estimateId}`, title: 'Rejeitar' },
          ],
          'MECANIX',
          'Respond to approve or reject this estimate',
        );

        results.push({
          channel: 'whatsapp',
          success: result?.success ?? false,
          messageId: result?.messageId,
        });

        // Log delivery
        await client.from('estimate_delivery_log').insert({
          tenant_id: tenantId,
          estimate_id: estimateId,
          channel: 'whatsapp',
          recipient: phone,
          status: result?.success ? 'sent' : 'failed',
          message_id: result?.messageId ?? null,
          sent_at: new Date().toISOString(),
          error_message: result?.success ? null : JSON.stringify(result?.error),
        });
      } catch (e) {
        results.push({ channel: 'whatsapp', success: false });
        this.logger.warn(`WhatsApp estimate send failed: ${e}`);
      }
    }

    // Push notification
    if (channels.includes('push')) {
      try {
        await this.push.sendToCustomer(tenantId, customer.id as string, {
          title: 'New Estimate Ready',
          body: `Estimate ${estimate.estimate_number} — ${Number(estimate.grand_total).toFixed(2)} Kz`,
          data: { type: 'estimate', estimateId, jobId: job.id as string },
        });
        results.push({ channel: 'push', success: true });

        await client.from('estimate_delivery_log').insert({
          tenant_id: tenantId,
          estimate_id: estimateId,
          channel: 'push',
          status: 'sent',
          sent_at: new Date().toISOString(),
        });
      } catch (e) {
        results.push({ channel: 'push', success: false });
        this.logger.warn(`Push estimate send failed: ${e}`);
      }
    }

    // Print (just log it)
    if (channels.includes('print')) {
      results.push({ channel: 'print', success: true });
      await client.from('estimate_delivery_log').insert({
        tenant_id: tenantId,
        estimate_id: estimateId,
        channel: 'print',
        status: 'sent',
        sent_at: new Date().toISOString(),
      });
    }

    // Update estimate status to sent
    await client
      .from('estimates')
      .update({
        status: 'sent',
        approval_channels: channels,
        sent_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', estimateId)
      .eq('tenant_id', tenantId);

    return { sent: true, results };
  }

  // ── Purchase Request Approval Notifications ──────────────

  /**
   * Send purchase request for approval via WhatsApp to workshop manager.
   */
  async sendPurchaseRequestApproval(tenantId: string, purchaseRequestId: string) {
    const client = this.supabase.getClient();

    // Get PR with items, job card, requester info
    const { data: pr } = await client
      .from('purchase_requests')
      .select(`
        *,
        job_card:job_cards(id, job_number, vehicle:vehicles(plate, make, model)),
        requester:users!purchase_requests_requested_by_fkey(id, full_name),
        items:purchase_request_items(id, part_name, part_number, quantity, estimated_unit_cost)
      `)
      .eq('id', purchaseRequestId)
      .eq('tenant_id', tenantId)
      .single();

    if (!pr) {
      this.logger.warn(`PR ${purchaseRequestId} not found for WhatsApp notification`);
      return { sent: false, error: 'Purchase request not found' };
    }

    // Find workshop manager/owner to send approval to
    const { data: managers } = await client
      .from('users')
      .select('id, full_name, phone')
      .eq('tenant_id', tenantId)
      .in('role', ['owner', 'manager'])
      .not('phone', 'is', null);

    if (!managers || managers.length === 0) {
      this.logger.warn(`No managers with phone found for tenant ${tenantId}`);
      return { sent: false, error: 'No managers with phone number found' };
    }

    const job = pr.job_card as Record<string, unknown> | null;
    const vehicle = job?.vehicle as Record<string, unknown> | null;
    const requester = pr.requester as Record<string, unknown> | null;
    const items = pr.items as Array<Record<string, unknown>> ?? [];

    const vehicleDesc = vehicle
      ? `${vehicle.make ?? ''} ${vehicle.model ?? ''}`
      : '';
    const jobDesc = job
      ? `${job.job_number}${vehicleDesc ? ` (${(vehicle?.plate as string) ?? ''} ${vehicleDesc.trim()})` : ''}`
      : 'N/A';

    const itemLines = items.map((item) => {
      const cost = Number(item.estimated_unit_cost ?? 0);
      const qty = Number(item.quantity ?? 1);
      const lineTotal = (cost * qty).toFixed(2);
      return `  • ${item.part_name ?? item.part_number ?? 'Unknown'} × ${qty} — $${lineTotal}`;
    });

    const total = Number(pr.estimated_cost ?? 0).toFixed(2);
    const threshold = Number(pr.approval_threshold ?? 0).toFixed(2);

    const bodyText = [
      `🔧 Purchase Request ${pr.pr_number}`,
      `Job: ${jobDesc}`,
      requester ? `Requested by: ${requester.full_name}` : '',
      '',
      'Items:',
      ...itemLines,
      '',
      `Total: $${total}`,
      `Threshold: $${threshold}`,
    ].filter((line) => line !== undefined).join('\n');

    const results: Array<{ phone: string; success: boolean; messageId?: string }> = [];

    for (const manager of managers) {
      const phone = manager.phone as string;
      try {
        const result = await this.whatsapp.sendInteractiveButtons(
          phone,
          bodyText,
          [
            { id: `approve_pr_${purchaseRequestId}`, title: 'Approve' },
            { id: `reject_pr_${purchaseRequestId}`, title: 'Reject' },
          ],
          'MECANIX',
          'Respond to approve or reject this purchase request',
        );

        results.push({
          phone,
          success: result?.success ?? false,
          messageId: result?.messageId,
        });

        this.logger.log(`PR approval WhatsApp sent to ${manager.full_name} (${phone})`);
      } catch (e) {
        results.push({ phone, success: false });
        this.logger.warn(`WhatsApp PR approval send failed for ${phone}: ${e}`);
      }
    }

    return { sent: results.some((r) => r.success), results };
  }

  /** Get notification history for a job */
  async getHistory(_tenantId: string, _jobCardId: string) {
    // For MVP, we don't persist notification history in DB
    // This would be enhanced in Phase 2 with a notifications table
    return [];
  }

  /** Get all available templates */
  getTemplates() {
    return {
      job_created: {
        pt: this.getTemplate('job_created', { plate: '{{plate}}', vehicle: '{{vehicle}}', jobNumber: '{{jobNumber}}' }, 'pt'),
        en: this.getTemplate('job_created', { plate: '{{plate}}', vehicle: '{{vehicle}}', jobNumber: '{{jobNumber}}' }, 'en'),
      },
      awaiting_approval: {
        pt: this.getTemplate('awaiting_approval', { plate: '{{plate}}', total: '{{total}}', jobNumber: '{{jobNumber}}' }, 'pt'),
        en: this.getTemplate('awaiting_approval', { plate: '{{plate}}', total: '{{total}}', jobNumber: '{{jobNumber}}' }, 'en'),
      },
      ready_collection: {
        pt: this.getTemplate('ready_collection', { plate: '{{plate}}', jobNumber: '{{jobNumber}}' }, 'pt'),
        en: this.getTemplate('ready_collection', { plate: '{{plate}}', jobNumber: '{{jobNumber}}' }, 'en'),
      },
      invoice_generated: {
        pt: this.getTemplate('invoice_generated', { invoiceNumber: '{{invoiceNumber}}', total: '{{total}}', jobNumber: '{{jobNumber}}' }, 'pt'),
        en: this.getTemplate('invoice_generated', { invoiceNumber: '{{invoiceNumber}}', total: '{{total}}', jobNumber: '{{jobNumber}}' }, 'en'),
      },
      service_reminder: {
        pt: this.getTemplate('service_reminder', { plate: '{{plate}}', serviceName: '{{serviceName}}' }, 'pt'),
        en: this.getTemplate('service_reminder', { plate: '{{plate}}', serviceName: '{{serviceName}}' }, 'en'),
      },
      appointment_confirmation: {
        pt: this.getTemplate('appointment_confirmation', { date: '{{date}}', time: '{{time}}', plate: '{{plate}}', serviceType: '{{serviceType}}' }, 'pt'),
        en: this.getTemplate('appointment_confirmation', { date: '{{date}}', time: '{{time}}', plate: '{{plate}}', serviceType: '{{serviceType}}' }, 'en'),
      },
      appointment_reminder: {
        pt: this.getTemplate('appointment_reminder', { time: '{{time}}', plate: '{{plate}}', serviceType: '{{serviceType}}' }, 'pt'),
        en: this.getTemplate('appointment_reminder', { time: '{{time}}', plate: '{{plate}}', serviceType: '{{serviceType}}' }, 'en'),
      },
    };
  }

  private getTemplate(templateName: string, data: Record<string, string>, language = 'pt'): string {
    const templates: Record<string, Record<string, string>> = {
      job_created: {
        pt: 'MECANIX: O seu veiculo {{plate}} ({{vehicle}}) foi registado com a ficha {{jobNumber}}. Manteremos informado do progresso.',
        en: 'MECANIX: Your vehicle {{plate}} ({{vehicle}}) has been registered with job card {{jobNumber}}. We will keep you informed.',
      },
      awaiting_approval: {
        pt: 'MECANIX: O orcamento para o seu veiculo {{plate}} esta pronto. Total: {{total}}. Ficha: {{jobNumber}}. Contacte-nos para aprovar.',
        en: 'MECANIX: The quote for your vehicle {{plate}} is ready. Total: {{total}}. Job: {{jobNumber}}. Contact us to approve.',
      },
      ready_collection: {
        pt: 'MECANIX: O seu veiculo {{plate}} esta pronto para recolha! Ficha {{jobNumber}}. Obrigado pela preferencia.',
        en: 'MECANIX: Your vehicle {{plate}} is ready for collection! Job {{jobNumber}}. Thank you for your business.',
      },
      invoice_generated: {
        pt: 'MECANIX: Fatura {{invoiceNumber}} no valor de {{total}}. Ref: {{jobNumber}}. Obrigado.',
        en: 'MECANIX: Invoice {{invoiceNumber}} for {{total}}. Ref: {{jobNumber}}. Thank you.',
      },
      service_reminder: {
        pt: 'MECANIX: Lembrete - O seu veiculo {{plate}} tem servico agendado: {{serviceName}}. Contacte-nos para agendar.',
        en: 'MECANIX: Reminder - Your vehicle {{plate}} has service due: {{serviceName}}. Contact us to schedule.',
      },
      appointment_confirmation: {
        pt: 'MECANIX: Agendamento confirmado para {{date}} as {{time}}. Veiculo: {{plate}}. Servico: {{serviceType}}.',
        en: 'MECANIX: Appointment confirmed for {{date}} at {{time}}. Vehicle: {{plate}}. Service: {{serviceType}}.',
      },
      appointment_reminder: {
        pt: 'MECANIX: Lembrete - Tem agendamento amanha as {{time}}. Veiculo: {{plate}}. Servico: {{serviceType}}.',
        en: 'MECANIX: Reminder - You have an appointment tomorrow at {{time}}. Vehicle: {{plate}}. Service: {{serviceType}}.',
      },
    };

    const template = templates[templateName]?.[language] ?? templates[templateName]?.['pt'] ?? '';
    return Object.entries(data).reduce(
      (text, [key, value]) => text.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value),
      template,
    );
  }

  private async getJobWithCustomer(tenantId: string, jobCardId: string) {
    const client = this.supabase.getClient();
    const { data } = await client
      .from('job_cards')
      .select(
        '*, customer:customers(id, full_name, phone), vehicle:vehicles(plate, make, model)',
      )
      .eq('id', jobCardId)
      .eq('tenant_id', tenantId)
      .single();
    return data;
  }

  /**
   * Appends a row to customer_comms. Never throws — comms logging
   * must not block the caller if the DB insert fails. Logs on the
   * common path so the back-office can reconstruct the customer
   * relationship audit trail.
   */
  private async logComms(
    tenantId: string,
    row: {
      customerId?: string | null;
      jobCardId?: string | null;
      invoiceId?: string | null;
      channel: 'whatsapp' | 'sms' | 'push' | 'email';
      templateKey: string;
      recipient?: string | null;
      body?: string | null;
      deliveryStatus?: 'queued' | 'sent' | 'delivered' | 'read' | 'failed';
      deliveryError?: string | null;
      metadata?: Record<string, unknown>;
    },
  ) {
    try {
      await this.supabase.getClient().from('customer_comms').insert({
        tenant_id: tenantId,
        customer_id: row.customerId ?? null,
        job_card_id: row.jobCardId ?? null,
        invoice_id: row.invoiceId ?? null,
        channel: row.channel,
        template_key: row.templateKey,
        recipient: row.recipient ?? null,
        body: row.body ?? null,
        delivery_status: row.deliveryStatus ?? 'sent',
        delivery_error: row.deliveryError ?? null,
        metadata: row.metadata ?? {},
      });
    } catch (e) {
      this.logger.warn(`Comms log insert failed: ${e}`);
    }
  }

  /**
   * Ensure an invoice has a public pay token. Returns the URL or
   * null if no app base URL is configured / the invoice has no
   * balance.
   */
  private async ensurePayLinkUrl(tenantId: string, invoiceId: string): Promise<string | null> {
    const base = process.env.PUBLIC_APP_URL ?? '';
    if (!base) return null;
    const client = this.supabase.getClient();
    const { data: inv } = await client
      .from('invoices')
      .select('public_pay_token, public_pay_expires_at, balance_due, status')
      .eq('id', invoiceId)
      .eq('tenant_id', tenantId)
      .single();
    if (!inv) return null;
    if (Number(inv.balance_due) <= 0) return null;
    if (inv.status === 'draft' || inv.status === 'cancelled') return null;

    let token = inv.public_pay_token as string | null;
    const expired =
      inv.public_pay_expires_at &&
      new Date(inv.public_pay_expires_at as string).getTime() < Date.now();
    if (!token || expired) {
      const newToken = [...Array(24)]
        .map(() => Math.floor(Math.random() * 16).toString(16))
        .join('') + Date.now().toString(16);
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      await client
        .from('invoices')
        .update({
          public_pay_token: newToken,
          public_pay_created_at: new Date().toISOString(),
          public_pay_expires_at: expiresAt,
        })
        .eq('id', invoiceId)
        .eq('tenant_id', tenantId);
      token = newToken;
    }
    // Locale prefix can't be derived here without a tenant default;
    // leave it unprefixed — the /public/pay/[token] route handler
    // resolves locale via Next.js middleware.
    return `${base.replace(/\/+$/, '')}/public/pay/${token}`;
  }

  private async getInvoiceIdForJob(tenantId: string, jobCardId: string): Promise<string | null> {
    const { data } = await this.supabase
      .getClient()
      .from('invoices')
      .select('id, balance_due')
      .eq('tenant_id', tenantId)
      .eq('job_card_id', jobCardId)
      .not('status', 'eq', 'cancelled')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    return (data?.id as string | null) ?? null;
  }

  // ── Appointment Reminders (24h + 1h before) ──

  async processAppointmentReminders(tenantId: string) {
    const client = this.supabase.getClient();
    const now = new Date();
    const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const in1h = new Date(now.getTime() + 60 * 60 * 1000);
    let sent = 0;

    // 24h reminders: appointments starting within 24-25 hours that haven't been reminded
    const { data: appts24 } = await client
      .from('appointments')
      .select('*, customer:customers(full_name, phone), vehicle:vehicles(plate, make, model)')
      .eq('tenant_id', tenantId)
      .eq('reminder_sent_24h', false)
      .in('status', ['booked', 'confirmed'])
      .gte('scheduled_start', in24h.toISOString())
      .lt('scheduled_start', new Date(in24h.getTime() + 60 * 60 * 1000).toISOString());

    for (const appt of appts24 ?? []) {
      const customer = appt.customer as Record<string, unknown> | null;
      const vehicle = appt.vehicle as Record<string, unknown> | null;
      if (customer?.phone) {
        const date = new Date(appt.scheduled_start as string).toLocaleDateString();
        const time = new Date(appt.scheduled_start as string).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const msg = `MECANIX Reminder: Your appointment is tomorrow ${date} at ${time} for ${vehicle?.plate ?? 'your vehicle'} (${vehicle?.make ?? ''} ${vehicle?.model ?? ''}). We look forward to seeing you!`;
        try {
          await this.whatsapp.sendText(customer.phone as string, msg);
          await client.from('appointments').update({ reminder_sent_24h: true, reminder_sent_24h_at: now.toISOString() }).eq('id', appt.id);
          sent++;
        } catch (e) { this.logger.warn(`Appointment 24h reminder failed: ${e}`); }
      }
    }

    // 1h reminders
    const { data: appts1 } = await client
      .from('appointments')
      .select('*, customer:customers(full_name, phone), vehicle:vehicles(plate)')
      .eq('tenant_id', tenantId)
      .eq('reminder_sent_1h', false)
      .in('status', ['booked', 'confirmed'])
      .gte('scheduled_start', in1h.toISOString())
      .lt('scheduled_start', new Date(in1h.getTime() + 60 * 60 * 1000).toISOString());

    for (const appt of appts1 ?? []) {
      const customer = appt.customer as Record<string, unknown> | null;
      if (customer?.phone) {
        const time = new Date(appt.scheduled_start as string).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const msg = `MECANIX: Your appointment is in 1 hour (${time}). See you soon!`;
        try {
          await this.whatsapp.sendText(customer.phone as string, msg);
          await client.from('appointments').update({ reminder_sent_1h: true, reminder_sent_1h_at: now.toISOString() }).eq('id', appt.id);
          sent++;
        } catch (e) { this.logger.warn(`Appointment 1h reminder failed: ${e}`); }
      }
    }

    return { sent };
  }

  // ── Payment Reminders (overdue invoices) ──

  async processPaymentReminders(tenantId: string) {
    const client = this.supabase.getClient();
    const today = new Date().toISOString().split('T')[0] as string;
    let sent = 0;

    // Find overdue invoices not fully paid
    const { data: overdueInvoices } = await client
      .from('invoices')
      .select('*, customer:customers(full_name, phone)')
      .eq('tenant_id', tenantId)
      .in('status', ['sent', 'partial'])
      .lt('due_date', today);

    for (const inv of overdueInvoices ?? []) {
      const dueDate = new Date(inv.due_date as string);
      const daysOverdue = Math.floor((Date.now() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
      const reminderCount = inv.payment_reminder_count as number;

      // Send at 3, 7, 14, 30 days overdue
      const shouldRemind =
        (daysOverdue >= 3 && reminderCount < 1) ||
        (daysOverdue >= 7 && reminderCount < 2) ||
        (daysOverdue >= 14 && reminderCount < 3) ||
        (daysOverdue >= 30 && reminderCount < 4);

      if (!shouldRemind) continue;

      const customer = inv.customer as Record<string, unknown> | null;
      if (customer?.phone) {
        const amount = Number(inv.grand_total) - Number(inv.paid_amount ?? 0);
        const msg = `MECANIX Payment Reminder: Invoice ${inv.invoice_number} has an outstanding balance of ${amount.toFixed(2)}. Due date was ${dueDate.toLocaleDateString()}. Please arrange payment at your earliest convenience.`;
        try {
          await this.whatsapp.sendText(customer.phone as string, msg);
          await client.from('invoices').update({
            payment_reminder_count: reminderCount + 1,
            last_reminder_sent_at: new Date().toISOString(),
          }).eq('id', inv.id);
          sent++;
        } catch (e) { this.logger.warn(`Payment reminder failed: ${e}`); }
      }
    }

    return { sent };
  }

  /**
   * Send a payment reminder for a single invoice on demand. Used by
   * the back-office collections page so a receptionist can nudge a
   * customer without waiting for the cron batch. Increments the
   * ladder counter and last_reminder_sent_at so the cron won't then
   * re-send the same step.
   */
  async sendInvoicePaymentReminder(tenantId: string, invoiceId: string) {
    const client = this.supabase.getClient();

    const { data: inv } = await client
      .from('invoices')
      .select('*, customer:customers(full_name, phone)')
      .eq('id', invoiceId)
      .eq('tenant_id', tenantId)
      .single();

    if (!inv) {
      return { ok: false, reason: 'invoice_not_found' as const };
    }
    const balance = Number(inv.grand_total) - Number(inv.paid_amount ?? 0);
    if (balance <= 0) {
      return { ok: false, reason: 'nothing_owed' as const };
    }
    const customer = inv.customer as Record<string, unknown> | null;
    const phone = customer?.phone as string | undefined;
    if (!phone) {
      return { ok: false, reason: 'no_customer_phone' as const };
    }

    const dueDate = inv.due_date ? new Date(inv.due_date as string).toLocaleDateString() : '';
    const payUrl = await this.ensurePayLinkUrl(tenantId, invoiceId);
    const base = `MECANIX Payment Reminder: Invoice ${inv.invoice_number} has an outstanding balance of ${balance.toFixed(2)}.${dueDate ? ` Due date was ${dueDate}.` : ''} Please arrange payment at your earliest convenience.`;
    const msg = payUrl ? `${base}\n\nPay online: ${payUrl}` : base;

    let status: 'sent' | 'failed' = 'sent';
    let err: string | null = null;
    try {
      await this.whatsapp.sendText(phone, msg);
    } catch (e) {
      status = 'failed';
      err = e instanceof Error ? e.message : String(e);
      this.logger.warn(`Manual payment reminder failed: ${e}`);
    }

    await this.logComms(tenantId, {
      customerId: inv.customer_id as string | null,
      invoiceId,
      jobCardId: inv.job_card_id as string | null,
      channel: 'whatsapp',
      templateKey: 'payment_reminder',
      recipient: phone,
      body: msg,
      deliveryStatus: status,
      deliveryError: err,
      metadata: { manual: true, ladder_step: Number(inv.payment_reminder_count) + 1 },
    });

    if (status === 'failed') return { ok: false, reason: 'send_failed' as const };

    await client
      .from('invoices')
      .update({
        payment_reminder_count: (Number(inv.payment_reminder_count) || 0) + 1,
        last_reminder_sent_at: new Date().toISOString(),
      })
      .eq('id', invoiceId)
      .eq('tenant_id', tenantId);

    return { ok: true, reason: 'sent' as const, phone: redactPhone(phone) };
  }

  async listCustomerComms(
    tenantId: string,
    filters: { customerId?: string; jobCardId?: string; invoiceId?: string; limit?: number } = {},
  ) {
    let q = this.supabase
      .getClient()
      .from('customer_comms')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('sent_at', { ascending: false })
      .limit(filters.limit ?? 100);
    if (filters.customerId) q = q.eq('customer_id', filters.customerId);
    if (filters.jobCardId) q = q.eq('job_card_id', filters.jobCardId);
    if (filters.invoiceId) q = q.eq('invoice_id', filters.invoiceId);
    const { data, error } = await q;
    if (error) throw error;
    return data ?? [];
  }
}
