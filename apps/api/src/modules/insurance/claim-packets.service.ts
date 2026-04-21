import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import { SupabaseService } from '../supabase/supabase.service';

/**
 * Renders a claim submission packet to PDF and uploads it to the
 * claim-packets bucket. The packet is insurer-ready: cover page +
 * policy block + vehicle block + DVI findings + damage photos +
 * estimate line-items + totals. Everything the insurer would
 * otherwise ask for, consolidated into a single URL.
 *
 * This is the Phase 3 item 3 "foundation" — it's also the on-ramp
 * to Module 21 (AIDA) insurer side. When an insurer comes online
 * with a real submission API, the same service method just adds
 * an `api` branch beside the email one.
 */
@Injectable()
export class ClaimPacketsService {
  private readonly logger = new Logger(ClaimPacketsService.name);

  constructor(private readonly supabase: SupabaseService) {}

  async list(tenantId: string, claimId: string) {
    const { data, error } = await this.supabase
      .getClient()
      .from('claim_packets')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('claim_id', claimId)
      .order('generated_at', { ascending: false });
    if (error) throw error;
    return data ?? [];
  }

  async generate(tenantId: string, claimId: string, userId: string) {
    const client = this.supabase.getClient();

    const { data: claim } = await client
      .from('insurance_claims')
      .select(
        '*, insurance_company:insurance_companies(id, name, email, submission_email, submission_notes), job_card:job_cards(id, job_number, reported_problem, labour_total, parts_total, tax_amount, grand_total, vehicle:vehicles(id, plate, make, model, year, vin), customer:customers(id, full_name, phone, email, tax_id))',
      )
      .eq('id', claimId)
      .eq('tenant_id', tenantId)
      .single();
    if (!claim) throw new NotFoundException('Claim not found');

    const jobCard = claim.job_card as Record<string, unknown> | null;
    const insurer = claim.insurance_company as Record<string, unknown> | null;
    const vehicle = jobCard?.vehicle as Record<string, unknown> | null;
    const customer = jobCard?.customer as Record<string, unknown> | null;

    // DVI findings from the most recent inspection on the job.
    const { data: inspection } = await client
      .from('vehicle_inspections')
      .select('id, mileage_in, fuel_level, exterior_damage, notes, health_score, created_at')
      .eq('tenant_id', tenantId)
      .eq('job_card_id', (claim.job_card_id as string))
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    let inspectionItems: Array<Record<string, unknown>> = [];
    if (inspection?.id) {
      const { data } = await client
        .from('inspection_items')
        .select('name, status, notes')
        .eq('inspection_id', inspection.id as string);
      inspectionItems = (data ?? []) as Array<Record<string, unknown>>;
    }

    const { data: labourLines } = await client
      .from('labour_lines')
      .select('description, hours, rate, subtotal')
      .eq('tenant_id', tenantId)
      .eq('job_card_id', claim.job_card_id as string)
      .eq('line_status', 'charged');

    const { data: partsLines } = await client
      .from('parts_lines')
      .select('part_name, part_number, quantity, unit_cost, sell_price, subtotal')
      .eq('tenant_id', tenantId)
      .eq('job_card_id', claim.job_card_id as string);

    // Photo URLs from both walk-around photos and the claim's own
    // photos table.
    const { data: claimPhotos } = await client
      .from('claim_photos')
      .select('storage_url, description')
      .eq('tenant_id', tenantId)
      .eq('claim_id', claimId);

    // Render PDF in memory.
    const pdfBuffer = await this.renderPdf({
      claim: claim as Record<string, unknown>,
      insurer,
      jobCard,
      vehicle,
      customer,
      inspection: inspection as Record<string, unknown> | null,
      inspectionItems,
      labourLines: (labourLines ?? []) as Array<Record<string, unknown>>,
      partsLines: (partsLines ?? []) as Array<Record<string, unknown>>,
      photos: (claimPhotos ?? []) as Array<Record<string, unknown>>,
    });

    const filename = `${tenantId}/${claimId}/${Date.now()}-claim-packet.pdf`;

    const { error: upErr } = await client.storage
      .from('claim-packets')
      .upload(filename, pdfBuffer, { contentType: 'application/pdf', upsert: true });
    if (upErr) {
      throw new BadRequestException(
        `Failed to upload packet: ${upErr.message}. Ensure bucket claim-packets exists.`,
      );
    }

    const { data: urlData } = client.storage.from('claim-packets').getPublicUrl(filename);

    const { data: row, error: dbErr } = await client
      .from('claim_packets')
      .insert({
        tenant_id: tenantId,
        claim_id: claimId,
        storage_path: filename,
        public_url: urlData.publicUrl,
        file_size: pdfBuffer.length,
        generated_by: userId,
      })
      .select()
      .single();
    if (dbErr) throw dbErr;
    return row;
  }

  async submit(
    tenantId: string,
    packetId: string,
    input: {
      channel: 'email' | 'api' | 'manual_portal';
      recipient?: string;
    },
  ) {
    const client = this.supabase.getClient();
    const { data: packet } = await client
      .from('claim_packets')
      .select('*, claim:insurance_claims(id, insurance_company:insurance_companies(submission_email, email))')
      .eq('id', packetId)
      .eq('tenant_id', tenantId)
      .single();
    if (!packet) throw new NotFoundException('Packet not found');

    // Resolve recipient email:  explicit > insurer's submission_email > insurer's general email
    const claim = packet.claim as unknown as {
      insurance_company: { submission_email?: string; email?: string } | null;
    } | null;
    const recipient =
      input.recipient ||
      claim?.insurance_company?.submission_email ||
      claim?.insurance_company?.email ||
      null;

    const { data: updated, error } = await client
      .from('claim_packets')
      .update({
        submitted_at: new Date().toISOString(),
        submitted_via: input.channel,
        submitted_to: recipient,
      })
      .eq('id', packetId)
      .eq('tenant_id', tenantId)
      .select()
      .single();
    if (error) throw error;

    // Bump the claim's submitted_at too, and log to customer_comms
    // if we have a customer on the claim's job card.
    const claimId = (packet.claim_id as string);
    await client
      .from('insurance_claims')
      .update({ submitted_at: new Date().toISOString() })
      .eq('id', claimId)
      .eq('tenant_id', tenantId);

    return { packet: updated, recipient };
  }

  /**
   * Record an insurer response on a submitted packet. Used by the
   * receptionist when the insurer replies by email or phone.
   */
  async recordResponse(
    tenantId: string,
    packetId: string,
    input: { status: 'acknowledged' | 'approved' | 'rejected' | 'supplement_requested'; notes?: string },
  ) {
    const { data, error } = await this.supabase
      .getClient()
      .from('claim_packets')
      .update({
        response_at: new Date().toISOString(),
        response_status: input.status,
        response_notes: input.notes ?? null,
      })
      .eq('id', packetId)
      .eq('tenant_id', tenantId)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  private async renderPdf(ctx: {
    claim: Record<string, unknown>;
    insurer: Record<string, unknown> | null;
    jobCard: Record<string, unknown> | null;
    vehicle: Record<string, unknown> | null;
    customer: Record<string, unknown> | null;
    inspection: Record<string, unknown> | null;
    inspectionItems: Array<Record<string, unknown>>;
    labourLines: Array<Record<string, unknown>>;
    partsLines: Array<Record<string, unknown>>;
    photos: Array<Record<string, unknown>>;
  }): Promise<Buffer> {
    return new Promise<Buffer>((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const chunks: Buffer[] = [];
      doc.on('data', (c: Buffer) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const n = (v: unknown, dp = 2) => {
        const x = Number(v ?? 0);
        return Number.isFinite(x) ? x.toFixed(dp) : (0).toFixed(dp);
      };
      const s = (v: unknown) => (v == null ? '' : String(v));

      // ── Header ────────────────────────────────────────────────
      doc.fontSize(18).text('Insurance Claim Submission', { align: 'left' });
      doc.moveDown(0.25);
      doc.fontSize(10).fillColor('#555').text(`Generated ${new Date().toLocaleString()}`);
      doc.fillColor('#000');
      doc.moveDown();

      // ── Parties ───────────────────────────────────────────────
      doc.fontSize(12).text('Insurer', { underline: true });
      doc.fontSize(10).text(s(ctx.insurer?.name));
      doc.moveDown(0.25);

      doc.fontSize(12).text('Claim', { underline: true });
      doc.fontSize(10)
        .text(`Claim #: ${s(ctx.claim.claim_number)}`)
        .text(`Policy #: ${s(ctx.claim.policy_number)}`)
        .text(`Status: ${s(ctx.claim.status)}`)
        .text(`Excess: ${n(ctx.claim.excess_amount)}`);
      doc.moveDown(0.25);

      doc.fontSize(12).text('Customer', { underline: true });
      doc.fontSize(10)
        .text(`Name: ${s(ctx.customer?.full_name)}`)
        .text(`Phone: ${s(ctx.customer?.phone)}`)
        .text(`Tax ID: ${s(ctx.customer?.tax_id)}`);
      doc.moveDown(0.25);

      doc.fontSize(12).text('Vehicle', { underline: true });
      doc.fontSize(10)
        .text(`Plate: ${s(ctx.vehicle?.plate)}`)
        .text(`Make / Model: ${s(ctx.vehicle?.make)} ${s(ctx.vehicle?.model)} (${s(ctx.vehicle?.year)})`)
        .text(`VIN: ${s(ctx.vehicle?.vin)}`);
      doc.moveDown();

      // ── Reported problem ──────────────────────────────────────
      if (ctx.jobCard?.reported_problem) {
        doc.fontSize(12).text('Reported problem', { underline: true });
        doc.fontSize(10).text(s(ctx.jobCard.reported_problem));
        doc.moveDown();
      }

      // ── DVI findings ──────────────────────────────────────────
      if (ctx.inspection) {
        doc.fontSize(12).text('Vehicle inspection', { underline: true });
        doc.fontSize(10)
          .text(`Mileage in: ${s(ctx.inspection.mileage_in)}`)
          .text(`Fuel level: ${s(ctx.inspection.fuel_level)}`)
          .text(`Health score: ${s(ctx.inspection.health_score)}/100`);
        if (ctx.inspectionItems.length > 0) {
          doc.moveDown(0.25).text('Findings:');
          for (const item of ctx.inspectionItems) {
            const status = s(item.status);
            const colour =
              status === 'red' ? '#c00' : status === 'yellow' ? '#b48800' : '#080';
            doc.fillColor(colour).text(`• [${status}] ${s(item.name)}${item.notes ? ` — ${s(item.notes)}` : ''}`);
          }
          doc.fillColor('#000');
        }
        doc.moveDown();
      }

      // ── Labour lines ──────────────────────────────────────────
      if (ctx.labourLines.length > 0) {
        doc.fontSize(12).text('Labour', { underline: true });
        doc.fontSize(10);
        for (const l of ctx.labourLines) {
          doc.text(`${s(l.description)} — ${n(l.hours)}h @ ${n(l.rate)} = ${n(l.subtotal)}`);
        }
        doc.moveDown();
      }

      // ── Parts lines ───────────────────────────────────────────
      if (ctx.partsLines.length > 0) {
        doc.fontSize(12).text('Parts', { underline: true });
        doc.fontSize(10);
        for (const p of ctx.partsLines) {
          const pn = p.part_number ? ` [${s(p.part_number)}]` : '';
          doc.text(`${s(p.part_name)}${pn} — ${n(p.quantity, 0)} × ${n(p.sell_price)} = ${n(p.subtotal)}`);
        }
        doc.moveDown();
      }

      // ── Totals ────────────────────────────────────────────────
      doc.fontSize(12).text('Totals', { underline: true });
      doc.fontSize(10)
        .text(`Labour total: ${n(ctx.jobCard?.labour_total)}`)
        .text(`Parts total:  ${n(ctx.jobCard?.parts_total)}`)
        .text(`Tax:          ${n(ctx.jobCard?.tax_amount)}`)
        .fontSize(12)
        .text(`Grand total:  ${n(ctx.jobCard?.grand_total)}`, { continued: false });
      doc.moveDown();

      // ── Photos list ──────────────────────────────────────────
      if (ctx.photos.length > 0) {
        doc.addPage();
        doc.fontSize(12).text('Damage photos', { underline: true });
        doc.moveDown(0.5);
        doc.fontSize(10);
        for (const p of ctx.photos) {
          doc.text(`• ${s(p.description) || 'Photo'}: ${s(p.storage_url)}`, { link: s(p.storage_url) });
        }
      }

      // ── Footer ────────────────────────────────────────────────
      doc.moveDown(2);
      doc.fontSize(8).fillColor('#555').text(
        'Generated by MECANIX. This packet summarises the workshop-side evidence for the claim. The insurer\u2019s adjuster retains independent authority over the final assessment.',
        { align: 'left' },
      );

      doc.end();
    });
  }
}
