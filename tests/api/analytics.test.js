// ============================================================
// Unit Tests for Analytics API endpoints
// Tests grade trends, platform metrics, and funnel computation
// ============================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSend = vi.fn();

vi.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: vi.fn(() => ({ send: mockSend })),
  ScanCommand: vi.fn(),
}));

vi.mock('@aws-sdk/util-dynamodb', () => ({
  unmarshall: vi.fn((item) => {
    const result = {};
    for (const [key, value] of Object.entries(item)) {
      if (value.S !== undefined) result[key] = value.S;
      else if (value.N !== undefined) result[key] = Number(value.N);
      else result[key] = value;
    }
    return result;
  }),
}));

// Import after mocks are set up
const {
  computeGradeTrends,
  computePlatformMetrics,
  computeFunnelMetrics,
  handleGetGrades,
  handleGetPlatforms,
  handleGetFunnel,
} = await import('../../src/api/routes/analytics.js');

describe('analytics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('computeGradeTrends', () => {
    it('should group records correctly by date', () => {
      const today = new Date().toISOString().split('T')[0];
      const records = [
        { foundAt: today, grade: 'A' },
        { foundAt: today, grade: 'A' },
        { foundAt: today, grade: 'B' },
        { foundAt: today, grade: 'C' },
      ];

      const result = computeGradeTrends(records);

      // Should return 30 days
      expect(result).toHaveLength(30);

      // Today's entry should have the correct counts
      const todayEntry = result.find(r => r.date === today);
      expect(todayEntry).toBeDefined();
      expect(todayEntry.A).toBe(2);
      expect(todayEntry.B).toBe(1);
      expect(todayEntry.C).toBe(1);
      expect(todayEntry.D).toBe(0);
      expect(todayEntry.F).toBe(0);
    });

    it('should fill missing dates with zeros', () => {
      const result = computeGradeTrends([]);

      expect(result).toHaveLength(30);
      for (const entry of result) {
        expect(entry.A).toBe(0);
        expect(entry.B).toBe(0);
        expect(entry.C).toBe(0);
        expect(entry.D).toBe(0);
        expect(entry.F).toBe(0);
      }
    });

    it('should return results sorted ascending by date', () => {
      const result = computeGradeTrends([]);

      for (let i = 1; i < result.length; i++) {
        expect(result[i].date > result[i - 1].date).toBe(true);
      }
    });

    it('should handle records with missing foundAt gracefully', () => {
      const records = [
        { grade: 'A' }, // no foundAt
        { foundAt: '', grade: 'B' }, // empty foundAt
      ];

      const result = computeGradeTrends(records);
      expect(result).toHaveLength(30);
      // These records should be skipped, all zeros
      const totalA = result.reduce((sum, r) => sum + r.A, 0);
      expect(totalA).toBe(0);
    });
  });

  describe('computePlatformMetrics', () => {
    it('should compute conversionRate correctly', () => {
      const records = [
        { platform: 'LinkedIn', totalScore: 4.5, grade: 'A', status: 'Applied' },
        { platform: 'LinkedIn', totalScore: 3.5, grade: 'B', status: 'New' },
        { platform: 'LinkedIn', totalScore: 4.0, grade: 'A', status: 'Applied' },
        { platform: 'Indeed', totalScore: 2.0, grade: 'D', status: 'New' },
      ];

      const result = computePlatformMetrics(records);

      const linkedin = result.find(p => p.platform === 'LinkedIn');
      expect(linkedin).toBeDefined();
      expect(linkedin.total).toBe(3);
      expect(linkedin.aGradeCount).toBe(2);
      // 2 applied out of 3 total = 66.67%
      expect(linkedin.conversionRate).toBeCloseTo(66.67, 1);
      expect(linkedin.avgScore).toBeCloseTo(4.0, 1);

      const indeed = result.find(p => p.platform === 'Indeed');
      expect(indeed).toBeDefined();
      expect(indeed.total).toBe(1);
      expect(indeed.conversionRate).toBe(0);
    });

    it('should return empty array for no records', () => {
      const result = computePlatformMetrics([]);
      expect(result).toEqual([]);
    });

    it('should handle records with missing platform', () => {
      const records = [
        { totalScore: 3.0, grade: 'C', status: 'New' },
      ];

      const result = computePlatformMetrics(records);
      expect(result).toHaveLength(1);
      expect(result[0].platform).toBe('Unknown');
    });
  });

  describe('computeFunnelMetrics', () => {
    it('should count statuses correctly', () => {
      const records = [
        { status: 'New' },
        { status: 'New' },
        { status: 'Reviewed' },
        { status: 'Applied', foundAt: '2025-01-01T00:00:00Z', updatedAt: 1736208000000 },
        { status: 'Rejected' },
        { status: 'Archived' },
      ];

      const result = computeFunnelMetrics(records);

      expect(result.found).toBe(6); // all records
      expect(result.reviewed).toBe(2); // Reviewed + Applied (Applied implies reviewed)
      expect(result.applied).toBe(1);
      expect(result.rejected).toBe(1);
      expect(result.archived).toBe(1);
    });

    it('should return zeros for empty table', () => {
      const result = computeFunnelMetrics([]);

      expect(result.found).toBe(0);
      expect(result.reviewed).toBe(0);
      expect(result.applied).toBe(0);
      expect(result.rejected).toBe(0);
      expect(result.archived).toBe(0);
      expect(result.newToAppliedDays).toBe(0);
    });

    it('should compute newToAppliedDays average', () => {
      // Two applied jobs: one took 5 days, one took 10 days → avg = 7.5
      const records = [
        {
          status: 'Applied',
          foundAt: '2025-01-01T00:00:00Z',
          updatedAt: new Date('2025-01-06T00:00:00Z').getTime(), // 5 days later
        },
        {
          status: 'Applied',
          foundAt: '2025-01-01T00:00:00Z',
          updatedAt: new Date('2025-01-11T00:00:00Z').getTime(), // 10 days later
        },
      ];

      const result = computeFunnelMetrics(records);
      expect(result.newToAppliedDays).toBe(7.5);
    });
  });

  describe('handleGetGrades (integration)', () => {
    it('should return 200 with grade data on success', async () => {
      mockSend.mockResolvedValue({ Items: [] });

      const result = await handleGetGrades();

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(Array.isArray(body)).toBe(true);
      expect(body).toHaveLength(30);
    });

    it('should return 500 on DynamoDB error', async () => {
      mockSend.mockRejectedValue(new Error('DynamoDB error'));

      const result = await handleGetGrades();

      expect(result.statusCode).toBe(500);
    });
  });

  describe('handleGetPlatforms (integration)', () => {
    it('should return 200 with platform data on success', async () => {
      mockSend.mockResolvedValue({ Items: [] });

      const result = await handleGetPlatforms();

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(Array.isArray(body)).toBe(true);
    });
  });

  describe('handleGetFunnel (integration)', () => {
    it('should return 200 with funnel data on success', async () => {
      mockSend.mockResolvedValue({ Items: [] });

      const result = await handleGetFunnel();

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.found).toBe(0);
      expect(body.reviewed).toBe(0);
      expect(body.applied).toBe(0);
    });
  });
});
