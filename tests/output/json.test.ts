import { describe, it, expect } from 'vitest';
import { formatJson } from '../../src/output/json';
import { VibeCheckResult, VibeCheckResultV2 } from '../../src/types';

describe('output/json', () => {
  const createMockResult = (): VibeCheckResult => ({
    period: {
      from: new Date('2025-11-21T10:00:00Z'),
      to: new Date('2025-11-28T10:00:00Z'),
      activeHours: 24.5,
    },
    commits: {
      total: 50,
      feat: 20,
      fix: 15,
      docs: 5,
      other: 10,
    },
    metrics: {
      iterationVelocity: { value: 4.5, unit: 'commits/hour', rating: 'high', description: 'Good' },
      reworkRatio: { value: 30, unit: '%', rating: 'medium', description: 'Normal' },
      trustPassRate: { value: 92, unit: '%', rating: 'high', description: 'Good' },
      debugSpiralDuration: { value: 15, unit: 'min', rating: 'high', description: 'Normal' },
      flowEfficiency: { value: 85, unit: '%', rating: 'high', description: 'Good' },
    },
    fixChains: [
      {
        component: 'auth',
        commits: 3,
        duration: 15,
        isSpiral: true,
        pattern: 'SECRETS_AUTH',
        firstCommit: new Date(),
        lastCommit: new Date(),
      },
    ],
    patterns: {
      categories: { SECRETS_AUTH: 3 },
      total: 3,
      tracerAvailable: 100,
    },
    overall: 'HIGH',
  });

  describe('formatJson', () => {
    it('returns valid JSON string', () => {
      const result = createMockResult();
      const output = formatJson(result);

      expect(() => JSON.parse(output)).not.toThrow();
    });

    it('converts dates to ISO strings', () => {
      const result = createMockResult();
      const output = JSON.parse(formatJson(result));

      expect(output.period.from).toBe('2025-11-21T10:00:00.000Z');
      expect(output.period.to).toBe('2025-11-28T10:00:00.000Z');
    });

    it('includes all period info', () => {
      const result = createMockResult();
      const output = JSON.parse(formatJson(result));

      expect(output.period.activeHours).toBe(24.5);
    });

    it('includes commit counts', () => {
      const result = createMockResult();
      const output = JSON.parse(formatJson(result));

      expect(output.commits.total).toBe(50);
      expect(output.commits.feat).toBe(20);
      expect(output.commits.fix).toBe(15);
    });

    it('includes all metrics', () => {
      const result = createMockResult();
      const output = JSON.parse(formatJson(result));

      expect(output.metrics.iterationVelocity.value).toBe(4.5);
      expect(output.metrics.reworkRatio.rating).toBe('medium');
      expect(output.metrics.trustPassRate.unit).toBe('%');
    });

    it('includes fix chains', () => {
      const result = createMockResult();
      const output = JSON.parse(formatJson(result));

      expect(output.fixChains).toHaveLength(1);
      expect(output.fixChains[0].component).toBe('auth');
      expect(output.fixChains[0].pattern).toBe('SECRETS_AUTH');
    });

    it('includes patterns', () => {
      const result = createMockResult();
      const output = JSON.parse(formatJson(result));

      expect(output.patterns.total).toBe(3);
      expect(output.patterns.categories.SECRETS_AUTH).toBe(3);
    });

    it('includes overall rating', () => {
      const result = createMockResult();
      const output = JSON.parse(formatJson(result));

      expect(output.overall).toBe('HIGH');
    });

    it('includes vibeScore for V2 results', () => {
      const result: VibeCheckResultV2 = {
        ...createMockResult(),
        semanticMetrics: createMockResult().metrics,
        vibeScore: {
          value: 0.85,
          components: { fileChurn: 0.9, timeSpiral: 0.8, velocityAnomaly: 0.85, codeStability: 0.85 },
          weights: { fileChurn: 0.3, timeSpiral: 0.25, velocityAnomaly: 0.2, codeStability: 0.25 },
        },
      };

      const output = JSON.parse(formatJson(result));

      expect(output.vibeScore.value).toBe(0.85);
    });

    it('includes semanticFreeMetrics for V2 results', () => {
      const result: VibeCheckResultV2 = {
        ...createMockResult(),
        semanticMetrics: createMockResult().metrics,
        semanticFreeMetrics: {
          fileChurn: { value: 90, unit: '%', rating: 'elite', description: 'Low', churnedFiles: 1, totalFiles: 10 },
          timeSpiral: { value: 85, unit: '%', rating: 'high', description: 'Normal', spiralCommits: 2, totalCommits: 20 },
          velocityAnomaly: { value: 80, unit: '%', rating: 'high', description: 'Normal', currentVelocity: 3.5, baselineMean: 3, baselineStdDev: 1, zScore: 0.5 },
          codeStability: { value: 88, unit: '%', rating: 'elite', description: 'Good', linesAdded: 500, linesSurviving: 440 },
        },
      };

      const output = JSON.parse(formatJson(result));

      expect(output.semanticFreeMetrics.fileChurn.churnedFiles).toBe(1);
      expect(output.semanticFreeMetrics.timeSpiral.spiralCommits).toBe(2);
      expect(output.semanticFreeMetrics.velocityAnomaly.zScore).toBe(0.5);
      expect(output.semanticFreeMetrics.codeStability.linesAdded).toBe(500);
    });

    it('handles empty fix chains', () => {
      const result = createMockResult();
      result.fixChains = [];

      const output = JSON.parse(formatJson(result));

      expect(output.fixChains).toEqual([]);
    });

    it('produces pretty-printed output', () => {
      const result = createMockResult();
      const output = formatJson(result);

      expect(output).toContain('\n');
      expect(output).toContain('  '); // indentation
    });
  });
});
