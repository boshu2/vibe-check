import * as fs from 'fs';
import * as path from 'path';
import { CalibrationState, CalibrationSample } from '../types';
import { DEFAULT_MODEL } from '../recommend/ordered-logistic';

const CALIBRATION_DIR = '.vibe-check';
const CALIBRATION_FILE = 'calibration.json';

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
      return JSON.parse(data);
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
 * Add a calibration sample.
 */
export function addSample(
  repoPath: string,
  sample: CalibrationSample
): CalibrationState {
  const state = loadCalibration(repoPath);
  state.samples.push(sample);
  state.lastUpdated = new Date();
  saveCalibration(repoPath, state);
  return state;
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
