import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseService {
  private readonly client: SupabaseClient;
  private readonly url: string;
  private readonly anonKey: string;

  constructor(private readonly config: ConfigService) {
    this.url = this.config.getOrThrow<string>('SUPABASE_URL');
    const serviceRoleKey = this.config.getOrThrow<string>('SUPABASE_SERVICE_ROLE_KEY');
    this.anonKey = this.config.getOrThrow<string>('SUPABASE_ANON_KEY');

    this.client = createClient(this.url, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }

  /** Service-role client — bypasses RLS. Use for admin operations. */
  getClient(): SupabaseClient {
    return this.client;
  }

  getAuthClient() {
    return this.client.auth.admin;
  }

  /** Creates a fresh anon client — safe for signInWithPassword without polluting the service-role client. */
  createAnonClient(): SupabaseClient {
    return createClient(this.url, this.anonKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }
}
