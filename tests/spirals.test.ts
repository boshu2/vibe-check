import { describe, it, expect } from 'vitest';
import { detectFixChains, calculateDebugSpiralDuration } from '../src/metrics/spirals';
import { Commit } from '../src/types';

describe('detectFixChains', () => {
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

  it('returns empty array for no commits', () => {
    expect(detectFixChains([])).toEqual([]);
  });

  it('does not detect chain with less than 3 fixes', () => {
    const now = new Date();
    const commits: Commit[] = [
      mockCommit('fix', 'fix: first', now),
      mockCommit('fix', 'fix: second', new Date(now.getTime() + 5000)),
    ];
    expect(detectFixChains(commits)).toEqual([]);
  });

  it('detects chain with 3+ consecutive fixes', () => {
    const now = new Date();
    const commits: Commit[] = [
      mockCommit('fix', 'fix: first', now, 'api'),
      mockCommit('fix', 'fix: second', new Date(now.getTime() + 5000), 'api'),
      mockCommit('fix', 'fix: third', new Date(now.getTime() + 10000), 'api'),
    ];
    const chains = detectFixChains(commits);
    expect(chains.length).toBe(1);
    expect(chains[0].commits).toBe(3);
  });

  it('detects SECRETS_AUTH pattern', () => {
    const now = new Date();
    const commits: Commit[] = [
      mockCommit('fix', 'fix: oauth token refresh', now, 'auth'),
      mockCommit('fix', 'fix: auth credential handling', new Date(now.getTime() + 5000), 'auth'),
      mockCommit('fix', 'fix: password validation', new Date(now.getTime() + 10000), 'auth'),
    ];
    const chains = detectFixChains(commits);
    expect(chains.length).toBe(1);
    expect(chains[0].pattern).toBe('SECRETS_AUTH');
  });
});

describe('calculateDebugSpiralDuration', () => {
  it('returns elite rating for no spirals', () => {
    const result = calculateDebugSpiralDuration([]);
    expect(result.rating).toBe('elite');
    expect(result.value).toBe(0);
  });

  it('calculates average duration correctly', () => {
    const chains = [
      { component: 'a', commits: 3, duration: 10, isSpiral: true, pattern: null, firstCommit: new Date(), lastCommit: new Date() },
      { component: 'b', commits: 4, duration: 20, isSpiral: true, pattern: null, firstCommit: new Date(), lastCommit: new Date() },
    ];
    const result = calculateDebugSpiralDuration(chains);
    expect(result.value).toBe(15); // (10 + 20) / 2
    // 15 min is the threshold - exactly 15 is 'high' not 'elite' (< 15)
    expect(result.rating).toBe('high');
  });
});
