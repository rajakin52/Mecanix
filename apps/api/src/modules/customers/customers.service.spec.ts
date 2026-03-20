import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CustomersService } from './customers.service';
import { NotFoundException } from '@nestjs/common';

const mockFrom = vi.fn();
const mockSupabaseService = {
  getClient: vi.fn().mockReturnValue({ from: mockFrom }),
};

describe('CustomersService', () => {
  let service: CustomersService;

  beforeEach(() => {
    service = new CustomersService(mockSupabaseService as never);
    vi.clearAllMocks();
    mockSupabaseService.getClient.mockReturnValue({ from: mockFrom });
  });

  describe('getById', () => {
    it('should return customer when found', async () => {
      const customer = { id: 'c1', tenant_id: 't1', full_name: 'Test Customer' };

      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: customer, error: null }),
      });

      const result = await service.getById('t1', 'c1');
      expect(result.full_name).toBe('Test Customer');
    });

    it('should throw NotFoundException when customer not found', async () => {
      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: { message: 'Not found' } }),
      });

      await expect(service.getById('t1', 'bad-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('should create a customer', async () => {
      const newCustomer = {
        id: 'c1',
        tenant_id: 't1',
        full_name: 'New Customer',
        phone: '+244 923 456 789',
      };

      mockFrom.mockReturnValue({
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: newCustomer, error: null }),
      });

      const result = await service.create('t1', 'u1', {
        fullName: 'New Customer',
        phone: '+244 923 456 789',
      });

      expect(result.full_name).toBe('New Customer');
    });
  });

  describe('list', () => {
    it('should return paginated customers', async () => {
      const customers = [
        { id: 'c1', full_name: 'Customer A' },
        { id: 'c2', full_name: 'Customer B' },
      ];

      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        or: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        range: vi.fn().mockResolvedValue({ data: customers, count: 2, error: null }),
      });

      const result = await service.list('t1', { page: 1, pageSize: 20, sortOrder: 'asc' });
      expect(result.data).toHaveLength(2);
      expect(result.meta.total).toBe(2);
    });
  });
});
