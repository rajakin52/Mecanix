import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface SmsSendResult {
  sent: boolean;
  messageSid?: string;
  error?: string;
}

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);
  private readonly accountSid: string;
  private readonly authToken: string;
  private readonly apiKeySid: string;
  private readonly apiKeySecret: string;
  private readonly fromNumber: string;

  constructor(private readonly config: ConfigService) {
    this.accountSid = this.config.get<string>('TWILIO_ACCOUNT_SID', '');
    this.authToken = this.config.get<string>('TWILIO_AUTH_TOKEN', '');
    this.apiKeySid = this.config.get<string>('TWILIO_API_KEY_SID', '');
    this.apiKeySecret = this.config.get<string>('TWILIO_API_KEY_SECRET', '');
    this.fromNumber = this.config.get<string>('TWILIO_FROM_NUMBER', '');
  }

  isConfigured(): boolean {
    const hasAuth = (this.accountSid && this.authToken)
      || (this.accountSid && this.apiKeySid && this.apiKeySecret);
    return Boolean(hasAuth && this.fromNumber);
  }

  getConfigStatus(): { accountSid: boolean; authToken: boolean; apiKeySid: boolean; apiKeySecret: boolean; fromNumber: boolean; configured: boolean } {
    return {
      accountSid: !!this.accountSid,
      authToken: !!this.authToken,
      apiKeySid: !!this.apiKeySid,
      apiKeySecret: !!this.apiKeySecret,
      fromNumber: !!this.fromNumber,
      configured: this.isConfigured(),
    };
  }

  async sendText(to: string, body: string): Promise<SmsSendResult> {
    if (!this.isConfigured()) {
      this.logger.warn('SMS not configured — need TWILIO_ACCOUNT_SID (AC...) + TWILIO_FROM_NUMBER, plus either TWILIO_AUTH_TOKEN or TWILIO_API_KEY_SID + TWILIO_API_KEY_SECRET');
      return { sent: false, error: 'Twilio env vars not set on server' };
    }

    const cleanTo = to.startsWith('+') ? to : `+${to.replace(/\D/g, '')}`;

    // Prefer API key auth when provided (can be rotated without affecting master creds)
    const [authUser, authPass] = this.apiKeySid && this.apiKeySecret
      ? [this.apiKeySid, this.apiKeySecret]
      : [this.accountSid, this.authToken];
    const auth = Buffer.from(`${authUser}:${authPass}`).toString('base64');
    const params = new URLSearchParams({
      To: cleanTo,
      From: this.fromNumber,
      Body: body,
    });

    try {
      const resp = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}/Messages.json`,
        {
          method: 'POST',
          headers: {
            Authorization: `Basic ${auth}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: params.toString(),
        },
      );

      const respBody = await resp.text();

      if (!resp.ok) {
        this.logger.error(`Twilio SMS ${resp.status}: ${respBody}`);
        return { sent: false, error: `Twilio ${resp.status}: ${respBody.slice(0, 300)}` };
      }

      let sid: string | undefined;
      try {
        const parsed = JSON.parse(respBody) as { sid?: string };
        sid = parsed.sid;
      } catch {
        // non-JSON response, leave sid undefined
      }

      this.logger.log(`SMS sent to=${cleanTo} sid=${sid ?? 'unknown'}`);
      return { sent: true, ...(sid ? { messageSid: sid } : {}) };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.logger.error(`SMS send exception: ${msg}`);
      return { sent: false, error: msg };
    }
  }
}
