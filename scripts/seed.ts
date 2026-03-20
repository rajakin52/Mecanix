import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env['SUPABASE_URL'] ?? 'http://127.0.0.1:54321';
const SERVICE_ROLE_KEY = process.env['SUPABASE_SERVICE_ROLE_KEY'] ?? '';

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const DEMO_USERS = [
  { email: 'owner@demo.mecanix.io', password: 'Demo1234!', fullName: 'João Silva', role: 'owner' },
  { email: 'manager@demo.mecanix.io', password: 'Demo1234!', fullName: 'Maria Santos', role: 'manager' },
  { email: 'tech@demo.mecanix.io', password: 'Demo1234!', fullName: 'Pedro Neto', role: 'technician' },
];

const DEMO_CUSTOMERS = [
  { fullName: 'António Fernandes', phone: '+244 923 456 789', email: 'antonio@email.ao' },
  { fullName: 'Ana Luísa Martins', phone: '+244 912 345 678', email: 'ana.martins@email.ao' },
  { fullName: 'Carlos Eduardo Mendes', phone: '+244 934 567 890' },
  { fullName: 'Francisca Domingos', phone: '+244 945 678 901', email: 'francisca@email.ao' },
  { fullName: 'Manuel Augusto', phone: '+244 956 789 012' },
  { fullName: 'Rosa Maria da Silva', phone: '+244 967 890 123' },
  { fullName: 'José Fernando Costa', phone: '+244 978 901 234', email: 'jose.costa@email.ao' },
  { fullName: 'Beatriz Soares', phone: '+244 989 012 345' },
  { fullName: 'Paulo André Nunes', phone: '+244 911 234 567', email: 'paulo.nunes@email.ao' },
  { fullName: 'Teresa Gonçalves', phone: '+244 922 345 678' },
];

const DEMO_VEHICLES = [
  { plate: 'LD-23-45-AB', make: 'Toyota', model: 'Hilux', year: 2019, fuelType: 'diesel', color: 'Branco', mileage: 85000 },
  { plate: 'LD-34-56-CD', make: 'Toyota', model: 'Corolla', year: 2020, fuelType: 'petrol', color: 'Prata', mileage: 62000 },
  { plate: 'LD-45-67-EF', make: 'Nissan', model: 'Navara', year: 2018, fuelType: 'diesel', color: 'Preto', mileage: 120000 },
  { plate: 'LD-56-78-GH', make: 'Toyota', model: 'Land Cruiser', year: 2017, fuelType: 'diesel', color: 'Branco', mileage: 145000 },
  { plate: 'LD-67-89-IJ', make: 'Mitsubishi', model: 'L200', year: 2021, fuelType: 'diesel', color: 'Cinza', mileage: 35000 },
  { plate: 'LD-78-90-KL', make: 'Nissan', model: 'Patrol', year: 2016, fuelType: 'diesel', color: 'Preto', mileage: 180000 },
  { plate: 'LD-89-01-MN', make: 'Toyota', model: 'RAV4', year: 2022, fuelType: 'hybrid', color: 'Azul', mileage: 22000 },
  { plate: 'LD-90-12-OP', make: 'Mitsubishi', model: 'Pajero', year: 2015, fuelType: 'diesel', color: 'Prata', mileage: 195000 },
  { plate: 'LD-01-23-QR', make: 'Toyota', model: 'Fortuner', year: 2020, fuelType: 'diesel', color: 'Bronze', mileage: 70000 },
  { plate: 'LD-12-34-ST', make: 'Nissan', model: 'X-Trail', year: 2019, fuelType: 'petrol', color: 'Vermelho', mileage: 55000 },
  { plate: 'LD-23-45-UV', make: 'Toyota', model: 'Hilux', year: 2021, fuelType: 'diesel', color: 'Cinza', mileage: 40000 },
  { plate: 'LD-34-56-WX', make: 'Mitsubishi', model: 'Outlander', year: 2023, fuelType: 'hybrid', color: 'Branco', mileage: 12000 },
  { plate: 'LD-45-67-YZ', make: 'Toyota', model: 'Prado', year: 2018, fuelType: 'diesel', color: 'Verde', mileage: 110000 },
  { plate: 'LD-56-78-AA', make: 'Nissan', model: 'Frontier', year: 2020, fuelType: 'diesel', color: 'Preto', mileage: 75000 },
  { plate: 'LD-67-89-BB', make: 'Toyota', model: 'Yaris', year: 2022, fuelType: 'petrol', color: 'Branco', mileage: 18000 },
];

async function seed() {
  console.log('🌱 Seeding MECANIX demo data...\n');

  // 1. Create tenant
  console.log('📦 Creating tenant...');
  const { data: tenant, error: tenantError } = await supabase
    .from('tenants')
    .insert({
      name: 'Oficina Demo',
      slug: 'oficina-demo',
      country: 'AO',
      currency: 'AOA',
      timezone: 'Africa/Luanda',
      locale: 'pt-PT',
      email: 'owner@demo.mecanix.io',
      phone: '+244 222 000 001',
      address: 'Rua da Missão, 123, Luanda, Angola',
      tax_id: '1234567890',
    })
    .select()
    .single();

  if (tenantError) {
    console.error('Failed to create tenant:', tenantError);
    process.exit(1);
  }
  console.log(`  ✓ Tenant: ${tenant.name} (${tenant.id})`);

  // 2. Create auth users + user rows
  console.log('\n👥 Creating users...');
  const userIds: string[] = [];

  for (const u of DEMO_USERS) {
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: u.email,
      password: u.password,
      email_confirm: true,
    });

    if (authError) {
      console.error(`  ✗ Auth user ${u.email}:`, authError.message);
      continue;
    }

    const { data: user, error: userError } = await supabase
      .from('users')
      .insert({
        tenant_id: tenant.id,
        auth_id: authData.user.id,
        email: u.email,
        full_name: u.fullName,
        role: u.role,
      })
      .select()
      .single();

    if (userError) {
      console.error(`  ✗ User row ${u.email}:`, userError.message);
      continue;
    }

    userIds.push(user.id);
    console.log(`  ✓ ${u.role}: ${u.fullName} (${u.email})`);
  }

  const ownerId = userIds[0];

  // 3. Create customers
  console.log('\n🧑 Creating customers...');
  const customerIds: string[] = [];

  for (const c of DEMO_CUSTOMERS) {
    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .insert({
        tenant_id: tenant.id,
        full_name: c.fullName,
        phone: c.phone,
        email: c.email ?? null,
        created_by: ownerId,
        updated_by: ownerId,
      })
      .select()
      .single();

    if (customerError) {
      console.error(`  ✗ ${c.fullName}:`, customerError.message);
      continue;
    }

    customerIds.push(customer.id);
    console.log(`  ✓ ${c.fullName}`);
  }

  // 4. Create vehicles (distribute among customers)
  console.log('\n🚗 Creating vehicles...');
  for (let i = 0; i < DEMO_VEHICLES.length; i++) {
    const v = DEMO_VEHICLES[i]!;
    const customerId = customerIds[i % customerIds.length]!;

    const { error: vehicleError } = await supabase
      .from('vehicles')
      .insert({
        tenant_id: tenant.id,
        customer_id: customerId,
        plate: v.plate,
        make: v.make,
        model: v.model,
        year: v.year,
        fuel_type: v.fuelType,
        color: v.color,
        mileage: v.mileage,
        created_by: ownerId,
        updated_by: ownerId,
      });

    if (vehicleError) {
      console.error(`  ✗ ${v.plate}:`, vehicleError.message);
      continue;
    }

    console.log(`  ✓ ${v.plate} - ${v.make} ${v.model} (${v.year})`);
  }

  console.log('\n✅ Seed complete!');
  console.log('\n📋 Login credentials:');
  for (const u of DEMO_USERS) {
    console.log(`  ${u.role.padEnd(12)} ${u.email} / ${u.password}`);
  }
}

seed().catch(console.error);
