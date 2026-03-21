import { Controller, Get, Post, Query, Body, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { FastifyReply } from 'fastify';

@Controller('webhook/whatsapp')
export class WebhookController {
  private readonly verifyToken: string;

  constructor(private readonly config: ConfigService) {
    this.verifyToken = this.config.get<string>('WHATSAPP_VERIFY_TOKEN', 'mecanix-webhook-2026');
  }

  /**
   * Webhook verification — Meta sends a GET request to verify the callback URL.
   * Must return the hub.challenge value if the verify token matches.
   */
  @Get()
  verify(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') token: string,
    @Query('hub.challenge') challenge: string,
    @Res() reply: FastifyReply,
  ) {
    if (mode === 'subscribe' && token === this.verifyToken) {
      console.log('WhatsApp webhook verified');
      return reply.status(200).send(challenge);
    }
    console.warn('WhatsApp webhook verification failed', { mode, token });
    return reply.status(403).send('Forbidden');
  }

  /**
   * Receive incoming messages and status updates from WhatsApp.
   * Meta POSTs here when messages are received or delivery status changes.
   */
  @Post()
  async receive(@Body() body: Record<string, unknown>, @Res() reply: FastifyReply) {
    // Always respond 200 quickly — Meta retries if not acknowledged
    console.log('WhatsApp webhook received:', JSON.stringify(body).substring(0, 500));

    // TODO: Process incoming messages, delivery status updates
    // For now, just acknowledge
    return reply.status(200).send('OK');
  }
}
