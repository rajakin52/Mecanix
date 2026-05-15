import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../supabase/supabase.service';
import { PermissionsService } from '../../common/permissions/permissions.service';
import { EmailService } from '../notifications/email.service';
import type { SignUpInput, LoginInput, CustomerSignUpInput } from '@mecanix/validators';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly permissions: PermissionsService,
    private readonly email: EmailService,
    private readonly config: ConfigService,
  ) {}

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

  async getProfile(authId: string, activeTenantId?: string) {
    const client = this.supabase.getClient();

    const { data: user, error } = await client
      .from('users')
      .select('id, tenant_id, email, full_name, role, custom_role_id, phone, avatar_url, is_active, is_super_admin')
      .eq('auth_id', authId)
      .single();

    if (error || !user) {
      throw new UnauthorizedException('User not found');
    }

    const homeTenantId = user.tenant_id as string;
    const currentTenantId = activeTenantId ?? homeTenantId;

    // Ship the effective capability set so the UI can hide/disable
    // controls without a round trip per action. Super-admins get the
    // full list — CapabilityGuard also bypasses them server-side.
    const capabilities = user.is_super_admin
      ? ['*']
      : await this.permissions.capabilityKeysFor({
          role: user.role as string,
          customRoleId: (user.custom_role_id as string | null) ?? null,
        });

    return {
      ...user,
      home_tenant_id: homeTenantId,
      current_tenant_id: currentTenantId,
      is_impersonating: currentTenantId !== homeTenantId,
      capabilities,
    };
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

  /**
   * Send a password-reset email. Public endpoint. Resolves successfully
   * even if the email isn't on file — that way attackers can't enumerate
   * accounts. Uses Supabase's admin.generateLink to mint the one-time
   * recovery URL, then ships it through Resend so the email is branded
   * (Supabase's own SMTP path would also work but the template control
   * is poor and not all projects have it wired up).
   */
  async requestPasswordReset(email: string, redirectTo?: string): Promise<{ success: true }> {
    const admin = this.supabase.getAuthClient();
    const defaultRedirect = this.config.get<string>('PASSWORD_RESET_REDIRECT_URL', '');
    const finalRedirect = redirectTo || defaultRedirect || undefined;

    try {
      const { data, error } = await admin.generateLink({
        type: 'recovery',
        email,
        options: finalRedirect ? { redirectTo: finalRedirect } : undefined,
      });
      if (error || !data?.properties?.action_link) {
        // Don't leak which email failed — log + return success.
        this.logger.warn(`generateLink(recovery) for ${email}: ${error?.message ?? 'no action_link'}`);
        return { success: true };
      }

      const link = data.properties.action_link;
      const html = `
        <p>You requested a password reset for your Mecanix account.</p>
        <p>Click the button below to choose a new password. This link is single-use and expires in 1 hour.</p>
        <p style="margin: 24px 0;">
          <a href="${link}" style="display: inline-block; background: #0087FF; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600;">Reset password</a>
        </p>
        <p style="color: #666; font-size: 12px;">If the button doesn't work, paste this URL into your browser:<br/>${link}</p>
        <p style="color: #666; font-size: 12px;">If you didn't ask for this reset, ignore this email — nothing will change.</p>
      `;

      await this.email.send({
        to: email,
        subject: 'Reset your Mecanix password',
        html,
      });
    } catch (err) {
      // Always swallow — the public endpoint should not leak whether the
      // address exists. The log captures the real failure.
      this.logger.error(`requestPasswordReset failed for ${email}: ${err instanceof Error ? err.message : String(err)}`);
    }

    return { success: true };
  }

  /**
   * Finalise a reset using the access_token that arrived on the redirect.
   * We validate the token against Supabase first (so a stolen + expired
   * link can't be replayed) and then update the password as service-role.
   */
  async resetPasswordWithToken(accessToken: string, password: string): Promise<{ success: true }> {
    const client = this.supabase.getClient();
    const { data, error } = await client.auth.getUser(accessToken);
    if (error || !data?.user) {
      throw new UnauthorizedException('Invalid or expired reset token');
    }
    const admin = this.supabase.getAuthClient();
    const { error: updErr } = await admin.updateUserById(data.user.id, { password });
    if (updErr) {
      throw new BadRequestException(updErr.message);
    }
    return { success: true };
  }

  /**
   * Admin action: trigger a password reset for another user in the same
   * tenant. Behaves exactly like the public flow but the actor is known
   * so we can audit it.
   */
  async adminSendUserReset(tenantId: string, userId: string, actorId: string): Promise<{ success: true }> {
    const client = this.supabase.getClient();
    const { data: user, error } = await client
      .from('users')
      .select('email')
      .eq('id', userId)
      .eq('tenant_id', tenantId)
      .maybeSingle();
    if (error || !user?.email) {
      throw new NotFoundException('User not found');
    }
    this.logger.log(`Admin ${actorId} initiated reset for user ${userId} (${user.email})`);
    await this.requestPasswordReset(user.email as string);
    return { success: true };
  }

  /**
   * Admin action: hard-set another user's password. Owner/manager only.
   */
  async adminChangeUserPassword(
    tenantId: string,
    userId: string,
    newPassword: string,
    actorId: string,
  ): Promise<{ success: true }> {
    const client = this.supabase.getClient();
    const { data: user, error } = await client
      .from('users')
      .select('auth_id, email')
      .eq('id', userId)
      .eq('tenant_id', tenantId)
      .maybeSingle();
    if (error || !user?.auth_id) {
      throw new NotFoundException('User not found');
    }
    const admin = this.supabase.getAuthClient();
    const { error: updErr } = await admin.updateUserById(user.auth_id as string, {
      password: newPassword,
    });
    if (updErr) {
      throw new BadRequestException(updErr.message);
    }
    this.logger.log(`Admin ${actorId} set new password for user ${userId} (${user.email})`);
    return { success: true };
  }

  /**
   * Admin action: generate a single-use magic link the caller can paste
   * into a private window to log in *as* the target user. The link is
   * audit-logged. We return the link URL — the frontend decides what to
   * do with it (open in incognito, copy to clipboard, etc.).
   */
  async adminImpersonateUser(
    tenantId: string,
    userId: string,
    actorId: string,
  ): Promise<{ magicLink: string }> {
    const client = this.supabase.getClient();
    const { data: user, error } = await client
      .from('users')
      .select('email')
      .eq('id', userId)
      .eq('tenant_id', tenantId)
      .maybeSingle();
    if (error || !user?.email) {
      throw new NotFoundException('User not found');
    }
    const admin = this.supabase.getAuthClient();
    const redirectTo = this.config.get<string>('IMPERSONATE_REDIRECT_URL', '');
    const { data, error: genErr } = await admin.generateLink({
      type: 'magiclink',
      email: user.email as string,
      options: redirectTo ? { redirectTo } : undefined,
    });
    if (genErr || !data?.properties?.action_link) {
      throw new InternalServerErrorException(genErr?.message ?? 'Failed to generate magic link');
    }
    this.logger.warn(
      `IMPERSONATION: admin=${actorId} target=${userId} tenant=${tenantId} email=${user.email}`,
    );
    return { magicLink: data.properties.action_link };
  }

  /**
   * Self-service password change. Verifies the current password by
   * attempting an anon-client sign-in (cheap and authoritative) before
   * setting the new one via admin.updateUserById.
   */
  async changeOwnPassword(
    authId: string,
    email: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<{ success: true }> {
    if (currentPassword === newPassword) {
      throw new BadRequestException('New password must differ from current password');
    }
    const anon = this.supabase.createAnonClient();
    const { error: verifyErr } = await anon.auth.signInWithPassword({
      email,
      password: currentPassword,
    });
    if (verifyErr) {
      throw new UnauthorizedException('Current password is incorrect');
    }
    const admin = this.supabase.getAuthClient();
    const { error: updErr } = await admin.updateUserById(authId, { password: newPassword });
    if (updErr) {
      throw new BadRequestException(updErr.message);
    }
    this.logger.log(`User ${authId} changed own password`);
    return { success: true };
  }

  /**
   * Self-service profile update. Touches public.users only — role,
   * is_active, tenant_id etc are owner/manager-only and live on the
   * tenants user-admin endpoints.
   */
  async updateOwnProfile(
    userId: string,
    tenantId: string,
    patch: { fullName?: string; phone?: string; avatarUrl?: string | null },
  ) {
    const client = this.supabase.getClient();
    const updates: Record<string, unknown> = { updated_by: userId };
    if (patch.fullName !== undefined) updates.full_name = patch.fullName;
    if (patch.phone !== undefined) updates.phone = patch.phone;
    if (patch.avatarUrl !== undefined) updates.avatar_url = patch.avatarUrl;
    const { data, error } = await client
      .from('users')
      .update(updates)
      .eq('id', userId)
      .eq('tenant_id', tenantId)
      .select('id, email, full_name, role, phone, avatar_url, is_active')
      .single();
    if (error || !data) {
      throw new BadRequestException(error?.message ?? 'Profile update failed');
    }
    return data;
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
