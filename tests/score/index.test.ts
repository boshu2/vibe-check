import { describe, it, expect } from 'vitest';
import { calculateVibeScore, scoreToExpectedLevel } from '../../src/score';
import {
  FileChurnResult,
  TimeSpiralResult,
  VelocityAnomalyResult,
  CodeStabilityResult,
} from '../../src/types';

describe('score', () => {
  const makeInputs = (values: {
    fc: number;
    ts: number;
    va: number;
    cs: number;
  }) => ({
    fileChurn: { value: values.fc } as FileChurnResult,
    timeSpiral: { value: values.ts } as TimeSpiralResult,
    velocityAnomaly: { value: values.va } as VelocityAnomalyResult,
    codeStability: { value: values.cs } as CodeStabilityResult,
  });

  describe('calculateVibeScore', () => {
    it('returns score between 0 and 1', () => {
      const inputs = makeInputs({ fc: 80, ts: 70, va: 60, cs: 75 });
      const result = calculateVibeScore(inputs);

      expect(result.value).toBeGreaterThanOrEqual(0);
      expect(result.value).toBeLessThanOrEqual(1);
    });

    it('returns 1.0 for perfect metrics', () => {
      const inputs = makeInputs({ fc: 100, ts: 100, va: 100, cs: 100 });
      const result = calculateVibeScore(inputs);

      expect(result.value).toBe(1);
    });

    it('returns 0 for worst metrics', () => {
      const inputs = makeInputs({ fc: 0, ts: 0, va: 0, cs: 0 });
      const result = calculateVibeScore(inputs);

      expect(result.value).toBe(0);
    });

    it('includes component breakdown normalized to 0-1', () => {
      const inputs = makeInputs({ fc: 80, ts: 70, va: 60, cs: 75 });
      const result = calculateVibeScore(inputs);

      expect(result.components.fileChurn).toBe(0.8);
      expect(result.components.timeSpiral).toBe(0.7);
      expect(result.components.velocityAnomaly).toBe(0.6);
      expect(result.components.codeStability).toBe(0.75);
    });

    it('includes weights used in calculation', () => {
      const inputs = makeInputs({ fc: 80, ts: 70, va: 60, cs: 75 });
      const result = calculateVibeScore(inputs);

      expect(result.weights).toHaveProperty('fileChurn');
      expect(result.weights).toHaveProperty('timeSpiral');
      expect(result.weights).toHaveProperty('velocityAnomaly');
      expect(result.weights).toHaveProperty('codeStability');
    });

    it('weights sum to 1.0', () => {
      const inputs = makeInputs({ fc: 80, ts: 70, va: 60, cs: 75 });
      const result = calculateVibeScore(inputs);

      const weightSum =
        result.weights.fileChurn +
        result.weights.timeSpiral +
        result.weights.velocityAnomaly +
        result.weights.codeStability;

      expect(weightSum).toBeCloseTo(1.0, 5);
    });

    it('calculates weighted average correctly', () => {
      const inputs = makeInputs({ fc: 100, ts: 100, va: 0, cs: 0 });
      const result = calculateVibeScore(inputs);

      // With fileChurn=0.30 and timeSpiral=0.25 weights
      // Score should be 0.30 * 1 + 0.25 * 1 + 0.20 * 0 + 0.25 * 0 = 0.55
      expect(result.value).toBeCloseTo(0.55, 2);
    });
  });

  describe('scoreToExpectedLevel', () => {
    it('maps very high scores (>=0.90) to level 4-5', () => {
      const result = scoreToExpectedLevel(0.95);
      expect(result.min).toBe(4);
      expect(result.max).toBe(5);
    });

    it('maps high scores (0.75-0.90) to level 3-4', () => {
      const result = scoreToExpectedLevel(0.8);
      expect(result.min).toBe(3);
      expect(result.max).toBe(4);
    });

    it('maps medium scores (0.60-0.75) to level 2-3', () => {
      const result = scoreToExpectedLevel(0.65);
      expect(result.min).toBe(2);
      expect(result.max).toBe(3);
    });

    it('maps low-medium scores (0.40-0.60) to level 1-2', () => {
      const result = scoreToExpectedLevel(0.5);
      expect(result.min).toBe(1);
      expect(result.max).toBe(2);
    });

    it('maps low scores (<0.40) to level 0-1', () => {
      const result = scoreToExpectedLevel(0.3);
      expect(result.min).toBe(0);
      expect(result.max).toBe(1);
    });

    it('returns min <= max for all scores', () => {
      for (let score = 0; score <= 1; score += 0.1) {
        const result = scoreToExpectedLevel(score);
        expect(result.min).toBeLessThanOrEqual(result.max);
      }
    });
  });
});
