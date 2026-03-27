-- ============================================================
-- MECANIX — Vehicle Makes & Models Database
-- Seedable, amendable lookup tables
-- ============================================================

CREATE TABLE public.vehicle_makes (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text NOT NULL UNIQUE,
  country         text,
  logo_url        text,
  is_active       boolean NOT NULL DEFAULT true,
  sort_order      integer NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_vehicle_makes_name ON public.vehicle_makes(name);

CREATE TABLE public.vehicle_models (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  make_id         uuid NOT NULL REFERENCES public.vehicle_makes(id) ON DELETE CASCADE,
  name            text NOT NULL,
  body_type       text,
  is_active       boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT NOW(),
  UNIQUE(make_id, name)
);

CREATE INDEX idx_vehicle_models_make ON public.vehicle_models(make_id);

-- Make VIN mandatory on vehicles (for new vehicles — existing ones keep null)
-- We won't add NOT NULL to avoid breaking existing data, but the validator will enforce it

-- ============================================================
-- SEED: Common makes in Angola/Mozambique/Brazil market
-- ============================================================
INSERT INTO public.vehicle_makes (name, country, sort_order) VALUES
  ('Toyota', 'JP', 1),
  ('Nissan', 'JP', 2),
  ('Mitsubishi', 'JP', 3),
  ('Hyundai', 'KR', 4),
  ('Kia', 'KR', 5),
  ('Mercedes-Benz', 'DE', 6),
  ('BMW', 'DE', 7),
  ('Volkswagen', 'DE', 8),
  ('Ford', 'US', 9),
  ('Chevrolet', 'US', 10),
  ('Honda', 'JP', 11),
  ('Suzuki', 'JP', 12),
  ('Isuzu', 'JP', 13),
  ('Land Rover', 'GB', 14),
  ('Range Rover', 'GB', 15),
  ('Jeep', 'US', 16),
  ('Peugeot', 'FR', 17),
  ('Renault', 'FR', 18),
  ('Fiat', 'IT', 19),
  ('Audi', 'DE', 20),
  ('Volvo', 'SE', 21),
  ('Mazda', 'JP', 22),
  ('Subaru', 'JP', 23),
  ('Lexus', 'JP', 24),
  ('Porsche', 'DE', 25),
  ('Citroën', 'FR', 26),
  ('Opel', 'DE', 27),
  ('Ssangyong', 'KR', 28),
  ('Chery', 'CN', 29),
  ('BYD', 'CN', 30),
  ('JAC', 'CN', 31),
  ('Great Wall', 'CN', 32),
  ('Tata', 'IN', 33),
  ('Mahindra', 'IN', 34),
  ('MAN', 'DE', 35),
  ('Scania', 'SE', 36),
  ('DAF', 'NL', 37),
  ('Iveco', 'IT', 38),
  ('Hino', 'JP', 39),
  ('CAMC', 'CN', 40)
ON CONFLICT (name) DO NOTHING;

-- Toyota models
INSERT INTO public.vehicle_models (make_id, name, body_type) VALUES
  ((SELECT id FROM public.vehicle_makes WHERE name = 'Toyota'), 'Hilux', 'pickup'),
  ((SELECT id FROM public.vehicle_makes WHERE name = 'Toyota'), 'Land Cruiser', 'suv'),
  ((SELECT id FROM public.vehicle_makes WHERE name = 'Toyota'), 'Prado', 'suv'),
  ((SELECT id FROM public.vehicle_makes WHERE name = 'Toyota'), 'Fortuner', 'suv'),
  ((SELECT id FROM public.vehicle_makes WHERE name = 'Toyota'), 'RAV4', 'suv'),
  ((SELECT id FROM public.vehicle_makes WHERE name = 'Toyota'), 'Corolla', 'sedan'),
  ((SELECT id FROM public.vehicle_makes WHERE name = 'Toyota'), 'Camry', 'sedan'),
  ((SELECT id FROM public.vehicle_makes WHERE name = 'Toyota'), 'Yaris', 'hatchback'),
  ((SELECT id FROM public.vehicle_makes WHERE name = 'Toyota'), 'Avensis', 'sedan'),
  ((SELECT id FROM public.vehicle_makes WHERE name = 'Toyota'), 'Hiace', 'van'),
  ((SELECT id FROM public.vehicle_makes WHERE name = 'Toyota'), 'Dyna', 'truck'),
  ((SELECT id FROM public.vehicle_makes WHERE name = 'Toyota'), 'Land Cruiser 70', 'suv'),
  ((SELECT id FROM public.vehicle_makes WHERE name = 'Toyota'), 'Land Cruiser 200', 'suv'),
  ((SELECT id FROM public.vehicle_makes WHERE name = 'Toyota'), 'Land Cruiser 300', 'suv'),
  ((SELECT id FROM public.vehicle_makes WHERE name = 'Toyota'), 'Rush', 'suv'),
  ((SELECT id FROM public.vehicle_makes WHERE name = 'Toyota'), 'Vitz', 'hatchback')
ON CONFLICT (make_id, name) DO NOTHING;

-- Nissan models
INSERT INTO public.vehicle_models (make_id, name, body_type) VALUES
  ((SELECT id FROM public.vehicle_makes WHERE name = 'Nissan'), 'Navara', 'pickup'),
  ((SELECT id FROM public.vehicle_makes WHERE name = 'Nissan'), 'Patrol', 'suv'),
  ((SELECT id FROM public.vehicle_makes WHERE name = 'Nissan'), 'X-Trail', 'suv'),
  ((SELECT id FROM public.vehicle_makes WHERE name = 'Nissan'), 'Qashqai', 'suv'),
  ((SELECT id FROM public.vehicle_makes WHERE name = 'Nissan'), 'Frontier', 'pickup'),
  ((SELECT id FROM public.vehicle_makes WHERE name = 'Nissan'), 'NP300', 'pickup'),
  ((SELECT id FROM public.vehicle_makes WHERE name = 'Nissan'), 'Almera', 'sedan'),
  ((SELECT id FROM public.vehicle_makes WHERE name = 'Nissan'), 'Sentra', 'sedan'),
  ((SELECT id FROM public.vehicle_makes WHERE name = 'Nissan'), 'Kicks', 'suv'),
  ((SELECT id FROM public.vehicle_makes WHERE name = 'Nissan'), 'Pathfinder', 'suv')
ON CONFLICT (make_id, name) DO NOTHING;

-- Mitsubishi models
INSERT INTO public.vehicle_models (make_id, name, body_type) VALUES
  ((SELECT id FROM public.vehicle_makes WHERE name = 'Mitsubishi'), 'L200', 'pickup'),
  ((SELECT id FROM public.vehicle_makes WHERE name = 'Mitsubishi'), 'Pajero', 'suv'),
  ((SELECT id FROM public.vehicle_makes WHERE name = 'Mitsubishi'), 'Pajero Sport', 'suv'),
  ((SELECT id FROM public.vehicle_makes WHERE name = 'Mitsubishi'), 'Outlander', 'suv'),
  ((SELECT id FROM public.vehicle_makes WHERE name = 'Mitsubishi'), 'ASX', 'suv'),
  ((SELECT id FROM public.vehicle_makes WHERE name = 'Mitsubishi'), 'Triton', 'pickup'),
  ((SELECT id FROM public.vehicle_makes WHERE name = 'Mitsubishi'), 'Canter', 'truck'),
  ((SELECT id FROM public.vehicle_makes WHERE name = 'Mitsubishi'), 'Eclipse Cross', 'suv')
ON CONFLICT (make_id, name) DO NOTHING;

-- Hyundai models
INSERT INTO public.vehicle_models (make_id, name, body_type) VALUES
  ((SELECT id FROM public.vehicle_makes WHERE name = 'Hyundai'), 'Tucson', 'suv'),
  ((SELECT id FROM public.vehicle_makes WHERE name = 'Hyundai'), 'Santa Fe', 'suv'),
  ((SELECT id FROM public.vehicle_makes WHERE name = 'Hyundai'), 'Creta', 'suv'),
  ((SELECT id FROM public.vehicle_makes WHERE name = 'Hyundai'), 'i10', 'hatchback'),
  ((SELECT id FROM public.vehicle_makes WHERE name = 'Hyundai'), 'i20', 'hatchback'),
  ((SELECT id FROM public.vehicle_makes WHERE name = 'Hyundai'), 'i30', 'hatchback'),
  ((SELECT id FROM public.vehicle_makes WHERE name = 'Hyundai'), 'Elantra', 'sedan'),
  ((SELECT id FROM public.vehicle_makes WHERE name = 'Hyundai'), 'Accent', 'sedan'),
  ((SELECT id FROM public.vehicle_makes WHERE name = 'Hyundai'), 'H1', 'van'),
  ((SELECT id FROM public.vehicle_makes WHERE name = 'Hyundai'), 'HD78', 'truck')
ON CONFLICT (make_id, name) DO NOTHING;

-- Kia models
INSERT INTO public.vehicle_models (make_id, name, body_type) VALUES
  ((SELECT id FROM public.vehicle_makes WHERE name = 'Kia'), 'Sportage', 'suv'),
  ((SELECT id FROM public.vehicle_makes WHERE name = 'Kia'), 'Sorento', 'suv'),
  ((SELECT id FROM public.vehicle_makes WHERE name = 'Kia'), 'Picanto', 'hatchback'),
  ((SELECT id FROM public.vehicle_makes WHERE name = 'Kia'), 'Rio', 'sedan'),
  ((SELECT id FROM public.vehicle_makes WHERE name = 'Kia'), 'Cerato', 'sedan'),
  ((SELECT id FROM public.vehicle_makes WHERE name = 'Kia'), 'Seltos', 'suv'),
  ((SELECT id FROM public.vehicle_makes WHERE name = 'Kia'), 'K2700', 'truck')
ON CONFLICT (make_id, name) DO NOTHING;

-- Mercedes-Benz models
INSERT INTO public.vehicle_models (make_id, name, body_type) VALUES
  ((SELECT id FROM public.vehicle_makes WHERE name = 'Mercedes-Benz'), 'C-Class', 'sedan'),
  ((SELECT id FROM public.vehicle_makes WHERE name = 'Mercedes-Benz'), 'E-Class', 'sedan'),
  ((SELECT id FROM public.vehicle_makes WHERE name = 'Mercedes-Benz'), 'S-Class', 'sedan'),
  ((SELECT id FROM public.vehicle_makes WHERE name = 'Mercedes-Benz'), 'GLC', 'suv'),
  ((SELECT id FROM public.vehicle_makes WHERE name = 'Mercedes-Benz'), 'GLE', 'suv'),
  ((SELECT id FROM public.vehicle_makes WHERE name = 'Mercedes-Benz'), 'GLS', 'suv'),
  ((SELECT id FROM public.vehicle_makes WHERE name = 'Mercedes-Benz'), 'G-Class', 'suv'),
  ((SELECT id FROM public.vehicle_makes WHERE name = 'Mercedes-Benz'), 'Sprinter', 'van'),
  ((SELECT id FROM public.vehicle_makes WHERE name = 'Mercedes-Benz'), 'Vito', 'van'),
  ((SELECT id FROM public.vehicle_makes WHERE name = 'Mercedes-Benz'), 'Actros', 'truck')
ON CONFLICT (make_id, name) DO NOTHING;

-- BMW models
INSERT INTO public.vehicle_models (make_id, name, body_type) VALUES
  ((SELECT id FROM public.vehicle_makes WHERE name = 'BMW'), '3 Series', 'sedan'),
  ((SELECT id FROM public.vehicle_makes WHERE name = 'BMW'), '5 Series', 'sedan'),
  ((SELECT id FROM public.vehicle_makes WHERE name = 'BMW'), '7 Series', 'sedan'),
  ((SELECT id FROM public.vehicle_makes WHERE name = 'BMW'), 'X1', 'suv'),
  ((SELECT id FROM public.vehicle_makes WHERE name = 'BMW'), 'X3', 'suv'),
  ((SELECT id FROM public.vehicle_makes WHERE name = 'BMW'), 'X5', 'suv'),
  ((SELECT id FROM public.vehicle_makes WHERE name = 'BMW'), 'X7', 'suv')
ON CONFLICT (make_id, name) DO NOTHING;

-- Volkswagen models
INSERT INTO public.vehicle_models (make_id, name, body_type) VALUES
  ((SELECT id FROM public.vehicle_makes WHERE name = 'Volkswagen'), 'Amarok', 'pickup'),
  ((SELECT id FROM public.vehicle_makes WHERE name = 'Volkswagen'), 'Tiguan', 'suv'),
  ((SELECT id FROM public.vehicle_makes WHERE name = 'Volkswagen'), 'Touareg', 'suv'),
  ((SELECT id FROM public.vehicle_makes WHERE name = 'Volkswagen'), 'Polo', 'hatchback'),
  ((SELECT id FROM public.vehicle_makes WHERE name = 'Volkswagen'), 'Golf', 'hatchback'),
  ((SELECT id FROM public.vehicle_makes WHERE name = 'Volkswagen'), 'Jetta', 'sedan'),
  ((SELECT id FROM public.vehicle_makes WHERE name = 'Volkswagen'), 'Transporter', 'van'),
  ((SELECT id FROM public.vehicle_makes WHERE name = 'Volkswagen'), 'Crafter', 'van')
ON CONFLICT (make_id, name) DO NOTHING;

-- Ford models
INSERT INTO public.vehicle_models (make_id, name, body_type) VALUES
  ((SELECT id FROM public.vehicle_makes WHERE name = 'Ford'), 'Ranger', 'pickup'),
  ((SELECT id FROM public.vehicle_makes WHERE name = 'Ford'), 'Everest', 'suv'),
  ((SELECT id FROM public.vehicle_makes WHERE name = 'Ford'), 'EcoSport', 'suv'),
  ((SELECT id FROM public.vehicle_makes WHERE name = 'Ford'), 'Fiesta', 'hatchback'),
  ((SELECT id FROM public.vehicle_makes WHERE name = 'Ford'), 'Focus', 'hatchback'),
  ((SELECT id FROM public.vehicle_makes WHERE name = 'Ford'), 'Transit', 'van'),
  ((SELECT id FROM public.vehicle_makes WHERE name = 'Ford'), 'F-150', 'pickup')
ON CONFLICT (make_id, name) DO NOTHING;

-- Land Rover models
INSERT INTO public.vehicle_models (make_id, name, body_type) VALUES
  ((SELECT id FROM public.vehicle_makes WHERE name = 'Land Rover'), 'Defender', 'suv'),
  ((SELECT id FROM public.vehicle_makes WHERE name = 'Land Rover'), 'Discovery', 'suv'),
  ((SELECT id FROM public.vehicle_makes WHERE name = 'Land Rover'), 'Discovery Sport', 'suv'),
  ((SELECT id FROM public.vehicle_makes WHERE name = 'Land Rover'), 'Freelander', 'suv')
ON CONFLICT (make_id, name) DO NOTHING;

-- Range Rover models
INSERT INTO public.vehicle_models (make_id, name, body_type) VALUES
  ((SELECT id FROM public.vehicle_makes WHERE name = 'Range Rover'), 'Range Rover', 'suv'),
  ((SELECT id FROM public.vehicle_makes WHERE name = 'Range Rover'), 'Range Rover Sport', 'suv'),
  ((SELECT id FROM public.vehicle_makes WHERE name = 'Range Rover'), 'Evoque', 'suv'),
  ((SELECT id FROM public.vehicle_makes WHERE name = 'Range Rover'), 'Velar', 'suv')
ON CONFLICT (make_id, name) DO NOTHING;

-- Honda models
INSERT INTO public.vehicle_models (make_id, name, body_type) VALUES
  ((SELECT id FROM public.vehicle_makes WHERE name = 'Honda'), 'Civic', 'sedan'),
  ((SELECT id FROM public.vehicle_makes WHERE name = 'Honda'), 'CR-V', 'suv'),
  ((SELECT id FROM public.vehicle_makes WHERE name = 'Honda'), 'HR-V', 'suv'),
  ((SELECT id FROM public.vehicle_makes WHERE name = 'Honda'), 'Fit', 'hatchback'),
  ((SELECT id FROM public.vehicle_makes WHERE name = 'Honda'), 'Accord', 'sedan')
ON CONFLICT (make_id, name) DO NOTHING;

-- Chevrolet models
INSERT INTO public.vehicle_models (make_id, name, body_type) VALUES
  ((SELECT id FROM public.vehicle_makes WHERE name = 'Chevrolet'), 'Onix', 'hatchback'),
  ((SELECT id FROM public.vehicle_makes WHERE name = 'Chevrolet'), 'Tracker', 'suv'),
  ((SELECT id FROM public.vehicle_makes WHERE name = 'Chevrolet'), 'S10', 'pickup'),
  ((SELECT id FROM public.vehicle_makes WHERE name = 'Chevrolet'), 'Trailblazer', 'suv'),
  ((SELECT id FROM public.vehicle_makes WHERE name = 'Chevrolet'), 'Spin', 'mpv')
ON CONFLICT (make_id, name) DO NOTHING;

-- Isuzu models
INSERT INTO public.vehicle_models (make_id, name, body_type) VALUES
  ((SELECT id FROM public.vehicle_makes WHERE name = 'Isuzu'), 'D-Max', 'pickup'),
  ((SELECT id FROM public.vehicle_makes WHERE name = 'Isuzu'), 'MU-X', 'suv'),
  ((SELECT id FROM public.vehicle_makes WHERE name = 'Isuzu'), 'NQR', 'truck'),
  ((SELECT id FROM public.vehicle_makes WHERE name = 'Isuzu'), 'FRR', 'truck'),
  ((SELECT id FROM public.vehicle_makes WHERE name = 'Isuzu'), 'FVZ', 'truck')
ON CONFLICT (make_id, name) DO NOTHING;
