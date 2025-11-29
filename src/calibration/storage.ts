import * as fs from 'fs';
import * as path from 'path';
import { CalibrationState, CalibrationSample } from '../types';
import { DEFAULT_MODEL, partialFit, batchPartialFit, ModelState } from '../recommend/ordered-logistic';
import { calculateECE, inferTrueLevel } from './ece';

const CALIBRATION_DIR = '.vibe-check';
const CALIBRATION_FILE = 'calibration.json';

/**
 * Retraining triggers for the calibration model.
 *
 * RETRAIN_SAMPLE_INTERVAL (10): Retrain every 10 samples to incorporate
 * new data. Balances learning speed vs. computational cost.
 *
 * RETRAIN_ECE_THRESHOLD (0.15): If Expected Calibration Error exceeds 15%,
 * the model's predictions are poorly calibrated. 15% chosen as "noticeable
 * but not catastrophic" miscalibration.
 *
 * Note: With 14 parameters (9 weights + 5 thresholds), even 10 samples is
 * severely underfitting. 20+ samples recommended for reliability.
 *
 * These values are NOT empirically optimized.
 */
const RETRAIN_SAMPLE_INTERVAL = 10;
const RETRAIN_ECE_THRESHOLD = 0.15;

/**
 * Get calibration file path for a repository.
 */
export function getCalibrationPath(repoPath: string): string {
  return path.join(repoPath, CALIBRATION_DIR, CALIBRATION_FILE);
}

/**
 * Load calibration state from disk.
 */
export function loadCalibration(repoPath: string): CalibrationState {
  const filePath = getCalibrationPath(repoPath);

  if (fs.existsSync(filePath)) {
    try {
      const data = fs.readFileSync(filePath, 'utf-8');
      const state = JSON.parse(data);
      // Ensure dates are Date objects
      state.lastUpdated = new Date(state.lastUpdated);
      state.samples = state.samples.map((s: CalibrationSample) => ({
        ...s,
        timestamp: new Date(s.timestamp),
      }));
      return state;
    } catch {
      return defaultCalibrationState();
    }
  }

  return defaultCalibrationState();
}

/**
 * Save calibration state to disk.
 */
export function saveCalibration(repoPath: string, state: CalibrationState): void {
  const dirPath = path.join(repoPath, CALIBRATION_DIR);
  const filePath = getCalibrationPath(repoPath);

  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }

  fs.writeFileSync(filePath, JSON.stringify(state, null, 2));
}

/**
 * Add a calibration sample and potentially trigger retraining.
 *
 * Retraining is triggered when:
 * 1. Sample count is a multiple of RETRAIN_SAMPLE_INTERVAL, OR
 * 2. ECE exceeds RETRAIN_ECE_THRESHOLD
 *
 * Returns updated state with potentially new weights.
 */
export function addSample(
  repoPath: string,
  sample: CalibrationSample
): CalibrationState {
  const state = loadCalibration(repoPath);
  state.samples.push(sample);
  state.lastUpdated = new Date();

  // Check if retraining is needed
  const shouldRetrain =
    state.samples.length % RETRAIN_SAMPLE_INTERVAL === 0 ||
    state.ece > RETRAIN_ECE_THRESHOLD;

  if (shouldRetrain && state.samples.length >= 5) {
    const updatedState = retrain(state);
    saveCalibration(repoPath, updatedState);
    return updatedState;
  }

  // Just save without retraining
  saveCalibration(repoPath, state);
  return state;
}

/**
 * Retrain the model using all accumulated samples.
 *
 * Uses batch partial fit with inferred true levels from vibe scores.
 */
export function retrain(state: CalibrationState): CalibrationState {
  if (state.samples.length < 5) {
    return state; // Not enough data
  }

  // Prepare training data: use vibeScore to infer "true" level
  const trainingData = state.samples.map((sample) => ({
    features: sample.features,
    trueLevel: inferTrueLevel(sample.vibeScore),
  }));

  // Start from default model (or could start from current weights)
  const initialModel: ModelState = {
    weights: [...DEFAULT_MODEL.weights],
    thresholds: [...DEFAULT_MODEL.thresholds],
  };

  // Train with multiple epochs for better convergence
  let model = initialModel;
  const epochs = Math.min(10, Math.ceil(50 / state.samples.length));
  for (let epoch = 0; epoch < epochs; epoch++) {
    model = batchPartialFit(model, trainingData, 0.05);
  }

  // Calculate new ECE
  const newEce = calculateECE(state.samples);

  return {
    ...state,
    weights: model.weights,
    thresholds: model.thresholds,
    ece: newEce,
    lastUpdated: new Date(),
    version: '2.1.0', // Bump version to indicate ML-learned weights
  };
}

/**
 * Force retraining (manual trigger).
 */
export function forceRetrain(repoPath: string): CalibrationState {
  const state = loadCalibration(repoPath);
  if (state.samples.length < 5) {
    return state;
  }
  const updatedState = retrain(state);
  saveCalibration(repoPath, updatedState);
  return updatedState;
}

function defaultCalibrationState(): CalibrationState {
  return {
    samples: [],
    weights: DEFAULT_MODEL.weights,
    thresholds: DEFAULT_MODEL.thresholds,
    ece: 0,
    lastUpdated: new Date(),
    version: '2.0.0',
  };
}
