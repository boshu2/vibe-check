import { describe, it, expect } from 'vitest';
import { calculateTimeSpiral } from '../../src/metrics/time-spiral';
import { Commit } from '../../src/types';

describe('metrics/time-spiral', () => {
  const mockCommit = (date: Date): Commit => ({
    hash: Math.random().toString(36).substring(7),
    date,
    message: 'test',
    type: 'feat',
    scope: null,
    author: 'test',
  });

  describe('calculateTimeSpiral', () => {
    it('returns elite for empty commits', () => {
      const result = calculateTimeSpiral([]);

      expect(result.value).toBe(100);
      expect(result.rating).toBe('elite');
      expect(result.spiralCommits).toBe(0);
      expect(result.totalCommits).toBe(0);
    });

    it('returns elite for single commit', () => {
      const result = calculateTimeSpiral([
        mockCommit(new Date('2025-11-28T10:00:00Z')),
      ]);

      expect(result.value).toBe(100);
      expect(result.rating).toBe('elite');
      expect(result.description).toContain('Insufficient');
    });

    it('detects spiral when commits < 5 min apart', () => {
      const baseTime = new Date('2025-11-28T10:00:00Z').getTime();
      const commits = [
        mockCommit(new Date(baseTime)),
        mockCommit(new Date(baseTime + 2 * 60 * 1000)), // +2 min (spiral)
        mockCommit(new Date(baseTime + 3 * 60 * 1000)), // +1 min (spiral)
      ];

      const result = calculateTimeSpiral(commits);

      expect(result.spiralCommits).toBe(2);
      expect(result.totalCommits).toBe(3);
    });

    it('no spiral when commits >= 5 min apart', () => {
      const baseTime = new Date('2025-11-28T10:00:00Z').getTime();
      const commits = [
        mockCommit(new Date(baseTime)),
        mockCommit(new Date(baseTime + 10 * 60 * 1000)), // +10 min
        mockCommit(new Date(baseTime + 20 * 60 * 1000)), // +10 min
      ];

      const result = calculateTimeSpiral(commits);

      expect(result.spiralCommits).toBe(0);
      expect(result.rating).toBe('elite');
    });

    it('calculates correct rating based on spiral ratio', () => {
      const baseTime = new Date('2025-11-28T10:00:00Z').getTime();

      // 40% spiral ratio (4 spirals out of 10 commits) - in 30-50% range = medium
      const commits = [
        mockCommit(new Date(baseTime)),
        mockCommit(new Date(baseTime + 1 * 60 * 1000)), // spiral
        mockCommit(new Date(baseTime + 10 * 60 * 1000)),
        mockCommit(new Date(baseTime + 11 * 60 * 1000)), // spiral
        mockCommit(new Date(baseTime + 20 * 60 * 1000)),
        mockCommit(new Date(baseTime + 21 * 60 * 1000)), // spiral
        mockCommit(new Date(baseTime + 30 * 60 * 1000)),
        mockCommit(new Date(baseTime + 31 * 60 * 1000)), // spiral
        mockCommit(new Date(baseTime + 40 * 60 * 1000)),
        mockCommit(new Date(baseTime + 50 * 60 * 1000)), // NOT spiral (9 min gap)
      ];

      const result = calculateTimeSpiral(commits);

      expect(result.spiralCommits).toBe(4);
      expect(result.rating).toBe('medium'); // 40% is in 30-50% range
    });

    it('returns low rating for >50% spiral ratio', () => {
      const baseTime = new Date('2025-11-28T10:00:00Z').getTime();

      // All rapid-fire commits
      const commits = Array.from({ length: 10 }, (_, i) =>
        mockCommit(new Date(baseTime + i * 60 * 1000)) // 1 min apart
      );

      const result = calculateTimeSpiral(commits);

      expect(result.rating).toBe('low');
      expect(result.description).toContain('frustrated iteration');
    });

    it('sorts commits by date before analysis', () => {
      const baseTime = new Date('2025-11-28T10:00:00Z').getTime();

      // Commits in random order
      const commits = [
        mockCommit(new Date(baseTime + 10 * 60 * 1000)),
        mockCommit(new Date(baseTime)),
        mockCommit(new Date(baseTime + 5 * 60 * 1000)),
      ];

      const result = calculateTimeSpiral(commits);

      // Should detect no spirals (5+ min between each when sorted)
      expect(result.spiralCommits).toBe(0);
    });

    it('includes description for each rating', () => {
      const eliteResult = calculateTimeSpiral([
        mockCommit(new Date('2025-11-28T10:00:00Z')),
      ]);
      expect(eliteResult.description).toContain('Insufficient');
    });
  });
});
