import { CalibrationSample } from '../types';

/**
 * Expected Calibration Error (ECE).
 * Measures how well predicted levels match declared levels.
 *
 * ECE = Σᵢ (nᵢ/N) × |accuracy(binᵢ) - confidence(binᵢ)|
 */
export function calculateECE(samples: CalibrationSample[]): number {
  if (samples.length === 0) return 0;

  // Group by declared level
  const bins = new Map<number, CalibrationSample[]>();
  for (let level = 0; level <= 5; level++) {
    bins.set(level, []);
  }
  for (const sample of samples) {
    const levelSamples = bins.get(sample.declaredLevel) || [];
    levelSamples.push(sample);
    bins.set(sample.declaredLevel, levelSamples);
  }

  // Expected score range for each level
  const expectedRanges: Record<number, { min: number; max: number }> = {
    5: { min: 0.90, max: 1.00 },
    4: { min: 0.80, max: 0.90 },
    3: { min: 0.65, max: 0.80 },
    2: { min: 0.50, max: 0.70 },
    1: { min: 0.30, max: 0.55 },
    0: { min: 0.00, max: 0.40 },
  };

  let ece = 0;
  for (const [level, levelSamples] of bins) {
    if (levelSamples.length === 0) continue;

    const expected = expectedRanges[level];
    const expectedCenter = (expected.min + expected.max) / 2;
    const actualMean = levelSamples.reduce((sum, s) => sum + s.vibeScore, 0) / levelSamples.length;

    ece += (levelSamples.length / samples.length) * Math.abs(actualMean - expectedCenter);
  }

  return Math.round(ece * 1000) / 1000;
}

/**
 * Assess if a score matches the expected range for a level.
 */
export function assessOutcome(
  vibeScore: number,
  declaredLevel: number
): 'correct' | 'too_high' | 'too_low' {
  const expectedRanges: Record<number, { min: number; max: number }> = {
    5: { min: 0.90, max: 1.00 },
    4: { min: 0.80, max: 0.90 },
    3: { min: 0.65, max: 0.80 },
    2: { min: 0.50, max: 0.70 },
    1: { min: 0.30, max: 0.55 },
    0: { min: 0.00, max: 0.40 },
  };

  const expected = expectedRanges[declaredLevel];

  if (vibeScore >= expected.min && vibeScore <= expected.max) {
    return 'correct';
  } else if (vibeScore > expected.max) {
    return 'too_low'; // Level was too conservative
  } else {
    return 'too_high'; // Level was too aggressive
  }
}
