import { Body, Controller, Get, Post, UseGuards, UsePipes } from '@nestjs/common';
import { AuthService } from './auth.service';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import {
  loginSchema,
  signUpSchema,
  inviteUserSchema,
  customerSignUpSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from '@mecanix/validators';
import type {
  LoginInput,
  SignUpInput,
  InviteUserInput,
  CustomerSignUpInput,
  ForgotPasswordInput,
  ResetPasswordInput,
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
  async login(@Body() body: LoginInput) {
    return this.authService.login(body);
  }

  @Post('customer-signup')
  @UsePipes(new ZodValidationPipe(customerSignUpSchema))
  @RateLimit(5, 60)
  async customerSignUp(@Body() body: CustomerSignUpInput) {
    return this.authService.customerSignUp(body);
  }

  @Post('refresh')
  @RateLimit(20, 60)
  async refresh(@Body('refreshToken') refreshToken: string) {
    return this.authService.refreshToken(refreshToken);
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
}
