import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class WhatsAppService {
  private readonly apiUrl = 'https://graph.facebook.com/v21.0';
  private readonly phoneNumberId: string;
  private readonly accessToken: string;

  constructor(private readonly config: ConfigService) {
    this.phoneNumberId = this.config.get<string>('WHATSAPP_PHONE_NUMBER_ID', '');
    this.accessToken = this.config.get<string>('WHATSAPP_ACCESS_TOKEN', '');
  }

  async sendTemplate(
    to: string,
    templateName: string,
    languageCode: string,
    components?: unknown[],
  ) {
    if (!this.phoneNumberId || !this.accessToken) {
      console.warn('WhatsApp not configured, skipping message');
      return null;
    }

    const cleanPhone = to.replace(/[\s\-\(\)]/g, '').replace(/^\+/, '');

    const body = {
      messaging_product: 'whatsapp',
      to: cleanPhone,
      type: 'template',
      template: {
        name: templateName,
        language: { code: languageCode },
        ...(components ? { components } : {}),
      },
    };

    try {
      const response = await fetch(
        `${this.apiUrl}/${this.phoneNumberId}/messages`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        },
      );

      const data = await response.json();

      if (!response.ok) {
        console.error('WhatsApp API error:', data);
        return { success: false, error: data };
      }

      return { success: true, messageId: data.messages?.[0]?.id };
    } catch (error) {
      console.error('WhatsApp send failed:', error);
      return { success: false, error };
    }
  }

  async sendText(to: string, text: string) {
    if (!this.phoneNumberId || !this.accessToken) {
      console.warn('WhatsApp not configured, skipping message');
      return null;
    }

    const cleanPhone = to.replace(/[\s\-\(\)]/g, '').replace(/^\+/, '');

    const body = {
      messaging_product: 'whatsapp',
      to: cleanPhone,
      type: 'text',
      text: { body: text },
    };

    try {
      const response = await fetch(
        `${this.apiUrl}/${this.phoneNumberId}/messages`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        },
      );

      const data = await response.json();

      if (!response.ok) {
        console.error('WhatsApp API error:', data);
        return { success: false, error: data };
      }

      return { success: true, messageId: data.messages?.[0]?.id };
    } catch (error) {
      console.error('WhatsApp send failed:', error);
      return { success: false, error };
    }
  }
}
