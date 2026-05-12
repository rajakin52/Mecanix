-- ══════════════════════════════════════════════════════════════
-- Bank deposits: record the source (what was deposited) and the
-- destination (where the money went). Only cash-sourced movements
-- should reduce the cash drawer's expected cash. Card / mobile /
-- transfer settlements hit the bank or card balance directly.
-- ══════════════════════════════════════════════════════════════

ALTER TABLE public.bank_deposits
  ADD COLUMN source_payment_method text NOT NULL DEFAULT 'cash'
    CHECK (source_payment_method IN (
      'cash', 'card', 'mpesa', 'multicaixa', 'emola',
      'pix', 'mbway', 'multibanco', 'transfer', 'other'
    )),
  ADD COLUMN destination_type text NOT NULL DEFAULT 'bank_account'
    CHECK (destination_type IN ('bank_account', 'debit_card', 'other'));

COMMENT ON COLUMN public.bank_deposits.source_payment_method IS
  'What was deposited. Only ''cash'' affects the register''s expected cash; other methods are purely bank/card-side reconciliation.';
COMMENT ON COLUMN public.bank_deposits.destination_type IS
  'Where the money landed: a bank account, a company debit/prepaid card, or other.';
