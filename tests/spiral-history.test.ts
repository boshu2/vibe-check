import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// Mock the home directory to use a temp folder
const TEST_HOME = path.join(os.tmpdir(), 'vibe-check-test-' + Date.now());
vi.mock('os', async () => {
  const actual = await vi.importActual('os');
  return {
    ...actual,
    homedir: () => TEST_HOME,
  };
});

// Import after mock setup
import {
  appendSpiral,
  resolveSpiral,
  readSpiralHistory,
  getAdvice,
  getPatternStats,
  getSpiralHistoryPath,
  getPatternDisplayName,
  getResolutionDisplayName,
} from '../src/storage/spiral-history.js';

describe('spiral-history', () => {
  beforeEach(() => {
    // Ensure clean test directory
    if (fs.existsSync(TEST_HOME)) {
      fs.rmSync(TEST_HOME, { recursive: true });
    }
    fs.mkdirSync(TEST_HOME, { recursive: true });
  });

  afterEach(() => {
    // Cleanup test directory
    if (fs.existsSync(TEST_HOME)) {
      fs.rmSync(TEST_HOME, { recursive: true });
    }
  });

  describe('getSpiralHistoryPath', () => {
    it('returns path in home directory', () => {
      const historyPath = getSpiralHistoryPath();
      expect(historyPath).toContain('.vibe-check');
      expect(historyPath).toContain('spiral-history.ndjson');
    });
  });

  describe('appendSpiral', () => {
    it('creates file and appends spiral record', () => {
      appendSpiral('SECRETS_AUTH', 'auth', 15, 4);

      const records = readSpiralHistory();
      expect(records).toHaveLength(1);
      expect(records[0].pattern).toBe('SECRETS_AUTH');
      expect(records[0].component).toBe('auth');
      expect(records[0].duration).toBe(15);
      expect(records[0].commits).toBe(4);
      expect(records[0].date).toBeDefined();
    });

    it('appends multiple spirals', () => {
      appendSpiral('SECRETS_AUTH', 'auth', 15, 4);
      appendSpiral('VOLUME_CONFIG', 'storage', 20, 5);
      appendSpiral('API_MISMATCH', 'api', 10, 3);

      const records = readSpiralHistory();
      expect(records).toHaveLength(3);
      expect(records[0].pattern).toBe('SECRETS_AUTH');
      expect(records[1].pattern).toBe('VOLUME_CONFIG');
      expect(records[2].pattern).toBe('API_MISMATCH');
    });
  });

  describe('resolveSpiral', () => {
    it('resolves most recent unresolved spiral', () => {
      appendSpiral('SECRETS_AUTH', 'auth', 15, 4);

      const resolved = resolveSpiral('TEST');
      expect(resolved).toBe(true);

      const records = readSpiralHistory();
      expect(records[0].resolution).toBe('TEST');
      expect(records[0].resolvedAt).toBeDefined();
    });

    it('returns false when no unresolved spiral', () => {
      appendSpiral('SECRETS_AUTH', 'auth', 15, 4);
      resolveSpiral('TEST');

      const resolved = resolveSpiral('BREAK');
      expect(resolved).toBe(false);
    });

    it('only resolves the most recent unresolved', () => {
      appendSpiral('SECRETS_AUTH', 'auth', 15, 4);
      resolveSpiral('TEST');
      appendSpiral('VOLUME_CONFIG', 'storage', 20, 5);

      resolveSpiral('DOCS');

      const records = readSpiralHistory();
      expect(records[0].resolution).toBe('TEST');
      expect(records[1].resolution).toBe('DOCS');
    });
  });

  describe('getAdvice', () => {
    it('returns null for unknown pattern', () => {
      const advice = getAdvice('UNKNOWN_PATTERN');
      expect(advice).toBeNull();
    });

    it('returns history stats for known pattern', () => {
      appendSpiral('SECRETS_AUTH', 'auth', 15, 4);
      appendSpiral('SECRETS_AUTH', 'oauth', 20, 5);
      appendSpiral('SECRETS_AUTH', 'auth', 10, 3);

      const advice = getAdvice('SECRETS_AUTH');
      expect(advice).not.toBeNull();
      expect(advice!.yourHistory.times).toBe(3);
      expect(advice!.yourHistory.avgDuration).toBe(15); // (15+20+10)/3 = 15
      expect(advice!.yourHistory.totalMinutes).toBe(45);
    });

    it('filters by component when specified', () => {
      appendSpiral('SECRETS_AUTH', 'auth', 15, 4);
      appendSpiral('SECRETS_AUTH', 'oauth', 20, 5);

      const advice = getAdvice('SECRETS_AUTH', 'auth');
      expect(advice!.yourHistory.times).toBe(1);
      expect(advice!.yourHistory.avgDuration).toBe(15);
    });

    it('shows what worked (resolutions)', () => {
      appendSpiral('SECRETS_AUTH', 'auth', 15, 4);
      resolveSpiral('TEST');
      appendSpiral('SECRETS_AUTH', 'auth', 20, 5);
      resolveSpiral('TEST');
      appendSpiral('SECRETS_AUTH', 'auth', 10, 3);
      resolveSpiral('BREAK');

      const advice = getAdvice('SECRETS_AUTH');
      expect(advice!.whatWorked).toHaveLength(2);

      // Sorted by frequency - TEST appears 2x, BREAK 1x
      expect(advice!.whatWorked[0].resolution).toBe('TEST');
      expect(advice!.whatWorked[0].times).toBe(2);
      expect(advice!.whatWorked[1].resolution).toBe('BREAK');
      expect(advice!.whatWorked[1].times).toBe(1);
    });

    it('generates personalized suggestion', () => {
      appendSpiral('SECRETS_AUTH', 'auth', 15, 4);
      resolveSpiral('TEST');
      appendSpiral('SECRETS_AUTH', 'auth', 20, 5);
      resolveSpiral('TEST');

      const advice = getAdvice('SECRETS_AUTH');
      expect(advice!.suggestion).toContain('writing a test');
      expect(advice!.suggestion).toContain('2x');
    });
  });

  describe('getPatternStats', () => {
    it('returns empty array when no history', () => {
      const stats = getPatternStats();
      expect(stats).toHaveLength(0);
    });

    it('groups spirals by pattern', () => {
      appendSpiral('SECRETS_AUTH', 'auth', 15, 4);
      appendSpiral('SECRETS_AUTH', 'oauth', 20, 5);
      appendSpiral('VOLUME_CONFIG', 'storage', 25, 3);

      const stats = getPatternStats();
      expect(stats).toHaveLength(2);

      // Sorted by frequency
      expect(stats[0].pattern).toBe('SECRETS_AUTH');
      expect(stats[0].times).toBe(2);
      expect(stats[1].pattern).toBe('VOLUME_CONFIG');
      expect(stats[1].times).toBe(1);
    });

    it('calculates average duration', () => {
      appendSpiral('SECRETS_AUTH', 'auth', 10, 3);
      appendSpiral('SECRETS_AUTH', 'auth', 20, 4);

      const stats = getPatternStats();
      expect(stats[0].avgDuration).toBe(15);
    });

    it('finds best fix for pattern', () => {
      appendSpiral('SECRETS_AUTH', 'auth', 15, 4);
      resolveSpiral('TEST');
      appendSpiral('SECRETS_AUTH', 'auth', 20, 5);
      resolveSpiral('TEST');
      appendSpiral('SECRETS_AUTH', 'auth', 10, 3);
      resolveSpiral('BREAK');

      const stats = getPatternStats();
      expect(stats[0].bestFix).toBe('TEST');
    });

    it('collects affected components', () => {
      appendSpiral('SECRETS_AUTH', 'auth', 15, 4);
      appendSpiral('SECRETS_AUTH', 'oauth', 20, 5);
      appendSpiral('SECRETS_AUTH', 'auth', 10, 3);

      const stats = getPatternStats();
      expect(stats[0].components).toContain('auth');
      expect(stats[0].components).toContain('oauth');
      expect(stats[0].components).toHaveLength(2);
    });

    it('respects days parameter', () => {
      // Add old spiral (mock by manipulating file directly)
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 60);

      const historyPath = getSpiralHistoryPath();
      fs.mkdirSync(path.dirname(historyPath), { recursive: true });
      fs.appendFileSync(
        historyPath,
        JSON.stringify({
          date: oldDate.toISOString(),
          pattern: 'OLD_PATTERN',
          component: 'old',
          duration: 100,
          commits: 10,
        }) + '\n'
      );

      // Add recent spiral
      appendSpiral('RECENT_PATTERN', 'new', 15, 3);

      const stats30 = getPatternStats(30);
      expect(stats30).toHaveLength(1);
      expect(stats30[0].pattern).toBe('RECENT_PATTERN');

      const stats90 = getPatternStats(90);
      expect(stats90).toHaveLength(2);
    });
  });

  describe('display name helpers', () => {
    it('returns friendly pattern names', () => {
      expect(getPatternDisplayName('SECRETS_AUTH')).toBe('OAuth/Token Issues');
      expect(getPatternDisplayName('VOLUME_CONFIG')).toBe('Volume/Mount Issues');
      expect(getPatternDisplayName('UNKNOWN')).toBe('UNKNOWN');
    });

    it('returns friendly resolution names', () => {
      expect(getResolutionDisplayName('TEST')).toBe('Wrote a test');
      expect(getResolutionDisplayName('BREAK')).toBe('Took a break');
      expect(getResolutionDisplayName('DOCS')).toBe('Read the docs');
    });
  });
});
