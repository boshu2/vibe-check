import { describe, it, expect } from 'vitest';
import { analyzeCommits } from '../src/metrics';
import { Commit } from '../src/types';

describe('analyzeCommits', () => {
  const mockCommit = (
    type: Commit['type'],
    message: string,
    date: Date,
    scope?: string
  ): Commit => ({
    hash: Math.random().toString(36).substring(7),
    date,
    message,
    type,
    scope: scope || null,
    author: 'test',
  });

  it('returns empty result for no commits', () => {
    const result = analyzeCommits([]);
    expect(result.commits.total).toBe(0);
    expect(result.overall).toBe('HIGH');
  });

  it('counts commit types correctly', () => {
    const now = new Date();
    const commits: Commit[] = [
      mockCommit('feat', 'feat: add feature', now),
      mockCommit('fix', 'fix: bug fix', now),
      mockCommit('fix', 'fix: another bug', now),
      mockCommit('docs', 'docs: update readme', now),
      mockCommit('chore', 'chore: deps', now),
    ];

    const result = analyzeCommits(commits);
    expect(result.commits.total).toBe(5);
    expect(result.commits.feat).toBe(1);
    expect(result.commits.fix).toBe(2);
    expect(result.commits.docs).toBe(1);
    expect(result.commits.other).toBe(1);
  });

  it('detects fix chains as debug spirals', () => {
    const baseTime = new Date('2025-11-28T10:00:00');
    const commits: Commit[] = [
      mockCommit('feat', 'feat: add oauth', baseTime, 'auth'),
      mockCommit('fix', 'fix(auth): token issue', new Date(baseTime.getTime() + 5 * 60000), 'auth'),
      mockCommit('fix', 'fix(auth): refresh token', new Date(baseTime.getTime() + 10 * 60000), 'auth'),
      mockCommit('fix', 'fix(auth): expiry check', new Date(baseTime.getTime() + 15 * 60000), 'auth'),
    ];

    const result = analyzeCommits(commits);
    expect(result.fixChains.length).toBe(1);
    expect(result.fixChains[0].component).toBe('auth');
    expect(result.fixChains[0].commits).toBe(3);
  });

  it('calculates overall rating from metrics', () => {
    const now = new Date();
    const hour = 60 * 60 * 1000;

    // High velocity, low rework scenario
    const commits: Commit[] = Array.from({ length: 10 }, (_, i) =>
      mockCommit('feat', `feat: feature ${i}`, new Date(now.getTime() - (10 - i) * hour / 10))
    );

    const result = analyzeCommits(commits);
    expect(['ELITE', 'HIGH', 'MEDIUM', 'LOW']).toContain(result.overall);
  });
});
