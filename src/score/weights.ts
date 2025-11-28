export interface ScoreWeights {
  fileChurn: number;
  timeSpiral: number;
  velocityAnomaly: number;
  codeStability: number;
}

/**
 * Default weights based on research.
 * Will be calibrated over time.
 */
export const DEFAULT_WEIGHTS: ScoreWeights = {
  fileChurn: 0.30,       // Strongest signal
  timeSpiral: 0.25,      // Frustrated iteration
  velocityAnomaly: 0.20, // Unusual patterns
  codeStability: 0.25,   // Long-term quality
};

/**
 * Normalize weights to sum to 1.0.
 */
export function normalizeWeights(weights: ScoreWeights): ScoreWeights {
  const sum = weights.fileChurn + weights.timeSpiral +
              weights.velocityAnomaly + weights.codeStability;

  return {
    fileChurn: weights.fileChurn / sum,
    timeSpiral: weights.timeSpiral / sum,
    velocityAnomaly: weights.velocityAnomaly / sum,
    codeStability: weights.codeStability / sum,
  };
}
