import { describe, it, expect } from 'vitest';
import {
  calculateECE,
  assessOutcome,
  inferTrueLevel,
} from '../../src/calibration/ece';
import { CalibrationSample } from '../../src/types';

describe('ece', () => {
  describe('calculateECE', () => {
    it('returns 0 for empty samples', () => {
      expect(calculateECE([])).toBe(0);
    });

    it('returns low ECE for well-calibrated samples', () => {
      const samples: CalibrationSample[] = [
        {
          timestamp: new Date(),
          vibeScore: 0.95,
          declaredLevel: 5,
          outcome: 'correct',
          features: [],
          modelVersion: '2.0.0',
        },
        {
          timestamp: new Date(),
          vibeScore: 0.85,
          declaredLevel: 4,
          outcome: 'correct',
          features: [],
          modelVersion: '2.0.0',
        },
        {
          timestamp: new Date(),
          vibeScore: 0.72,
          declaredLevel: 3,
          outcome: 'correct',
          features: [],
          modelVersion: '2.0.0',
        },
      ];

      const ece = calculateECE(samples);
      expect(ece).toBeLessThan(0.1);
    });

    it('returns higher ECE for miscalibrated samples', () => {
      const samples: CalibrationSample[] = [
        {
          timestamp: new Date(),
          vibeScore: 0.5,
          declaredLevel: 5,
          outcome: 'too_high',
          features: [],
          modelVersion: '2.0.0',
        },
        {
          timestamp: new Date(),
          vibeScore: 0.4,
          declaredLevel: 4,
          outcome: 'too_high',
          features: [],
          modelVersion: '2.0.0',
        },
      ];

      const ece = calculateECE(samples);
      expect(ece).toBeGreaterThan(0.2);
    });

    it('returns a number between 0 and 1', () => {
      const samples: CalibrationSample[] = [
        {
          timestamp: new Date(),
          vibeScore: 0.5,
          declaredLevel: 3,
          outcome: 'correct',
          features: [],
          modelVersion: '2.0.0',
        },
      ];

      const ece = calculateECE(samples);
      expect(ece).toBeGreaterThanOrEqual(0);
      expect(ece).toBeLessThanOrEqual(1);
    });
  });

  describe('assessOutcome', () => {
    it('returns correct for score in expected range for level 5', () => {
      expect(assessOutcome(0.95, 5)).toBe('correct');
      expect(assessOutcome(0.92, 5)).toBe('correct');
    });

    it('returns correct for score in expected range for level 4', () => {
      expect(assessOutcome(0.85, 4)).toBe('correct');
      expect(assessOutcome(0.82, 4)).toBe('correct');
    });

    it('returns correct for score in expected range for level 3', () => {
      expect(assessOutcome(0.72, 3)).toBe('correct');
      expect(assessOutcome(0.68, 3)).toBe('correct');
    });

    it('returns too_low when level was conservative', () => {
      // Score is high but level was low - level was too conservative
      expect(assessOutcome(0.95, 3)).toBe('too_low');
      expect(assessOutcome(0.85, 2)).toBe('too_low');
    });

    it('returns too_high when level was aggressive', () => {
      // Score is low but level was high - level was too aggressive
      expect(assessOutcome(0.5, 5)).toBe('too_high');
      expect(assessOutcome(0.4, 4)).toBe('too_high');
    });
  });

  describe('inferTrueLevel', () => {
    it('maps high scores to level 5', () => {
      expect(inferTrueLevel(0.95)).toBe(5);
      expect(inferTrueLevel(0.92)).toBe(5);
      expect(inferTrueLevel(0.9)).toBe(5);
    });

    it('maps 0.80-0.90 to level 4', () => {
      expect(inferTrueLevel(0.85)).toBe(4);
      expect(inferTrueLevel(0.8)).toBe(4);
    });

    it('maps 0.65-0.80 to level 3', () => {
      expect(inferTrueLevel(0.72)).toBe(3);
      expect(inferTrueLevel(0.65)).toBe(3);
    });

    it('maps 0.50-0.65 to level 2', () => {
      expect(inferTrueLevel(0.55)).toBe(2);
      expect(inferTrueLevel(0.5)).toBe(2);
    });

    it('maps 0.30-0.50 to level 1', () => {
      expect(inferTrueLevel(0.4)).toBe(1);
      expect(inferTrueLevel(0.3)).toBe(1);
    });

    it('maps scores below 0.30 to level 0', () => {
      expect(inferTrueLevel(0.2)).toBe(0);
      expect(inferTrueLevel(0.1)).toBe(0);
      expect(inferTrueLevel(0)).toBe(0);
    });

    it('returns valid level type (0-5)', () => {
      for (let score = 0; score <= 1; score += 0.1) {
        const level = inferTrueLevel(score);
        expect(level).toBeGreaterThanOrEqual(0);
        expect(level).toBeLessThanOrEqual(5);
      }
    });
  });
});
