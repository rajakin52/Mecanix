import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import type { SignUpInput, LoginInput, CustomerSignUpInput } from '@mecanix/validators';

@Injectable()
export class AuthService {
  constructor(private readonly supabase: SupabaseService) {}

  async signUp(input: SignUpInput) {
    const client = this.supabase.getClient();
    const admin = this.supabase.getAuthClient();

    // 1. Create auth user
    const { data: authData, error: authError } = await admin.createUser({
      email: input.email,
      password: input.password,
      email_confirm: true,
    });

    if (authError) {
      throw new BadRequestException(authError.message);
    }

    const authUserId = authData.user.id;

    try {
      // 2. Create tenant
      const slug = input.workshopName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');

      const { data: tenant, error: tenantError } = await client
        .from('tenants')
        .insert({
          name: input.workshopName,
          slug: `${slug}-${Date.now().toString(36)}`,
          country: input.country,
          currency: input.currency,
          timezone: this.getTimezone(input.country),
          locale: this.getLocale(input.country),
          email: input.email,
          phone: input.phone ?? null,
        })
        .select()
        .single();

      if (tenantError) {
        await admin.deleteUser(authUserId);
        throw new InternalServerErrorException('Failed to create tenant');
      }

      // 3. Create user row
      const { data: user, error: userError } = await client
        .from('users')
        .insert({
          tenant_id: tenant.id,
          auth_id: authUserId,
          email: input.email,
          full_name: input.ownerName,
          role: 'owner',
          phone: input.phone ?? null,
        })
        .select()
        .single();

      if (userError) {
        await admin.deleteUser(authUserId);
        throw new InternalServerErrorException('Failed to create user');
      }

      // 4. Generate session (use anon client to avoid polluting service-role client)
      const anonClient = this.supabase.createAnonClient();
      const { data: session, error: sessionError } = await anonClient.auth.signInWithPassword({
        email: input.email,
        password: input.password,
      });

      if (sessionError) {
        throw new InternalServerErrorException('Account created but login failed');
      }

      return {
        user: {
          id: user.id,
          email: user.email,
          fullName: user.full_name,
          role: user.role,
          tenantId: tenant.id,
        },
        tenant: {
          id: tenant.id,
          name: tenant.name,
          slug: tenant.slug,
          country: tenant.country,
          currency: tenant.currency,
        },
        session: {
          accessToken: session.session.access_token,
          refreshToken: session.session.refresh_token,
          expiresAt: session.session.expires_at,
        },
      };
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof InternalServerErrorException) {
        throw error;
      }
      await admin.deleteUser(authUserId);
      throw new InternalServerErrorException('Signup failed');
    }
  }

  async login(input: LoginInput) {
    // Use anon client for signIn to avoid polluting the service-role client
    const anonClient = this.supabase.createAnonClient();
    const serviceClient = this.supabase.getClient();

    const { data, error } = await anonClient.auth.signInWithPassword({
      email: input.email,
      password: input.password,
    });

    if (error) {
      throw new UnauthorizedException('Invalid email or password');
    }

    // Get user profile using service-role client (bypasses RLS)
    const { data: user } = await serviceClient
      .from('users')
      .select('id, tenant_id, full_name, role, email')
      .eq('auth_id', data.user.id)
      .single();

    if (!user) {
      throw new UnauthorizedException('User profile not found');
    }

    const { data: tenant } = await serviceClient
      .from('tenants')
      .select('id, name, slug, country, currency')
      .eq('id', user.tenant_id)
      .single();

    return {
      user: {
        id: user.id,
        email: user.email,
        fullName: user.full_name,
        role: user.role,
        tenantId: user.tenant_id,
      },
      tenant,
      session: {
        accessToken: data.session.access_token,
        refreshToken: data.session.refresh_token,
        expiresAt: data.session.expires_at,
      },
    };
  }

  /**
   * Customer self-registration.
   * If email/phone matches an existing customer record, links to it.
   * Otherwise creates a new customer record.
   */
  async customerSignUp(input: CustomerSignUpInput) {
    const client = this.supabase.getClient();
    const admin = this.supabase.getClient().auth.admin;

    // 1. Create Supabase auth user
    const { data: authData, error: authError } = await admin.createUser({
      email: input.email,
      password: input.password,
      email_confirm: true,
    });

    if (authError) {
      if (authError.message?.includes('already registered')) {
        throw new BadRequestException('An account with this email already exists. Please log in.');
      }
      throw new InternalServerErrorException('Failed to create account');
    }

    const authUserId = authData.user.id;

    try {
      // 2. Find existing customer by email or phone (across all tenants)
      let existingCustomer: Record<string, unknown> | null = null;
      let tenantId: string | null = null;

      // Try email match first
      const { data: byEmail } = await client
        .from('customers')
        .select('*, tenant:tenants(id, name, slug, country, currency)')
        .eq('email', input.email)
        .is('deleted_at', null)
        .limit(1)
        .maybeSingle();

      if (byEmail) {
        existingCustomer = byEmail;
        tenantId = byEmail.tenant_id;
      } else {
        // Try phone match
        const { data: byPhone } = await client
          .from('customers')
          .select('*, tenant:tenants(id, name, slug, country, currency)')
          .eq('phone', input.phone)
          .is('deleted_at', null)
          .limit(1)
          .maybeSingle();

        if (byPhone) {
          existingCustomer = byPhone;
          tenantId = byPhone.tenant_id;
        }
      }

      // If workshopCode provided and no match found, find tenant by slug
      if (!tenantId && input.workshopCode) {
        const { data: tenant } = await client
          .from('tenants')
          .select('id')
          .eq('slug', input.workshopCode)
          .single();
        if (tenant) tenantId = tenant.id;
      }

      // If still no tenant, we can't create user (need at least one tenant)
      if (!tenantId) {
        // Find any tenant as fallback (first tenant in system)
        const { data: anyTenant } = await client
          .from('tenants')
          .select('id')
          .limit(1)
          .single();
        if (anyTenant) tenantId = anyTenant.id;
      }

      if (!tenantId) {
        await admin.deleteUser(authUserId);
        throw new BadRequestException('No workshop found. Please contact your workshop for an invite.');
      }

      // 3. Create user row
      const { data: user, error: userError } = await client
        .from('users')
        .insert({
          tenant_id: tenantId,
          auth_id: authUserId,
          email: input.email,
          full_name: input.fullName,
          role: 'customer',
          phone: input.phone,
        })
        .select()
        .single();

      if (userError) {
        await admin.deleteUser(authUserId);
        throw new InternalServerErrorException('Failed to create user profile');
      }

      // 4. Link to existing customer or create new one
      if (existingCustomer) {
        // Link existing customer to this auth user
        await client
          .from('customers')
          .update({ user_id: user.id })
          .eq('id', existingCustomer.id);
      } else {
        // Create new customer record
        await client
          .from('customers')
          .insert({
            tenant_id: tenantId,
            full_name: input.fullName,
            email: input.email,
            phone: input.phone,
            user_id: user.id,
            created_by: user.id,
          });
      }

      // 5. Generate session
      const anonClient = this.supabase.createAnonClient();
      const { data: session, error: sessionError } = await anonClient.auth.signInWithPassword({
        email: input.email,
        password: input.password,
      });

      if (sessionError) {
        throw new InternalServerErrorException('Account created but login failed');
      }

      // Get tenant info
      const { data: tenant } = await client
        .from('tenants')
        .select('id, name, slug, country, currency')
        .eq('id', tenantId)
        .single();

      return {
        user: {
          id: user.id,
          email: user.email,
          fullName: user.full_name,
          role: user.role,
          tenantId,
        },
        tenant,
        session: {
          accessToken: session.session.access_token,
          refreshToken: session.session.refresh_token,
          expiresAt: session.session.expires_at,
        },
        linkedExistingCustomer: !!existingCustomer,
      };
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof InternalServerErrorException) {
        throw error;
      }
      await admin.deleteUser(authUserId);
      throw new InternalServerErrorException('Customer signup failed');
    }
  }

  async refreshToken(refreshToken: string) {
    const anonClient = this.supabase.createAnonClient();

    const { data, error } = await anonClient.auth.refreshSession({ refresh_token: refreshToken });

    if (error || !data.session) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    return {
      accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token,
      expiresAt: data.session.expires_at,
    };
  }

  async getProfile(authId: string) {
    const client = this.supabase.getClient();

    const { data: user, error } = await client
      .from('users')
      .select('id, tenant_id, email, full_name, role, phone, avatar_url, is_active')
      .eq('auth_id', authId)
      .single();

    if (error || !user) {
      throw new UnauthorizedException('User not found');
    }

    return user;
  }

  async inviteUser(tenantId: string, email: string, fullName: string, role: string, invitedBy: string) {
    const client = this.supabase.getClient();
    const admin = this.supabase.getAuthClient();

    // Create auth user with generated password (they'll reset it)
    const tempPassword = crypto.randomUUID() + 'Aa1!';
    const { data: authData, error: authError } = await admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
    });

    if (authError) {
      throw new BadRequestException(authError.message);
    }

    const { data: user, error: userError } = await client
      .from('users')
      .insert({
        tenant_id: tenantId,
        auth_id: authData.user.id,
        email,
        full_name: fullName,
        role,
        created_by: invitedBy,
      })
      .select()
      .single();

    if (userError) {
      await admin.deleteUser(authData.user.id);
      throw new InternalServerErrorException('Failed to create user');
    }

    // Send password reset email
    await admin.generateLink({ type: 'recovery', email });

    return user;
  }

  private getTimezone(country: string): string {
    const map: Record<string, string> = {
      AO: 'Africa/Luanda',
      MZ: 'Africa/Maputo',
      BR: 'America/Sao_Paulo',
      PT: 'Europe/Lisbon',
    };
    return map[country] ?? 'UTC';
  }

  private getLocale(country: string): string {
    const map: Record<string, string> = {
      AO: 'pt-PT',
      MZ: 'pt-PT',
      BR: 'pt-BR',
      PT: 'pt-PT',
    };
    return map[country] ?? 'pt-PT';
  }
}
