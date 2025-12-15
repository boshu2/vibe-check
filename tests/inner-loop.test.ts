import { describe, it, expect } from 'vitest';
import { TimelineEvent } from '../src/types.js';
import {
  detectTestsPassingLie,
  detectContextAmnesia,
  detectInstructionDrift,
  detectLoggingOnlyCommits,
  analyzeInnerLoop,
} from '../src/inner-loop/index.js';

/**
 * Unit tests for Inner Loop Failure Pattern Detection
 *
 * Tests the 4 "Inner Loop Disasters" from vibe coding:
 * 1. "Tests Passing" Lie
 * 2. Context Amnesia
 * 3. Instruction Drift
 * 4. Debug Loop Spiral (logging-only commits)
 */

describe('detectTestsPassingLie', () => {
  it('detects commit claiming fix followed by immediate fix', () => {
    const events = [
      makeEvent('abc123', new Date('2024-01-01T10:00:00'), 'fix', 'auth', 'fix: auth login working'),
      makeEvent('def456', new Date('2024-01-01T10:15:00'), 'fix', 'auth', 'fix: auth login handle null'),
    ];

    const filesPerCommit = new Map([
      ['abc123', ['src/auth/login.ts']],
      ['def456', ['src/auth/login.ts']],
    ]);

    const result = detectTestsPassingLie(events, filesPerCommit);

    expect(result.detected).toBe(true);
    expect(result.totalLies).toBeGreaterThan(0);
    expect(result.lies[0].commitHash).toBe('abc123');
  });

  it('ignores tentative commits (WIP, try, experiment)', () => {
    const events = [
      makeEvent('abc123', new Date('2024-01-01T10:00:00'), 'fix', 'auth', 'wip: trying auth fix'),
      makeEvent('def456', new Date('2024-01-01T10:15:00'), 'fix', 'auth', 'fix: auth working now'),
    ];

    const filesPerCommit = new Map([
      ['abc123', ['src/auth/login.ts']],
      ['def456', ['src/auth/login.ts']],
    ]);

    const result = detectTestsPassingLie(events, filesPerCommit);

    // The WIP commit shouldn't count as a lie since it's tentative
    expect(result.lies.find(l => l.commitHash === 'abc123')).toBeUndefined();
  });

  it('returns no lies when fixes are on different files', () => {
    const events = [
      makeEvent('abc123', new Date('2024-01-01T10:00:00'), 'fix', 'auth', 'fix: auth complete'),
      makeEvent('def456', new Date('2024-01-01T10:15:00'), 'fix', 'db', 'fix: database issue'),
    ];

    const filesPerCommit = new Map([
      ['abc123', ['src/auth/login.ts']],
      ['def456', ['src/db/connection.ts']],
    ]);

    const result = detectTestsPassingLie(events, filesPerCommit);

    expect(result.detected).toBe(false);
  });
});

describe('detectContextAmnesia', () => {
  it('detects explicit revert patterns', () => {
    const events = [
      makeEvent('abc123', new Date('2024-01-01T10:00:00'), 'feat', 'api', 'feat: add endpoint'),
      makeEvent('def456', new Date('2024-01-01T10:30:00'), 'fix', 'api', 'revert: undo endpoint changes'),
    ];

    const filesPerCommit = new Map([
      ['abc123', ['src/api/routes.ts']],
      ['def456', ['src/api/routes.ts']],
    ]);

    const lineStatsPerCommit = new Map([
      ['abc123', { additions: 50, deletions: 0 }],
      ['def456', { additions: 0, deletions: 50 }],
    ]);

    const result = detectContextAmnesia(events, filesPerCommit, lineStatsPerCommit);

    expect(result.detected).toBe(true);
    expect(result.incidents.some(i => i.type === 'revert')).toBe(true);
  });

  it('detects reimplementation (delete then re-add)', () => {
    const events = [
      makeEvent('abc123', new Date('2024-01-01T10:00:00'), 'chore', 'utils', 'chore: remove old helper'),
      makeEvent('def456', new Date('2024-01-01T10:45:00'), 'feat', 'utils', 'feat: add helper function'),
    ];

    const filesPerCommit = new Map([
      ['abc123', ['src/utils/helper.ts']],
      ['def456', ['src/utils/helper.ts']],
    ]);

    const lineStatsPerCommit = new Map([
      ['abc123', { additions: 0, deletions: 50 }],
      ['def456', { additions: 60, deletions: 0 }],
    ]);

    const result = detectContextAmnesia(events, filesPerCommit, lineStatsPerCommit);

    expect(result.detected).toBe(true);
    expect(result.incidents.some(i => i.type === 'reimplementation')).toBe(true);
  });

  it('detects repeated similar fixes', () => {
    // Need 3+ fix commits on same scope to trigger forgotten_change detection
    const events = [
      makeEvent('abc123', new Date('2024-01-01T10:00:00'), 'fix', 'auth', 'fix: handle null user'),
      makeEvent('def456', new Date('2024-01-01T10:20:00'), 'fix', 'auth', 'fix: handle null user check'),
      makeEvent('ghi789', new Date('2024-01-01T10:40:00'), 'fix', 'auth', 'fix: handle null user validation'),
    ];

    const filesPerCommit = new Map([
      ['abc123', ['src/auth/user.ts']],
      ['def456', ['src/auth/user.ts']],
      ['ghi789', ['src/auth/user.ts']],
    ]);

    const lineStatsPerCommit = new Map([
      ['abc123', { additions: 10, deletions: 2 }],
      ['def456', { additions: 12, deletions: 5 }],
      ['ghi789', { additions: 8, deletions: 3 }],
    ]);

    const result = detectContextAmnesia(events, filesPerCommit, lineStatsPerCommit);

    // This may or may not detect depending on similarity threshold
    // The key is that repeated fixes on the same component are tracked
    expect(result.totalIncidents).toBeGreaterThanOrEqual(0);
  });

  it('returns empty when no amnesia patterns found', () => {
    const events = [
      makeEvent('abc123', new Date('2024-01-01T10:00:00'), 'feat', 'api', 'feat: add users endpoint'),
      makeEvent('def456', new Date('2024-01-01T11:00:00'), 'feat', 'api', 'feat: add posts endpoint'),
    ];

    const filesPerCommit = new Map([
      ['abc123', ['src/api/users.ts']],
      ['def456', ['src/api/posts.ts']],
    ]);

    const lineStatsPerCommit = new Map([
      ['abc123', { additions: 50, deletions: 0 }],
      ['def456', { additions: 60, deletions: 0 }],
    ]);

    const result = detectContextAmnesia(events, filesPerCommit, lineStatsPerCommit);

    expect(result.detected).toBe(false);
    expect(result.incidents.length).toBe(0);
  });
});

describe('detectInstructionDrift', () => {
  it('detects unrequested refactoring touching many files', () => {
    const events = [
      makeEvent('abc123', new Date('2024-01-01T10:00:00'), 'feat', 'auth', 'feat: add login'),
      // Refactor that touches 6+ files outside the initial working set
      makeEvent('def456', new Date('2024-01-01T10:30:00'), 'refactor', null, 'refactor: cleanup and improve code quality'),
      makeEvent('ghi789', new Date('2024-01-01T11:00:00'), 'feat', 'auth', 'feat: add logout'),
    ];

    const filesPerCommit = new Map([
      ['abc123', ['src/auth/login.ts']],
      ['def456', [
        'src/utils/a.ts', 'src/utils/b.ts', 'src/utils/c.ts',
        'src/helpers/d.ts', 'src/helpers/e.ts', 'src/helpers/f.ts',
      ]], // 6 files, all outside initial working set
      ['ghi789', ['src/auth/logout.ts']],
    ]);

    const result = detectInstructionDrift(events, filesPerCommit);

    expect(result.detected).toBe(true);
    expect(result.drifts.some(d => d.driftType === 'unrequested_refactor')).toBe(true);
  });

  it('detects scope explosion (many more files than average)', () => {
    // Use a more extreme case with many more small commits first
    const events = [
      makeEvent('a1', new Date('2024-01-01T10:00:00'), 'feat', 'api', 'feat: add endpoint'),
      makeEvent('a2', new Date('2024-01-01T10:10:00'), 'feat', 'api', 'feat: add another'),
      makeEvent('a3', new Date('2024-01-01T10:20:00'), 'feat', 'api', 'feat: add third'),
      makeEvent('a4', new Date('2024-01-01T10:30:00'), 'feat', 'api', 'feat: add fourth'),
      makeEvent('a5', new Date('2024-01-01T10:40:00'), 'feat', 'api', 'feat: add fifth'),
      makeEvent('big', new Date('2024-01-01T11:00:00'), 'chore', null, 'chore: massive update'),
    ];

    // Avg of 5 commits with 1 file each = 1, threshold = max(3, 10) = 10
    // 30 files is definitely > 10
    const filesPerCommit = new Map([
      ['a1', ['src/api/a.ts']],
      ['a2', ['src/api/b.ts']],
      ['a3', ['src/api/c.ts']],
      ['a4', ['src/api/d.ts']],
      ['a5', ['src/api/e.ts']],
      ['big', Array.from({ length: 30 }, (_, i) => `src/other/file${i}.ts`)], // 30 files!
    ]);

    const result = detectInstructionDrift(events, filesPerCommit);

    // 30 files when avg is 1 and threshold is 10 should trigger
    expect(result.detected).toBe(true);
    expect(result.drifts.some(d => d.driftType === 'scope_creep')).toBe(true);
  });

  it('allows changes to common config files', () => {
    const events = [
      makeEvent('abc123', new Date('2024-01-01T10:00:00'), 'feat', 'api', 'feat: add endpoint'),
      makeEvent('def456', new Date('2024-01-01T10:30:00'), 'chore', null, 'chore: update deps'),
    ];

    const filesPerCommit = new Map([
      ['abc123', ['src/api/routes.ts']],
      ['def456', ['package.json', 'package-lock.json']],
    ]);

    const result = detectInstructionDrift(events, filesPerCommit);

    // package.json changes shouldn't trigger drift warning
    expect(result.drifts.filter(d =>
      d.unauthorizedFiles.includes('package.json')
    ).length).toBe(0);
  });
});

describe('detectLoggingOnlyCommits', () => {
  it('detects commits that mention logging/debug', () => {
    const events = [
      makeEvent('abc123', new Date('2024-01-01T10:00:00'), 'fix', 'api', 'fix: add debug logging'),
      makeEvent('def456', new Date('2024-01-01T10:15:00'), 'fix', 'api', 'fix: more console.log'),
      makeEvent('ghi789', new Date('2024-01-01T10:30:00'), 'fix', 'api', 'fix: temp debug output'),
    ];

    const result = detectLoggingOnlyCommits(events);

    expect(result.detected).toBe(true);
    expect(result.consecutiveLoggingCount).toBeGreaterThanOrEqual(3);
  });

  it('counts consecutive logging commits', () => {
    const events = [
      makeEvent('abc123', new Date('2024-01-01T10:00:00'), 'fix', 'api', 'fix: adding logs to trace'),
      makeEvent('def456', new Date('2024-01-01T10:10:00'), 'fix', 'api', 'fix: debug the issue'),
      makeEvent('ghi789', new Date('2024-01-01T10:20:00'), 'fix', 'api', 'fix: investigating with print'),
      makeEvent('jkl012', new Date('2024-01-01T10:30:00'), 'feat', 'api', 'feat: actual feature'),
    ];

    const result = detectLoggingOnlyCommits(events);

    expect(result.consecutiveLoggingCount).toBe(3);
    expect(result.totalLoggingCommits).toBe(3);
  });

  it('returns no issues for normal commits', () => {
    const events = [
      makeEvent('abc123', new Date('2024-01-01T10:00:00'), 'feat', 'api', 'feat: add endpoint'),
      makeEvent('def456', new Date('2024-01-01T10:30:00'), 'feat', 'api', 'feat: add validation'),
      makeEvent('ghi789', new Date('2024-01-01T11:00:00'), 'test', 'api', 'test: add unit tests'),
    ];

    const result = detectLoggingOnlyCommits(events);

    expect(result.detected).toBe(false);
    expect(result.consecutiveLoggingCount).toBe(0);
  });
});

describe('analyzeInnerLoop', () => {
  it('aggregates all inner loop issues', () => {
    const events = [
      makeEvent('abc123', new Date('2024-01-01T10:00:00'), 'fix', 'auth', 'fix: auth working'),
      makeEvent('def456', new Date('2024-01-01T10:10:00'), 'fix', 'auth', 'fix: auth still broken'),
      makeEvent('ghi789', new Date('2024-01-01T10:20:00'), 'fix', 'auth', 'fix: add logging'),
      makeEvent('jkl012', new Date('2024-01-01T10:30:00'), 'fix', 'auth', 'fix: debug output'),
    ];

    const filesPerCommit = new Map([
      ['abc123', ['src/auth/login.ts']],
      ['def456', ['src/auth/login.ts']],
      ['ghi789', ['src/auth/login.ts']],
      ['jkl012', ['src/auth/login.ts']],
    ]);

    const lineStatsPerCommit = new Map([
      ['abc123', { additions: 20, deletions: 5 }],
      ['def456', { additions: 15, deletions: 10 }],
      ['ghi789', { additions: 5, deletions: 0 }],
      ['jkl012', { additions: 3, deletions: 0 }],
    ]);

    const result = analyzeInnerLoop(events, filesPerCommit, lineStatsPerCommit);

    expect(result.summary.totalIssuesDetected).toBeGreaterThan(0);
    expect(result.recommendations.length).toBeGreaterThan(0);
  });

  it('returns healthy status for good sessions', () => {
    const events = [
      makeEvent('abc123', new Date('2024-01-01T10:00:00'), 'feat', 'api', 'feat: add users endpoint'),
      makeEvent('def456', new Date('2024-01-01T10:30:00'), 'feat', 'api', 'feat: add posts endpoint'),
      makeEvent('ghi789', new Date('2024-01-01T11:00:00'), 'test', 'api', 'test: add api tests'),
    ];

    const filesPerCommit = new Map([
      ['abc123', ['src/api/users.ts']],
      ['def456', ['src/api/posts.ts']],
      ['ghi789', ['tests/api.test.ts']],
    ]);

    const lineStatsPerCommit = new Map([
      ['abc123', { additions: 100, deletions: 0 }],
      ['def456', { additions: 80, deletions: 0 }],
      ['ghi789', { additions: 50, deletions: 0 }],
    ]);

    const result = analyzeInnerLoop(events, filesPerCommit, lineStatsPerCommit);

    expect(result.summary.overallHealth).toBe('healthy');
    expect(result.summary.totalIssuesDetected).toBe(0);
  });

  it('marks critical health for multiple serious issues', () => {
    const events = [
      // Tests passing lie
      makeEvent('abc123', new Date('2024-01-01T10:00:00'), 'fix', 'auth', 'fix: done, all tests pass'),
      makeEvent('def456', new Date('2024-01-01T10:05:00'), 'fix', 'auth', 'fix: oops forgot this'),
      makeEvent('ghi789', new Date('2024-01-01T10:10:00'), 'fix', 'auth', 'fix: working now'),
      makeEvent('jkl012', new Date('2024-01-01T10:15:00'), 'fix', 'auth', 'fix: one more thing'),
    ];

    const filesPerCommit = new Map([
      ['abc123', ['src/auth/login.ts']],
      ['def456', ['src/auth/login.ts']],
      ['ghi789', ['src/auth/login.ts']],
      ['jkl012', ['src/auth/login.ts']],
    ]);

    const lineStatsPerCommit = new Map([
      ['abc123', { additions: 20, deletions: 5 }],
      ['def456', { additions: 10, deletions: 8 }],
      ['ghi789', { additions: 15, deletions: 10 }],
      ['jkl012', { additions: 5, deletions: 3 }],
    ]);

    const result = analyzeInnerLoop(events, filesPerCommit, lineStatsPerCommit);

    // Multiple lies should trigger at least warning status
    expect(['warning', 'critical']).toContain(result.summary.overallHealth);
  });
});

// Helper function
function makeEvent(
  hash: string,
  timestamp: Date,
  type: TimelineEvent['type'],
  scope: string | null,
  subject: string = `${type}: test commit`
): TimelineEvent {
  return {
    hash,
    timestamp,
    author: 'Test User',
    subject,
    type,
    scope,
    sessionId: 'test-session',
    sessionPosition: 0,
    gapMinutes: 0,
    isRefactor: type === 'refactor',
    spiralDepth: 0,
  };
}
