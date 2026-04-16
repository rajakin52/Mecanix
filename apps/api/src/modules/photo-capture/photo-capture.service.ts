import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class PhotoCaptureService {
  constructor(private readonly supabase: SupabaseService) {}

  /**
   * Create a photo capture session — can be a draft (no jobCardId) for the wizard flow,
   * or linked to an existing job card.
   */
  async createSession(tenantId: string, userId: string, input: {
    jobCardId?: string;
    vehiclePlate?: string;
    vehicleInfo?: string;
    requiredPhotos?: string[];
    captureMode?: 'camera' | 'gallery';
    sendWhatsApp?: string; // phone number to send link via WhatsApp
  }) {
    // Generate short token
    const token = Array.from({ length: 8 }, () => Math.random().toString(36).charAt(2)).join('').toUpperCase();
    const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(); // 2 hours

    const { data, error } = await this.supabase.getClient()
      .from('photo_capture_sessions')
      .insert({
        tenant_id: tenantId,
        job_card_id: input.jobCardId ?? null,
        token,
        vehicle_plate: input.vehiclePlate ?? null,
        vehicle_info: input.vehicleInfo ?? null,
        required_photos: input.requiredPhotos ?? ['front', 'rear', 'left', 'right', 'dashboard', 'interior'],
        capture_mode: input.captureMode ?? 'camera',
        expires_at: expiresAt,
        created_by: userId,
      })
      .select()
      .single();

    if (error) throw error;

    const captureUrl = `${process.env['CORS_ORIGINS']?.split(',')[0] ?? 'https://mecanix-web-ten.vercel.app'}/capture/${token}`;

    // Send via WhatsApp if phone number provided
    if (input.sendWhatsApp) {
      try {
        const whatsappPhoneId = process.env['WHATSAPP_PHONE_NUMBER_ID'];
        const whatsappToken = process.env['WHATSAPP_ACCESS_TOKEN'];
        if (whatsappPhoneId && whatsappToken) {
          const modeText = input.captureMode === 'gallery'
            ? 'seleccionar as fotografias da galeria'
            : 'tirar as fotografias do veículo';
          const message = `MECANIX - Fotografias do veículo\n\n🚗 ${input.vehiclePlate ?? ''} ${input.vehicleInfo ?? ''}\n\nAbra o link abaixo no seu telemóvel para ${modeText}:\n\n${captureUrl}\n\n⏰ Este link expira em 2 horas.`;

          await fetch(`https://graph.facebook.com/v18.0/${whatsappPhoneId}/messages`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${whatsappToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              messaging_product: 'whatsapp',
              to: input.sendWhatsApp.replace(/\D/g, ''),
              type: 'text',
              text: { body: message },
            }),
          });
        }
      } catch { /* WhatsApp send is best-effort */ }
    }

    return { ...data, captureUrl, token };
  }

  /**
   * Get session by token (public — no auth needed)
   */
  async getByToken(token: string) {
    const { data, error } = await this.supabase.getClient()
      .from('photo_capture_sessions')
      .select('*')
      .eq('token', token)
      .eq('status', 'active')
      .gt('expires_at', new Date().toISOString())
      .single();

    if (error || !data) throw new NotFoundException('Session not found or expired');

    // Get already captured photos
    const { data: photos } = await this.supabase.getClient()
      .from('photo_capture_items')
      .select('*')
      .eq('session_id', data.id)
      .order('captured_at');

    return { ...data, photos: photos ?? [] };
  }

  /**
   * Upload a photo to a session (public — token validates)
   */
  async uploadPhoto(token: string, input: {
    photoType: string;
    storageUrl: string;
    fileSize?: number;
  }) {
    // Validate session
    const session = await this.getByToken(token);

    const { data, error } = await this.supabase.getClient()
      .from('photo_capture_items')
      .insert({
        session_id: session.id,
        tenant_id: session.tenant_id,
        photo_type: input.photoType,
        storage_url: input.storageUrl,
        file_size: input.fileSize ?? null,
      })
      .select()
      .single();

    if (error) throw error;

    // Check if all required photos are captured
    const { data: allPhotos } = await this.supabase.getClient()
      .from('photo_capture_items')
      .select('photo_type')
      .eq('session_id', session.id);

    const capturedTypes = new Set((allPhotos ?? []).map((p) => p.photo_type as string));
    const requiredTypes = session.required_photos as string[];
    const allCaptured = requiredTypes.every((t) => capturedTypes.has(t));

    if (allCaptured) {
      await this.supabase.getClient()
        .from('photo_capture_sessions')
        .update({ status: 'completed' })
        .eq('id', session.id);
    }

    return { photo: data, allCaptured, captured: capturedTypes.size, required: requiredTypes.length };
  }

  /**
   * Link a draft session to a job card (called after job card creation)
   */
  async linkToJob(tenantId: string, sessionId: string, jobCardId: string) {
    const { data, error } = await this.supabase.getClient()
      .from('photo_capture_sessions')
      .update({ job_card_id: jobCardId })
      .eq('id', sessionId)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error || !data) throw new NotFoundException('Session not found');
    return data;
  }

  /**
   * Get photos for a session by session ID (for wizard polling)
   */
  async getSessionPhotos(sessionId: string) {
    const { data: photos } = await this.supabase.getClient()
      .from('photo_capture_items')
      .select('*')
      .eq('session_id', sessionId)
      .order('captured_at');

    return photos ?? [];
  }

  /**
   * List sessions for a job card (authenticated)
   */
  async listByJob(tenantId: string, jobCardId: string) {
    const { data } = await this.supabase.getClient()
      .from('photo_capture_sessions')
      .select('*, photos:photo_capture_items(*)')
      .eq('tenant_id', tenantId)
      .eq('job_card_id', jobCardId)
      .order('created_at', { ascending: false });

    return data ?? [];
  }
}
