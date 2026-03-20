import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { RequestUser } from '../guards/tenant.guard';

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): RequestUser => {
    const request = ctx.switchToHttp().getRequest();
    return request.user as RequestUser;
  },
);

export const TenantId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest();
    return (request.user as RequestUser).tenantId;
  },
);
