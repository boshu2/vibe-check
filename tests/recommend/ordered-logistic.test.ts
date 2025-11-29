import { describe, it, expect } from 'vitest';
import {
  predictProba,
  predict,
  predictWithConfidence,
  partialFit,
  batchPartialFit,
  DEFAULT_MODEL,
} from '../../src/recommend/ordered-logistic';

describe('ordered-logistic', () => {
  describe('predictProba', () => {
    it('returns probability distribution summing to 1', () => {
      const features = [0, 0, 0, 0, 0, 0.7, 0.7, 0.7, 0.7];
      const probs = predictProba(features);

      expect(probs).toHaveLength(6);
      const sum = probs.reduce((a, b) => a + b, 0);
      expect(sum).toBeCloseTo(1.0, 5);
    });

    it('returns non-negative probabilities', () => {
      const features = [-2, -2, -2, -2, -2, 0.1, 0.1, 0.1, 0.1];
      const probs = predictProba(features);

      probs.forEach((p) => expect(p).toBeGreaterThanOrEqual(0));
    });

    it('shifts distribution based on weighted features', () => {
      // All zeros = neutral prediction
      const neutralFeatures = [0, 0, 0, 0, 0, 0.5, 0.5, 0.5, 0.5];
      // High semantic-free metrics (positive weights) should increase level
      const highMetricsFeatures = [0, 0, 0, 0, 0, 0.95, 0.95, 0.95, 0.95];

      const neutralProbs = predictProba(neutralFeatures);
      const highProbs = predictProba(highMetricsFeatures);

      // Higher semantic-free metrics should shift probability mass to higher levels
      const neutralMean = neutralProbs.reduce((sum, p, i) => sum + p * i, 0);
      const highMean = highProbs.reduce((sum, p, i) => sum + p * i, 0);

      expect(highMean).toBeGreaterThan(neutralMean);
    });
  });

  describe('predict', () => {
    it('returns level 0-5', () => {
      const features = [0, 0, 0, 0, 0, 0.7, 0.7, 0.7, 0.7];
      const level = predict(features);

      expect(level).toBeGreaterThanOrEqual(0);
      expect(level).toBeLessThanOrEqual(5);
    });

    it('returns argmax of probabilities', () => {
      const features = [0, 0, 0, 0, 0, 0.7, 0.7, 0.7, 0.7];
      const probs = predictProba(features);
      const predicted = predict(features);

      const maxProb = Math.max(...probs);
      const expectedLevel = probs.indexOf(maxProb);

      expect(predicted).toBe(expectedLevel);
    });
  });

  describe('predictWithConfidence', () => {
    it('returns level, confidence, CI, and probs', () => {
      const features = [0, 0, 0, 0, 0, 0.7, 0.7, 0.7, 0.7];
      const result = predictWithConfidence(features);

      expect(result).toHaveProperty('level');
      expect(result).toHaveProperty('confidence');
      expect(result).toHaveProperty('ci');
      expect(result).toHaveProperty('probs');

      expect(result.level).toBeGreaterThanOrEqual(0);
      expect(result.level).toBeLessThanOrEqual(5);
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
      expect(result.ci).toHaveLength(2);
      expect(result.ci[0]).toBeLessThanOrEqual(result.ci[1]);
    });
  });

  describe('partialFit', () => {
    it('returns new model state without mutating original', () => {
      const features = [0.5, 0.5, 0.5, 0.5, 0.5, 0.7, 0.7, 0.7, 0.7];
      const trueLevel = 2;
      const originalWeights = [...DEFAULT_MODEL.weights];
      const originalThresholds = [...DEFAULT_MODEL.thresholds];

      const updatedModel = partialFit(DEFAULT_MODEL, features, trueLevel);

      // Original should not be mutated
      expect(DEFAULT_MODEL.weights).toEqual(originalWeights);
      expect(DEFAULT_MODEL.thresholds).toEqual(originalThresholds);

      // Should return different array instances
      expect(updatedModel.weights).not.toBe(DEFAULT_MODEL.weights);
      expect(updatedModel.thresholds).not.toBe(DEFAULT_MODEL.thresholds);
    });

    it('returns correct number of weights and thresholds', () => {
      const features = [0, 0, 0, 0, 0, 0.7, 0.7, 0.7, 0.7];
      const trueLevel = 3;

      const updatedModel = partialFit(DEFAULT_MODEL, features, trueLevel);

      expect(updatedModel.weights).toHaveLength(9);
      expect(updatedModel.thresholds).toHaveLength(5);
    });

    it('keeps thresholds ordered after update', () => {
      const features = [1, 1, 1, 1, 1, 0.9, 0.9, 0.9, 0.9];
      const trueLevel = 0;

      const updatedModel = partialFit(DEFAULT_MODEL, features, trueLevel, 0.5);

      for (let i = 1; i < updatedModel.thresholds.length; i++) {
        expect(updatedModel.thresholds[i]).toBeGreaterThan(
          updatedModel.thresholds[i - 1]
        );
      }
    });
  });

  describe('batchPartialFit', () => {
    it('returns new model state', () => {
      const samples = [
        { features: [0, 0, 0, 0, 0, 0.5, 0.5, 0.5, 0.5], trueLevel: 3 },
      ];

      const updatedModel = batchPartialFit(DEFAULT_MODEL, samples);

      // Should return different array instances
      expect(updatedModel.weights).not.toBe(DEFAULT_MODEL.weights);
      expect(updatedModel.thresholds).not.toBe(DEFAULT_MODEL.thresholds);
    });

    it('handles empty samples array', () => {
      const updatedModel = batchPartialFit(DEFAULT_MODEL, []);

      // With no samples, should return equivalent to original
      expect(updatedModel.weights).toEqual(DEFAULT_MODEL.weights);
      expect(updatedModel.thresholds).toEqual(DEFAULT_MODEL.thresholds);
    });

    it('applies updates for each sample', () => {
      const samples = [
        { features: [1, 0, 0, 0, 0, 0.5, 0.5, 0.5, 0.5], trueLevel: 3 },
        { features: [0, 1, 0, 0, 0, 0.5, 0.5, 0.5, 0.5], trueLevel: 3 },
        { features: [0, 0, 1, 0, 0, 0.5, 0.5, 0.5, 0.5], trueLevel: 3 },
      ];

      const updatedModel = batchPartialFit(DEFAULT_MODEL, samples);

      // Model should have valid structure
      expect(updatedModel.weights).toHaveLength(9);
      expect(updatedModel.thresholds).toHaveLength(5);
    });
  });
});
