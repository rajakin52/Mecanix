import { describe, it, expect, vi, beforeEach } from 'vitest';
import { VehiclesService } from './vehicles.service';
import { NotFoundException } from '@nestjs/common';

const mockFrom = vi.fn();
const mockSupabaseService = {
  getClient: vi.fn().mockReturnValue({ from: mockFrom }),
};

describe('VehiclesService', () => {
  let service: VehiclesService;

  beforeEach(() => {
    service = new VehiclesService(mockSupabaseService as never);
    vi.clearAllMocks();
    mockSupabaseService.getClient.mockReturnValue({ from: mockFrom });
  });

  describe('getById', () => {
    it('should return vehicle when found', async () => {
      const vehicle = { id: 'v1', tenant_id: 't1', plate: 'LD-23-45-AB' };

      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: vehicle, error: null }),
      });

      const result = await service.getById('t1', 'v1');
      expect(result.plate).toBe('LD-23-45-AB');
    });

    it('should throw NotFoundException when vehicle not found', async () => {
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
    it('should create a vehicle', async () => {
      const newVehicle = {
        id: 'v1',
        tenant_id: 't1',
        customer_id: 'c1',
        plate: 'LD-12-34-AB',
        make: 'Toyota',
        model: 'Hilux',
      };

      mockFrom.mockReturnValue({
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: newVehicle, error: null }),
      });

      const result = await service.create('t1', 'u1', {
        customerId: 'c1',
        plate: 'LD-12-34-AB',
        vin: 'JTFDE5260500001',
        make: 'Toyota',
        model: 'Hilux',
      });

      expect(result.plate).toBe('LD-12-34-AB');
    });
  });

  describe('list', () => {
    it('should return paginated vehicles', async () => {
      const vehicles = [
        { id: 'v1', plate: 'LD-23-45-AB' },
        { id: 'v2', plate: 'LD-34-56-CD' },
      ];

      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        or: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        range: vi.fn().mockResolvedValue({ data: vehicles, count: 2, error: null }),
      });

      const result = await service.list('t1', { page: 1, pageSize: 20, sortOrder: 'asc' });
      expect(result.data).toHaveLength(2);
      expect(result.meta.total).toBe(2);
    });
  });
});
