import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthService } from './auth.service';
import { UnauthorizedException } from '@nestjs/common';

const mockSupabaseService = {
  getClient: vi.fn(),
  getAuthClient: vi.fn(),
  createAnonClient: vi.fn(),
};

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(() => {
    service = new AuthService(mockSupabaseService as never);
    vi.clearAllMocks();
  });

  describe('login', () => {
    it('should throw UnauthorizedException on invalid credentials', async () => {
      mockSupabaseService.createAnonClient.mockReturnValue({
        auth: {
          signInWithPassword: vi.fn().mockResolvedValue({
            data: null,
            error: { message: 'Invalid login credentials' },
          }),
        },
      });

      await expect(
        service.login({ email: 'bad@test.com', password: 'wrong' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should return session on valid credentials', async () => {
      const mockUser = { id: 'auth-123' };
      const mockSession = {
        access_token: 'token-abc',
        refresh_token: 'refresh-abc',
        expires_at: 9999999999,
      };

      mockSupabaseService.createAnonClient.mockReturnValue({
        auth: {
          signInWithPassword: vi.fn().mockResolvedValue({
            data: { user: mockUser, session: mockSession },
            error: null,
          }),
        },
      });

      mockSupabaseService.getClient.mockReturnValue({
        from: vi.fn().mockImplementation((table: string) => {
          if (table === 'users') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              single: vi.fn().mockResolvedValue({
                data: {
                  id: 'user-1',
                  tenant_id: 'tenant-1',
                  full_name: 'Test User',
                  role: 'owner',
                  email: 'test@test.com',
                },
                error: null,
              }),
            };
          }
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: {
                id: 'tenant-1',
                name: 'Test Workshop',
                slug: 'test-workshop',
                country: 'AO',
                currency: 'AOA',
              },
              error: null,
            }),
          };
        }),
      });

      const result = await service.login({
        email: 'test@test.com',
        password: 'Password1',
      });

      expect(result.session.accessToken).toBe('token-abc');
      expect(result.user.role).toBe('owner');
    });
  });

  describe('refreshToken', () => {
    it('should throw UnauthorizedException on invalid refresh token', async () => {
      mockSupabaseService.createAnonClient.mockReturnValue({
        auth: {
          refreshSession: vi.fn().mockResolvedValue({
            data: { session: null },
            error: { message: 'Invalid refresh token' },
          }),
        },
      });

      await expect(service.refreshToken('bad-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });
});
