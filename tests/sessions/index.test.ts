import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import {
  loadSessionHistory,
  saveSessionHistory,
  recordSession,
  calculateBaseline,
  detectSessionBoundary,
  compareToBaseline,
  SessionHistory,
  SessionRecord,
} from '../../src/sessions';

// Mock fs module
vi.mock('fs', () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  mkdirSync: vi.fn(),
}));

describe('sessions', () => {
  const mockRepoPath = '/test/repo';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('loadSessionHistory', () => {
    it('returns empty history when file does not exist', () => {
      (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(false);

      const result = loadSessionHistory(mockRepoPath);

      expect(result.sessions).toEqual([]);
      expect(result.baseline).toBeNull();
    });

    it('returns parsed history when file exists', () => {
      const mockHistory: SessionHistory = {
        sessions: [
          {
            id: '2025-11-28T10:00',
            startedAt: '2025-11-28T10:00:00Z',
            endedAt: '2025-11-28T11:00:00Z',
            commits: 10,
            trustPassRate: 90,
            reworkRatio: 20,
            spirals: 0,
          },
        ],
        baseline: {
          trustPassRate: 85,
          reworkRatio: 25,
          avgCommits: 15,
          avgDuration: 60,
        },
        lastUpdated: '2025-11-28T12:00:00Z',
      };

      (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(true);
      (fs.readFileSync as ReturnType<typeof vi.fn>).mockReturnValue(JSON.stringify(mockHistory));

      const result = loadSessionHistory(mockRepoPath);

      expect(result.sessions).toHaveLength(1);
      expect(result.baseline).not.toBeNull();
    });

    it('returns empty history on JSON parse error', () => {
      (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(true);
      (fs.readFileSync as ReturnType<typeof vi.fn>).mockReturnValue('invalid json');

      const result = loadSessionHistory(mockRepoPath);

      expect(result.sessions).toEqual([]);
      expect(result.baseline).toBeNull();
    });
  });

  describe('saveSessionHistory', () => {
    it('creates directory if it does not exist', () => {
      (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(false);

      const history: SessionHistory = {
        sessions: [],
        baseline: null,
        lastUpdated: '',
      };

      saveSessionHistory(history, mockRepoPath);

      expect(fs.mkdirSync).toHaveBeenCalledWith(
        expect.stringContaining('.vibe-check'),
        { recursive: true }
      );
    });

    it('updates lastUpdated timestamp', () => {
      (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(true);

      const history: SessionHistory = {
        sessions: [],
        baseline: null,
        lastUpdated: '2025-11-27T10:00:00Z',
      };

      saveSessionHistory(history, mockRepoPath);

      expect(fs.writeFileSync).toHaveBeenCalled();
      const savedData = JSON.parse(
        (fs.writeFileSync as ReturnType<typeof vi.fn>).mock.calls[0][1]
      );
      expect(savedData.lastUpdated).not.toBe('2025-11-27T10:00:00Z');
    });
  });

  describe('recordSession', () => {
    it('adds new session to history', () => {
      (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(false);

      const result = recordSession(
        mockRepoPath,
        new Date('2025-11-28T10:00:00Z'),
        new Date('2025-11-28T11:00:00Z'),
        10,
        90,
        20,
        0,
        85
      );

      expect(result.sessions).toHaveLength(1);
      expect(result.sessions[0].commits).toBe(10);
      expect(result.sessions[0].trustPassRate).toBe(90);
      expect(result.sessions[0].vibeScore).toBe(85);
    });

    it('updates existing session with same ID', () => {
      const existingHistory: SessionHistory = {
        sessions: [
          {
            id: '2025-11-28T10:00',
            startedAt: '2025-11-28T10:00:00Z',
            endedAt: '2025-11-28T10:30:00Z',
            commits: 5,
            trustPassRate: 80,
            reworkRatio: 30,
            spirals: 1,
          },
        ],
        baseline: null,
        lastUpdated: '',
      };

      (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(true);
      (fs.readFileSync as ReturnType<typeof vi.fn>).mockReturnValue(JSON.stringify(existingHistory));

      const result = recordSession(
        mockRepoPath,
        new Date('2025-11-28T10:00:00Z'),
        new Date('2025-11-28T11:00:00Z'),
        10,
        90,
        20,
        0,
        85
      );

      expect(result.sessions).toHaveLength(1);
      expect(result.sessions[0].commits).toBe(10);
      expect(result.sessions[0].trustPassRate).toBe(90);
    });

    it('limits sessions to 100', () => {
      const sessions: SessionRecord[] = Array.from({ length: 100 }, (_, i) => ({
        id: `session-${i}`,
        startedAt: new Date(2025, 0, i + 1).toISOString(),
        endedAt: new Date(2025, 0, i + 1, 1).toISOString(),
        commits: 10,
        trustPassRate: 85,
        reworkRatio: 25,
        spirals: 0,
      }));

      const existingHistory: SessionHistory = {
        sessions,
        baseline: null,
        lastUpdated: '',
      };

      (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(true);
      (fs.readFileSync as ReturnType<typeof vi.fn>).mockReturnValue(JSON.stringify(existingHistory));

      const result = recordSession(
        mockRepoPath,
        new Date('2025-06-01T10:00:00Z'),
        new Date('2025-06-01T11:00:00Z'),
        15,
        92,
        18,
        0
      );

      expect(result.sessions).toHaveLength(100);
    });
  });

  describe('calculateBaseline', () => {
    it('returns null for fewer than 5 sessions', () => {
      const sessions: SessionRecord[] = [
        { id: '1', startedAt: '', endedAt: '', commits: 10, trustPassRate: 90, reworkRatio: 20, spirals: 0 },
        { id: '2', startedAt: '', endedAt: '', commits: 12, trustPassRate: 85, reworkRatio: 25, spirals: 1 },
      ];

      const result = calculateBaseline(sessions);

      expect(result).toBeNull();
    });

    it('calculates averages from last 20 sessions', () => {
      const sessions: SessionRecord[] = Array.from({ length: 10 }, (_, i) => ({
        id: `${i}`,
        startedAt: new Date(2025, 0, i + 1, 10).toISOString(),
        endedAt: new Date(2025, 0, i + 1, 11).toISOString(),
        commits: 10,
        trustPassRate: 80 + i,
        reworkRatio: 20 + i,
        spirals: 0,
      }));

      const result = calculateBaseline(sessions);

      expect(result).not.toBeNull();
      expect(result!.avgCommits).toBe(10);
      expect(result!.avgDuration).toBe(60);
    });

    it('uses only last 20 sessions for large histories', () => {
      const sessions: SessionRecord[] = Array.from({ length: 50 }, (_, i) => ({
        id: `${i}`,
        startedAt: new Date(2025, 0, i + 1, 10).toISOString(),
        endedAt: new Date(2025, 0, i + 1, 11).toISOString(),
        commits: i < 30 ? 5 : 20, // Old sessions have 5, recent have 20
        trustPassRate: 80,
        reworkRatio: 25,
        spirals: 0,
      }));

      const result = calculateBaseline(sessions);

      expect(result!.avgCommits).toBe(20); // Should use only recent sessions
    });
  });

  describe('detectSessionBoundary', () => {
    it('returns new session for empty commits', () => {
      const result = detectSessionBoundary([], mockRepoPath);

      expect(result.isNewSession).toBe(true);
    });

    it('detects session start after 2-hour gap', () => {
      const commits = [
        { date: new Date('2025-11-28T08:00:00Z') },
        { date: new Date('2025-11-28T08:30:00Z') },
        { date: new Date('2025-11-28T12:00:00Z') }, // 3.5 hour gap
        { date: new Date('2025-11-28T12:30:00Z') },
      ];

      (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(false);

      const result = detectSessionBoundary(commits, mockRepoPath);

      expect(result.sessionStart.toISOString()).toBe('2025-11-28T12:00:00.000Z');
    });

    it('uses first commit as session start when no large gaps', () => {
      const commits = [
        { date: new Date('2025-11-28T10:00:00Z') },
        { date: new Date('2025-11-28T10:30:00Z') },
        { date: new Date('2025-11-28T11:00:00Z') },
      ];

      (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(false);

      const result = detectSessionBoundary(commits, mockRepoPath);

      expect(result.sessionStart.toISOString()).toBe('2025-11-28T10:00:00.000Z');
    });
  });

  describe('compareToBaseline', () => {
    it('returns no baseline when history is empty', () => {
      (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(false);

      const result = compareToBaseline(mockRepoPath, 90, 20, 10, 60);

      expect(result.hasBaseline).toBe(false);
      expect(result.comparison).toBeNull();
    });

    it('returns above verdict for better than baseline', () => {
      const history: SessionHistory = {
        sessions: Array.from({ length: 5 }, () => ({
          id: '1',
          startedAt: new Date().toISOString(),
          endedAt: new Date().toISOString(),
          commits: 10,
          trustPassRate: 80,
          reworkRatio: 30,
          spirals: 0,
        })),
        baseline: {
          trustPassRate: 80,
          reworkRatio: 30,
          avgCommits: 10,
          avgDuration: 60,
        },
        lastUpdated: '',
      };

      (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(true);
      (fs.readFileSync as ReturnType<typeof vi.fn>).mockReturnValue(JSON.stringify(history));

      const result = compareToBaseline(mockRepoPath, 90, 25, 15, 60);

      expect(result.hasBaseline).toBe(true);
      expect(result.comparison!.verdict).toBe('above');
      expect(result.comparison!.trustDelta).toBe(10);
    });

    it('returns below verdict for worse than baseline', () => {
      const history: SessionHistory = {
        sessions: Array.from({ length: 5 }, () => ({
          id: '1',
          startedAt: new Date().toISOString(),
          endedAt: new Date().toISOString(),
          commits: 10,
          trustPassRate: 90,
          reworkRatio: 20,
          spirals: 0,
        })),
        baseline: {
          trustPassRate: 90,
          reworkRatio: 20,
          avgCommits: 10,
          avgDuration: 60,
        },
        lastUpdated: '',
      };

      (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(true);
      (fs.readFileSync as ReturnType<typeof vi.fn>).mockReturnValue(JSON.stringify(history));

      const result = compareToBaseline(mockRepoPath, 75, 35, 8, 60);

      expect(result.hasBaseline).toBe(true);
      expect(result.comparison!.verdict).toBe('below');
    });

    it('returns normal verdict for similar to baseline', () => {
      const history: SessionHistory = {
        sessions: Array.from({ length: 5 }, () => ({
          id: '1',
          startedAt: new Date().toISOString(),
          endedAt: new Date().toISOString(),
          commits: 10,
          trustPassRate: 85,
          reworkRatio: 25,
          spirals: 0,
        })),
        baseline: {
          trustPassRate: 85,
          reworkRatio: 25,
          avgCommits: 10,
          avgDuration: 60,
        },
        lastUpdated: '',
      };

      (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(true);
      (fs.readFileSync as ReturnType<typeof vi.fn>).mockReturnValue(JSON.stringify(history));

      const result = compareToBaseline(mockRepoPath, 87, 23, 11, 60);

      expect(result.hasBaseline).toBe(true);
      expect(result.comparison!.verdict).toBe('normal');
    });

    it('provides appropriate message for each verdict', () => {
      const history: SessionHistory = {
        sessions: Array.from({ length: 5 }, () => ({
          id: '1',
          startedAt: new Date().toISOString(),
          endedAt: new Date().toISOString(),
          commits: 10,
          trustPassRate: 80,
          reworkRatio: 25,
          spirals: 0,
        })),
        baseline: {
          trustPassRate: 80,
          reworkRatio: 25,
          avgCommits: 10,
          avgDuration: 60,
        },
        lastUpdated: '',
      };

      (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(true);
      (fs.readFileSync as ReturnType<typeof vi.fn>).mockReturnValue(JSON.stringify(history));

      // Test above
      const above = compareToBaseline(mockRepoPath, 90, 20, 10, 60);
      expect(above.comparison!.message).toContain('nice flow');

      // Test normal
      const normal = compareToBaseline(mockRepoPath, 82, 27, 10, 60);
      expect(normal.comparison!.message).toContain('Typical');
    });

    it('calculates correct deltas', () => {
      const history: SessionHistory = {
        sessions: Array.from({ length: 5 }, () => ({
          id: '1',
          startedAt: new Date().toISOString(),
          endedAt: new Date().toISOString(),
          commits: 10,
          trustPassRate: 80,
          reworkRatio: 30,
          spirals: 0,
        })),
        baseline: {
          trustPassRate: 80,
          reworkRatio: 30,
          avgCommits: 10,
          avgDuration: 60,
        },
        lastUpdated: '',
      };

      (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(true);
      (fs.readFileSync as ReturnType<typeof vi.fn>).mockReturnValue(JSON.stringify(history));

      const result = compareToBaseline(mockRepoPath, 90, 25, 15, 90);

      expect(result.comparison!.trustDelta).toBe(10);
      expect(result.comparison!.reworkDelta).toBe(-5);
    });
  });
});
