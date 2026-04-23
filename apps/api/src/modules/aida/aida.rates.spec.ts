import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AidaService } from './aida.service';

/**
 * These tests cover only the rate-resolution logic introduced with
 * /settings/aida — namely resolveAidaBodyLabourRate,
 * resolveAidaPaintMaterialRate and getEffectiveRates. Other AidaService
 * methods touch Supabase storage, vision calls, etc. and are best
 * exercised via integration tests.
 */

// Builds a mock .from() chain that resolves the last `.maybeSingle()` /
// `.single()` call with the given response. One call at a time; tests
// that do multiple queries re-prime the mock between them.
function mockSingle(response: { data: unknown; error?: unknown }) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    not: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue(response),
  };
}

describe('AidaService — effective rates', () => {
  const mockFrom = vi.fn();
  const mockSupabase = {
    getClient: vi.fn().mockReturnValue({ from: mockFrom }),
  };
  let service: AidaService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabase.getClient.mockReturnValue({ from: mockFrom });
    service = new AidaService(
      mockSupabase as never,
      {} as never, // JobsService — not touched by these paths
      {} as never, // AiService
      {} as never, // ConfigService
    );
  });

  describe('getEffectiveRates', () => {
    it('returns AIDA override when aida.default_body_labour_rate is set', async () => {
      // Call 1: body rate setting lookup → has value
      // Call 2: paint rate setting lookup → null
      mockFrom
        .mockReturnValueOnce(mockSingle({ data: { value: '15000' } }))
        .mockReturnValueOnce(mockSingle({ data: null }));

      const result = await service.getEffectiveRates('tenant-1');

      expect(result.bodyLabourRate).toBe(15000);
      expect(result.bodyLabourSource).toBe('aida_override');
      expect(result.paintMaterialRate).toBeNull();
      expect(result.paintMaterialSource).toBe('none');
    });

    it('returns AIDA override alongside a paint fallback when both are set', async () => {
      mockFrom
        .mockReturnValueOnce(mockSingle({ data: { value: '12000' } })) // body
        .mockReturnValueOnce(mockSingle({ data: { value: '8500' } })); // paint

      const result = await service.getEffectiveRates('tenant-1');

      expect(result.bodyLabourRate).toBe(12000);
      expect(result.bodyLabourSource).toBe('aida_override');
      expect(result.paintMaterialRate).toBe(8500);
      expect(result.paintMaterialSource).toBe('aida_override');
    });

    it('falls back to workshop default when AIDA override is unset', async () => {
      mockFrom
        .mockReturnValueOnce(mockSingle({ data: null })) // body override: none
        .mockReturnValueOnce(mockSingle({ data: { value: '9500' } })) // workshop default
        .mockReturnValueOnce(mockSingle({ data: null })); // paint rate

      const result = await service.getEffectiveRates('tenant-1');

      expect(result.bodyLabourRate).toBe(9500);
      expect(result.bodyLabourSource).toBe('workshop_default');
    });

    it('falls back to top technician rate when no setting is configured', async () => {
      mockFrom
        .mockReturnValueOnce(mockSingle({ data: null })) // body override
        .mockReturnValueOnce(mockSingle({ data: null })) // workshop default
        .mockReturnValueOnce(mockSingle({ data: { hourly_rate: 7500 } })) // tech
        .mockReturnValueOnce(mockSingle({ data: null })); // paint

      const result = await service.getEffectiveRates('tenant-1');

      expect(result.bodyLabourRate).toBe(7500);
      expect(result.bodyLabourSource).toBe('tech_max');
    });

    it('returns 0 with source "none" when nothing is configured', async () => {
      mockFrom
        .mockReturnValueOnce(mockSingle({ data: null })) // body override
        .mockReturnValueOnce(mockSingle({ data: null })) // workshop default
        .mockReturnValueOnce(mockSingle({ data: null })) // tech max
        .mockReturnValueOnce(mockSingle({ data: null })); // paint

      const result = await service.getEffectiveRates('tenant-1');

      expect(result.bodyLabourRate).toBe(0);
      expect(result.bodyLabourSource).toBe('none');
      expect(result.paintMaterialRate).toBeNull();
      expect(result.paintMaterialSource).toBe('none');
    });

    it('treats an empty-string AIDA body rate as unset', async () => {
      mockFrom
        .mockReturnValueOnce(mockSingle({ data: { value: '' } })) // body override: empty
        .mockReturnValueOnce(mockSingle({ data: { value: '5000' } })) // workshop default
        .mockReturnValueOnce(mockSingle({ data: null })); // paint

      const result = await service.getEffectiveRates('tenant-1');

      expect(result.bodyLabourSource).toBe('workshop_default');
      expect(result.bodyLabourRate).toBe(5000);
    });

    it('treats a zero AIDA body rate as unset', async () => {
      mockFrom
        .mockReturnValueOnce(mockSingle({ data: { value: '0' } })) // body override: 0
        .mockReturnValueOnce(mockSingle({ data: { value: '4000' } })) // workshop default
        .mockReturnValueOnce(mockSingle({ data: null })); // paint

      const result = await service.getEffectiveRates('tenant-1');

      expect(result.bodyLabourSource).toBe('workshop_default');
      expect(result.bodyLabourRate).toBe(4000);
    });

    it('treats a non-numeric setting value as unset and continues falling back', async () => {
      mockFrom
        .mockReturnValueOnce(mockSingle({ data: { value: 'not-a-number' } })) // body
        .mockReturnValueOnce(mockSingle({ data: { value: 'also-bad' } })) // workshop default: bad
        .mockReturnValueOnce(mockSingle({ data: { hourly_rate: 6000 } })) // tech
        .mockReturnValueOnce(mockSingle({ data: null })); // paint

      const result = await service.getEffectiveRates('tenant-1');

      expect(result.bodyLabourSource).toBe('tech_max');
      expect(result.bodyLabourRate).toBe(6000);
    });
  });
});
