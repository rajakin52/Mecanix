-- 00121_line_pricing_snapshot.sql
-- Snapshots the pricing decision made at issue time on every parts_line
-- and labour_line. Combined with the generic audit_log (00087), gives
-- a complete "how was this priced and what changed since" view per line.
--
-- Snapshot columns (set on insert, never modified by edits):
--   cost_method            — which cost method was used to resolve unit_cost
--                            (last_cost / weighted_average / fifo / lifo / highest_cost)
--   sell_price_source      — how sell_price was resolved on this line
--                            (manual / catalogue / auto_markup)
--   margin_pct_at_issue    — (sell − cost) / sell × 100, frozen at insert time
--
-- These three answer "what was the pricing decision at the moment this
-- line went on the invoice". Subsequent edits write to audit_log
-- (entity_type='parts_line' or 'labour_line') with before/after states,
-- so the UI can show "originally priced at X (auto-markup, FIFO, 35%
-- margin), then changed to Y by user Z on date W."

ALTER TABLE public.parts_lines
  ADD COLUMN IF NOT EXISTS cost_method          text,
  ADD COLUMN IF NOT EXISTS sell_price_source    text,
  ADD COLUMN IF NOT EXISTS margin_pct_at_issue  numeric(6, 3);

ALTER TABLE public.labour_lines
  ADD COLUMN IF NOT EXISTS sell_price_source    text,
  ADD COLUMN IF NOT EXISTS margin_pct_at_issue  numeric(6, 3);

COMMENT ON COLUMN public.parts_lines.cost_method IS
  'Cost-resolution method active when this line was added (last_cost/weighted_average/fifo/lifo/highest_cost). Snapshot; never modified by edits.';
COMMENT ON COLUMN public.parts_lines.sell_price_source IS
  'How sell_price was resolved at insert (manual/catalogue/auto_markup). Snapshot.';
COMMENT ON COLUMN public.parts_lines.margin_pct_at_issue IS
  'Margin % at insert. Frozen — current margin is computed on the fly from current unit_cost and sell_price.';
