import { describe, it, expect } from 'vitest';
import { detectDetour } from '../src/patterns/detour';
import { detectLateNightSpiral } from '../src/patterns/late-night';
import { TimelineEvent, TimelineSession, FixChain } from '../src/types';

/**
 * Unit tests for Phase 3 pattern detection
 */

describe('detectDetour', () => {
  it('detects code added then deleted in same scope', () => {
    const events: TimelineEvent[] = [
      makeEvent('abc123', new Date('2024-01-01T10:00:00'), 'feat', 'ml'),
      makeEvent('def456', new Date('2024-01-01T12:00:00'), 'feat', 'ml'),
      makeEvent('ghi789', new Date('2024-01-01T14:00:00'), 'refactor', 'ml'),
    ];

    const filesPerCommit = new Map([
      ['abc123', ['src/ml/model.ts']],
      ['def456', ['src/ml/train.ts']],
      ['ghi789', ['src/ml/model.ts', 'src/ml/train.ts']],
    ]);

    const lineStatsPerCommit = new Map([
      ['abc123', { additions: 100, deletions: 0 }],
      ['def456', { additions: 150, deletions: 10 }],
      ['ghi789', { additions: 20, deletions: 200 }], // Big delete
    ]);

    const result = detectDetour(events, filesPerCommit, lineStatsPerCommit);

    expect(result.detected).toBe(true);
    expect(result.detours.length).toBeGreaterThan(0);
    expect(result.detours[0].scope).toBe('ml');
  });

  it('returns no detours when deletions are small', () => {
    const events: TimelineEvent[] = [
      makeEvent('abc123', new Date('2024-01-01T10:00:00'), 'feat', 'api'),
      makeEvent('def456', new Date('2024-01-01T11:00:00'), 'feat', 'api'),
    ];

    const filesPerCommit = new Map([
      ['abc123', ['src/api/routes.ts']],
      ['def456', ['src/api/handlers.ts']],
    ]);

    const lineStatsPerCommit = new Map([
      ['abc123', { additions: 100, deletions: 10 }],
      ['def456', { additions: 80, deletions: 5 }],
    ]);

    const result = detectDetour(events, filesPerCommit, lineStatsPerCommit);

    expect(result.detected).toBe(false);
    expect(result.detours.length).toBe(0);
  });

  it('calculates time lost correctly', () => {
    const events: TimelineEvent[] = [
      makeEvent('abc123', new Date('2024-01-01T10:00:00'), 'feat', 'experiment'),
      makeEvent('def456', new Date('2024-01-01T12:30:00'), 'refactor', 'experiment'),
    ];

    const filesPerCommit = new Map([
      ['abc123', ['src/experiment/index.ts']],
      ['def456', ['src/experiment/index.ts']],
    ]);

    const lineStatsPerCommit = new Map([
      ['abc123', { additions: 200, deletions: 0 }],
      ['def456', { additions: 0, deletions: 180 }],
    ]);

    const result = detectDetour(events, filesPerCommit, lineStatsPerCommit);

    expect(result.detected).toBe(true);
    expect(result.totalTimeLost).toBe(150); // 2.5 hours
  });
});

describe('detectLateNightSpiral', () => {
  it('detects debug spiral after 22:00', () => {
    const lateNightSession = makeSession(
      'session-1',
      new Date('2024-01-01T23:00:00'),
      new Date('2024-01-02T00:30:00'),
      90,
      [
        makeEvent('a', new Date('2024-01-01T23:00:00'), 'fix', 'auth'),
        makeEvent('b', new Date('2024-01-01T23:20:00'), 'fix', 'auth'),
        makeEvent('c', new Date('2024-01-01T23:45:00'), 'fix', 'auth'),
        makeEvent('d', new Date('2024-01-02T00:15:00'), 'fix', 'auth'),
      ],
      [{
        component: 'auth',
        commits: 4,
        duration: 75,
        isSpiral: true,
        pattern: null,
        firstCommit: new Date('2024-01-01T23:00:00'),
        lastCommit: new Date('2024-01-02T00:15:00'),
      }]
    );

    const result = detectLateNightSpiral([lateNightSession]);

    expect(result.detected).toBe(true);
    expect(result.spirals.length).toBe(1);
    expect(result.spirals[0].component).toBe('auth');
    expect(result.spirals[0].fixCount).toBe(4);
  });

  it('ignores daytime debug sessions', () => {
    const daytimeSession = makeSession(
      'session-1',
      new Date('2024-01-01T14:00:00'),
      new Date('2024-01-01T15:30:00'),
      90,
      [
        makeEvent('a', new Date('2024-01-01T14:00:00'), 'fix', 'auth'),
        makeEvent('b', new Date('2024-01-01T14:20:00'), 'fix', 'auth'),
        makeEvent('c', new Date('2024-01-01T14:45:00'), 'fix', 'auth'),
      ],
      [{
        component: 'auth',
        commits: 3,
        duration: 45,
        isSpiral: true,
        pattern: null,
        firstCommit: new Date('2024-01-01T14:00:00'),
        lastCommit: new Date('2024-01-01T14:45:00'),
      }]
    );

    const result = detectLateNightSpiral([daytimeSession]);

    expect(result.detected).toBe(false);
  });

  it('detects early morning spirals (before 6am)', () => {
    const earlyMorningSession = makeSession(
      'session-1',
      new Date('2024-01-01T03:00:00'),
      new Date('2024-01-01T04:30:00'),
      90,
      [
        makeEvent('a', new Date('2024-01-01T03:00:00'), 'fix', 'db'),
        makeEvent('b', new Date('2024-01-01T03:30:00'), 'fix', 'db'),
        makeEvent('c', new Date('2024-01-01T04:00:00'), 'fix', 'db'),
      ],
      [{
        component: 'db',
        commits: 3,
        duration: 60,
        isSpiral: true,
        pattern: null,
        firstCommit: new Date('2024-01-01T03:00:00'),
        lastCommit: new Date('2024-01-01T04:00:00'),
      }]
    );

    const result = detectLateNightSpiral([earlyMorningSession]);

    expect(result.detected).toBe(true);
  });

  it('generates helpful message', () => {
    const lateSession = makeSession(
      'session-1',
      new Date('2024-01-01T22:30:00'),
      new Date('2024-01-01T23:45:00'),
      75,
      [
        makeEvent('a', new Date('2024-01-01T22:30:00'), 'fix', 'api'),
        makeEvent('b', new Date('2024-01-01T22:50:00'), 'fix', 'api'),
        makeEvent('c', new Date('2024-01-01T23:15:00'), 'fix', 'api'),
        makeEvent('d', new Date('2024-01-01T23:40:00'), 'fix', 'api'),
      ],
      [{
        component: 'api',
        commits: 4,
        duration: 70,
        isSpiral: true,
        pattern: null,
        firstCommit: new Date('2024-01-01T22:30:00'),
        lastCommit: new Date('2024-01-01T23:40:00'),
      }]
    );

    const result = detectLateNightSpiral([lateSession]);

    expect(result.message).toContain('late-night');
    expect(result.message).toContain('10pm');
  });
});

// Helper functions

function makeEvent(
  hash: string,
  timestamp: Date,
  type: TimelineEvent['type'],
  scope: string | null
): TimelineEvent {
  return {
    hash,
    timestamp,
    author: 'Test User',
    subject: `${type}: test commit`,
    type,
    scope,
    sessionId: 'session-0',
    sessionPosition: 0,
    gapMinutes: 0,
    isRefactor: type === 'refactor',
    spiralDepth: 0,
  };
}

function makeSession(
  id: string,
  start: Date,
  end: Date,
  duration: number,
  commits: TimelineEvent[],
  spirals: FixChain[] = []
): TimelineSession {
  return {
    id,
    start,
    end,
    duration,
    commits,
    vibeScore: null,
    overall: 'MEDIUM',
    trustPassRate: 70,
    reworkRatio: 30,
    flowState: false,
    spirals,
    xpEarned: 20,
  };
}
