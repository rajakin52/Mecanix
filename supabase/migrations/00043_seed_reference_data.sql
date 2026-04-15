-- ═══════════════════════════════════════════════════════════════
-- Comprehensive reference data seed: vehicle makes + models
-- ═══════════════════════════════════════════════════════════════

-- ── Step 1: Add missing makes (Chinese + other brands) ──
INSERT INTO public.vehicle_makes (name, country)
VALUES
  ('Haval', 'China'), ('Chery', 'China'), ('JAC', 'China'),
  ('GWM', 'China'), ('BAIC', 'China'), ('BYD', 'China'),
  ('Geely', 'China'), ('MG', 'United Kingdom'), ('Opel', 'Germany'),
  ('Citroën', 'France'), ('SEAT', 'Spain'), ('Skoda', 'Czech Republic'),
  ('Subaru', 'Japan'), ('Lexus', 'Japan'), ('Infiniti', 'Japan'),
  ('Porsche', 'Germany'), ('Jaguar', 'United Kingdom'),
  ('Alfa Romeo', 'Italy'), ('Iveco', 'Italy'), ('Tata', 'India'),
  ('Mahindra', 'India'), ('Daihatsu', 'Japan')
ON CONFLICT (name) DO NOTHING;

-- ── Step 2: Add models for ALL brands ──
INSERT INTO public.vehicle_models (make_id, name, body_type)
SELECT m.id, v.model_name, v.body_type
FROM (VALUES
  -- Toyota
  ('Toyota', 'Corolla', 'sedan'), ('Toyota', 'Camry', 'sedan'), ('Toyota', 'Yaris', 'hatchback'),
  ('Toyota', 'RAV4', 'suv'), ('Toyota', 'Land Cruiser', 'suv'), ('Toyota', 'Fortuner', 'suv'),
  ('Toyota', 'Hilux', 'pickup'), ('Toyota', 'Avanza', 'mpv'), ('Toyota', 'Prado', 'suv'),
  ('Toyota', 'Rush', 'suv'), ('Toyota', 'C-HR', 'suv'), ('Toyota', 'Supra', 'coupe'),
  -- Nissan
  ('Nissan', 'Qashqai', 'suv'), ('Nissan', 'X-Trail', 'suv'), ('Nissan', 'Navara', 'pickup'),
  ('Nissan', 'Patrol', 'suv'), ('Nissan', 'Sentra', 'sedan'), ('Nissan', 'Micra', 'hatchback'),
  ('Nissan', 'NP300', 'pickup'), ('Nissan', 'NP200', 'pickup'), ('Nissan', 'Juke', 'suv'),
  ('Nissan', 'Almera', 'sedan'), ('Nissan', 'Kicks', 'suv'),
  -- Hyundai
  ('Hyundai', 'Tucson', 'suv'), ('Hyundai', 'Creta', 'suv'), ('Hyundai', 'i20', 'hatchback'),
  ('Hyundai', 'i30', 'hatchback'), ('Hyundai', 'Elantra', 'sedan'), ('Hyundai', 'Santa Fe', 'suv'),
  ('Hyundai', 'Venue', 'suv'), ('Hyundai', 'Kona', 'suv'), ('Hyundai', 'Accent', 'sedan'),
  ('Hyundai', 'H1', 'van'), ('Hyundai', 'Staria', 'van'),
  -- Kia
  ('Kia', 'Sportage', 'suv'), ('Kia', 'Seltos', 'suv'), ('Kia', 'Picanto', 'hatchback'),
  ('Kia', 'Rio', 'hatchback'), ('Kia', 'Sorento', 'suv'), ('Kia', 'Cerato', 'sedan'),
  ('Kia', 'Carnival', 'mpv'), ('Kia', 'K5', 'sedan'),
  -- Volkswagen
  ('Volkswagen', 'Golf', 'hatchback'), ('Volkswagen', 'Polo', 'hatchback'), ('Volkswagen', 'Tiguan', 'suv'),
  ('Volkswagen', 'T-Cross', 'suv'), ('Volkswagen', 'Amarok', 'pickup'), ('Volkswagen', 'Touareg', 'suv'),
  ('Volkswagen', 'Caddy', 'van'), ('Volkswagen', 'Transporter', 'van'), ('Volkswagen', 'Passat', 'sedan'),
  ('Volkswagen', 'Jetta', 'sedan'),
  -- BMW
  ('BMW', '3 Series', 'sedan'), ('BMW', '5 Series', 'sedan'), ('BMW', 'X1', 'suv'),
  ('BMW', 'X3', 'suv'), ('BMW', 'X5', 'suv'), ('BMW', '1 Series', 'hatchback'),
  ('BMW', 'X6', 'suv'), ('BMW', '7 Series', 'sedan'),
  -- Mercedes-Benz
  ('Mercedes-Benz', 'C-Class', 'sedan'), ('Mercedes-Benz', 'E-Class', 'sedan'), ('Mercedes-Benz', 'A-Class', 'hatchback'),
  ('Mercedes-Benz', 'GLA', 'suv'), ('Mercedes-Benz', 'GLC', 'suv'), ('Mercedes-Benz', 'GLE', 'suv'),
  ('Mercedes-Benz', 'Sprinter', 'van'), ('Mercedes-Benz', 'Vito', 'van'),
  -- Ford
  ('Ford', 'Ranger', 'pickup'), ('Ford', 'EcoSport', 'suv'), ('Ford', 'Everest', 'suv'),
  ('Ford', 'Fiesta', 'hatchback'), ('Ford', 'Focus', 'hatchback'), ('Ford', 'Territory', 'suv'),
  ('Ford', 'Transit', 'van'), ('Ford', 'Puma', 'suv'),
  -- Suzuki
  ('Suzuki', 'Swift', 'hatchback'), ('Suzuki', 'Vitara', 'suv'), ('Suzuki', 'Jimny', 'suv'),
  ('Suzuki', 'Baleno', 'hatchback'), ('Suzuki', 'Ertiga', 'mpv'), ('Suzuki', 'S-Presso', 'hatchback'),
  -- Honda
  ('Honda', 'Civic', 'sedan'), ('Honda', 'CR-V', 'suv'), ('Honda', 'HR-V', 'suv'),
  ('Honda', 'Fit', 'hatchback'), ('Honda', 'City', 'sedan'), ('Honda', 'Accord', 'sedan'),
  -- Mazda
  ('Mazda', 'CX-5', 'suv'), ('Mazda', 'CX-3', 'suv'), ('Mazda', 'Mazda3', 'hatchback'),
  ('Mazda', 'Mazda2', 'hatchback'), ('Mazda', 'BT-50', 'pickup'), ('Mazda', 'CX-30', 'suv'),
  -- Renault
  ('Renault', 'Duster', 'suv'), ('Renault', 'Kwid', 'hatchback'), ('Renault', 'Clio', 'hatchback'),
  ('Renault', 'Captur', 'suv'), ('Renault', 'Megane', 'hatchback'), ('Renault', 'Triber', 'mpv'),
  -- Peugeot
  ('Peugeot', '208', 'hatchback'), ('Peugeot', '2008', 'suv'), ('Peugeot', '3008', 'suv'),
  ('Peugeot', '308', 'hatchback'), ('Peugeot', '5008', 'suv'),
  -- Mitsubishi
  ('Mitsubishi', 'Pajero', 'suv'), ('Mitsubishi', 'Triton', 'pickup'), ('Mitsubishi', 'ASX', 'suv'),
  ('Mitsubishi', 'Outlander', 'suv'), ('Mitsubishi', 'Eclipse Cross', 'suv'), ('Mitsubishi', 'L200', 'pickup'),
  -- Isuzu
  ('Isuzu', 'D-Max', 'pickup'), ('Isuzu', 'MU-X', 'suv'), ('Isuzu', 'KB', 'pickup'),
  -- Chevrolet
  ('Chevrolet', 'Onix', 'hatchback'), ('Chevrolet', 'Tracker', 'suv'), ('Chevrolet', 'S10', 'pickup'),
  ('Chevrolet', 'Cruze', 'sedan'), ('Chevrolet', 'Equinox', 'suv'),
  -- Fiat
  ('Fiat', 'Strada', 'pickup'), ('Fiat', 'Argo', 'hatchback'), ('Fiat', 'Toro', 'pickup'),
  ('Fiat', 'Mobi', 'hatchback'), ('Fiat', 'Pulse', 'suv'),
  -- Audi
  ('Audi', 'A3', 'sedan'), ('Audi', 'A4', 'sedan'), ('Audi', 'Q3', 'suv'),
  ('Audi', 'Q5', 'suv'), ('Audi', 'Q7', 'suv'),
  -- Land Rover
  ('Land Rover', 'Discovery Sport', 'suv'), ('Land Rover', 'Defender', 'suv'),
  ('Land Rover', 'Range Rover Sport', 'suv'), ('Land Rover', 'Range Rover Evoque', 'suv'),
  -- Jeep
  ('Jeep', 'Compass', 'suv'), ('Jeep', 'Renegade', 'suv'), ('Jeep', 'Wrangler', 'suv'),
  ('Jeep', 'Grand Cherokee', 'suv'),
  -- Volvo
  ('Volvo', 'XC40', 'suv'), ('Volvo', 'XC60', 'suv'), ('Volvo', 'XC90', 'suv'),
  -- Chinese brands
  ('Haval', 'Jolion', 'suv'), ('Haval', 'H6', 'suv'), ('Haval', 'H2', 'suv'),
  ('Chery', 'Tiggo 4 Pro', 'suv'), ('Chery', 'Tiggo 7 Pro', 'suv'), ('Chery', 'Tiggo 8 Pro', 'suv'),
  ('JAC', 'S3', 'suv'), ('JAC', 'T8', 'pickup'),
  ('GWM', 'P-Series', 'pickup'), ('GWM', 'Steed', 'pickup'),
  ('BAIC', 'X25', 'suv'), ('BAIC', 'D20', 'hatchback'),
  ('BYD', 'Atto 3', 'suv'), ('BYD', 'Dolphin', 'hatchback'), ('BYD', 'Seal', 'sedan'),
  ('MG', 'ZS', 'suv'), ('MG', 'HS', 'suv'), ('MG', '3', 'hatchback'),
  ('Opel', 'Corsa', 'hatchback'), ('Opel', 'Crossland', 'suv'), ('Opel', 'Mokka', 'suv'),
  ('Subaru', 'Forester', 'suv'), ('Subaru', 'XV', 'suv'), ('Subaru', 'Outback', 'wagon'),
  ('Lexus', 'NX', 'suv'), ('Lexus', 'RX', 'suv'),
  ('Tata', 'Nexon', 'suv'), ('Tata', 'Punch', 'suv'),
  ('Mahindra', 'Scorpio', 'suv'), ('Mahindra', 'XUV700', 'suv'), ('Mahindra', 'Bolero', 'suv'),
  ('Skoda', 'Octavia', 'sedan'), ('Skoda', 'Kamiq', 'suv'), ('Skoda', 'Karoq', 'suv')
) AS v(make_name, model_name, body_type)
JOIN public.vehicle_makes m ON m.name = v.make_name
ON CONFLICT (make_id, name) DO NOTHING;
