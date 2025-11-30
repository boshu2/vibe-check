import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { formatMarkdown } from '../../src/output/markdown';
import { VibeCheckResult, VibeCheckResultV2 } from '../../src/types';

describe('output/markdown', () => {
  // Mock Date for consistent timestamp
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-11-28T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

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
    fixChains: [],
    patterns: { categories: {}, total: 0, tracerAvailable: 0 },
    overall: 'HIGH',
  });

  describe('formatMarkdown', () => {
    it('includes markdown header', () => {
      const result = createMockResult();
      const output = formatMarkdown(result);

      expect(output).toContain('# Vibe-Check Report');
    });

    it('includes period information', () => {
      const result = createMockResult();
      const output = formatMarkdown(result);

      expect(output).toContain('**Period:**');
      expect(output).toContain('Nov 21, 2025');
      expect(output).toContain('Nov 28, 2025');
      expect(output).toContain('24.5h active');
    });

    it('includes commit counts', () => {
      const result = createMockResult();
      const output = formatMarkdown(result);

      expect(output).toContain('**Commits:** 50 total');
      expect(output).toContain('20 feat');
      expect(output).toContain('15 fix');
    });

    it('includes overall rating', () => {
      const result = createMockResult();
      const output = formatMarkdown(result);

      expect(output).toContain('**Overall Rating:** HIGH');
    });

    it('includes metrics table', () => {
      const result = createMockResult();
      const output = formatMarkdown(result);

      expect(output).toContain('## Semantic Metrics');
      expect(output).toContain('| Metric | Value | Rating | Description |');
      expect(output).toContain('Iteration Velocity');
      expect(output).toContain('4.5commits/hour');
      expect(output).toContain('HIGH');
    });

    it('includes VibeScore for V2 results', () => {
      const result: VibeCheckResultV2 = {
        ...createMockResult(),
        semanticMetrics: createMockResult().metrics,
        vibeScore: {
          value: 0.85,
          components: { fileChurn: 0.9, timeSpiral: 0.8, velocityAnomaly: 0.85, codeStability: 0.85 },
          weights: { fileChurn: 0.3, timeSpiral: 0.25, velocityAnomaly: 0.2, codeStability: 0.25 },
        },
      };

      const output = formatMarkdown(result);

      expect(output).toContain('**VibeScore:** 85%');
    });

    it('includes semantic-free metrics table for V2', () => {
      const result: VibeCheckResultV2 = {
        ...createMockResult(),
        semanticMetrics: createMockResult().metrics,
        semanticFreeMetrics: {
          fileChurn: { value: 90, unit: '%', rating: 'elite', description: 'Low churn', churnedFiles: 1, totalFiles: 10 },
          timeSpiral: { value: 85, unit: '%', rating: 'high', description: 'Normal', spiralCommits: 2, totalCommits: 20 },
          velocityAnomaly: { value: 80, unit: '%', rating: 'high', description: 'Normal', currentVelocity: 3.5, baselineMean: 3, baselineStdDev: 1, zScore: 0.5 },
          codeStability: { value: 88, unit: '%', rating: 'elite', description: 'Good', linesAdded: 500, linesSurviving: 440 },
        },
      };

      const output = formatMarkdown(result);

      expect(output).toContain('## Semantic-Free Metrics (v2.0)');
      expect(output).toContain('File Churn');
      expect(output).toContain('Time Spiral');
    });

    it('includes debug spirals when present', () => {
      const result = createMockResult();
      result.fixChains = [
        {
          component: 'auth',
          commits: 3,
          duration: 15,
          isSpiral: true,
          pattern: 'SECRETS_AUTH',
          firstCommit: new Date(),
          lastCommit: new Date(),
        },
      ];

      const output = formatMarkdown(result);

      expect(output).toContain('## Debug Spirals');
      expect(output).toContain('| auth | 3 | 15m | SECRETS_AUTH |');
    });

    it('includes pattern analysis when patterns present', () => {
      const result = createMockResult();
      result.patterns = {
        categories: { SECRETS_AUTH: 3, API_MISMATCH: 2 },
        total: 5,
        tracerAvailable: 60,
      };

      const output = formatMarkdown(result);

      expect(output).toContain('## Pattern Analysis');
      expect(output).toContain('SECRETS_AUTH');
      expect(output).toContain('**60%** of fix patterns');
    });

    it('includes recommendations section', () => {
      const result = createMockResult();
      const output = formatMarkdown(result);

      expect(output).toContain('## Recommendations');
    });

    it('adds recommendation for low rework ratio', () => {
      const result = createMockResult();
      result.metrics.reworkRatio.rating = 'low';

      const output = formatMarkdown(result);

      expect(output).toContain('High rework ratio');
      expect(output).toContain('tracer tests');
    });

    it('adds recommendation for low trust pass rate', () => {
      const result = createMockResult();
      result.metrics.trustPassRate.rating = 'low';

      const output = formatMarkdown(result);

      expect(output).toContain('Trust pass rate below target');
    });

    it('adds recommendation for long debug spirals', () => {
      const result = createMockResult();
      result.metrics.debugSpiralDuration.rating = 'low';

      const output = formatMarkdown(result);

      expect(output).toContain('Long debug spirals');
      expect(output).toContain('smaller, verifiable steps');
    });

    it('suggests tracer tests for detected patterns', () => {
      const result = createMockResult();
      result.fixChains = [
        {
          component: 'auth',
          commits: 3,
          duration: 15,
          isSpiral: true,
          pattern: 'SECRETS_AUTH',
          firstCommit: new Date(),
          lastCommit: new Date(),
        },
      ];

      const output = formatMarkdown(result);

      expect(output).toContain('tracer tests for: SECRETS_AUTH');
    });

    it('shows healthy message when all metrics good', () => {
      const result = createMockResult();
      // All ratings are already high/elite

      const output = formatMarkdown(result);

      expect(output).toContain('All metrics healthy');
    });

    it('includes generation timestamp', () => {
      const result = createMockResult();
      const output = formatMarkdown(result);

      expect(output).toContain('Generated by vibe-check');
      expect(output).toContain('2025-11-28');
    });

    it('handles pattern without tracer (OTHER)', () => {
      const result = createMockResult();
      result.patterns = {
        categories: { OTHER: 2 },
        total: 2,
        tracerAvailable: 0,
      };

      const output = formatMarkdown(result);

      expect(output).toContain('| OTHER | 2 | No |');
    });
  });
});
