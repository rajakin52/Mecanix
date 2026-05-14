import { Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import type { Statement, StatementTransaction } from './statements.service';

export interface SoaPdfContext {
  statement: Statement;
  tenant: {
    name: string;
    currency: string;
    locale: string;
    address?: string | null;
    phone?: string | null;
    email?: string | null;
    tax_id?: string | null;
  };
  period: { startDate?: string; endDate?: string };
  generatedAt: Date;
}

@Injectable()
export class SoaPdfService {
  render(ctx: SoaPdfContext): Promise<Buffer> {
    return new Promise<Buffer>((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 40 });
      const chunks: Buffer[] = [];
      doc.on('data', (c: Buffer) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const fmt = (n: number) =>
        new Intl.NumberFormat(ctx.tenant.locale || 'pt-PT', {
          style: 'currency',
          currency: ctx.tenant.currency || 'AOA',
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }).format(n);
      const date = (d?: string | null) =>
        d ? new Date(d).toLocaleDateString(ctx.tenant.locale || 'pt-PT') : '';
      const s = (v: unknown) => (v == null ? '' : String(v));

      const customer = ctx.statement.entity as Record<string, unknown>;
      const customerName =
        s(customer.company_name) || s(customer.full_name) || 'Customer';

      // ── Header ──────────────────────────────────────────────
      doc.fontSize(20).fillColor('#111').text(ctx.tenant.name, { align: 'left' });
      doc.fontSize(9).fillColor('#666');
      if (ctx.tenant.address) doc.text(ctx.tenant.address);
      if (ctx.tenant.phone) doc.text(`Tel: ${ctx.tenant.phone}`);
      if (ctx.tenant.email) doc.text(ctx.tenant.email);
      if (ctx.tenant.tax_id) doc.text(`NIF: ${ctx.tenant.tax_id}`);

      doc.moveDown(0.5);
      doc.fontSize(16).fillColor('#111').text('Statement of Account', { align: 'right' });
      doc.fontSize(9).fillColor('#666');
      doc.text(`Generated: ${ctx.generatedAt.toLocaleString(ctx.tenant.locale || 'pt-PT')}`, {
        align: 'right',
      });
      if (ctx.period.startDate || ctx.period.endDate) {
        doc.text(
          `Period: ${date(ctx.period.startDate) || '—'} to ${date(ctx.period.endDate) || 'today'}`,
          { align: 'right' },
        );
      }
      doc.moveDown(1);

      // ── Customer block ──────────────────────────────────────
      doc.fillColor('#111').fontSize(11).text('Statement for', { underline: false });
      doc.fontSize(12).text(customerName);
      doc.fontSize(9).fillColor('#555');
      if (customer.email) doc.text(s(customer.email));
      if (customer.phone) doc.text(s(customer.phone));
      doc.fillColor('#000');
      doc.moveDown(0.8);

      // ── Aging buckets ───────────────────────────────────────
      if (ctx.statement.aging && ctx.statement.aging.total > 0) {
        const a = ctx.statement.aging;
        doc.fontSize(11).fillColor('#111').text('Aging summary');
        doc.moveDown(0.2);
        const startX = doc.x;
        const colW = 95;
        const y = doc.y;
        const buckets: Array<[string, number, string]> = [
          ['Current', a.current, '#0a7'],
          ['1–30 d', a.thirty, '#888'],
          ['31–60 d', a.sixty, '#d97706'],
          ['60+ d', a.ninety, '#c00'],
          ['Total due', a.total, '#111'],
        ];
        buckets.forEach(([label, amount, color], i) => {
          const x = startX + i * colW;
          doc.fontSize(8).fillColor('#666').text(label, x, y, { width: colW - 5 });
          doc
            .fontSize(11)
            .fillColor(color)
            .text(fmt(amount), x, y + 12, { width: colW - 5 });
        });
        doc.fillColor('#000');
        doc.y = y + 32;
        doc.moveDown(1);
      }

      // ── Transactions table ─────────────────────────────────
      doc.fontSize(11).fillColor('#111').text('Transactions');
      doc.moveDown(0.3);

      const tableTop = doc.y;
      const cols = [
        { label: 'Date', x: 40, w: 60 },
        { label: 'Ref', x: 100, w: 75 },
        { label: 'Description', x: 175, w: 175 },
        { label: 'Debit', x: 350, w: 55, align: 'right' as const },
        { label: 'Credit', x: 405, w: 55, align: 'right' as const },
        { label: 'Balance', x: 460, w: 70, align: 'right' as const },
      ];

      doc.fontSize(8).fillColor('#666');
      for (const c of cols) {
        doc.text(c.label, c.x, tableTop, { width: c.w, align: c.align ?? 'left' });
      }
      doc
        .strokeColor('#ddd')
        .lineWidth(0.5)
        .moveTo(40, tableTop + 12)
        .lineTo(530, tableTop + 12)
        .stroke();
      doc.y = tableTop + 16;
      doc.fillColor('#000');

      const renderTxRow = (tx: StatementTransaction) => {
        // page break check
        if (doc.y > 720) {
          doc.addPage();
          doc.y = 40;
        }
        const y = doc.y;
        doc.fontSize(8).fillColor('#111');
        doc.text(date(tx.date), cols[0]!.x, y, { width: cols[0]!.w });
        doc.text(tx.reference, cols[1]!.x, y, { width: cols[1]!.w });
        const desc =
          tx.type === 'invoice' && tx.days_overdue && tx.days_overdue > 0
            ? `${tx.description} (${tx.days_overdue}d overdue)`
            : tx.description;
        doc.text(desc, cols[2]!.x, y, { width: cols[2]!.w });
        doc.text(tx.debit ? fmt(tx.debit) : '', cols[3]!.x, y, {
          width: cols[3]!.w,
          align: 'right',
        });
        doc.text(tx.credit ? fmt(tx.credit) : '', cols[4]!.x, y, {
          width: cols[4]!.w,
          align: 'right',
        });
        doc.text(fmt(tx.runningBalance), cols[5]!.x, y, {
          width: cols[5]!.w,
          align: 'right',
        });
        doc.y = y + 14;
      };

      // Opening balance row if present
      if (ctx.statement.openingBalance !== 0) {
        doc.fontSize(8).fillColor('#666');
        doc.text('Opening balance', cols[2]!.x, doc.y, { width: cols[2]!.w });
        doc.text(fmt(ctx.statement.openingBalance), cols[5]!.x, doc.y - 10, {
          width: cols[5]!.w,
          align: 'right',
        });
        doc.y += 14;
      }

      for (const tx of ctx.statement.transactions) {
        renderTxRow(tx);
      }

      doc
        .strokeColor('#bbb')
        .lineWidth(0.5)
        .moveTo(40, doc.y)
        .lineTo(530, doc.y)
        .stroke();
      doc.y += 6;

      // ── Totals ────────────────────────────────────────────
      doc.fontSize(9).fillColor('#111');
      const totalsY = doc.y;
      doc.text('Total debits', cols[2]!.x, totalsY, { width: cols[2]!.w });
      doc.text(fmt(ctx.statement.totalDebits), cols[3]!.x, totalsY, {
        width: cols[3]!.w,
        align: 'right',
      });
      doc.text(fmt(ctx.statement.totalCredits), cols[4]!.x, totalsY, {
        width: cols[4]!.w,
        align: 'right',
      });
      doc.y = totalsY + 16;

      doc.fontSize(11).fillColor('#111');
      const balanceY = doc.y;
      doc.text('Closing balance', cols[2]!.x, balanceY, { width: cols[2]!.w });
      doc.fillColor(ctx.statement.closingBalance > 0 ? '#c00' : '#0a7');
      doc.text(fmt(ctx.statement.closingBalance), cols[5]!.x, balanceY, {
        width: cols[5]!.w,
        align: 'right',
      });
      doc.fillColor('#000');
      doc.y = balanceY + 24;

      // ── Footer ────────────────────────────────────────────
      doc
        .fontSize(8)
        .fillColor('#888')
        .text(
          'Please remit outstanding amounts to the bank account on file. For queries, contact us using the details above.',
          40,
          780,
          { width: 510, align: 'center' },
        );

      doc.end();
    });
  }
}
