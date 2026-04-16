import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import sharp from 'sharp';

/** Compress an image buffer: resize to max 1600px wide, JPEG quality 75 */
async function compressPhoto(buffer: Buffer): Promise<Buffer> {
  return sharp(buffer)
    .rotate()                // auto-rotate based on EXIF
    .resize(1600, 1600, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 75, mozjpeg: true })
    .toBuffer();
}

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
   * Accepts either a storageUrl (pre-uploaded) or base64Data (uploaded here to Supabase Storage)
   */
  async uploadPhoto(token: string, input: {
    photoType: string;
    storageUrl?: string;
    base64Data?: string;
    fileName?: string;
    fileSize?: number;
  }) {
    // Validate session
    const session = await this.getByToken(token);

    let storageUrl = input.storageUrl ?? '';

    // If base64 data provided, compress and upload to Supabase Storage
    if (input.base64Data) {
      // Strip data URL prefix if present (e.g. "data:image/jpeg;base64,...")
      const base64 = input.base64Data.replace(/^data:image\/\w+;base64,/, '');
      const rawBuffer = Buffer.from(base64, 'base64');
      const buffer = await compressPhoto(rawBuffer);
      const path = `${session.tenant_id}/${session.id}/${input.photoType}_${Date.now()}.jpg`;

      const { error: uploadError } = await this.supabase.getClient()
        .storage.from('vehicle-photos')
        .upload(path, buffer, {
          contentType: 'image/jpeg',
          upsert: true,
        });

      if (uploadError) throw uploadError;

      const { data: urlData } = this.supabase.getClient()
        .storage.from('vehicle-photos')
        .getPublicUrl(path);

      storageUrl = urlData.publicUrl;
    }

    if (!storageUrl) throw new BadRequestException('Either storageUrl or base64Data is required');

    const { data, error } = await this.supabase.getClient()
      .from('photo_capture_items')
      .insert({
        session_id: session.id,
        tenant_id: session.tenant_id,
        photo_type: input.photoType,
        storage_url: storageUrl,
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
   * Direct photo upload (mobile app) — uploads base64 to Supabase Storage
   * and updates the job card's photos array.
   */
  async directUpload(tenantId: string, input: {
    jobId: string;
    photoType: string;
    base64Data: string;
    fileName?: string;
  }) {
    const base64 = input.base64Data.replace(/^data:image\/\w+;base64,/, '');
    const rawBuffer = Buffer.from(base64, 'base64');
    const buffer = await compressPhoto(rawBuffer);
    const path = `${tenantId}/${input.jobId}/${input.photoType}_${Date.now()}.jpg`;

    const { error: uploadError } = await this.supabase.getClient()
      .storage.from('vehicle-photos')
      .upload(path, buffer, {
        contentType: 'image/jpeg',
        upsert: true,
      });

    if (uploadError) throw uploadError;

    const { data: urlData } = this.supabase.getClient()
      .storage.from('vehicle-photos')
      .getPublicUrl(path);

    const storageUrl = urlData.publicUrl;

    // Append to the job card's photos array
    const { data: job } = await this.supabase.getClient()
      .from('job_cards')
      .select('photos')
      .eq('id', input.jobId)
      .eq('tenant_id', tenantId)
      .single();

    const currentPhotos = (job?.photos as string[]) ?? [];
    await this.supabase.getClient()
      .from('job_cards')
      .update({ photos: [...currentPhotos, storageUrl] })
      .eq('id', input.jobId)
      .eq('tenant_id', tenantId);

    return { storageUrl, url: storageUrl };
  }

  /**
   * Create a signature session — sends a WhatsApp link for the customer to sign on their phone
   */
  async createSignatureSession(tenantId: string, userId: string, input: {
    jobCardId?: string;
    customerName?: string;
    vehiclePlate?: string;
    vehicleInfo?: string;
    sendWhatsApp: string;
  }) {
    const token = Array.from({ length: 8 }, () => Math.random().toString(36).charAt(2)).join('').toUpperCase();
    const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();

    const { data, error } = await this.supabase.getClient()
      .from('photo_capture_sessions')
      .insert({
        tenant_id: tenantId,
        job_card_id: input.jobCardId ?? null,
        token,
        vehicle_plate: input.vehiclePlate ?? null,
        vehicle_info: input.vehicleInfo ?? null,
        required_photos: ['signature'],
        capture_mode: 'camera',
        expires_at: expiresAt,
        created_by: userId,
      })
      .select()
      .single();

    if (error) throw error;

    const baseUrl = process.env['CORS_ORIGINS']?.split(',')[0] ?? 'https://mecanix-web-ten.vercel.app';
    const signUrl = `${baseUrl}/sign/${token}`;

    // Send via WhatsApp
    try {
      const whatsappPhoneId = process.env['WHATSAPP_PHONE_NUMBER_ID'];
      const whatsappToken = process.env['WHATSAPP_ACCESS_TOKEN'];
      if (whatsappPhoneId && whatsappToken) {
        const name = input.customerName ? `\n👤 ${input.customerName}` : '';
        const message = `MECANIX - Assinatura de Recepção\n${name}\n🚗 ${input.vehiclePlate ?? ''} ${input.vehicleInfo ?? ''}\n\nPor favor assine a recepção do veículo no link abaixo:\n\n${signUrl}\n\n⏰ Este link expira em 2 horas.`;

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
    } catch { /* best effort */ }

    return { ...data, signUrl, token };
  }

  /**
   * Upload a signature image for a session (public — token validates)
   */
  async uploadSignature(token: string, base64Data: string) {
    const session = await this.getByToken(token);

    // Upload signature PNG to Supabase Storage
    const base64 = base64Data.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64, 'base64');
    const path = `${session.tenant_id}/${session.id}/signature_${Date.now()}.png`;

    const { error: uploadError } = await this.supabase.getClient()
      .storage.from('vehicle-photos')
      .upload(path, buffer, {
        contentType: 'image/png',
        upsert: true,
      });

    if (uploadError) throw uploadError;

    const { data: urlData } = this.supabase.getClient()
      .storage.from('vehicle-photos')
      .getPublicUrl(path);

    const storageUrl = urlData.publicUrl;

    // Save as a capture item with type 'signature'
    await this.supabase.getClient()
      .from('photo_capture_items')
      .insert({
        session_id: session.id,
        tenant_id: session.tenant_id,
        photo_type: 'signature',
        storage_url: storageUrl,
        file_size: buffer.length,
      });

    // Mark session completed
    await this.supabase.getClient()
      .from('photo_capture_sessions')
      .update({ status: 'completed' })
      .eq('id', session.id);

    return { storageUrl, completed: true };
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
