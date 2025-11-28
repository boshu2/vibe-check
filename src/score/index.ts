import { VibeScore, FileChurnResult, TimeSpiralResult, VelocityAnomalyResult, CodeStabilityResult } from '../types';
import { DEFAULT_WEIGHTS, ScoreWeights } from './weights';

export interface ScoreInputs {
  fileChurn: FileChurnResult;
  timeSpiral: TimeSpiralResult;
  velocityAnomaly: VelocityAnomalyResult;
  codeStability: CodeStabilityResult;
}

/**
 * Calculate composite VibeScore (0-1) from semantic-free metrics.
 */
export function calculateVibeScore(
  inputs: ScoreInputs,
  weights: ScoreWeights = DEFAULT_WEIGHTS
): VibeScore {
  // Normalize all metrics to 0-1
  const fileChurnNorm = inputs.fileChurn.value / 100;
  const timeSpiralNorm = inputs.timeSpiral.value / 100;
  const velocityAnomalyNorm = inputs.velocityAnomaly.value / 100;
  const codeStabilityNorm = inputs.codeStability.value / 100;

  // Weighted sum
  const value =
    weights.fileChurn * fileChurnNorm +
    weights.timeSpiral * timeSpiralNorm +
    weights.velocityAnomaly * velocityAnomalyNorm +
    weights.codeStability * codeStabilityNorm;

  return {
    value: Math.round(value * 100) / 100,
    components: {
      fileChurn: fileChurnNorm,
      timeSpiral: timeSpiralNorm,
      velocityAnomaly: velocityAnomalyNorm,
      codeStability: codeStabilityNorm,
    },
    weights,
  };
}

/**
 * Map VibeScore to expected vibe level range.
 */
export function scoreToExpectedLevel(score: number): { min: number; max: number } {
  if (score >= 0.90) return { min: 4, max: 5 };
  if (score >= 0.75) return { min: 3, max: 4 };
  if (score >= 0.60) return { min: 2, max: 3 };
  if (score >= 0.40) return { min: 1, max: 2 };
  return { min: 0, max: 1 };
}

export { DEFAULT_WEIGHTS, ScoreWeights } from './weights';
