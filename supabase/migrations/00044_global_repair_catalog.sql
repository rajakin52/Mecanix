-- Make repair catalog global: tenant_id nullable (NULL = shared across all tenants)
-- Same pattern as symptom_codes and vehicle_makes/models

-- Step 1: Allow NULL tenant_id on all 3 catalog tables
ALTER TABLE public.repair_catalog ALTER COLUMN tenant_id DROP NOT NULL;
ALTER TABLE public.repair_catalog_labour_items ALTER COLUMN tenant_id DROP NOT NULL;
ALTER TABLE public.repair_catalog_parts_items ALTER COLUMN tenant_id DROP NOT NULL;

-- Step 2: Update RLS policies to include global items (tenant_id IS NULL)
DROP POLICY IF EXISTS "repair_catalog_tenant_isolation" ON public.repair_catalog;
CREATE POLICY "repair_catalog_select" ON public.repair_catalog
  FOR SELECT USING (tenant_id IS NULL OR tenant_id = public.get_tenant_id());
CREATE POLICY "repair_catalog_modify" ON public.repair_catalog
  FOR ALL USING (tenant_id = public.get_tenant_id());

DROP POLICY IF EXISTS "catalog_labour_tenant_isolation" ON public.repair_catalog_labour_items;
CREATE POLICY "catalog_labour_select" ON public.repair_catalog_labour_items
  FOR SELECT USING (tenant_id IS NULL OR tenant_id = public.get_tenant_id());
CREATE POLICY "catalog_labour_modify" ON public.repair_catalog_labour_items
  FOR ALL USING (tenant_id = public.get_tenant_id());

DROP POLICY IF EXISTS "catalog_parts_tenant_isolation" ON public.repair_catalog_parts_items;
CREATE POLICY "catalog_parts_select" ON public.repair_catalog_parts_items
  FOR SELECT USING (tenant_id IS NULL OR tenant_id = public.get_tenant_id());
CREATE POLICY "catalog_parts_modify" ON public.repair_catalog_parts_items
  FOR ALL USING (tenant_id = public.get_tenant_id());

-- Step 3: Seed global catalog items (tenant_id = NULL)
-- Industry-standard repair items with default labour hours

-- Helper: insert catalog item + labour + parts in one go
DO $$
DECLARE
  v_id uuid;
  v_labour_id uuid;
  items jsonb := '[
    {"type":"maintenance_package","code":"SVC-5K","name":"5,000km Service","cat":"Service","hrs":1.0,
     "labour":[{"desc":"Oil & filter change + fluid check","hrs":1.0}],
     "parts":[{"name":"Engine Oil 5W-30 (4L)","qty":1},{"name":"Oil Filter","qty":1}]},
    {"type":"maintenance_package","code":"SVC-10K","name":"10,000km Service","cat":"Service","hrs":1.5,
     "labour":[{"desc":"Oil change + air filter + brake check + fluid top-up","hrs":1.5}],
     "parts":[{"name":"Engine Oil 5W-30 (4L)","qty":1},{"name":"Oil Filter","qty":1},{"name":"Air Filter","qty":1}]},
    {"type":"maintenance_package","code":"SVC-20K","name":"20,000km Service","cat":"Service","hrs":2.5,
     "labour":[{"desc":"Full service: oil, filters, spark plugs, coolant, brake inspection","hrs":2.5}],
     "parts":[{"name":"Engine Oil (4L)","qty":1},{"name":"Oil Filter","qty":1},{"name":"Air Filter","qty":1},{"name":"Spark Plugs (set)","qty":1},{"name":"Cabin Filter","qty":1}]},
    {"type":"maintenance_package","code":"SVC-40K","name":"40,000km Service","cat":"Service","hrs":3.5,
     "labour":[{"desc":"Full service + transmission fluid + brake fluid + timing inspection","hrs":3.5}],
     "parts":[{"name":"Engine Oil (4L)","qty":1},{"name":"Oil Filter","qty":1},{"name":"Air Filter","qty":1},{"name":"Cabin Filter","qty":1},{"name":"Spark Plugs (set)","qty":1},{"name":"Brake Fluid DOT4 (1L)","qty":1}]},
    {"type":"maintenance_package","code":"SVC-60K","name":"60,000km Major Service","cat":"Service","hrs":5.0,
     "labour":[{"desc":"Major service: all fluids, all filters, timing belt/chain inspection, injector clean","hrs":5.0}],
     "parts":[{"name":"Engine Oil (4L)","qty":1},{"name":"Oil Filter","qty":1},{"name":"Air Filter","qty":1},{"name":"Fuel Filter","qty":1},{"name":"Cabin Filter","qty":1},{"name":"Spark Plugs (set)","qty":1}]},
    {"type":"maintenance_package","code":"SVC-MAJOR","name":"Major Service (Custom)","cat":"Service","hrs":5.0,
     "labour":[{"desc":"Comprehensive 50-point service with timing belt inspection","hrs":5.0}],"parts":[]},
    {"type":"maintenance_package","code":"SVC-AC","name":"A/C Service & Regas","cat":"HVAC","hrs":1.5,
     "labour":[{"desc":"A/C regas + leak check + cabin filter","hrs":1.5}],
     "parts":[{"name":"Refrigerant R134a","qty":1},{"name":"Cabin Filter","qty":1}]},
    {"type":"maintenance_package","code":"SVC-PRETRIP","name":"Pre-Trip Safety Check","cat":"Service","hrs":0.75,
     "labour":[{"desc":"Tires, brakes, lights, fluids, wipers — multi-point safety check","hrs":0.75}],"parts":[]},

    {"type":"standard_repair","code":"REP-BRAKE-PAD-F","name":"Brake Pads - Front","cat":"Brakes","hrs":1.0,
     "labour":[{"desc":"Replace front brake pads","hrs":1.0}],
     "parts":[{"name":"Front Brake Pads (set)","qty":1}]},
    {"type":"standard_repair","code":"REP-BRAKE-PAD-R","name":"Brake Pads - Rear","cat":"Brakes","hrs":1.0,
     "labour":[{"desc":"Replace rear brake pads","hrs":1.0}],
     "parts":[{"name":"Rear Brake Pads (set)","qty":1}]},
    {"type":"standard_repair","code":"REP-BRAKE-DISC-F","name":"Brake Discs + Pads - Front","cat":"Brakes","hrs":2.0,
     "labour":[{"desc":"Replace front brake discs and pads","hrs":2.0}],
     "parts":[{"name":"Front Brake Discs (pair)","qty":1},{"name":"Front Brake Pads (set)","qty":1}]},
    {"type":"standard_repair","code":"REP-BRAKE-DISC-R","name":"Brake Discs + Pads - Rear","cat":"Brakes","hrs":2.0,
     "labour":[{"desc":"Replace rear brake discs and pads","hrs":2.0}],
     "parts":[{"name":"Rear Brake Discs (pair)","qty":1},{"name":"Rear Brake Pads (set)","qty":1}]},
    {"type":"standard_repair","code":"REP-BRAKE-FLUID","name":"Brake Fluid Change","cat":"Brakes","hrs":0.5,
     "labour":[{"desc":"Brake fluid flush and bleed","hrs":0.5}],
     "parts":[{"name":"Brake Fluid DOT4 (1L)","qty":1}]},
    {"type":"standard_repair","code":"REP-BRAKE-CALIPER","name":"Brake Caliper Replacement","cat":"Brakes","hrs":1.5,
     "labour":[{"desc":"Replace brake caliper + bleed","hrs":1.5}],
     "parts":[{"name":"Brake Caliper","qty":1}]},
    {"type":"standard_repair","code":"REP-HANDBRAKE","name":"Handbrake Cable Replacement","cat":"Brakes","hrs":1.5,
     "labour":[{"desc":"Replace handbrake cable + adjust","hrs":1.5}],
     "parts":[{"name":"Handbrake Cable","qty":1}]},
    {"type":"standard_repair","code":"REP-ABS-SENSOR","name":"ABS Sensor Replacement","cat":"Brakes","hrs":1.0,
     "labour":[{"desc":"Replace ABS wheel speed sensor","hrs":1.0}],
     "parts":[{"name":"ABS Sensor","qty":1}]},

    {"type":"standard_repair","code":"REP-TIMING-BELT","name":"Timing Belt Replacement","cat":"Engine","hrs":4.0,
     "labour":[{"desc":"Remove and replace timing belt + tensioner","hrs":4.0}],
     "parts":[{"name":"Timing Belt Kit","qty":1}]},
    {"type":"standard_repair","code":"REP-TIMING-CHAIN","name":"Timing Chain Replacement","cat":"Engine","hrs":6.0,
     "labour":[{"desc":"Remove and replace timing chain + guides","hrs":6.0}],
     "parts":[{"name":"Timing Chain Kit","qty":1}]},
    {"type":"standard_repair","code":"REP-HEAD-GASKET","name":"Head Gasket Replacement","cat":"Engine","hrs":8.0,
     "labour":[{"desc":"Remove cylinder head, replace gasket, reassemble","hrs":8.0}],
     "parts":[{"name":"Head Gasket Set","qty":1}]},
    {"type":"standard_repair","code":"REP-WATERPUMP","name":"Water Pump Replacement","cat":"Engine","hrs":3.0,
     "labour":[{"desc":"Replace water pump + coolant","hrs":3.0}],
     "parts":[{"name":"Water Pump","qty":1},{"name":"Coolant (5L)","qty":1}]},
    {"type":"standard_repair","code":"REP-THERMOSTAT","name":"Thermostat Replacement","cat":"Engine","hrs":1.5,
     "labour":[{"desc":"Replace thermostat + coolant top-up","hrs":1.5}],
     "parts":[{"name":"Thermostat","qty":1}]},
    {"type":"standard_repair","code":"REP-TURBO","name":"Turbocharger Replacement","cat":"Engine","hrs":6.0,
     "labour":[{"desc":"Remove and replace turbocharger + oil lines","hrs":6.0}],
     "parts":[{"name":"Turbocharger","qty":1}]},
    {"type":"standard_repair","code":"REP-FUEL-PUMP","name":"Fuel Pump Replacement","cat":"Engine","hrs":2.5,
     "labour":[{"desc":"Replace fuel pump (in-tank or external)","hrs":2.5}],
     "parts":[{"name":"Fuel Pump","qty":1}]},
    {"type":"standard_repair","code":"REP-EGR","name":"EGR Valve Replacement","cat":"Engine","hrs":1.5,
     "labour":[{"desc":"Replace EGR valve + clean intake","hrs":1.5}],
     "parts":[{"name":"EGR Valve","qty":1}]},
    {"type":"standard_repair","code":"REP-ENGINE-MOUNT","name":"Engine Mount Replacement","cat":"Engine","hrs":2.0,
     "labour":[{"desc":"Replace engine mount(s)","hrs":2.0}],
     "parts":[{"name":"Engine Mount","qty":1}]},
    {"type":"standard_repair","code":"REP-INJECT-CLEAN","name":"Injector Cleaning","cat":"Engine","hrs":2.0,
     "labour":[{"desc":"Remove, clean, and test fuel injectors","hrs":2.0}],"parts":[]},
    {"type":"standard_repair","code":"REP-RADIATOR","name":"Radiator Replacement","cat":"Cooling","hrs":2.5,
     "labour":[{"desc":"Drain coolant, replace radiator, refill","hrs":2.5}],
     "parts":[{"name":"Radiator","qty":1},{"name":"Coolant (5L)","qty":1}]},
    {"type":"standard_repair","code":"REP-COOLANT-FLUSH","name":"Coolant Flush","cat":"Cooling","hrs":1.0,
     "labour":[{"desc":"Drain, flush, and refill cooling system","hrs":1.0}],
     "parts":[{"name":"Coolant (5L)","qty":2}]},

    {"type":"standard_repair","code":"REP-CLUTCH","name":"Clutch Replacement","cat":"Drivetrain","hrs":6.0,
     "labour":[{"desc":"Remove gearbox, replace clutch kit, reassemble","hrs":6.0}],
     "parts":[{"name":"Clutch Kit (disc + pressure plate + bearing)","qty":1}]},
    {"type":"standard_repair","code":"REP-FLYWHEEL","name":"Dual Mass Flywheel Replacement","cat":"Drivetrain","hrs":7.0,
     "labour":[{"desc":"Remove gearbox, replace flywheel + clutch kit","hrs":7.0}],
     "parts":[{"name":"Dual Mass Flywheel","qty":1},{"name":"Clutch Kit","qty":1}]},
    {"type":"standard_repair","code":"REP-CV-BOOT","name":"CV Boot Replacement","cat":"Drivetrain","hrs":1.5,
     "labour":[{"desc":"Replace CV boot + repack grease","hrs":1.5}],
     "parts":[{"name":"CV Boot Kit","qty":1}]},
    {"type":"standard_repair","code":"REP-DRIVESHAFT","name":"Driveshaft Replacement","cat":"Drivetrain","hrs":2.0,
     "labour":[{"desc":"Replace driveshaft assembly","hrs":2.0}],
     "parts":[{"name":"Driveshaft Assembly","qty":1}]},
    {"type":"standard_repair","code":"REP-GEARBOX-OIL","name":"Gearbox Oil Change","cat":"Drivetrain","hrs":1.0,
     "labour":[{"desc":"Drain and refill gearbox oil","hrs":1.0}],
     "parts":[{"name":"Gearbox Oil (2L)","qty":1}]},
    {"type":"standard_repair","code":"REP-AUTO-SERVICE","name":"Automatic Transmission Service","cat":"Drivetrain","hrs":2.0,
     "labour":[{"desc":"ATF drain + filter + refill","hrs":2.0}],
     "parts":[{"name":"ATF (6L)","qty":1},{"name":"Transmission Filter","qty":1}]},

    {"type":"standard_repair","code":"REP-BATTERY","name":"Battery Replacement","cat":"Electrical","hrs":0.5,
     "labour":[{"desc":"Replace battery + terminal clean","hrs":0.5}],
     "parts":[{"name":"Battery","qty":1}]},
    {"type":"standard_repair","code":"REP-ALTERNATOR","name":"Alternator Replacement","cat":"Electrical","hrs":2.0,
     "labour":[{"desc":"Remove and replace alternator","hrs":2.0}],
     "parts":[{"name":"Alternator","qty":1}]},
    {"type":"standard_repair","code":"REP-STARTER","name":"Starter Motor Replacement","cat":"Electrical","hrs":1.5,
     "labour":[{"desc":"Remove and replace starter motor","hrs":1.5}],
     "parts":[{"name":"Starter Motor","qty":1}]},
    {"type":"standard_repair","code":"REP-WINDOW-REG","name":"Window Regulator Replacement","cat":"Electrical","hrs":1.5,
     "labour":[{"desc":"Remove door panel, replace window regulator/motor","hrs":1.5}],
     "parts":[{"name":"Window Regulator","qty":1}]},

    {"type":"standard_repair","code":"REP-SHOCK-F","name":"Shock Absorbers - Front (pair)","cat":"Suspension","hrs":2.0,
     "labour":[{"desc":"Replace front shock absorbers","hrs":2.0}],
     "parts":[{"name":"Front Shock Absorbers (pair)","qty":1}]},
    {"type":"standard_repair","code":"REP-SHOCK-R","name":"Shock Absorbers - Rear (pair)","cat":"Suspension","hrs":1.5,
     "labour":[{"desc":"Replace rear shock absorbers","hrs":1.5}],
     "parts":[{"name":"Rear Shock Absorbers (pair)","qty":1}]},
    {"type":"standard_repair","code":"REP-BALLJOINT","name":"Ball Joint Replacement","cat":"Suspension","hrs":1.5,
     "labour":[{"desc":"Replace ball joint + alignment check","hrs":1.5}],
     "parts":[{"name":"Ball Joint","qty":1}]},
    {"type":"standard_repair","code":"REP-TIEROD","name":"Tie Rod End Replacement","cat":"Suspension","hrs":1.0,
     "labour":[{"desc":"Replace tie rod end + alignment","hrs":1.0}],
     "parts":[{"name":"Tie Rod End","qty":1}]},
    {"type":"standard_repair","code":"REP-CONTROL-ARM","name":"Control Arm Replacement","cat":"Suspension","hrs":2.0,
     "labour":[{"desc":"Replace control arm + bush + alignment","hrs":2.0}],
     "parts":[{"name":"Control Arm","qty":1}]},
    {"type":"standard_repair","code":"REP-WHEEL-BEARING","name":"Wheel Bearing Replacement","cat":"Suspension","hrs":1.5,
     "labour":[{"desc":"Replace wheel bearing/hub assembly","hrs":1.5}],
     "parts":[{"name":"Wheel Bearing","qty":1}]},
    {"type":"standard_repair","code":"REP-WHEEL-ALIGN","name":"Wheel Alignment","cat":"Suspension","hrs":1.0,
     "labour":[{"desc":"Four-wheel alignment","hrs":1.0}],"parts":[]},
    {"type":"standard_repair","code":"REP-STEERING-RACK","name":"Steering Rack Replacement","cat":"Steering","hrs":4.0,
     "labour":[{"desc":"Replace steering rack + alignment","hrs":4.0}],
     "parts":[{"name":"Steering Rack","qty":1}]},
    {"type":"standard_repair","code":"REP-POWER-STEER","name":"Power Steering Pump","cat":"Steering","hrs":2.0,
     "labour":[{"desc":"Replace power steering pump + fluid","hrs":2.0}],
     "parts":[{"name":"Power Steering Pump","qty":1}]},

    {"type":"standard_repair","code":"REP-WHEEL-BALANCE","name":"Wheel Balancing (4 wheels)","cat":"Tires","hrs":0.5,
     "labour":[{"desc":"Balance all four wheels","hrs":0.5}],"parts":[]},
    {"type":"standard_repair","code":"REP-TIRE-CHANGE","name":"Tire Change (per tire)","cat":"Tires","hrs":0.25,
     "labour":[{"desc":"Remove old tire, mount and balance new tire","hrs":0.25}],"parts":[]},
    {"type":"standard_repair","code":"REP-TIRE-REPAIR","name":"Tire Puncture Repair","cat":"Tires","hrs":0.3,
     "labour":[{"desc":"Locate and repair tire puncture","hrs":0.3}],
     "parts":[{"name":"Puncture Repair Kit","qty":1}]},

    {"type":"standard_repair","code":"REP-EXHAUST-MUFFLER","name":"Muffler/Silencer Replacement","cat":"Exhaust","hrs":1.5,
     "labour":[{"desc":"Replace exhaust muffler/silencer","hrs":1.5}],
     "parts":[{"name":"Exhaust Muffler","qty":1}]},
    {"type":"standard_repair","code":"REP-CATALYTIC","name":"Catalytic Converter Replacement","cat":"Exhaust","hrs":2.0,
     "labour":[{"desc":"Replace catalytic converter","hrs":2.0}],
     "parts":[{"name":"Catalytic Converter","qty":1}]},
    {"type":"standard_repair","code":"REP-DPF-CLEAN","name":"DPF Clean / Regeneration","cat":"Exhaust","hrs":2.0,
     "labour":[{"desc":"Forced DPF regeneration + diagnostic check","hrs":2.0}],"parts":[]},

    {"type":"standard_repair","code":"REP-AC-COMPRESSOR","name":"A/C Compressor Replacement","cat":"HVAC","hrs":4.0,
     "labour":[{"desc":"Evacuate system, replace compressor, recharge","hrs":4.0}],
     "parts":[{"name":"A/C Compressor","qty":1},{"name":"Refrigerant R134a","qty":1}]},
    {"type":"standard_repair","code":"REP-BLOWER-MOTOR","name":"Blower Motor Replacement","cat":"HVAC","hrs":1.5,
     "labour":[{"desc":"Replace cabin blower motor","hrs":1.5}],
     "parts":[{"name":"Blower Motor","qty":1}]},

    {"type":"standard_repair","code":"DIAG-GENERAL","name":"General Diagnostic","cat":"Diagnostics","hrs":1.0,
     "labour":[{"desc":"OBD scan + visual inspection + test drive","hrs":1.0}],"parts":[]},
    {"type":"standard_repair","code":"DIAG-ELECTRICAL","name":"Electrical Diagnostic","cat":"Diagnostics","hrs":1.5,
     "labour":[{"desc":"Electrical system diagnostic + wiring check","hrs":1.5}],"parts":[]},
    {"type":"standard_repair","code":"DIAG-ENGINE","name":"Engine Diagnostic (Advanced)","cat":"Diagnostics","hrs":2.0,
     "labour":[{"desc":"Compression test, leak-down, OBD deep scan","hrs":2.0}],"parts":[]},

    {"type":"standard_repair","code":"REP-WIPER","name":"Wiper Blades Replacement","cat":"Body","hrs":0.3,
     "labour":[{"desc":"Replace wiper blades","hrs":0.3}],
     "parts":[{"name":"Wiper Blades (set)","qty":1}]},
    {"type":"standard_repair","code":"REP-HEADLIGHT","name":"Headlight Bulb Replacement","cat":"Body","hrs":0.5,
     "labour":[{"desc":"Replace headlight bulb","hrs":0.5}],
     "parts":[{"name":"Headlight Bulb","qty":1}]},
    {"type":"standard_repair","code":"REP-WINDSCREEN","name":"Windscreen Replacement","cat":"Body","hrs":2.0,
     "labour":[{"desc":"Remove and replace windscreen","hrs":2.0}],
     "parts":[{"name":"Windscreen","qty":1}]},
    {"type":"standard_repair","code":"REP-MIRROR","name":"Side Mirror Replacement","cat":"Body","hrs":0.5,
     "labour":[{"desc":"Replace side mirror","hrs":0.5}],
     "parts":[{"name":"Side Mirror","qty":1}]},

    {"type":"standard_repair","code":"BODY-DENT-S","name":"Dent Repair - Small","cat":"Body Repair","hrs":2.0,
     "labour":[{"desc":"Small dent removal + touch-up paint","hrs":2.0}],"parts":[]},
    {"type":"standard_repair","code":"BODY-DENT-L","name":"Dent Repair - Large","cat":"Body Repair","hrs":4.0,
     "labour":[{"desc":"Large dent repair with filler + repaint","hrs":4.0}],
     "parts":[{"name":"Body Filler","qty":1},{"name":"Paint (matched)","qty":1}]},
    {"type":"standard_repair","code":"BODY-SCRATCH","name":"Scratch Repair","cat":"Body Repair","hrs":1.5,
     "labour":[{"desc":"Scratch polish + touch-up","hrs":1.5}],"parts":[]},
    {"type":"standard_repair","code":"BODY-BUMPER-F","name":"Front Bumper Repair","cat":"Body Repair","hrs":3.0,
     "labour":[{"desc":"Repair + respray front bumper","hrs":3.0}],
     "parts":[{"name":"Paint (matched)","qty":1}]},
    {"type":"standard_repair","code":"BODY-BUMPER-R","name":"Rear Bumper Repair","cat":"Body Repair","hrs":3.0,
     "labour":[{"desc":"Repair + respray rear bumper","hrs":3.0}],
     "parts":[{"name":"Paint (matched)","qty":1}]},
    {"type":"standard_repair","code":"BODY-FENDER","name":"Fender Repair","cat":"Body Repair","hrs":4.0,
     "labour":[{"desc":"Fender repair + repaint","hrs":4.0}],
     "parts":[{"name":"Body Filler","qty":1},{"name":"Paint (matched)","qty":1}]},
    {"type":"standard_repair","code":"BODY-DOOR","name":"Door Panel Repair","cat":"Body Repair","hrs":5.0,
     "labour":[{"desc":"Door panel repair + repaint","hrs":5.0}],
     "parts":[{"name":"Paint (matched)","qty":1}]},
    {"type":"standard_repair","code":"BODY-PDR","name":"Paintless Dent Removal","cat":"Body Repair","hrs":1.0,
     "labour":[{"desc":"PDR — remove small dents without paint damage","hrs":1.0}],"parts":[]},
    {"type":"standard_repair","code":"BODY-FULL-REPAINT","name":"Full Vehicle Respray","cat":"Body Repair","hrs":40.0,
     "labour":[{"desc":"Full vehicle strip, prep, prime, and repaint","hrs":40.0}],
     "parts":[{"name":"Primer (5L)","qty":2},{"name":"Base Coat Paint (5L)","qty":3},{"name":"Clear Coat (5L)","qty":2}]},
    {"type":"standard_repair","code":"BODY-POLISH","name":"Full Vehicle Polish + Wax","cat":"Body Repair","hrs":3.0,
     "labour":[{"desc":"Machine polish + hand wax entire vehicle","hrs":3.0}],
     "parts":[{"name":"Polish Compound","qty":1},{"name":"Wax","qty":1}]}
  ]';
  item jsonb;
  labour_item jsonb;
  parts_item jsonb;
  i int;
BEGIN
  FOR item IN SELECT * FROM jsonb_array_elements(items)
  LOOP
    -- Skip if already exists
    IF EXISTS (SELECT 1 FROM repair_catalog WHERE code = item->>'code' AND tenant_id IS NULL) THEN
      CONTINUE;
    END IF;

    INSERT INTO repair_catalog (tenant_id, type, code, name, category, estimated_hours, is_active, sort_order)
    VALUES (NULL, item->>'type', item->>'code', item->>'name', item->>'cat', (item->>'hrs')::numeric, true, 0)
    RETURNING id INTO v_id;

    -- Insert labour items
    i := 0;
    FOR labour_item IN SELECT * FROM jsonb_array_elements(item->'labour')
    LOOP
      INSERT INTO repair_catalog_labour_items (tenant_id, catalog_id, description, hours, rate, sort_order)
      VALUES (NULL, v_id, labour_item->>'desc', (labour_item->>'hrs')::numeric, 0, i);
      i := i + 1;
    END LOOP;

    -- Insert parts items
    i := 0;
    IF item->'parts' IS NOT NULL AND jsonb_array_length(item->'parts') > 0 THEN
      FOR parts_item IN SELECT * FROM jsonb_array_elements(item->'parts')
      LOOP
        INSERT INTO repair_catalog_parts_items (tenant_id, catalog_id, part_name, quantity, unit_cost, markup_pct, sort_order)
        VALUES (NULL, v_id, parts_item->>'name', (parts_item->>'qty')::numeric, 0, 0, i);
        i := i + 1;
      END LOOP;
    END IF;
  END LOOP;
END $$;
