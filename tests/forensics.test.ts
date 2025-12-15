/**
 * Tracer Tests for VIBE-045: Git Forensics
 *
 * Tests for pattern detection and quality metrics.
 * Proven algorithm from release-engineering retrospective (475 commits analyzed).
 */

import { describe, it, expect } from 'vitest';
import {
  detectDebugSpirals,
  detectVagueCommits,
  detectContextAmnesia,
  detectPatterns,
} from '../src/analyzers/patterns.js';
import {
  isConventionalCommit,
  isDescriptiveCommit,
  isVagueCommit,
  calculateQualityMetrics,
  getRecommendation,
} from '../src/analyzers/quality.js';
import { Commit } from '../src/types.js';
import { execSync } from 'child_process';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLI_PATH = path.join(__dirname, '..', 'dist', 'cli.js');
const TEST_REPO = process.cwd();

function runCli(args: string): string {
  try {
    return execSync(`node ${CLI_PATH} ${args}`, {
      encoding: 'utf-8',
      cwd: TEST_REPO,
      timeout: 30000,
    });
  } catch (error: unknown) {
    const execError = error as { stdout?: string; stderr?: string };
    return execError.stdout || execError.stderr || '';
  }
}

function createCommit(
  hash: string,
  message: string,
  scope: string | null = null,
  type: Commit['type'] = 'feat'
): Commit {
  return {
    hash,
    date: new Date(),
    message,
    type,
    scope,
    author: 'test',
  };
}

describe('Pattern Detection (VIBE-045)', () => {
  describe('detectDebugSpirals', () => {
    it('returns null for no spiral patterns', () => {
      const commits = [
        createCommit('a', 'feat: add login'),
        createCommit('b', 'fix: handle errors'),
        createCommit('c', 'docs: update readme'),
      ];

      const result = detectDebugSpirals(commits);
      expect(result).toBeNull();
    });

    it('detects "take N" pattern with 3+ occurrences', () => {
      const commits = [
        createCommit('a', 'take 1'),
        createCommit('b', 'take 2'),
        createCommit('c', 'take 3'),
      ];

      const result = detectDebugSpirals(commits);

      expect(result).not.toBeNull();
      expect(result!.count).toBe(3);
      expect(result!.commits).toEqual(['a', 'b', 'c']);
    });

    it('ignores fewer than 3 take commits', () => {
      const commits = [
        createCommit('a', 'take 1'),
        createCommit('b', 'take 2'),
        createCommit('c', 'feat: something else'),
      ];

      const result = detectDebugSpirals(commits);
      expect(result).toBeNull();
    });

    it('detects retry patterns like "fix #N"', () => {
      const commits = [
        createCommit('a', 'fix #1'),
        createCommit('b', 'fix #2'),
        createCommit('c', 'fix #3'),
      ];

      const result = detectDebugSpirals(commits);
      expect(result).not.toBeNull();
      expect(result!.count).toBe(3);
    });

    it('detects wip/temp patterns', () => {
      const commits = [
        createCommit('a', 'wip'),
        createCommit('b', 'wip2'),
        createCommit('c', 'temp'),
      ];

      const result = detectDebugSpirals(commits);
      expect(result).not.toBeNull();
      expect(result!.count).toBe(3);
    });

    it('detects version patterns like "v2", "v3"', () => {
      const commits = [
        createCommit('a', 'v1'),
        createCommit('b', 'v2'),
        createCommit('c', 'v3'),
      ];

      const result = detectDebugSpirals(commits);
      expect(result).not.toBeNull();
      expect(result!.count).toBe(3);
    });
  });

  describe('detectVagueCommits', () => {
    it('detects commits with short messages', () => {
      const commits = [
        createCommit('a', 'ci'),
        createCommit('b', 'v3'),
        createCommit('c', 'feat: proper commit message'),
      ];

      const result = detectVagueCommits(commits);

      expect(result.count).toBe(2);
      expect(result.percentage).toBeCloseTo(66.7, 0);
      expect(result.examples).toContain('ci');
      expect(result.examples).toContain('v3');
    });

    it('respects custom threshold', () => {
      const commits = [
        createCommit('a', 'short message'),
        createCommit('b', 'this is a longer message that exceeds threshold'),
      ];

      const result10 = detectVagueCommits(commits, 10);
      const result30 = detectVagueCommits(commits, 30);

      expect(result10.count).toBe(0); // Both exceed 10 chars
      expect(result30.count).toBe(1); // "short message" is < 30 chars
    });

    it('returns 0 for empty commits array', () => {
      const result = detectVagueCommits([]);
      expect(result.count).toBe(0);
      expect(result.percentage).toBe(0);
    });
  });

  describe('detectContextAmnesia', () => {
    it('detects frequently visited scopes', () => {
      const commits = [
        createCommit('a', 'feat(auth): login', 'auth'),
        createCommit('b', 'fix(auth): token', 'auth'),
        createCommit('c', 'feat(auth): logout', 'auth'),
        createCommit('d', 'fix(auth): session', 'auth'),
        createCommit('e', 'test(auth): add tests', 'auth'),
        createCommit('f', 'feat(api): endpoint', 'api'),
      ];

      const result = detectContextAmnesia(commits);

      expect(result.scopes.length).toBe(1);
      expect(result.scopes[0].name).toBe('auth');
      expect(result.scopes[0].visits).toBe(5);
    });

    it('ignores scopes with few visits', () => {
      const commits = [
        createCommit('a', 'feat(auth): login', 'auth'),
        createCommit('b', 'fix(api): endpoint', 'api'),
        createCommit('c', 'feat(db): schema', 'db'),
      ];

      const result = detectContextAmnesia(commits);
      expect(result.scopes.length).toBe(0);
    });

    it('respects custom minVisits threshold', () => {
      const commits = [
        createCommit('a', 'feat(auth): login', 'auth'),
        createCommit('b', 'fix(auth): token', 'auth'),
        createCommit('c', 'feat(auth): logout', 'auth'),
      ];

      const result3 = detectContextAmnesia(commits, 3);
      const result5 = detectContextAmnesia(commits, 5);

      expect(result3.scopes.length).toBe(1);
      expect(result5.scopes.length).toBe(0);
    });
  });
});

describe('Quality Metrics (VIBE-045)', () => {
  describe('isConventionalCommit', () => {
    it('recognizes conventional commit format', () => {
      expect(isConventionalCommit('feat: add login')).toBe(true);
      expect(isConventionalCommit('fix(auth): handle token')).toBe(true);
      expect(isConventionalCommit('docs: update readme')).toBe(true);
      expect(isConventionalCommit('chore(deps): bump versions')).toBe(true);
    });

    it('rejects non-conventional formats', () => {
      expect(isConventionalCommit('add login')).toBe(false);
      expect(isConventionalCommit('Fixed the bug')).toBe(false);
      expect(isConventionalCommit('WIP')).toBe(false);
      expect(isConventionalCommit('v2')).toBe(false);
    });
  });

  describe('isDescriptiveCommit', () => {
    it('accepts commits with sufficient length', () => {
      expect(isDescriptiveCommit('feat: add login functionality')).toBe(true);
      expect(isDescriptiveCommit('This is a long commit message')).toBe(true);
    });

    it('rejects short commits', () => {
      expect(isDescriptiveCommit('ci')).toBe(false);
      expect(isDescriptiveCommit('fix')).toBe(false);
      expect(isDescriptiveCommit('wip')).toBe(false);
    });
  });

  describe('isVagueCommit', () => {
    it('detects vague commits correctly', () => {
      expect(isVagueCommit('ci')).toBe(true);
      expect(isVagueCommit('v2')).toBe(true);
      expect(isVagueCommit('wip')).toBe(true);
      expect(isVagueCommit('feat: add login functionality')).toBe(false); // 29 chars > 20
    });
  });

  describe('calculateQualityMetrics', () => {
    it('calculates all metrics correctly', () => {
      const commits = [
        createCommit('a', 'feat: add login functionality'),
        createCommit('b', 'fix(auth): handle token expiry'),
        createCommit('c', 'ci'),
        createCommit('d', 'wip'),
      ];

      const metrics = calculateQualityMetrics(commits);

      expect(metrics.totalCommits).toBe(4);
      expect(metrics.conventionalCommits.count).toBe(2);
      expect(metrics.conventionalCommits.percentage).toBe(50);
      expect(metrics.vagueCommits.count).toBe(2);
      expect(metrics.vagueCommits.percentage).toBe(50);
    });

    it('handles empty commits array', () => {
      const metrics = calculateQualityMetrics([]);

      expect(metrics.totalCommits).toBe(0);
      expect(metrics.conventionalCommits.percentage).toBe(0);
      expect(metrics.vagueCommits.percentage).toBe(0);
    });
  });

  describe('getRecommendation', () => {
    it('returns sweep for high vague percentage', () => {
      const metrics = {
        totalCommits: 10,
        conventionalCommits: { count: 3, percentage: 30 },
        descriptiveCommits: { count: 4, percentage: 40, minLength: 20 },
        vagueCommits: { count: 6, percentage: 60, threshold: 20 },
      };

      expect(getRecommendation(metrics, false)).toBe('sweep');
    });

    it('returns sweep when debug spirals present', () => {
      const metrics = {
        totalCommits: 10,
        conventionalCommits: { count: 8, percentage: 80 },
        descriptiveCommits: { count: 9, percentage: 90, minLength: 20 },
        vagueCommits: { count: 1, percentage: 10, threshold: 20 },
      };

      expect(getRecommendation(metrics, true)).toBe('sweep');
    });

    it('returns celebrate for excellent quality', () => {
      const metrics = {
        totalCommits: 10,
        conventionalCommits: { count: 9, percentage: 90 },
        descriptiveCommits: { count: 10, percentage: 100, minLength: 20 },
        vagueCommits: { count: 0, percentage: 0, threshold: 20 },
      };

      expect(getRecommendation(metrics, false)).toBe('celebrate');
    });

    it('returns maintain for acceptable quality', () => {
      const metrics = {
        totalCommits: 10,
        conventionalCommits: { count: 6, percentage: 60 },
        descriptiveCommits: { count: 7, percentage: 70, minLength: 20 },
        vagueCommits: { count: 2, percentage: 20, threshold: 20 },
      };

      expect(getRecommendation(metrics, false)).toBe('maintain');
    });
  });
});

describe('Forensics CLI Command', () => {
  it('runs without error', () => {
    const output = runCli('forensics --since "30 days ago" --format json');
    expect(() => JSON.parse(output)).not.toThrow();
  });

  it('returns expected JSON structure', () => {
    const output = runCli('forensics --since "1 month ago" --format json');
    const data = JSON.parse(output);

    expect(data).toHaveProperty('analysisPeriod');
    expect(data).toHaveProperty('totalCommits');
    expect(data).toHaveProperty('patterns');
    expect(data).toHaveProperty('qualityMetrics');
    expect(data).toHaveProperty('recommendation');

    expect(data.patterns).toHaveProperty('debugSpirals');
    expect(data.patterns).toHaveProperty('vagueCommits');
    expect(data.patterns).toHaveProperty('contextAmnesia');

    expect(data.qualityMetrics).toHaveProperty('conventionalCommits');
    expect(data.qualityMetrics).toHaveProperty('vagueCommits');
  });

  it('shows terminal output by default', () => {
    const output = runCli('forensics --since "30 days ago"');
    expect(output).toContain('Git Forensics Report');
    expect(output).toContain('Quality Metrics');
    expect(output).toContain('Patterns Detected');
    expect(output).toContain('Recommendation');
  });

  it('outputs markdown format', () => {
    const output = runCli('forensics --since "30 days ago" --format markdown');
    expect(output).toContain('# Git Forensics Report');
    expect(output).toContain('## Quality Metrics');
    expect(output).toContain('## Patterns Detected');
  });
});
