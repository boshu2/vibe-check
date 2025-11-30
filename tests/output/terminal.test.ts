import { describe, it, expect, vi, beforeEach } from 'vitest';
import { formatTerminal, formatTerminalSimple } from '../../src/output/terminal';
import { VibeCheckResult, VibeCheckResultV2 } from '../../src/types';

// Strip ANSI codes for easier testing
function stripAnsi(str: string): string {
  return str.replace(/\u001B\[[0-9;]*m/g, '');
}

describe('output/terminal', () => {
  const createMockResult = (overrides: Partial<VibeCheckResult> = {}): VibeCheckResult => ({
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
      iterationVelocity: {
        value: 4.5,
        unit: 'commits/hour',
        rating: 'high',
        description: 'Good iteration speed',
      },
      reworkRatio: {
        value: 30,
        unit: '%',
        rating: 'medium',
        description: 'Normal rework',
      },
      trustPassRate: {
        value: 92,
        unit: '%',
        rating: 'high',
        description: 'Good trust',
      },
      debugSpiralDuration: {
        value: 15,
        unit: 'min',
        rating: 'high',
        description: 'Normal debugging time',
      },
      flowEfficiency: {
        value: 85,
        unit: '%',
        rating: 'high',
        description: 'Good flow',
      },
    },
    fixChains: [],
    patterns: {
      categories: {},
      total: 0,
      tracerAvailable: 0,
    },
    overall: 'HIGH',
    ...overrides,
  });

  const createMockResultV2 = (overrides: Partial<VibeCheckResultV2> = {}): VibeCheckResultV2 => {
    const base = createMockResult();
    return {
      ...base,
      semanticMetrics: base.metrics,
      semanticFreeMetrics: {
        fileChurn: {
          value: 85,
          unit: '%',
          rating: 'high',
          description: 'Low file churn',
          churnedFiles: 3,
          totalFiles: 20,
        },
        timeSpiral: {
          value: 90,
          unit: '%',
          rating: 'elite',
          description: 'No time spirals',
          spiralCommits: 2,
          totalCommits: 50,
        },
        velocityAnomaly: {
          value: 75,
          unit: '%',
          rating: 'high',
          description: 'Normal velocity',
          currentVelocity: 4.5,
          baselineMean: 4.0,
          baselineStdDev: 1.0,
          zScore: 0.5,
        },
        codeStability: {
          value: 80,
          unit: '%',
          rating: 'high',
          description: 'Good stability',
          linesAdded: 500,
          linesSurviving: 400,
        },
      },
      vibeScore: {
        value: 0.83,
        components: {
          fileChurn: 0.85,
          timeSpiral: 0.90,
          velocityAnomaly: 0.75,
          codeStability: 0.80,
        },
        weights: {
          fileChurn: 0.30,
          timeSpiral: 0.25,
          velocityAnomaly: 0.20,
          codeStability: 0.25,
        },
      },
      ...overrides,
    };
  };

  describe('formatTerminal', () => {
    it('includes header with VIBE-CHECK RESULTS', () => {
      const result = createMockResult();
      const output = formatTerminal(result);

      expect(stripAnsi(output)).toContain('VIBE-CHECK RESULTS');
    });

    it('includes period information', () => {
      const result = createMockResult();
      const output = stripAnsi(formatTerminal(result));

      expect(output).toContain('Period:');
      expect(output).toContain('Nov 21, 2025');
      expect(output).toContain('Nov 28, 2025');
      expect(output).toContain('24.5h active');
    });

    it('includes commit counts', () => {
      const result = createMockResult();
      const output = stripAnsi(formatTerminal(result));

      expect(output).toContain('50 total');
      expect(output).toContain('20 feat');
      expect(output).toContain('15 fix');
      expect(output).toContain('5 docs');
      expect(output).toContain('10 other');
    });

    it('includes all 5 core metrics', () => {
      const result = createMockResult();
      const output = stripAnsi(formatTerminal(result));

      expect(output).toContain('Iteration Velocity');
      expect(output).toContain('Rework Ratio');
      expect(output).toContain('Trust Pass Rate');
      expect(output).toContain('Debug Spiral Duration');
      expect(output).toContain('Flow Efficiency');
    });

    it('includes metric values with units', () => {
      const result = createMockResult();
      const output = stripAnsi(formatTerminal(result));

      expect(output).toContain('4.5commits/hour');
      expect(output).toContain('30%');
      expect(output).toContain('92%');
      expect(output).toContain('15min');
      expect(output).toContain('85%');
    });

    it('includes overall rating', () => {
      const result = createMockResult();
      const output = stripAnsi(formatTerminal(result));

      expect(output).toContain('OVERALL:');
      expect(output).toContain('HIGH');
    });

    it('shows ELITE rating in output', () => {
      const result = createMockResult({ overall: 'ELITE' });
      const output = stripAnsi(formatTerminal(result));

      expect(output).toContain('ELITE');
    });

    it('shows LOW rating in output', () => {
      const result = createMockResult({ overall: 'LOW' });
      const output = stripAnsi(formatTerminal(result));

      expect(output).toContain('LOW');
    });

    it('includes debug spirals when present', () => {
      const result = createMockResult({
        fixChains: [
          {
            component: 'auth',
            commits: 5,
            duration: 30,
            isSpiral: true,
            pattern: 'SECRETS_AUTH',
            firstCommit: new Date(),
            lastCommit: new Date(),
          },
        ],
      });
      const output = stripAnsi(formatTerminal(result));

      expect(output).toContain('DEBUG SPIRALS');
      expect(output).toContain('auth');
      expect(output).toContain('5 commits');
      expect(output).toContain('30m');
      expect(output).toContain('SECRETS_AUTH');
    });

    it('includes patterns when present', () => {
      const result = createMockResult({
        patterns: {
          categories: { SECRETS_AUTH: 3, API_MISMATCH: 2 },
          total: 5,
          tracerAvailable: 100,
        },
      });
      const output = stripAnsi(formatTerminal(result));

      expect(output).toContain('PATTERNS');
      expect(output).toContain('SECRETS_AUTH: 3 fixes');
      expect(output).toContain('API_MISMATCH: 2 fixes');
    });

    it('shows strength and focus for varied ratings', () => {
      const result = createMockResult();
      result.metrics.iterationVelocity.rating = 'elite';
      result.metrics.reworkRatio.rating = 'low';

      const output = stripAnsi(formatTerminal(result));

      expect(output).toContain('Strength:');
      expect(output).toContain('Focus:');
    });

    it('shows opportunities for low/medium metrics', () => {
      const result = createMockResult();
      result.metrics.reworkRatio.rating = 'low';
      result.metrics.trustPassRate.rating = 'medium';

      const output = stripAnsi(formatTerminal(result));

      expect(output).toContain('OPPORTUNITIES');
    });

    describe('V2 results with VibeScore', () => {
      it('includes CODE PATTERNS section', () => {
        const result = createMockResultV2();
        const output = stripAnsi(formatTerminal(result));

        expect(output).toContain('CODE PATTERNS');
        expect(output).toContain('File Churn');
        expect(output).toContain('Time Spiral');
        expect(output).toContain('Velocity Anomaly');
        expect(output).toContain('Code Stability');
      });

      it('includes VibeScore', () => {
        const result = createMockResultV2();
        const output = stripAnsi(formatTerminal(result));

        expect(output).toContain('VIBE SCORE');
        expect(output).toContain('83%');
      });

      it('shows near-miss messages when close to 90%', () => {
        const result = createMockResultV2();
        result.vibeScore!.value = 0.87;
        const output = stripAnsi(formatTerminal(result));

        expect(output).toContain('SO CLOSE');
      });
    });
  });

  describe('formatTerminalSimple', () => {
    it('includes VIBE-CHECK header', () => {
      const result = createMockResult();
      const output = stripAnsi(formatTerminalSimple(result));

      expect(output).toContain('VIBE-CHECK');
    });

    it('includes period dates', () => {
      const result = createMockResult();
      const output = stripAnsi(formatTerminalSimple(result));

      expect(output).toContain('Nov 21');
      expect(output).toContain('Nov 28');
    });

    it('includes overall rating', () => {
      const result = createMockResult();
      const output = stripAnsi(formatTerminalSimple(result));

      expect(output).toContain('Rating:');
      expect(output).toContain('HIGH');
    });

    it('includes trust and rework metrics', () => {
      const result = createMockResult();
      const output = stripAnsi(formatTerminalSimple(result));

      expect(output).toContain('Trust:');
      expect(output).toContain('92%');
      expect(output).toContain('Rework:');
      expect(output).toContain('30%');
    });

    it('includes VibeScore for V2 results', () => {
      const result = createMockResultV2();
      const output = stripAnsi(formatTerminalSimple(result));

      expect(output).toContain('Score:');
      expect(output).toContain('83%');
    });

    it('shows spiral warning when spirals detected', () => {
      const result = createMockResult({
        fixChains: [
          {
            component: 'auth',
            commits: 5,
            duration: 30,
            isSpiral: true,
            pattern: null,
            firstCommit: new Date(),
            lastCommit: new Date(),
          },
        ],
      });
      const output = stripAnsi(formatTerminalSimple(result));

      expect(output).toContain('debug spiral');
    });

    it('suggests running without --simple for details', () => {
      const result = createMockResult();
      const output = stripAnsi(formatTerminalSimple(result));

      expect(output).toContain('Run without --simple for full details');
    });

    it('pluralizes spirals correctly', () => {
      const result = createMockResult({
        fixChains: [
          { component: 'a', commits: 3, duration: 10, isSpiral: true, pattern: null, firstCommit: new Date(), lastCommit: new Date() },
          { component: 'b', commits: 3, duration: 10, isSpiral: true, pattern: null, firstCommit: new Date(), lastCommit: new Date() },
        ],
      });
      const output = stripAnsi(formatTerminalSimple(result));

      expect(output).toContain('2 debug spirals');
    });
  });
});
