import { Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

interface CreateDocumentReminderInput {
  vehicleId?: string;
  customerId?: string;
  documentType: string;
  documentName: string;
  expiryDate: string;
  reminderDays?: number;
  notes?: string;
}

@Injectable()
export class DocumentRemindersService {
  constructor(private readonly supabase: SupabaseService) {}

  async list(tenantId: string, vehicleId?: string, status?: string) {
    const client = this.supabase.getClient();

    let query = client
      .from('document_reminders')
      .select('*, vehicle:vehicles(id, plate, make, model), customer:customers(id, full_name)')
      .eq('tenant_id', tenantId)
      .order('expiry_date', { ascending: true });

    if (vehicleId) {
      query = query.eq('vehicle_id', vehicleId);
    }
    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;
    if (error) throw error;

    return data ?? [];
  }

  async create(tenantId: string, userId: string, input: CreateDocumentReminderInput) {
    const client = this.supabase.getClient();

    const { data, error } = await client
      .from('document_reminders')
      .insert({
        tenant_id: tenantId,
        vehicle_id: input.vehicleId || null,
        customer_id: input.customerId || null,
        document_type: input.documentType,
        document_name: input.documentName,
        expiry_date: input.expiryDate,
        reminder_days: input.reminderDays ?? 30,
        notes: input.notes || null,
        created_by: userId,
      })
      .select('*, vehicle:vehicles(id, plate, make, model), customer:customers(id, full_name)')
      .single();

    if (error) throw error;
    return data;
  }

  async getDue(tenantId: string) {
    const client = this.supabase.getClient();

    // Get all active reminders where expiry_date - reminder_days <= today
    const { data, error } = await client
      .from('document_reminders')
      .select('*, vehicle:vehicles(id, plate, make, model), customer:customers(id, full_name)')
      .eq('tenant_id', tenantId)
      .eq('status', 'active')
      .order('expiry_date', { ascending: true });

    if (error) throw error;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return (data ?? []).filter((reminder) => {
      const expiry = new Date(reminder.expiry_date as string);
      const reminderDays = (reminder.reminder_days as number) ?? 30;
      const reminderDate = new Date(expiry);
      reminderDate.setDate(reminderDate.getDate() - reminderDays);
      return reminderDate <= today;
    });
  }

  async markRenewed(tenantId: string, id: string) {
    const client = this.supabase.getClient();

    const { data, error } = await client
      .from('document_reminders')
      .update({ status: 'renewed' })
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error || !data) {
      throw new NotFoundException('Document reminder not found');
    }

    return data;
  }
}
