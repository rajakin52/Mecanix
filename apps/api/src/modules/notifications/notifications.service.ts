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

    const message = `MECANIX: O seu veículo ${job.vehicle?.plate} (${job.vehicle?.make} ${job.vehicle?.model}) foi registado com a ficha ${job.job_number}. Manteremos informado do progresso.`;

    return this.whatsapp.sendText(job.customer.phone, message);
  }

  /** Send when status changes to awaiting_approval (quote ready) */
  async onAwaitingApproval(tenantId: string, jobCardId: string) {
    const job = await this.getJobWithCustomer(tenantId, jobCardId);
    if (!job || !job.customer?.phone) return;

    const message = `MECANIX: O orçamento para o seu veículo ${job.vehicle?.plate} está pronto. Total: ${job.grand_total}. Por favor, entre em contacto para aprovar.`;

    return this.whatsapp.sendText(job.customer.phone, message);
  }

  /** Send when vehicle is ready for collection */
  async onReadyForCollection(tenantId: string, jobCardId: string) {
    const job = await this.getJobWithCustomer(tenantId, jobCardId);
    if (!job || !job.customer?.phone) return;

    const message = `MECANIX: O seu veículo ${job.vehicle?.plate} está pronto para recolha! Ficha ${job.job_number}. Obrigado pela preferência.`;

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

    const message = `MECANIX: Fatura ${invoice.invoice_number} no valor de ${invoice.grand_total}. Ref: ${invoice.job_card?.job_number}. Obrigado.`;

    return this.whatsapp.sendText(invoice.customer.phone, message);
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
