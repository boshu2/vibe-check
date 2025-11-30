import { describe, it, expect } from 'vitest';
import { calculateVelocityAnomaly } from '../../src/metrics/velocity-anomaly';
import { Commit } from '../../src/types';

describe('metrics/velocity-anomaly', () => {
  const mockCommit = (date: Date): Commit => ({
    hash: Math.random().toString(36).substring(7),
    date,
    message: 'test',
    type: 'feat',
    scope: null,
    author: 'test',
  });

  describe('calculateVelocityAnomaly', () => {
    it('returns result for empty commits', () => {
      const result = calculateVelocityAnomaly([]);

      expect(result.currentVelocity).toBe(0);
      expect(result.zScore).toBeDefined();
    });

    it('uses default baseline when none provided', () => {
      const commits = [
        mockCommit(new Date('2025-11-28T10:00:00Z')),
      ];

      const result = calculateVelocityAnomaly(commits);

      expect(result.baselineMean).toBe(3.0);
      expect(result.baselineStdDev).toBe(1.5);
    });

    it('uses provided baseline', () => {
      const commits = [
        mockCommit(new Date('2025-11-28T10:00:00Z')),
      ];
      const baseline = { mean: 5.0, stdDev: 2.0 };

      const result = calculateVelocityAnomaly(commits, baseline);

      expect(result.baselineMean).toBe(5.0);
      expect(result.baselineStdDev).toBe(2.0);
    });

    it('calculates z-score correctly', () => {
      const baseTime = new Date('2025-11-28T10:00:00Z').getTime();
      // 6 commits in 1 hour = 6 commits/hour velocity
      const commits = Array.from({ length: 6 }, (_, i) =>
        mockCommit(new Date(baseTime + i * 10 * 60 * 1000))
      );

      // Baseline: mean=3, stdDev=1.5
      // Current velocity ~6, z-score = (6-3)/1.5 = 2
      const result = calculateVelocityAnomaly(commits);

      expect(result.currentVelocity).toBeGreaterThan(0);
      expect(result.zScore).toBeGreaterThan(0);
    });

    it('returns elite for velocity near baseline', () => {
      const baseTime = new Date('2025-11-28T10:00:00Z').getTime();
      // 3 commits over 1 hour = 3 commits/hour (exactly matches baseline mean of 3.0)
      // z-score = |3.0 - 3.0| / 1.5 = 0 → elite (< 1.0)
      const commits = [
        mockCommit(new Date(baseTime)),
        mockCommit(new Date(baseTime + 30 * 60 * 1000)),
        mockCommit(new Date(baseTime + 60 * 60 * 1000)),
      ];

      const result = calculateVelocityAnomaly(commits);

      expect(result.rating).toBe('elite');
      expect(result.description).toContain('near baseline');
    });

    it('handles zero stdDev gracefully', () => {
      const commits = [
        mockCommit(new Date('2025-11-28T10:00:00Z')),
      ];
      const baseline = { mean: 3.0, stdDev: 0 };

      const result = calculateVelocityAnomaly(commits, baseline);

      expect(result.zScore).toBe(0);
    });

    it('returns low rating for high z-score', () => {
      const baseTime = new Date('2025-11-28T10:00:00Z').getTime();
      // 20 commits in 1 hour = very high velocity (~20 commits/hour)
      // z-score = |20 - 3| / 1.5 ≈ 11.3 → low (>= 2.0)
      const commits = Array.from({ length: 20 }, (_, i) =>
        mockCommit(new Date(baseTime + i * 3 * 60 * 1000))
      );

      const result = calculateVelocityAnomaly(commits);

      // Should be far from baseline (z-score >= 2.0 triggers 'low')
      expect(result.zScore).toBeGreaterThanOrEqual(2);
      expect(result.rating).toBe('low');
      expect(result.description).toContain('unusual pattern');
    });

    it('includes velocity in description', () => {
      const commits = [
        mockCommit(new Date('2025-11-28T10:00:00Z')),
        mockCommit(new Date('2025-11-28T10:30:00Z')),
      ];

      const result = calculateVelocityAnomaly(commits);

      expect(result.description).toContain('/hr');
    });
  });
});
