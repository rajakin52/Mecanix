import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../supabase/supabase.service';

// Meta Cloud API, pinned to the version we've tested against.
const META_GRAPH_VERSION = 'v21.0';

export type WhatsAppSendResult =
  | { success: true; messageId: string; eventId: string }
  | { success: false; error: string; eventId: string | null };

/** Where the send originated — persisted so you can trace a delivery back to a user action. */
export interface WhatsAppContext {
  tenantId?: string;
  contextType?: 'photo_capture' | 'signature' | 'estimate' | 'invoice' | 'appointment' | 'generic';
  contextId?: string;
}

@Injectable()
export class WhatsAppService {
  private readonly logger = new Logger(WhatsAppService.name);
  private readonly apiUrl = `https://graph.facebook.com/${META_GRAPH_VERSION}`;
  private readonly phoneNumberId: string;
  private readonly accessToken: string;

  constructor(
    private readonly config: ConfigService,
    private readonly supabase: SupabaseService,
  ) {
    this.phoneNumberId = this.config.get<string>('WHATSAPP_PHONE_NUMBER_ID', '');
    this.accessToken = this.config.get<string>('WHATSAPP_ACCESS_TOKEN', '');
  }

  /**
   * Normalise a phone string to E.164 without the leading '+'.
   * Meta Cloud API requires this format (e.g. 244924635555).
   *
   * Strategy:
   *  - strip everything non-digit
   *  - if the caller wrote `00XXX...` (international dial prefix), drop the `00`
   *  - if the resulting number is short enough that it clearly lacks a country
   *    code, prepend `defaultCountryCode`.
   *
   * Short numbers (<=9 digits) get the default country code prefixed; anything
   * longer is assumed to already include a country code. This is imperfect for
   * weird edge cases but covers Angola (9 digits after 244) and the standard
   * "user typed +244…" case correctly.
   */
  static normalizeToE164(raw: string, defaultCountryCode = '244'): string {
    let digits = raw.replace(/\D/g, '');
    if (digits.startsWith('00')) digits = digits.slice(2);
    if (digits.length <= 9) digits = defaultCountryCode + digits;
    return digits;
  }

  /** Insert a new whatsapp_events row. Returns id, or null if the insert itself failed. */
  private async logAttempt(row: {
    tenantId?: string;
    phoneRaw: string;
    phoneE164: string;
    templateName?: string;
    languageCode?: string;
    requestBody: unknown;
    contextType?: string;
    contextId?: string;
  }): Promise<string | null> {
    try {
      const { data, error } = await this.supabase
        .getClient()
        .from('whatsapp_events')
        .insert({
          tenant_id: row.tenantId ?? null,
          phone_raw: row.phoneRaw,
          phone_e164: row.phoneE164,
          meta_phone_number_id: this.phoneNumberId || null,
          template_name: row.templateName ?? null,
          language_code: row.languageCode ?? null,
          request_body: row.requestBody as object,
          status: 'pending',
          context_type: row.contextType ?? null,
          context_id: row.contextId ?? null,
        })
        .select('id')
        .single();
      if (error) {
        this.logger.error(`Failed to insert whatsapp_events row: ${error.message}`);
        return null;
      }
      return data.id as string;
    } catch (e) {
      this.logger.error(`whatsapp_events insert exception: ${e instanceof Error ? e.message : String(e)}`);
      return null;
    }
  }

  /** Patch an existing whatsapp_events row with outcome. */
  private async updateEvent(
    eventId: string,
    patch: {
      status: 'sent' | 'failed' | 'skipped';
      metaMessageId?: string;
      metaResponseCode?: number;
      metaResponseBody?: unknown;
      error?: string;
    },
  ): Promise<void> {
    try {
      await this.supabase
        .getClient()
        .from('whatsapp_events')
        .update({
          status: patch.status,
          meta_message_id: patch.metaMessageId ?? null,
          meta_response_code: patch.metaResponseCode ?? null,
          meta_response_body: (patch.metaResponseBody ?? null) as object | null,
          error: patch.error ?? null,
        })
        .eq('id', eventId);
    } catch (e) {
      this.logger.error(`whatsapp_events update exception: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  /**
   * Send an approved WhatsApp template message.
   *
   * Every attempt is written to `whatsapp_events`. If env vars are missing the
   * row is still written with status=skipped, so diagnosis never requires
   * staring at Railway logs.
   */
  async sendTemplate(
    to: string,
    templateName: string,
    languageCode: string,
    components: unknown[] | undefined,
    context: WhatsAppContext = {},
  ): Promise<WhatsAppSendResult> {
    const phoneE164 = WhatsAppService.normalizeToE164(to);

    const requestBody = {
      messaging_product: 'whatsapp',
      to: phoneE164,
      type: 'template',
      template: {
        name: templateName,
        language: { code: languageCode },
        ...(components && components.length > 0 ? { components } : {}),
      },
    };

    const eventId = await this.logAttempt({
      tenantId: context.tenantId,
      phoneRaw: to,
      phoneE164,
      templateName,
      languageCode,
      requestBody,
      contextType: context.contextType,
      contextId: context.contextId,
    });

    if (!this.phoneNumberId || !this.accessToken) {
      const error = 'WhatsApp not configured (missing WHATSAPP_PHONE_NUMBER_ID or WHATSAPP_ACCESS_TOKEN)';
      this.logger.warn(error);
      if (eventId) await this.updateEvent(eventId, { status: 'skipped', error });
      return { success: false, error, eventId };
    }

    try {
      const response = await fetch(`${this.apiUrl}/${this.phoneNumberId}/messages`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      const rawText = await response.text();
      let parsed: unknown;
      try {
        parsed = JSON.parse(rawText);
      } catch {
        parsed = { raw: rawText };
      }

      if (!response.ok) {
        const errMsg = `Meta API ${response.status}: ${rawText.slice(0, 400)}`;
        this.logger.error(errMsg);
        if (eventId) {
          await this.updateEvent(eventId, {
            status: 'failed',
            metaResponseCode: response.status,
            metaResponseBody: parsed,
            error: errMsg,
          });
        }
        return { success: false, error: errMsg, eventId };
      }

      const data = parsed as { messages?: Array<{ id?: string }> };
      const messageId = data.messages?.[0]?.id ?? '';
      if (eventId) {
        await this.updateEvent(eventId, {
          status: 'sent',
          metaMessageId: messageId,
          metaResponseCode: response.status,
          metaResponseBody: parsed,
        });
      }
      this.logger.log(`WhatsApp template "${templateName}" sent (wamid=${messageId})`);
      return { success: true, messageId, eventId: eventId ?? '' };
    } catch (e) {
      const error = `WhatsApp send exception: ${e instanceof Error ? e.message : String(e)}`;
      this.logger.error(error);
      if (eventId) await this.updateEvent(eventId, { status: 'failed', error });
      return { success: false, error, eventId };
    }
  }

  /**
   * Convenience wrapper for the approved `damage_photos_upload_request` template.
   * See WhatsApp template spec: {{1}}=vehicle, {{2}}=service number, button URL
   * param = capture token (suffix appended to the template's baked-in URL base).
   */
  async sendDamagePhotosUploadRequest(params: {
    to: string;
    vehicle: string;
    serviceNumber: string;
    captureToken: string;
    languageCode: 'pt_PT' | 'en';
    context?: WhatsAppContext;
  }): Promise<WhatsAppSendResult> {
    const components = [
      {
        type: 'body',
        parameters: [
          { type: 'text', text: params.vehicle },
          { type: 'text', text: params.serviceNumber },
        ],
      },
      {
        type: 'button',
        sub_type: 'url',
        index: '0',
        parameters: [{ type: 'text', text: params.captureToken }],
      },
    ];
    return this.sendTemplate(
      params.to,
      'damage_photos_upload_request',
      params.languageCode,
      components,
      params.context ?? {},
    );
  }

  /**
   * Free-form text. Only deliverable within the 24-hour customer service
   * window (i.e. the customer messaged us first). Use templates for anything
   * initiated by the business.
   */
  async sendText(to: string, text: string, context: WhatsAppContext = {}): Promise<WhatsAppSendResult> {
    const phoneE164 = WhatsAppService.normalizeToE164(to);
    const requestBody = {
      messaging_product: 'whatsapp',
      to: phoneE164,
      type: 'text',
      text: { body: text },
    };

    const eventId = await this.logAttempt({
      tenantId: context.tenantId,
      phoneRaw: to,
      phoneE164,
      requestBody,
      contextType: context.contextType,
      contextId: context.contextId,
    });

    if (!this.phoneNumberId || !this.accessToken) {
      const error = 'WhatsApp not configured (missing WHATSAPP_PHONE_NUMBER_ID or WHATSAPP_ACCESS_TOKEN)';
      this.logger.warn(error);
      if (eventId) await this.updateEvent(eventId, { status: 'skipped', error });
      return { success: false, error, eventId };
    }

    try {
      const response = await fetch(`${this.apiUrl}/${this.phoneNumberId}/messages`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });
      const rawText = await response.text();
      let parsed: unknown;
      try { parsed = JSON.parse(rawText); } catch { parsed = { raw: rawText }; }

      if (!response.ok) {
        const errMsg = `Meta API ${response.status}: ${rawText.slice(0, 400)}`;
        this.logger.error(errMsg);
        if (eventId) {
          await this.updateEvent(eventId, {
            status: 'failed',
            metaResponseCode: response.status,
            metaResponseBody: parsed,
            error: errMsg,
          });
        }
        return { success: false, error: errMsg, eventId };
      }

      const data = parsed as { messages?: Array<{ id?: string }> };
      const messageId = data.messages?.[0]?.id ?? '';
      if (eventId) {
        await this.updateEvent(eventId, {
          status: 'sent',
          metaMessageId: messageId,
          metaResponseCode: response.status,
          metaResponseBody: parsed,
        });
      }
      return { success: true, messageId, eventId: eventId ?? '' };
    } catch (e) {
      const error = `WhatsApp send exception: ${e instanceof Error ? e.message : String(e)}`;
      this.logger.error(error);
      if (eventId) await this.updateEvent(eventId, { status: 'failed', error });
      return { success: false, error, eventId };
    }
  }

  /**
   * Interactive button message (e.g. estimate approve/reject). 24-hour window
   * rules apply — same as sendText.
   */
  async sendInteractiveButtons(
    to: string,
    bodyText: string,
    buttons: Array<{ id: string; title: string }>,
    headerText?: string,
    footerText?: string,
    context: WhatsAppContext = {},
  ): Promise<WhatsAppSendResult> {
    const phoneE164 = WhatsAppService.normalizeToE164(to);
    const requestBody: Record<string, unknown> = {
      messaging_product: 'whatsapp',
      to: phoneE164,
      type: 'interactive',
      interactive: {
        type: 'button',
        ...(headerText ? { header: { type: 'text', text: headerText } } : {}),
        body: { text: bodyText },
        ...(footerText ? { footer: { text: footerText } } : {}),
        action: {
          buttons: buttons.slice(0, 3).map((btn) => ({
            type: 'reply',
            reply: { id: btn.id, title: btn.title.slice(0, 20) },
          })),
        },
      },
    };

    const eventId = await this.logAttempt({
      tenantId: context.tenantId,
      phoneRaw: to,
      phoneE164,
      requestBody,
      contextType: context.contextType,
      contextId: context.contextId,
    });

    if (!this.phoneNumberId || !this.accessToken) {
      const error = 'WhatsApp not configured (missing WHATSAPP_PHONE_NUMBER_ID or WHATSAPP_ACCESS_TOKEN)';
      this.logger.warn(error);
      if (eventId) await this.updateEvent(eventId, { status: 'skipped', error });
      return { success: false, error, eventId };
    }

    try {
      const response = await fetch(`${this.apiUrl}/${this.phoneNumberId}/messages`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });
      const rawText = await response.text();
      let parsed: unknown;
      try { parsed = JSON.parse(rawText); } catch { parsed = { raw: rawText }; }

      if (!response.ok) {
        const errMsg = `Meta API ${response.status}: ${rawText.slice(0, 400)}`;
        this.logger.error(errMsg);
        if (eventId) {
          await this.updateEvent(eventId, {
            status: 'failed',
            metaResponseCode: response.status,
            metaResponseBody: parsed,
            error: errMsg,
          });
        }
        return { success: false, error: errMsg, eventId };
      }

      const data = parsed as { messages?: Array<{ id?: string }> };
      const messageId = data.messages?.[0]?.id ?? '';
      if (eventId) {
        await this.updateEvent(eventId, {
          status: 'sent',
          metaMessageId: messageId,
          metaResponseCode: response.status,
          metaResponseBody: parsed,
        });
      }
      return { success: true, messageId, eventId: eventId ?? '' };
    } catch (e) {
      const error = `WhatsApp interactive send exception: ${e instanceof Error ? e.message : String(e)}`;
      this.logger.error(error);
      if (eventId) await this.updateEvent(eventId, { status: 'failed', error });
      return { success: false, error, eventId };
    }
  }
}
