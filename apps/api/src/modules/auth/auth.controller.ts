import { Body, Controller, Get, Post, UseGuards, UsePipes } from '@nestjs/common';
import { AuthService } from './auth.service';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { loginSchema, signUpSchema, inviteUserSchema, customerSignUpSchema } from '@mecanix/validators';
import type { LoginInput, SignUpInput, InviteUserInput, CustomerSignUpInput } from '@mecanix/validators';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/user.decorator';
import type { RequestUser } from '../../common/guards/tenant.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('signup')
  @UsePipes(new ZodValidationPipe(signUpSchema))
  async signUp(@Body() body: SignUpInput) {
    return this.authService.signUp(body);
  }

  @Post('login')
  @UsePipes(new ZodValidationPipe(loginSchema))
  async login(@Body() body: LoginInput) {
    return this.authService.login(body);
  }

  @Post('customer-signup')
  @UsePipes(new ZodValidationPipe(customerSignUpSchema))
  async customerSignUp(@Body() body: CustomerSignUpInput) {
    return this.authService.customerSignUp(body);
  }

  @Post('refresh')
  async refresh(@Body('refreshToken') refreshToken: string) {
    return this.authService.refreshToken(refreshToken);
  }

  @Post('invite')
  @UseGuards(TenantGuard, RolesGuard)
  @Roles('owner', 'manager')
  async invite(
    @CurrentUser() user: RequestUser,
    @Body(new ZodValidationPipe(inviteUserSchema)) body: InviteUserInput,
  ) {
    return this.authService.inviteUser(user.tenantId, body.email, body.fullName, body.role, user.id);
  }

  @Get('profile')
  @UseGuards(TenantGuard)
  async profile(@CurrentUser() user: RequestUser) {
    return this.authService.getProfile(user.authId);
  }
}
