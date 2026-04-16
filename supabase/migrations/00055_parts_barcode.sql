-- Add barcode/EAN fields to parts for scanning
ALTER TABLE public.parts
  ADD COLUMN IF NOT EXISTS barcode text,       -- EAN-13, UPC, or internal barcode
  ADD COLUMN IF NOT EXISTS sku text;           -- internal SKU (if different from part_number)

CREATE INDEX IF NOT EXISTS idx_parts_barcode ON public.parts(barcode) WHERE barcode IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_parts_sku ON public.parts(sku) WHERE sku IS NOT NULL;
