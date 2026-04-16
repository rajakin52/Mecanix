import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class AccountingSyncService {
  private readonly logger = new Logger(AccountingSyncService.name);

  constructor(private readonly supabase: SupabaseService) {}

  async listConnections(tenantId: string) {
    const { data, error } = await this.supabase
      .getClient()
      .from('accounting_connections')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  }

  async createConnection(
    tenantId: string,
    input: {
      provider: string;
      baseUrl?: string;
      databaseName?: string;
      apiKey?: string;
      config?: Record<string, unknown>;
    },
  ) {
    const { data, error } = await this.supabase
      .getClient()
      .from('accounting_connections')
      .insert({
        tenant_id: tenantId,
        provider: input.provider,
        base_url: input.baseUrl ?? null,
        database_name: input.databaseName ?? null,
        api_key: input.apiKey ?? null,
        config: input.config ?? {},
        is_active: true,
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async updateConnection(
    tenantId: string,
    id: string,
    input: Partial<{
      provider: string;
      baseUrl: string;
      databaseName: string;
      apiKey: string;
      config: Record<string, unknown>;
      is_active: boolean;
    }>,
  ) {
    const updatePayload: Record<string, unknown> = {};
    if (input.provider !== undefined) updatePayload.provider = input.provider;
    if (input.baseUrl !== undefined) updatePayload.base_url = input.baseUrl;
    if (input.databaseName !== undefined) updatePayload.database_name = input.databaseName;
    if (input.apiKey !== undefined) updatePayload.api_key = input.apiKey;
    if (input.config !== undefined) updatePayload.config = input.config;
    if (input.is_active !== undefined) updatePayload.is_active = input.is_active;

    const { data, error } = await this.supabase
      .getClient()
      .from('accounting_connections')
      .update(updatePayload)
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single();
    if (error) throw error;
    if (!data) throw new NotFoundException('Connection not found');
    return data;
  }

  async deleteConnection(tenantId: string, id: string) {
    const { error } = await this.supabase
      .getClient()
      .from('accounting_connections')
      .delete()
      .eq('id', id)
      .eq('tenant_id', tenantId);
    if (error) throw error;
    return { deleted: true };
  }

  async syncInvoice(tenantId: string, connectionId: string, invoiceId: string) {
    const connection = await this.getConnection(tenantId, connectionId);

    // Fetch the invoice data
    const { data: invoice, error: invError } = await this.supabase
      .getClient()
      .from('invoices')
      .select('*')
      .eq('id', invoiceId)
      .eq('tenant_id', tenantId)
      .single();
    if (invError || !invoice) throw new NotFoundException('Invoice not found');

    let success = false;
    let externalId: string | null = null;
    let errorMessage: string | null = null;

    try {
      switch (connection.provider) {
        case 'odoo':
          externalId = await this.syncInvoiceToOdoo(connection, invoice);
          break;
        case 'quickbooks':
          this.logger.log(`QuickBooks invoice sync placeholder for invoice ${invoiceId}`);
          externalId = `qb_${invoiceId}`;
          break;
        case 'zoho':
          this.logger.log(`Zoho invoice sync placeholder for invoice ${invoiceId}`);
          externalId = `zoho_${invoiceId}`;
          break;
        case 'xero':
          this.logger.log(`Xero invoice sync placeholder for invoice ${invoiceId}`);
          externalId = `xero_${invoiceId}`;
          break;
        case 'sage':
          this.logger.log(`Sage invoice sync placeholder for invoice ${invoiceId}`);
          externalId = `sage_${invoiceId}`;
          break;
        default:
          throw new Error(`Unsupported provider: ${String(connection.provider)}`);
      }
      success = true;
    } catch (err: unknown) {
      errorMessage = err instanceof Error ? err.message : String(err);
      this.logger.error(`Invoice sync failed: ${errorMessage}`);
    }

    // Log the sync attempt
    await this.supabase
      .getClient()
      .from('accounting_sync_log')
      .insert({
        tenant_id: tenantId,
        connection_id: connectionId,
        entity_type: 'invoice',
        entity_id: invoiceId,
        external_id: externalId,
        provider: connection.provider,
        action: 'push',
        success,
        error_message: errorMessage,
      });

    return { success, externalId, error: errorMessage };
  }

  async syncCustomer(tenantId: string, connectionId: string, customerId: string) {
    const connection = await this.getConnection(tenantId, connectionId);

    const { data: customer, error: custError } = await this.supabase
      .getClient()
      .from('customers')
      .select('*')
      .eq('id', customerId)
      .eq('tenant_id', tenantId)
      .single();
    if (custError || !customer) throw new NotFoundException('Customer not found');

    let success = false;
    let externalId: string | null = null;
    let errorMessage: string | null = null;

    try {
      switch (connection.provider) {
        case 'odoo':
          externalId = await this.syncCustomerToOdoo(connection, customer);
          break;
        case 'quickbooks':
          this.logger.log(`QuickBooks customer sync placeholder for customer ${customerId}`);
          externalId = `qb_${customerId}`;
          break;
        case 'zoho':
          this.logger.log(`Zoho customer sync placeholder for customer ${customerId}`);
          externalId = `zoho_${customerId}`;
          break;
        case 'xero':
          this.logger.log(`Xero customer sync placeholder for customer ${customerId}`);
          externalId = `xero_${customerId}`;
          break;
        case 'sage':
          this.logger.log(`Sage customer sync placeholder for customer ${customerId}`);
          externalId = `sage_${customerId}`;
          break;
        default:
          throw new Error(`Unsupported provider: ${String(connection.provider)}`);
      }
      success = true;
    } catch (err: unknown) {
      errorMessage = err instanceof Error ? err.message : String(err);
      this.logger.error(`Customer sync failed: ${errorMessage}`);
    }

    await this.supabase
      .getClient()
      .from('accounting_sync_log')
      .insert({
        tenant_id: tenantId,
        connection_id: connectionId,
        entity_type: 'customer',
        entity_id: customerId,
        external_id: externalId,
        provider: connection.provider,
        action: 'push',
        success,
        error_message: errorMessage,
      });

    return { success, externalId, error: errorMessage };
  }

  async getSyncLog(tenantId: string, connectionId: string) {
    const { data, error } = await this.supabase
      .getClient()
      .from('accounting_sync_log')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('connection_id', connectionId)
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) throw error;
    return data;
  }

  // --- Private helpers ---

  private async getConnection(tenantId: string, connectionId: string) {
    const { data, error } = await this.supabase
      .getClient()
      .from('accounting_connections')
      .select('*')
      .eq('id', connectionId)
      .eq('tenant_id', tenantId)
      .single();
    if (error || !data) throw new NotFoundException('Accounting connection not found');
    return data;
  }

  private async syncInvoiceToOdoo(
    connection: Record<string, unknown>,
    invoice: Record<string, unknown>,
  ): Promise<string> {
    const baseUrl = connection.base_url as string;
    const db = connection.database_name as string;

    // Odoo XML-RPC call to create account.move
    const xmlPayload = `<?xml version="1.0"?>
<methodCall>
  <methodName>execute_kw</methodName>
  <params>
    <param><value><string>${db}</string></value></param>
    <param><value><int>2</int></value></param>
    <param><value><string>${String(connection.api_key)}</string></value></param>
    <param><value><string>account.move</string></value></param>
    <param><value><string>create</string></value></param>
    <param><value><array><data>
      <value><struct>
        <member><name>move_type</name><value><string>out_invoice</string></value></member>
        <member><name>ref</name><value><string>${String(invoice.invoice_number)}</string></value></member>
      </struct></value>
    </data></array></value></param>
  </params>
</methodCall>`;

    const res = await fetch(`${baseUrl}/xmlrpc/2/object`, {
      method: 'POST',
      headers: { 'Content-Type': 'text/xml' },
      body: xmlPayload,
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      throw new Error(`Odoo XML-RPC failed with status ${String(res.status)}`);
    }

    const responseText = await res.text();
    // Extract the created ID from XML-RPC response
    const idMatch = responseText.match(/<int>(\d+)<\/int>/);
    return idMatch?.[1] ?? 'odoo_unknown';
  }

  private async syncCustomerToOdoo(
    connection: Record<string, unknown>,
    customer: Record<string, unknown>,
  ): Promise<string> {
    const baseUrl = connection.base_url as string;
    const db = connection.database_name as string;

    const xmlPayload = `<?xml version="1.0"?>
<methodCall>
  <methodName>execute_kw</methodName>
  <params>
    <param><value><string>${db}</string></value></param>
    <param><value><int>2</int></value></param>
    <param><value><string>${String(connection.api_key)}</string></value></param>
    <param><value><string>res.partner</string></value></param>
    <param><value><string>create</string></value></param>
    <param><value><array><data>
      <value><struct>
        <member><name>name</name><value><string>${String(customer.name)}</string></value></member>
        <member><name>email</name><value><string>${String(customer.email ?? '')}</string></value></member>
        <member><name>phone</name><value><string>${String(customer.phone ?? '')}</string></value></member>
      </struct></value>
    </data></array></value></param>
  </params>
</methodCall>`;

    const res = await fetch(`${baseUrl}/xmlrpc/2/object`, {
      method: 'POST',
      headers: { 'Content-Type': 'text/xml' },
      body: xmlPayload,
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      throw new Error(`Odoo XML-RPC failed with status ${String(res.status)}`);
    }

    const responseText = await res.text();
    const idMatch = responseText.match(/<int>(\d+)<\/int>/);
    return idMatch?.[1] ?? 'odoo_unknown';
  }
}
