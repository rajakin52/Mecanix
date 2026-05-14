import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

export interface EmailAttachment {
  filename: string;
  content: Buffer;
  contentType?: string;
}

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  from?: string; // e.g. "Mecanix <noreply@mecanix.ao>"
  replyTo?: string;
  attachments?: EmailAttachment[];
}

export type SendEmailResult =
  | { success: true; providerMessageId: string }
  | { success: false; skipped: true; reason: 'no_provider' }
  | { success: false; error: string };

const DEFAULT_FROM = 'Mecanix <noreply@mecanix.ao>';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly client: Resend | null;
  private readonly defaultFrom: string;

  constructor(private readonly config: ConfigService) {
    const key = this.config.get<string>('RESEND_API_KEY', '');
    this.client = key ? new Resend(key) : null;
    this.defaultFrom = this.config.get<string>('RESEND_FROM_EMAIL', DEFAULT_FROM);
    if (!this.client) {
      this.logger.warn(
        'RESEND_API_KEY not set — EmailService will skip sends and return { skipped: true }',
      );
    }
  }

  async send(opts: SendEmailOptions): Promise<SendEmailResult> {
    if (!this.client) {
      this.logger.log(`[email skipped, no provider] to=${opts.to} subject=${opts.subject}`);
      return { success: false, skipped: true, reason: 'no_provider' };
    }

    try {
      const { data, error } = await this.client.emails.send({
        from: opts.from ?? this.defaultFrom,
        to: opts.to,
        subject: opts.subject,
        html: opts.html,
        text: opts.text,
        replyTo: opts.replyTo,
        attachments: opts.attachments?.map((a) => ({
          filename: a.filename,
          content: a.content,
          contentType: a.contentType,
        })),
      });

      if (error) {
        this.logger.error(`Resend error sending to ${opts.to}: ${error.message}`);
        return { success: false, error: error.message };
      }
      if (!data?.id) {
        return { success: false, error: 'No message id returned by Resend' };
      }
      return { success: true, providerMessageId: data.id };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Email send threw: ${message}`);
      return { success: false, error: message };
    }
  }

  hasProvider(): boolean {
    return this.client !== null;
  }
}
