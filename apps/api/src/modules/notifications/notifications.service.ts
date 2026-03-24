import { Injectable } from '@nestjs/common';
import { WhatsAppService } from './whatsapp.service';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class NotificationsService {
  constructor(
    private readonly whatsapp: WhatsAppService,
    private readonly supabase: SupabaseService,
  ) {}

  /** Send notification when job card is created */
  async onJobCreated(tenantId: string, jobCardId: string) {
    const job = await this.getJobWithCustomer(tenantId, jobCardId);
    if (!job || !job.customer?.phone) return;

    const message = this.getTemplate('job_created', {
      plate: job.vehicle?.plate ?? '',
      vehicle: `${job.vehicle?.make ?? ''} ${job.vehicle?.model ?? ''}`,
      jobNumber: job.job_number ?? '',
    });

    return this.whatsapp.sendText(job.customer.phone, message);
  }

  /** Send when status changes to awaiting_approval (quote ready) */
  async onAwaitingApproval(tenantId: string, jobCardId: string) {
    const job = await this.getJobWithCustomer(tenantId, jobCardId);
    if (!job || !job.customer?.phone) return;

    const message = this.getTemplate('awaiting_approval', {
      plate: job.vehicle?.plate ?? '',
      total: String(job.grand_total ?? '0'),
      jobNumber: job.job_number ?? '',
    });

    return this.whatsapp.sendText(job.customer.phone, message);
  }

  /** Send when vehicle is ready for collection */
  async onReadyForCollection(tenantId: string, jobCardId: string) {
    const job = await this.getJobWithCustomer(tenantId, jobCardId);
    if (!job || !job.customer?.phone) return;

    const message = this.getTemplate('ready_collection', {
      plate: job.vehicle?.plate ?? '',
      jobNumber: job.job_number ?? '',
    });

    return this.whatsapp.sendText(job.customer.phone, message);
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

    const message = this.getTemplate('invoice_generated', {
      invoiceNumber: invoice.invoice_number ?? '',
      total: String(invoice.grand_total ?? '0'),
      jobNumber: invoice.job_card?.job_number ?? '',
    });

    return this.whatsapp.sendText(invoice.customer.phone, message);
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
        '*, customer:customers(full_name, phone), vehicle:vehicles(plate, make, model)',
      )
      .eq('id', jobCardId)
      .eq('tenant_id', tenantId)
      .single();
    return data;
  }
}
