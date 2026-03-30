import { Injectable, CanActivate, ExecutionContext, HttpException, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

const RATE_LIMIT_KEY = 'rate_limit';

/**
 * Decorator to set per-route rate limits.
 * @param max - Maximum requests allowed in the time window
 * @param windowSeconds - Time window in seconds
 */
export const RateLimit = (max: number, windowSeconds: number) =>
  SetMetadata(RATE_LIMIT_KEY, { max, windowSeconds });

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly store = new Map<string, RateLimitEntry>();

  constructor(private readonly reflector: Reflector) {
    // Clean expired entries every 5 minutes
    setInterval(() => {
      const now = Date.now();
      for (const [key, entry] of this.store) {
        if (now > entry.resetAt) this.store.delete(key);
      }
    }, 5 * 60 * 1000);
  }

  canActivate(context: ExecutionContext): boolean {
    const config = this.reflector.get<{ max: number; windowSeconds: number } | undefined>(
      RATE_LIMIT_KEY,
      context.getHandler(),
    );

    if (!config) return true;

    const request = context.switchToHttp().getRequest();
    const ip = request.ip ?? request.raw?.ip ?? 'unknown';
    const route = request.routeOptions?.url ?? request.url;
    const key = `${ip}:${route}`;
    const now = Date.now();

    const entry = this.store.get(key);

    if (!entry || now > entry.resetAt) {
      this.store.set(key, { count: 1, resetAt: now + config.windowSeconds * 1000 });
      return true;
    }

    entry.count++;

    if (entry.count > config.max) {
      throw new HttpException(
        { success: false, error: { code: 'RATE_LIMITED', message: 'Too many requests, please try again later' } },
        429,
      );
    }

    return true;
  }
}
