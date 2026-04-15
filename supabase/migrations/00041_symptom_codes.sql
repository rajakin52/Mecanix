-- Symptom codes: database-driven checklist for customer-reported vehicle issues
-- Organized by family (quick_service, mechanic, body_paint) with usage tracking

CREATE TABLE public.symptom_codes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid REFERENCES public.tenants(id) ON DELETE CASCADE,  -- NULL = global seed
  code        text NOT NULL,
  label_en    text NOT NULL,
  label_pt    text NOT NULL,
  family      text NOT NULL CHECK (family IN ('quick_service', 'mechanic', 'body_paint')),
  category    text NOT NULL,
  icon        text,
  usage_count integer NOT NULL DEFAULT 0,
  is_active   boolean NOT NULL DEFAULT true,
  sort_order  integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT NOW(),
  updated_at  timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_symptom_codes_tenant ON public.symptom_codes(tenant_id);
CREATE INDEX idx_symptom_codes_family ON public.symptom_codes(family, usage_count DESC) WHERE is_active = true;
CREATE UNIQUE INDEX uq_symptom_code_per_tenant ON public.symptom_codes(COALESCE(tenant_id, '00000000-0000-0000-0000-000000000000'), code);

ALTER TABLE public.symptom_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "symptom_codes_select" ON public.symptom_codes
  FOR SELECT USING (tenant_id IS NULL OR tenant_id = public.get_tenant_id());
CREATE POLICY "symptom_codes_insert" ON public.symptom_codes
  FOR INSERT WITH CHECK (tenant_id = public.get_tenant_id());
CREATE POLICY "symptom_codes_update" ON public.symptom_codes
  FOR UPDATE USING (tenant_id IS NULL OR tenant_id = public.get_tenant_id());

CREATE TRIGGER symptom_codes_updated_at
  BEFORE UPDATE ON public.symptom_codes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Add symptom_codes array to job_cards
ALTER TABLE public.job_cards
  ADD COLUMN IF NOT EXISTS symptom_codes text[] NOT NULL DEFAULT '{}';

-- ═══════════════════════════════════════════════════════════════
-- SEED: Global symptom codes (tenant_id = NULL, visible to all)
-- ═══════════════════════════════════════════════════════════════

-- ── QUICK SERVICE family ──
INSERT INTO public.symptom_codes (tenant_id, code, label_en, label_pt, family, category, icon, sort_order) VALUES
  (NULL, 'OIL_CHANGE_DUE',        'Oil change due',              'Troca de óleo necessária',       'quick_service', 'maintenance',  '🛢️', 1),
  (NULL, 'BRAKE_PADS_WORN',       'Brake pads worn',             'Pastilhas de travão gastas',     'quick_service', 'brakes',       '🛑', 2),
  (NULL, 'TIRE_REPLACEMENT',      'Tire replacement needed',     'Substituição de pneus',          'quick_service', 'tires',        '🔧', 3),
  (NULL, 'BATTERY_WEAK',          'Battery weak / dead',         'Bateria fraca / descarregada',   'quick_service', 'electrical',   '🔋', 4),
  (NULL, 'WIPER_BLADES',          'Wiper blades worn',           'Escovas limpa-vidros gastas',    'quick_service', 'maintenance',  '🌧️', 5),
  (NULL, 'LIGHT_BULB_OUT',        'Light bulb out',              'Lâmpada queimada',               'quick_service', 'electrical',   '💡', 6),
  (NULL, 'AC_REGAS',              'A/C needs regas',             'Recarga de ar condicionado',     'quick_service', 'hvac',         '❄️', 7),
  (NULL, 'FILTER_REPLACEMENT',    'Filter replacement',          'Substituição de filtros',        'quick_service', 'maintenance',  '🔄', 8),
  (NULL, 'WHEEL_ALIGNMENT',       'Wheel alignment needed',      'Alinhamento de rodas',           'quick_service', 'suspension',   '🎯', 9),
  (NULL, 'WHEEL_BALANCING',       'Wheel balancing needed',      'Balanceamento de rodas',         'quick_service', 'tires',        '⚖️', 10),
  (NULL, 'FLUID_TOP_UP',          'Fluid top-up needed',         'Reposição de fluidos',           'quick_service', 'maintenance',  '💧', 11),
  (NULL, 'SPARK_PLUGS',           'Spark plugs replacement',     'Substituição de velas',          'quick_service', 'engine',       '⚡', 12);

-- ── MECHANIC family ──
INSERT INTO public.symptom_codes (tenant_id, code, label_en, label_pt, family, category, icon, sort_order) VALUES
  (NULL, 'ENGINE_WARNING_LIGHT',  'Engine warning light on',     'Luz de motor acesa',             'mechanic', 'engine',       '🚨', 1),
  (NULL, 'STRANGE_NOISE',         'Strange noise',               'Barulho estranho',               'mechanic', 'general',      '🔊', 2),
  (NULL, 'VIBRATION',             'Vibration while driving',     'Vibração ao conduzir',           'mechanic', 'suspension',   '📳', 3),
  (NULL, 'BRAKING_ISSUES',        'Braking problems',            'Problemas de travagem',          'mechanic', 'brakes',       '⚠️', 4),
  (NULL, 'STARTING_PROBLEMS',     'Engine won''t start / hard start', 'Motor não arranca / arranque difícil', 'mechanic', 'engine', '🔑', 5),
  (NULL, 'OVERHEATING',           'Engine overheating',          'Motor a sobreaquecer',           'mechanic', 'engine',       '🌡️', 6),
  (NULL, 'FLUID_LEAK',            'Fluid leak under vehicle',    'Fuga de fluido debaixo do veículo', 'mechanic', 'engine',    '💦', 7),
  (NULL, 'TRANSMISSION_ISSUES',   'Transmission / gearbox issues', 'Problemas de transmissão / caixa', 'mechanic', 'drivetrain', '⚙️', 8),
  (NULL, 'STEERING_PROBLEMS',     'Steering problems',           'Problemas de direção',           'mechanic', 'steering',     '🔄', 9),
  (NULL, 'SUSPENSION_PROBLEMS',   'Suspension problems',         'Problemas de suspensão',         'mechanic', 'suspension',   '🔩', 10),
  (NULL, 'ELECTRICAL_ISSUE',      'Electrical issue',            'Problema eléctrico',             'mechanic', 'electrical',   '⚡', 11),
  (NULL, 'EXHAUST_SMOKE',         'Exhaust smoke',               'Fumo no escape',                 'mechanic', 'exhaust',      '💨', 12),
  (NULL, 'AC_NOT_WORKING',        'A/C not cooling',             'Ar condicionado não arrefece',   'mechanic', 'hvac',         '🥵', 13),
  (NULL, 'CLUTCH_SLIPPING',       'Clutch slipping',             'Embraiagem a patinar',           'mechanic', 'drivetrain',   '🦶', 14),
  (NULL, 'CHECK_ENGINE',          'Check engine light',          'Luz de verificação do motor',    'mechanic', 'engine',       '🔶', 15),
  (NULL, 'ABS_LIGHT',             'ABS warning light',           'Luz de ABS acesa',               'mechanic', 'brakes',       '🟡', 16),
  (NULL, 'POWER_LOSS',            'Loss of power',               'Perda de potência',              'mechanic', 'engine',       '📉', 17),
  (NULL, 'ROUGH_IDLE',            'Rough idle / stalling',       'Ralenti irregular / motor cala',  'mechanic', 'engine',       '〰️', 18);

-- ── BODY & PAINT family ──
INSERT INTO public.symptom_codes (tenant_id, code, label_en, label_pt, family, category, icon, sort_order) VALUES
  (NULL, 'SCRATCH_REPAIR',        'Scratch repair',              'Reparação de riscos',            'body_paint', 'body',    '✏️', 1),
  (NULL, 'DENT_REPAIR',           'Dent repair',                 'Reparação de mossas',            'body_paint', 'body',    '🔨', 2),
  (NULL, 'BUMPER_REPAIR',         'Bumper repair / replacement', 'Reparação / substituição de para-choques', 'body_paint', 'body', '🛡️', 3),
  (NULL, 'PAINT_TOUCH_UP',        'Paint touch-up',              'Retoque de pintura',             'body_paint', 'paint',   '🎨', 4),
  (NULL, 'FULL_RESPRAY',          'Full panel / vehicle respray', 'Repintura de painel / veículo', 'body_paint', 'paint',   '🖌️', 5),
  (NULL, 'WINDSCREEN_REPAIR',     'Windscreen repair / replace', 'Reparação / substituição de pára-brisas', 'body_paint', 'glass', '🪟', 6),
  (NULL, 'MIRROR_REPAIR',         'Mirror repair / replacement', 'Reparação / substituição de espelho', 'body_paint', 'body', '🪞', 7),
  (NULL, 'HEADLIGHT_REPAIR',      'Headlight repair / replace',  'Reparação / substituição de farol', 'body_paint', 'body', '🔦', 8),
  (NULL, 'RUST_TREATMENT',        'Rust treatment',              'Tratamento de ferrugem',         'body_paint', 'body',    '🟤', 9),
  (NULL, 'COLLISION_REPAIR',      'Collision / accident repair', 'Reparação de colisão / acidente', 'body_paint', 'body',  '💥', 10),
  (NULL, 'DOOR_REPAIR',           'Door repair / replacement',   'Reparação / substituição de porta', 'body_paint', 'body', '🚪', 11),
  (NULL, 'FENDER_REPAIR',         'Fender / wing repair',        'Reparação de guarda-lamas',      'body_paint', 'body',    '🔧', 12);
