/**
 * Ordered Logistic Regression for Vibe Level Classification.
 * Respects ordinal structure: 0 < 1 < 2 < 3 < 4 < 5
 */

const N_LEVELS = 6;

export interface ModelState {
  weights: number[];
  thresholds: number[];
}

/**
 * Default model state (will be updated via calibration).
 */
export const DEFAULT_MODEL: ModelState = {
  weights: [
    0.3,   // reversibility
    -0.5,  // blastRadius (negative = higher risk lowers level)
    -0.4,  // verificationCost
    -0.4,  // domainComplexity
    0.3,   // aiTrackRecord
    0.8,   // fileChurnScore
    0.6,   // timeSpiralScore
    0.3,   // velocityAnomalyScore
    0.5,   // codeStabilityScore
  ],
  thresholds: [-2.0, -0.8, 0.4, 1.6, 2.8], // 5 thresholds for 6 levels
};

/**
 * Sigmoid function.
 */
function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

/**
 * Predict probability distribution over levels 0-5.
 */
export function predictProba(
  features: number[],
  model: ModelState = DEFAULT_MODEL
): number[] {
  // Linear combination
  let eta = 0;
  for (let i = 0; i < features.length && i < model.weights.length; i++) {
    eta += features[i] * model.weights[i];
  }

  // Cumulative probabilities
  const cumProbs = model.thresholds.map(t => sigmoid(t - eta));

  // P(Y=k) = P(Y≤k) - P(Y≤k-1)
  const probs: number[] = [];
  probs[0] = cumProbs[0];
  for (let k = 1; k < N_LEVELS - 1; k++) {
    probs[k] = cumProbs[k] - cumProbs[k - 1];
  }
  probs[N_LEVELS - 1] = 1 - cumProbs[N_LEVELS - 2];

  // Ensure non-negative (numerical stability)
  return probs.map(p => Math.max(0, p));
}

/**
 * Predict most likely level.
 */
export function predict(
  features: number[],
  model: ModelState = DEFAULT_MODEL
): number {
  const probs = predictProba(features, model);
  let maxIdx = 0;
  let maxProb = probs[0];
  for (let i = 1; i < probs.length; i++) {
    if (probs[i] > maxProb) {
      maxProb = probs[i];
      maxIdx = i;
    }
  }
  return maxIdx;
}

/**
 * Predict with confidence and CI.
 */
export function predictWithConfidence(
  features: number[],
  model: ModelState = DEFAULT_MODEL
): { level: number; confidence: number; ci: [number, number]; probs: number[] } {
  const probs = predictProba(features, model);
  const level = probs.indexOf(Math.max(...probs));
  const confidence = Math.max(...probs);

  // Approximate CI from probability distribution variance
  let mean = 0;
  let variance = 0;
  for (let i = 0; i < probs.length; i++) {
    mean += i * probs[i];
  }
  for (let i = 0; i < probs.length; i++) {
    variance += probs[i] * Math.pow(i - mean, 2);
  }
  const stdDev = Math.sqrt(variance);
  const ci: [number, number] = [
    Math.max(0, mean - 1.96 * stdDev),
    Math.min(5, mean + 1.96 * stdDev),
  ];

  return { level, confidence, ci, probs };
}
