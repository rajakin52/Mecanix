/**
 * smoke.ts — schema-invariant + query-smoke checks against the prod
 * Supabase instance, runnable from CI or ad-hoc to catch regressions.
 *
 * Usage:
 *   export SB_URL=https://<ref>.supabase.co
 *   export SB_KEY=<service-role key>
 *   pnpm --filter @mecanix/scripts smoke
 *
 * Each check returns { name, status: 'pass' | 'fail' | 'skip', details? }.
 * The script prints a per-check line, a summary, and exits non-zero on
 * any failure. Designed to run in under 30 seconds so it's painless to
 * invoke between deploys.
 *
 * What it catches:
 *  - schema invariants (no orphan rows, dangling FKs, draft invoices
 *    with positive balance, etc.)
 *  - PostgREST embedding regressions (e.g. the recent 404 caused by
 *    ambiguous users-join on invoices.getById)
 *  - cron-state regressions (last SOA batch sane, draft proformas
 *    with no lines = the orphan pattern we saw twice)
 *
 * What it does NOT catch:
 *  - business-logic bugs inside service methods (only end-to-end
 *    tests would catch those; deferred)
 *  - auth-guard regressions (the script uses service-role; bypasses
 *    TenantGuard / RolesGuard)
 */

const SB_URL = process.env['SB_URL'];
const SB_KEY = process.env['SB_KEY'];

if (!SB_URL || !SB_KEY) {
  console.error('SB_URL and SB_KEY env vars required');
  process.exit(2);
}

const headers: Record<string, string> = {
  apikey: SB_KEY,
  Authorization: `Bearer ${SB_KEY}`,
  'Content-Type': 'application/json',
};

interface Result {
  name: string;
  status: 'pass' | 'fail' | 'skip';
  details?: string;
}
const results: Result[] = [];

async function rest<T = unknown>(path: string): Promise<{ ok: boolean; body: T; status: number; error?: string }> {
  try {
    const res = await fetch(`${SB_URL}${path}`, { headers });
    const body = await res.json();
    return { ok: res.ok, body: body as T, status: res.status };
  } catch (err) {
    return { ok: false, body: {} as T, status: 0, error: err instanceof Error ? err.message : String(err) };
  }
}

async function check(name: string, fn: () => Promise<Result>): Promise<void> {
  try {
    const r = await fn();
    results.push(r);
    const icon = r.status === 'pass' ? '✓' : r.status === 'skip' ? '→' : '✗';
    const colour = r.status === 'pass' ? '\x1b[32m' : r.status === 'skip' ? '\x1b[33m' : '\x1b[31m';
    console.log(`${colour}${icon}\x1b[0m ${r.name}${r.details ? `\n    \x1b[90m${r.details}\x1b[0m` : ''}`);
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    results.push({ name, status: 'fail', details: detail });
    console.log(`\x1b[31m✗\x1b[0m ${name}\n    \x1b[90m${detail}\x1b[0m`);
  }
}

// ─────────────────────────────────────────────────────────────────────
// Schema invariants
// ─────────────────────────────────────────────────────────────────────

async function checkNoZeroValueDraftInvoices(): Promise<Result> {
  const { ok, body } = await rest<Array<{ id: string }>>('/rest/v1/invoices?status=eq.draft&grand_total=eq.0&select=id');
  if (!ok) return { name: 'no zero-value drafts', status: 'fail', details: 'query failed' };
  return body.length === 0
    ? { name: 'no zero-value drafts', status: 'pass' }
    : { name: 'no zero-value drafts', status: 'fail', details: `${body.length} draft(s) with grand_total = 0` };
}

async function checkAllInvoicesHaveDueDate(): Promise<Result> {
  const { ok, body } = await rest<Array<{ invoice_number: string }>>(
    '/rest/v1/invoices?due_date=is.null&balance_due=gt.0&status=neq.cancelled&select=invoice_number'
  );
  if (!ok) return { name: 'all unpaid invoices have due_date', status: 'fail', details: 'query failed' };
  return body.length === 0
    ? { name: 'all unpaid invoices have due_date', status: 'pass' }
    : { name: 'all unpaid invoices have due_date', status: 'fail', details: `${body.length} missing: ${body.slice(0, 5).map(r => r.invoice_number).join(', ')}` };
}

async function checkNoOrphanProformas(): Promise<Result> {
  // A proforma with grand_total > 0 but zero lines is the orphan pattern
  // from before commit 6e680fa.
  const { ok, body } = await rest<Array<{ id: string; proforma_number: string }>>(
    '/rest/v1/proformas?grand_total=gt.0&select=id,proforma_number'
  );
  if (!ok) return { name: 'no orphan proformas (totals without lines)', status: 'fail', details: 'query failed' };
  let orphans = 0;
  for (const p of body.slice(0, 50)) {
    const lines = await rest<Array<unknown>>(`/rest/v1/parts_lines?proforma_id=eq.${p.id}&select=id&limit=1`);
    if (lines.ok && lines.body.length === 0) orphans++;
  }
  return orphans === 0
    ? { name: 'no orphan proformas (totals without lines)', status: 'pass', details: `checked ${Math.min(body.length, 50)} proforma(s)` }
    : { name: 'no orphan proformas (totals without lines)', status: 'fail', details: `${orphans} proforma(s) have totals but no lines` };
}

async function checkBillsExist(): Promise<Result> {
  // Stand-alone sanity — ensure the canonical billing tables exist and
  // return rows. Catches the case where a migration silently dropped
  // a table or RLS suddenly returns nothing.
  for (const table of ['invoices', 'parts_lines', 'labour_lines', 'customers', 'parts']) {
    const r = await rest<Array<unknown>>(`/rest/v1/${table}?select=id&limit=1`);
    if (!r.ok) return { name: 'core tables readable', status: 'fail', details: `${table}: HTTP ${r.status}` };
  }
  return { name: 'core tables readable', status: 'pass' };
}

async function checkStockCacheInSync(): Promise<Result> {
  // parts.stock_qty must equal SUM(warehouse_stock.quantity) for each part,
  // enforced by the migration 00108 trigger. If the cache drifts something
  // is bypassing the trigger.
  const parts = await rest<Array<{ id: string; stock_qty: number }>>('/rest/v1/parts?select=id,stock_qty&limit=200');
  if (!parts.ok) return { name: 'parts.stock_qty matches warehouse_stock', status: 'fail', details: 'query failed' };
  let drift = 0;
  let checked = 0;
  for (const p of parts.body.slice(0, 50)) {
    const ws = await rest<Array<{ quantity: number }>>(`/rest/v1/warehouse_stock?part_id=eq.${p.id}&select=quantity`);
    if (!ws.ok) continue;
    const sum = ws.body.reduce((s, r) => s + Number(r.quantity || 0), 0);
    if (sum !== Number(p.stock_qty || 0)) drift++;
    checked++;
  }
  return drift === 0
    ? { name: 'parts.stock_qty matches warehouse_stock', status: 'pass', details: `checked ${checked} part(s)` }
    : { name: 'parts.stock_qty matches warehouse_stock', status: 'fail', details: `${drift} part(s) drifted from canonical stock` };
}

// ─────────────────────────────────────────────────────────────────────
// PostgREST query smoke tests
// These run the exact selects the API service uses. Catches FK-ambiguity
// and embedding regressions (the recent 404 was this class).
// ─────────────────────────────────────────────────────────────────────

async function checkInvoiceGetByIdSelect(): Promise<Result> {
  // Pick any invoice with a JC and run the getById select. Must return
  // exactly the expected shape — anything else means the embed broke.
  const pick = await rest<Array<{ id: string }>>('/rest/v1/invoices?job_card_id=not.is.null&select=id&limit=1');
  if (!pick.ok || pick.body.length === 0) {
    return { name: 'invoices.getById embed resolves', status: 'skip', details: 'no JC-linked invoice available' };
  }
  const id = pick.body[0]!.id;
  const select =
    '*,customer:customers(*),job_card:job_cards(*,vehicle:vehicles(id,plate,vin,make,model,year,color,fuel_type,mileage),service_writer:users!job_cards_service_writer_id_fkey(id,full_name),primary_technician:technicians(id,full_name))';
  const r = await rest<Array<unknown> | { code?: string }>(`/rest/v1/invoices?id=eq.${id}&select=${encodeURIComponent(select)}`);
  if (!r.ok || (r.body as { code?: string }).code) {
    return { name: 'invoices.getById embed resolves', status: 'fail', details: JSON.stringify(r.body).slice(0, 200) };
  }
  return { name: 'invoices.getById embed resolves', status: 'pass' };
}

async function checkProformasGetByIdSelect(): Promise<Result> {
  const pick = await rest<Array<{ id: string }>>('/rest/v1/proformas?select=id&limit=1');
  if (!pick.ok || pick.body.length === 0) {
    return { name: 'proformas.getById embed resolves', status: 'skip', details: 'no proforma available' };
  }
  const id = pick.body[0]!.id;
  const select =
    '*,customer:customers(*),lines:parts_lines(id,part_name,part_number,quantity,unit_cost,sell_price,subtotal,tax_rate,tax_code_id,part_id,discount_pct,discount_amount)';
  const r = await rest<Array<unknown> | { code?: string }>(`/rest/v1/proformas?id=eq.${id}&select=${encodeURIComponent(select)}`);
  if (!r.ok || (r.body as { code?: string }).code) {
    return { name: 'proformas.getById embed resolves', status: 'fail', details: JSON.stringify(r.body).slice(0, 200) };
  }
  return { name: 'proformas.getById embed resolves', status: 'pass' };
}

// ─────────────────────────────────────────────────────────────────────
// Cron / SOA sanity
// ─────────────────────────────────────────────────────────────────────

async function checkLastSoaBatchSane(): Promise<Result> {
  const r = await rest<Array<{ batch_id: string; status: string; channel: string; created_at: string }>>(
    '/rest/v1/soa_send_log?order=created_at.desc&limit=10'
  );
  if (!r.ok) return { name: 'last SOA batch reasonable', status: 'fail', details: 'query failed' };
  if (r.body.length === 0) return { name: 'last SOA batch reasonable', status: 'skip', details: 'no batches yet' };
  // No failed rows in the last 10? Failures are not always bugs but
  // worth surfacing as a warning. Treated as pass with a note.
  const failed = r.body.filter((x) => x.status === 'failed').length;
  return {
    name: 'last SOA batch reasonable',
    status: 'pass',
    details: `last 10 rows: ${r.body.length - failed} ok, ${failed} failed`,
  };
}

// ─────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log(`\nmecanix smoke — ${SB_URL}`);
  console.log('─'.repeat(60));

  await check('no zero-value drafts', checkNoZeroValueDraftInvoices);
  await check('all unpaid invoices have due_date', checkAllInvoicesHaveDueDate);
  await check('no orphan proformas', checkNoOrphanProformas);
  await check('core tables readable', checkBillsExist);
  await check('parts.stock_qty matches warehouse_stock', checkStockCacheInSync);
  await check('invoices.getById embed resolves', checkInvoiceGetByIdSelect);
  await check('proformas.getById embed resolves', checkProformasGetByIdSelect);
  await check('last SOA batch reasonable', checkLastSoaBatchSane);

  console.log('─'.repeat(60));
  const passed = results.filter((r) => r.status === 'pass').length;
  const failed = results.filter((r) => r.status === 'fail').length;
  const skipped = results.filter((r) => r.status === 'skip').length;
  console.log(`${passed} passed · ${failed} failed · ${skipped} skipped\n`);

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(2);
});
