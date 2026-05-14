-- 00118_lines_invoice_id.sql
-- Track which invoice each labour/parts line was billed on. This lets
-- the system support multiple invoices per job card (partial invoicing,
-- parts backorder, post-reopen re-invoicing) without ever double-billing.
--
-- Once a line has billed_on_invoice_id NOT NULL it is "frozen":
-- application code refuses updates and deletes regardless of the
-- job-card status. The proper accounting fix for a billed line is a
-- credit note + a new replacement line, not in-place mutation.
--
-- Note on naming: parts_lines already has an invoice_id column from
-- migration 00115 with a CHECK constraint that says "exactly one of
-- (job_card_id | invoice_id | proforma_id)" — that's the *anchor* for
-- a stand-alone OTC line. The new billed_on_invoice_id is different:
-- it's a *reference* from a JC-anchored line to the invoice that
-- billed it. So both columns can coexist and they mean different things.

ALTER TABLE public.labour_lines
  ADD COLUMN IF NOT EXISTS billed_on_invoice_id uuid REFERENCES public.invoices(id) ON DELETE SET NULL;

ALTER TABLE public.parts_lines
  ADD COLUMN IF NOT EXISTS billed_on_invoice_id uuid REFERENCES public.invoices(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_labour_lines_billed_invoice
  ON public.labour_lines(billed_on_invoice_id) WHERE billed_on_invoice_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_parts_lines_billed_invoice
  ON public.parts_lines(billed_on_invoice_id) WHERE billed_on_invoice_id IS NOT NULL;

-- Backfill: every existing invoice generated before this migration was
-- the only invoice on its job card (close-on-invoice had no opt-out).
-- So for each invoice with a job_card_id, mark all the JC's charged
-- lines as billed on that invoice. Stand-alone (OTC) lines have
-- job_card_id IS NULL and are skipped.

UPDATE public.labour_lines l
   SET billed_on_invoice_id = i.id
  FROM public.invoices i
 WHERE l.job_card_id IS NOT NULL
   AND l.job_card_id = i.job_card_id
   AND l.tenant_id = i.tenant_id
   AND l.line_status = 'charged'
   AND l.billed_on_invoice_id IS NULL;

UPDATE public.parts_lines p
   SET billed_on_invoice_id = i.id
  FROM public.invoices i
 WHERE p.job_card_id IS NOT NULL
   AND p.job_card_id = i.job_card_id
   AND p.tenant_id = i.tenant_id
   AND p.line_status = 'charged'
   AND p.billed_on_invoice_id IS NULL;

COMMENT ON COLUMN public.labour_lines.billed_on_invoice_id IS
  'Which invoice billed this line. Null = not yet invoiced. Set automatically by the invoice-generation flow; freezes the line from edits/deletes.';
COMMENT ON COLUMN public.parts_lines.billed_on_invoice_id IS
  'Which invoice billed this JC-anchored line. For OTC lines the anchor is invoice_id instead; this column stays null for those. Once non-null, the line is frozen.';
