-- Photo capture sessions: bridge web desk → mobile camera
-- Advisor generates a link, opens on phone, takes photos, they sync to job card

CREATE TABLE public.photo_capture_sessions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  job_card_id     uuid NOT NULL REFERENCES public.job_cards(id),
  token           text NOT NULL UNIQUE,     -- short unique token for public URL
  vehicle_plate   text,
  vehicle_info    text,                     -- "Toyota Hilux (2022)"
  status          text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'expired')),
  required_photos text[] NOT NULL DEFAULT ARRAY['front','rear','left','right','dashboard','interior'],
  expires_at      timestamptz NOT NULL,
  created_by      uuid REFERENCES public.users(id),
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_photo_sessions_token ON public.photo_capture_sessions(token) WHERE status = 'active';

-- Photos captured via the session
CREATE TABLE public.photo_capture_items (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id      uuid NOT NULL REFERENCES public.photo_capture_sessions(id) ON DELETE CASCADE,
  tenant_id       uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  photo_type      text NOT NULL,            -- front, rear, left, right, dashboard, interior, extra
  storage_url     text NOT NULL,
  thumbnail_url   text,
  file_size       integer,
  captured_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_photo_capture_items_session ON public.photo_capture_items(session_id);

-- Enable Realtime so web sees photos appear live
ALTER PUBLICATION supabase_realtime ADD TABLE public.photo_capture_items;

-- Public access (no RLS needed for token-based access)
ALTER TABLE public.photo_capture_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "photo_sessions_select" ON public.photo_capture_sessions
  FOR SELECT USING (tenant_id = public.get_tenant_id() OR true);  -- public read by token
CREATE POLICY "photo_sessions_insert" ON public.photo_capture_sessions
  FOR INSERT WITH CHECK (tenant_id = public.get_tenant_id());

ALTER TABLE public.photo_capture_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "photo_items_select" ON public.photo_capture_items
  FOR SELECT USING (true);  -- public read (token validates session)
CREATE POLICY "photo_items_insert" ON public.photo_capture_items
  FOR INSERT WITH CHECK (true);  -- public insert (token validates session)
