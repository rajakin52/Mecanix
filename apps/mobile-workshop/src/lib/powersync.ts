import { PowerSyncDatabase } from '@powersync/react-native';
import { supabase } from './supabase';

const schema = {
  customers: {
    id: 'TEXT PRIMARY KEY',
    tenant_id: 'TEXT',
    full_name: 'TEXT',
    phone: 'TEXT',
    email: 'TEXT',
    tax_id: 'TEXT',
    address: 'TEXT',
    notes: 'TEXT',
    created_at: 'TEXT',
    updated_at: 'TEXT',
    created_by: 'TEXT',
    updated_by: 'TEXT',
  },
  vehicles: {
    id: 'TEXT PRIMARY KEY',
    tenant_id: 'TEXT',
    customer_id: 'TEXT',
    plate: 'TEXT',
    vin: 'TEXT',
    make: 'TEXT',
    model: 'TEXT',
    year: 'INTEGER',
    color: 'TEXT',
    fuel_type: 'TEXT',
    engine_size: 'TEXT',
    mileage: 'INTEGER',
    notes: 'TEXT',
    photos: 'TEXT',
    created_at: 'TEXT',
    updated_at: 'TEXT',
    created_by: 'TEXT',
    updated_by: 'TEXT',
  },
};

export class SupabaseConnector {
  async fetchCredentials() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Not authenticated');

    return {
      endpoint: process.env.EXPO_PUBLIC_POWERSYNC_URL ?? '',
      token: session.access_token,
    };
  }

  async uploadData(database: PowerSyncDatabase) {
    const tx = await database.getNextCrudTransaction();
    if (!tx) return;

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Not authenticated');

    for (const op of tx.crud) {
      const table = op.table;
      const record = { ...op.opData, id: op.id };
      const apiUrl = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

      if (op.op === 'PUT') {
        await fetch(`${apiUrl}/${table}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify(record),
        });
      } else if (op.op === 'PATCH') {
        await fetch(`${apiUrl}/${table}/${op.id}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify(op.opData),
        });
      } else if (op.op === 'DELETE') {
        await fetch(`${apiUrl}/${table}/${op.id}`, {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        });
      }
    }

    await tx.complete();
  }
}
