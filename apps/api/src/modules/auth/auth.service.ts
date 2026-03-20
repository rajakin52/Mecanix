import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import type { SignUpInput, LoginInput } from '@mecanix/validators';

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
