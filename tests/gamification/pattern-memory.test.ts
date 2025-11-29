import { describe, it, expect } from 'vitest';
import {
  createInitialPatternMemory,
  updatePatternMemory,
  formatPatternMemory,
  getPatternDisplayName,
  getPatternAdvice,
} from '../../src/gamification/pattern-memory';
import { FixChain } from '../../src/types';

describe('Pattern Memory', () => {
  describe('createInitialPatternMemory', () => {
    it('creates empty pattern memory', () => {
      const memory = createInitialPatternMemory();

      expect(memory.version).toBe('1.0.0');
      expect(memory.records).toEqual([]);
      expect(memory.patternCounts).toEqual({});
      expect(memory.componentCounts).toEqual({});
      expect(memory.patternDurations).toEqual({});
      expect(memory.topPatterns).toEqual([]);
      expect(memory.topComponents).toEqual([]);
      expect(memory.avgRecoveryTime).toBe(0);
      expect(memory.totalSpirals).toBe(0);
    });
  });

  describe('updatePatternMemory', () => {
    it('returns unchanged memory when no fix chains provided', () => {
      const memory = createInitialPatternMemory();
      const updated = updatePatternMemory(memory, []);

      expect(updated.records.length).toBe(0);
      expect(updated.totalSpirals).toBe(0);
    });

    it('ignores non-spiral fix chains', () => {
      const memory = createInitialPatternMemory();
      const chains: FixChain[] = [
        {
          component: 'auth',
          commits: 2, // Only 2 - not a spiral
          duration: 10,
          isSpiral: false,
          pattern: 'SECRETS_AUTH',
          firstCommit: new Date(),
          lastCommit: new Date(),
        },
      ];

      const updated = updatePatternMemory(memory, chains);
      expect(updated.records.length).toBe(0);
    });

    it('adds spiral records and computes aggregates', () => {
      const memory = createInitialPatternMemory();
      const chains: FixChain[] = [
        {
          component: 'auth',
          commits: 4,
          duration: 30,
          isSpiral: true,
          pattern: 'SECRETS_AUTH',
          firstCommit: new Date(),
          lastCommit: new Date(),
        },
        {
          component: 'api',
          commits: 3,
          duration: 20,
          isSpiral: true,
          pattern: 'API_MISMATCH',
          firstCommit: new Date(),
          lastCommit: new Date(),
        },
      ];

      const updated = updatePatternMemory(memory, chains);

      expect(updated.records.length).toBe(2);
      expect(updated.totalSpirals).toBe(2);
      expect(updated.patternCounts['SECRETS_AUTH']).toBe(1);
      expect(updated.patternCounts['API_MISMATCH']).toBe(1);
      expect(updated.componentCounts['auth']).toBe(1);
      expect(updated.componentCounts['api']).toBe(1);
      expect(updated.avgRecoveryTime).toBe(25); // (30 + 20) / 2
    });

    it('accumulates patterns over multiple updates', () => {
      let memory = createInitialPatternMemory();

      // First update
      memory = updatePatternMemory(memory, [
        {
          component: 'auth',
          commits: 3,
          duration: 30,
          isSpiral: true,
          pattern: 'SECRETS_AUTH',
          firstCommit: new Date(),
          lastCommit: new Date(),
        },
      ]);

      // Second update - same pattern
      memory = updatePatternMemory(memory, [
        {
          component: 'auth',
          commits: 4,
          duration: 20,
          isSpiral: true,
          pattern: 'SECRETS_AUTH',
          firstCommit: new Date(),
          lastCommit: new Date(),
        },
      ]);

      expect(memory.records.length).toBe(2);
      expect(memory.totalSpirals).toBe(2);
      expect(memory.patternCounts['SECRETS_AUTH']).toBe(2);
      expect(memory.patternDurations['SECRETS_AUTH']).toBe(50); // 30 + 20
    });

    it('identifies top patterns by frequency', () => {
      let memory = createInitialPatternMemory();

      const chains: FixChain[] = [
        { component: 'a', commits: 3, duration: 10, isSpiral: true, pattern: 'SECRETS_AUTH', firstCommit: new Date(), lastCommit: new Date() },
        { component: 'b', commits: 3, duration: 10, isSpiral: true, pattern: 'SECRETS_AUTH', firstCommit: new Date(), lastCommit: new Date() },
        { component: 'c', commits: 3, duration: 10, isSpiral: true, pattern: 'SECRETS_AUTH', firstCommit: new Date(), lastCommit: new Date() },
        { component: 'd', commits: 3, duration: 10, isSpiral: true, pattern: 'API_MISMATCH', firstCommit: new Date(), lastCommit: new Date() },
        { component: 'e', commits: 3, duration: 10, isSpiral: true, pattern: 'VOLUME_CONFIG', firstCommit: new Date(), lastCommit: new Date() },
      ];

      memory = updatePatternMemory(memory, chains);

      expect(memory.topPatterns[0]).toBe('SECRETS_AUTH');
      expect(memory.topPatterns.length).toBeLessThanOrEqual(3);
    });

    it('handles null patterns as OTHER', () => {
      const memory = createInitialPatternMemory();
      const chains: FixChain[] = [
        {
          component: 'unknown',
          commits: 5,
          duration: 45,
          isSpiral: true,
          pattern: null,
          firstCommit: new Date(),
          lastCommit: new Date(),
        },
      ];

      const updated = updatePatternMemory(memory, chains);

      expect(updated.records[0].pattern).toBe('OTHER');
      expect(updated.patternCounts['OTHER']).toBe(1);
    });

    it('limits records to 100', () => {
      let memory = createInitialPatternMemory();

      // Add 110 records
      for (let i = 0; i < 110; i++) {
        memory = updatePatternMemory(memory, [
          {
            component: `comp-${i}`,
            commits: 3,
            duration: 10,
            isSpiral: true,
            pattern: 'SECRETS_AUTH',
            firstCommit: new Date(),
            lastCommit: new Date(),
          },
        ]);
      }

      expect(memory.records.length).toBe(100);
    });
  });

  describe('formatPatternMemory', () => {
    it('returns hasData: false for empty memory', () => {
      const memory = createInitialPatternMemory();
      const formatted = formatPatternMemory(memory);

      expect(formatted.hasData).toBe(false);
      expect(formatted.summary).toBe('No spiral patterns recorded yet');
    });

    it('returns hasData: false for undefined memory', () => {
      const formatted = formatPatternMemory(undefined as any);

      expect(formatted.hasData).toBe(false);
    });

    it('formats pattern data correctly', () => {
      let memory = createInitialPatternMemory();
      memory = updatePatternMemory(memory, [
        { component: 'auth', commits: 4, duration: 30, isSpiral: true, pattern: 'SECRETS_AUTH', firstCommit: new Date(), lastCommit: new Date() },
        { component: 'api', commits: 3, duration: 20, isSpiral: true, pattern: 'API_MISMATCH', firstCommit: new Date(), lastCommit: new Date() },
      ]);

      const formatted = formatPatternMemory(memory);

      expect(formatted.hasData).toBe(true);
      expect(formatted.totalSpirals).toBe(2);
      expect(formatted.avgRecoveryTime).toBe(25);
      expect(formatted.topPatterns.length).toBe(2);
      expect(formatted.topPatterns[0].displayName).toBe('Secrets & Auth');
      expect(formatted.topPatterns[0].advice).toContain('secrets manager');
    });

    it('generates appropriate summary for few spirals', () => {
      let memory = createInitialPatternMemory();
      memory = updatePatternMemory(memory, [
        { component: 'auth', commits: 3, duration: 30, isSpiral: true, pattern: 'SECRETS_AUTH', firstCommit: new Date(), lastCommit: new Date() },
      ]);

      const formatted = formatPatternMemory(memory);
      expect(formatted.summary).toBe('1 spiral recorded');
    });

    it('generates summary with top trigger for many spirals', () => {
      let memory = createInitialPatternMemory();
      for (let i = 0; i < 10; i++) {
        memory = updatePatternMemory(memory, [
          { component: 'auth', commits: 3, duration: 10, isSpiral: true, pattern: 'SECRETS_AUTH', firstCommit: new Date(), lastCommit: new Date() },
        ]);
      }

      const formatted = formatPatternMemory(memory);
      expect(formatted.summary).toContain('10 spirals');
      expect(formatted.summary).toContain('Secrets & Auth');
      expect(formatted.summary).toContain('100%');
    });
  });

  describe('getPatternDisplayName', () => {
    it('returns human-readable names for known patterns', () => {
      expect(getPatternDisplayName('SECRETS_AUTH')).toBe('Secrets & Auth');
      expect(getPatternDisplayName('VOLUME_CONFIG')).toBe('Volume Config');
      expect(getPatternDisplayName('API_MISMATCH')).toBe('API Mismatch');
      expect(getPatternDisplayName('SSL_TLS')).toBe('SSL/TLS');
      expect(getPatternDisplayName('IMAGE_REGISTRY')).toBe('Image/Registry');
      expect(getPatternDisplayName('GITOPS_DRIFT')).toBe('GitOps Drift');
      expect(getPatternDisplayName('OTHER')).toBe('Other');
    });

    it('returns pattern as-is for unknown patterns', () => {
      expect(getPatternDisplayName('UNKNOWN_PATTERN')).toBe('UNKNOWN_PATTERN');
    });
  });

  describe('getPatternAdvice', () => {
    it('returns advice for known patterns', () => {
      expect(getPatternAdvice('SECRETS_AUTH')).toContain('secrets manager');
      expect(getPatternAdvice('VOLUME_CONFIG')).toContain('volume mount');
      expect(getPatternAdvice('API_MISMATCH')).toContain('schema validation');
      expect(getPatternAdvice('SSL_TLS')).toContain('certificate');
      expect(getPatternAdvice('IMAGE_REGISTRY')).toContain('image tags');
      expect(getPatternAdvice('GITOPS_DRIFT')).toContain('drift detection');
    });

    it('returns generic advice for unknown patterns', () => {
      expect(getPatternAdvice('UNKNOWN')).toContain('pre-deployment validation');
    });
  });
});
