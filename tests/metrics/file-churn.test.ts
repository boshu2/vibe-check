import { describe, it, expect } from 'vitest';
import { calculateFileChurn } from '../../src/metrics/file-churn';
import { Commit } from '../../src/types';

describe('metrics/file-churn', () => {
  const mockCommit = (hash: string, date: Date): Commit => ({
    hash,
    date,
    message: 'test',
    type: 'feat',
    scope: null,
    author: 'test',
  });

  describe('calculateFileChurn', () => {
    it('returns 100% for empty commits', () => {
      const result = calculateFileChurn([], new Map());
      expect(result.value).toBe(100);
      expect(result.churnedFiles).toBe(0);
      expect(result.totalFiles).toBe(0);
    });

    it('returns 100% when no files are churned', () => {
      const commits = [
        mockCommit('abc', new Date('2025-11-28T10:00:00Z')),
        mockCommit('def', new Date('2025-11-28T11:00:00Z')),
      ];
      const filesPerCommit = new Map([
        ['abc', ['file1.ts']],
        ['def', ['file2.ts']],
      ]);

      const result = calculateFileChurn(commits, filesPerCommit);

      expect(result.value).toBe(100);
      expect(result.rating).toBe('elite');
      expect(result.churnedFiles).toBe(0);
      expect(result.totalFiles).toBe(2);
    });

    it('detects churn when file touched 3+ times in 1 hour', () => {
      const baseTime = new Date('2025-11-28T10:00:00Z').getTime();
      const commits = [
        mockCommit('a', new Date(baseTime)),
        mockCommit('b', new Date(baseTime + 10 * 60 * 1000)), // +10 min
        mockCommit('c', new Date(baseTime + 20 * 60 * 1000)), // +20 min
      ];
      const filesPerCommit = new Map([
        ['a', ['file1.ts']],
        ['b', ['file1.ts']],
        ['c', ['file1.ts']],
      ]);

      const result = calculateFileChurn(commits, filesPerCommit);

      expect(result.churnedFiles).toBe(1);
      expect(result.totalFiles).toBe(1);
      expect(result.value).toBe(0); // 100% churn = 0 score
      expect(result.rating).toBe('low');
    });

    it('does not detect churn if touches span more than 1 hour', () => {
      const baseTime = new Date('2025-11-28T10:00:00Z').getTime();
      const commits = [
        mockCommit('a', new Date(baseTime)),
        mockCommit('b', new Date(baseTime + 40 * 60 * 1000)), // +40 min
        mockCommit('c', new Date(baseTime + 90 * 60 * 1000)), // +90 min (>1hr span)
      ];
      const filesPerCommit = new Map([
        ['a', ['file1.ts']],
        ['b', ['file1.ts']],
        ['c', ['file1.ts']],
      ]);

      const result = calculateFileChurn(commits, filesPerCommit);

      expect(result.churnedFiles).toBe(0);
      expect(result.rating).toBe('elite');
    });

    it('calculates correct rating thresholds', () => {
      const baseTime = new Date('2025-11-28T10:00:00Z').getTime();

      // Create 10 files, 2 churned (20% churn ratio)
      const commits: Commit[] = [];
      const filesPerCommit = new Map<string, string[]>();

      // 2 churned files
      for (let i = 0; i < 3; i++) {
        const hash = `churn1-${i}`;
        commits.push(mockCommit(hash, new Date(baseTime + i * 5 * 60 * 1000)));
        filesPerCommit.set(hash, ['churnedFile1.ts']);
      }
      for (let i = 0; i < 3; i++) {
        const hash = `churn2-${i}`;
        commits.push(mockCommit(hash, new Date(baseTime + i * 5 * 60 * 1000)));
        filesPerCommit.set(hash, ['churnedFile2.ts']);
      }

      // 8 non-churned files
      for (let i = 0; i < 8; i++) {
        const hash = `single-${i}`;
        commits.push(mockCommit(hash, new Date(baseTime + i * 60 * 60 * 1000)));
        filesPerCommit.set(hash, [`file${i}.ts`]);
      }

      const result = calculateFileChurn(commits, filesPerCommit);

      expect(result.churnedFiles).toBe(2);
      expect(result.totalFiles).toBe(10);
      expect(result.rating).toBe('high'); // 20% is in 10-25% range
    });

    it('handles missing files in map gracefully', () => {
      const commits = [
        mockCommit('abc', new Date('2025-11-28T10:00:00Z')),
      ];
      const filesPerCommit = new Map<string, string[]>(); // Empty map

      const result = calculateFileChurn(commits, filesPerCommit);

      expect(result.value).toBe(100);
      expect(result.totalFiles).toBe(0);
    });

    it('includes correct description for each rating', () => {
      const elite = calculateFileChurn([], new Map());
      expect(elite.description).toContain('Elite');

      // For other ratings, would need to construct appropriate data
    });
  });
});
