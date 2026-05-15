import { Body, Controller, Get, Patch, Post, Req, Res, UseGuards, UsePipes } from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { AuthService } from './auth.service';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import {
  loginSchema,
  signUpSchema,
  inviteUserSchema,
  customerSignUpSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changeOwnPasswordSchema,
  updateOwnProfileSchema,
} from '@mecanix/validators';
import type {
  LoginInput,
  SignUpInput,
  InviteUserInput,
  CustomerSignUpInput,
  ForgotPasswordInput,
  ResetPasswordInput,
  ChangeOwnPasswordInput,
  UpdateOwnProfileInput,
} from '@mecanix/validators';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RequiresCapability } from '../../common/decorators/requires-capability.decorator';
import { CapabilityGuard } from '../../common/guards/capability.guard';
import { BlockedWhenImpersonating } from '../../common/decorators/blocked-when-impersonating.decorator';
import { ImpersonationBlockGuard } from '../../common/guards/impersonation-block.guard';
import { CurrentUser } from '../../common/decorators/user.decorator';
import type { RequestUser } from '../../common/guards/tenant.guard';
import { RateLimitGuard, RateLimit } from '../../common/guards/rate-limit.guard';

// Cookie names. Two cookies (access + refresh) — same pattern Supabase
// uses internally. httpOnly + Secure (in prod) + SameSite=None (also
// only in prod, since web + api live on different domains). Dev gets
// SameSite=Lax + Secure=false so localhost flows work without HTTPS.
const ACCESS_COOKIE = 'mecanix_access';
const REFRESH_COOKIE = 'mecanix_refresh';

function sessionCookieOptions(maxAgeSeconds: number) {
  const isProd = process.env['NODE_ENV'] === 'production';
  return {
    httpOnly: true,
    secure: isProd,
    // Web and API live on different domains in prod (vercel.app vs
    // railway.app) → SameSite must be 'none' for the cookie to ride
    // along on cross-site fetches. In dev they're both on localhost
    // (same-site) so Lax suffices and we don't need Secure either.
    sameSite: (isProd ? 'none' : 'lax') as 'none' | 'lax',
    path: '/',
    maxAge: maxAgeSeconds,
  };
}

function setSessionCookies(
  reply: FastifyReply,
  session: { accessToken: string; refreshToken: string },
) {
  // 1 hour for access, 30 days for refresh — matches Supabase defaults.
  reply.setCookie(ACCESS_COOKIE, session.accessToken, sessionCookieOptions(60 * 60));
  reply.setCookie(REFRESH_COOKIE, session.refreshToken, sessionCookieOptions(60 * 60 * 24 * 30));
}

function clearSessionCookies(reply: FastifyReply) {
  const opts = sessionCookieOptions(0);
  reply.clearCookie(ACCESS_COOKIE, opts);
  reply.clearCookie(REFRESH_COOKIE, opts);
}

@Controller('auth')
@UseGuards(RateLimitGuard)
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('signup')
  @UsePipes(new ZodValidationPipe(signUpSchema))
  @RateLimit(5, 60)
  async signUp(@Body() body: SignUpInput) {
    return this.authService.signUp(body);
  }

  @Post('login')
  @UsePipes(new ZodValidationPipe(loginSchema))
  @RateLimit(10, 60)
  async login(
    @Body() body: LoginInput,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    const result = await this.authService.login(body);
    // Set httpOnly cookies for web clients. Mobile clients ignore the
    // Set-Cookie header and use session.accessToken from the body as
    // before — same response shape, dual delivery.
    if (result.session?.accessToken && result.session?.refreshToken) {
      setSessionCookies(reply, result.session);
    }
    return result;
  }

  @Post('customer-signup')
  @UsePipes(new ZodValidationPipe(customerSignUpSchema))
  @RateLimit(5, 60)
  async customerSignUp(@Body() body: CustomerSignUpInput) {
    return this.authService.customerSignUp(body);
  }

  @Post('refresh')
  @RateLimit(20, 60)
  async refresh(
    @Body('refreshToken') refreshTokenFromBody: string | undefined,
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    // Web clients have no body — they rely on the httpOnly refresh
    // cookie ride-along. Mobile clients keep sending the body.
    const refreshToken = refreshTokenFromBody ?? (req.cookies as Record<string, string> | undefined)?.[REFRESH_COOKIE];
    if (!refreshToken) {
      return { success: false, error: { code: 'NO_REFRESH_TOKEN', message: 'No refresh token provided' } };
    }
    const result = await this.authService.refreshToken(refreshToken);
    if (result?.accessToken && result?.refreshToken) {
      setSessionCookies(reply, result);
    }
    return result;
  }

  // Explicit logout — clears the session cookies. The Supabase refresh
  // token isn't revoked here (Supabase doesn't expose that on the
  // service-role admin SDK without complications); the cookies just
  // disappear, which is enough for browser sessions.
  @Post('logout')
  logout(@Res({ passthrough: true }) reply: FastifyReply) {
    clearSessionCookies(reply);
    return { success: true };
  }

  // Always returns { success: true } regardless of whether the email
  // exists — prevents account enumeration.
  @Post('forgot-password')
  @UsePipes(new ZodValidationPipe(forgotPasswordSchema))
  @RateLimit(5, 60)
  async forgotPassword(@Body() body: ForgotPasswordInput) {
    return this.authService.requestPasswordReset(body.email, body.redirectTo);
  }

  // The access_token comes from the hash on the redirect URL after the
  // user clicks the email link. We validate it server-side before setting
  // the new password.
  @Post('reset-password')
  @UsePipes(new ZodValidationPipe(resetPasswordSchema))
  @RateLimit(10, 60)
  async resetPassword(@Body() body: ResetPasswordInput) {
    return this.authService.resetPasswordWithToken(body.accessToken, body.password);
  }

  @Post('invite')
  @UseGuards(TenantGuard, ImpersonationBlockGuard, RolesGuard, CapabilityGuard)
  @Roles('owner', 'manager')
  @RequiresCapability('users.invite')
  @BlockedWhenImpersonating(
    'Support staff cannot invite users into a workshop. Ask the owner to send the invite themselves.',
  )
  async invite(
    @CurrentUser() user: RequestUser,
    @Body(new ZodValidationPipe(inviteUserSchema)) body: InviteUserInput,
  ) {
    return this.authService.inviteUser(user.tenantId, body.email, body.fullName, body.role, user.id);
  }

  @Get('profile')
  @UseGuards(TenantGuard)
  async profile(@CurrentUser() user: RequestUser) {
    return this.authService.getProfile(user.authId, user.tenantId);
  }

  // Self-service profile edit — fullName / phone / locale / avatarUrl.
  // Role / is_active / tenant changes stay on the owner-managed
  // /tenants/me/users/:userId endpoint.
  @Patch('profile')
  @UseGuards(TenantGuard)
  async updateProfile(
    @CurrentUser() user: RequestUser,
    @Body(new ZodValidationPipe(updateOwnProfileSchema)) body: UpdateOwnProfileInput,
  ) {
    return this.authService.updateOwnProfile(user.id, user.tenantId, body);
  }

  // Self-service password change. Requires the current password — a
  // stolen access token alone shouldn't be enough to lock the legit
  // user out of their account.
  @Post('change-password')
  @UseGuards(TenantGuard)
  @RateLimit(5, 60)
  async changeOwnPassword(
    @CurrentUser() user: RequestUser,
    @Body(new ZodValidationPipe(changeOwnPasswordSchema)) body: ChangeOwnPasswordInput,
  ) {
    return this.authService.changeOwnPassword(
      user.authId,
      user.email,
      body.currentPassword,
      body.newPassword,
    );
  }
}
