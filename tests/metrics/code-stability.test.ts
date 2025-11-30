import { describe, it, expect } from 'vitest';
import { calculateCodeStability } from '../../src/metrics/code-stability';
import { Commit } from '../../src/types';

describe('metrics/code-stability', () => {
  const mockCommit = (message: string): Commit => ({
    hash: Math.random().toString(36).substring(7),
    date: new Date(),
    message,
    type: 'feat',
    scope: null,
    author: 'test',
  });

  describe('calculateCodeStability', () => {
    it('estimates stability from commit messages when no stats', () => {
      const commits = [
        mockCommit('feat: add feature'),
        mockCommit('fix: something'),
        mockCommit('feat: another feature'),
      ];

      const result = calculateCodeStability(commits);

      expect(result.description).toContain('Estimated');
      expect(result.linesAdded).toBe(0);
      expect(result.linesSurviving).toBe(0);
    });

    it('returns elite when no fix/revert commits', () => {
      const commits = [
        mockCommit('feat: add feature'),
        mockCommit('feat: another feature'),
        mockCommit('docs: update readme'),
      ];

      const result = calculateCodeStability(commits);

      expect(result.value).toBe(100);
      expect(result.rating).toBe('elite');
    });

    it('penalizes fix commits in estimation', () => {
      const commits = [
        mockCommit('feat: add feature'),
        mockCommit('fix: broken thing'),
        mockCommit('fix: another fix'),
        mockCommit('fix: yet another'),
      ];

      const result = calculateCodeStability(commits);

      // 75% fix commits = 25% score
      expect(result.value).toBe(25);
      expect(result.rating).toBe('low');
    });

    it('detects revert commits', () => {
      const commits = [
        mockCommit('feat: add feature'),
        mockCommit('revert: undo feature'),
      ];

      const result = calculateCodeStability(commits);

      expect(result.value).toBe(50); // 50% fix/revert
    });

    it('detects undo in messages', () => {
      const commits = [
        mockCommit('feat: add feature'),
        mockCommit('chore: undo previous change'),
      ];

      const result = calculateCodeStability(commits);

      expect(result.value).toBe(50);
    });

    it('calculates stability from line stats', () => {
      const commits = [mockCommit('feat: test')];
      const stats = [
        { additions: 100, deletions: 20 },
      ];

      const result = calculateCodeStability(commits, stats);

      // deletions/additions = 0.2, score = 1 - (0.2 * 0.5) = 0.9
      expect(result.value).toBe(90);
      expect(result.rating).toBe('elite');
      expect(result.linesAdded).toBe(100);
    });

    it('handles high churn (many deletions)', () => {
      const commits = [mockCommit('refactor: cleanup')];
      const stats = [
        { additions: 100, deletions: 100 },
      ];

      const result = calculateCodeStability(commits, stats);

      // deletions/additions = 1.0 (capped), score = 1 - (1.0 * 0.5) = 0.5
      expect(result.value).toBe(50);
      expect(result.rating).toBe('medium');
    });

    it('aggregates multiple commit stats', () => {
      const commits = [
        mockCommit('feat: one'),
        mockCommit('feat: two'),
      ];
      const stats = [
        { additions: 50, deletions: 10 },
        { additions: 50, deletions: 10 },
      ];

      const result = calculateCodeStability(commits, stats);

      expect(result.linesAdded).toBe(100);
      // 20/100 = 0.2 churn, score = 0.9
      expect(result.value).toBe(90);
    });

    it('handles zero additions gracefully', () => {
      const commits = [mockCommit('chore: delete files')];
      const stats = [
        { additions: 0, deletions: 50 },
      ];

      const result = calculateCodeStability(commits, stats);

      expect(result.value).toBe(100); // 0 churn when no additions
    });

    it('returns correct rating for each threshold', () => {
      // Elite >= 85%
      const eliteStats = [{ additions: 100, deletions: 10 }];
      const elite = calculateCodeStability([mockCommit('t')], eliteStats);
      expect(elite.rating).toBe('elite');

      // High 70-85%
      const highStats = [{ additions: 100, deletions: 50 }];
      const high = calculateCodeStability([mockCommit('t')], highStats);
      expect(high.rating).toBe('high');

      // Medium 50-70%
      const medStats = [{ additions: 100, deletions: 80 }];
      const med = calculateCodeStability([mockCommit('t')], medStats);
      expect(med.rating).toBe('medium');

      // Low < 50% (would need > 100% deletions which is capped)
    });

    it('includes line counts in description', () => {
      const commits = [mockCommit('feat: test')];
      const stats = [{ additions: 100, deletions: 20 }];

      const result = calculateCodeStability(commits, stats);

      expect(result.description).toContain('+100');
      expect(result.description).toContain('-20');
    });

    it('calculates surviving lines', () => {
      const commits = [mockCommit('feat: test')];
      const stats = [{ additions: 100, deletions: 20 }];

      const result = calculateCodeStability(commits, stats);

      // linesSurviving = additions * score = 100 * 0.9 = 90
      expect(result.linesSurviving).toBe(90);
    });
  });
});
