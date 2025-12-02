/**
 * Learning State Storage
 *
 * Manages persistence of learning state to ~/.vibe-check/learning-state.json
 * This is global (not per-repo) to track cross-repo patterns.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  LearningState,
  Nudge,
  RetroSummary,
  NUDGE_TTL_DAYS,
  MAX_PENDING_NUDGES,
} from './types';

const LEARNING_DIR = '.vibe-check';
const LEARNING_FILE = 'learning-state.json';
const LEARNING_STATE_VERSION = '1.0.0';

/**
 * Get learning state file path (global)
 */
export function getLearningStatePath(): string {
  return path.join(os.homedir(), LEARNING_DIR, LEARNING_FILE);
}

/**
 * Create initial learning state
 */
export function createInitialLearningState(): LearningState {
  const today = new Date().toISOString().split('T')[0];
  return {
    version: LEARNING_STATE_VERSION,
    lastDailyCheck: '',
    lastWeeklyRetro: today,
    lastMonthlyReview: today,
    pendingNudges: [],
    retroDue: false,
    retroDueReason: '',
    totalRetrosCompleted: 0,
    nudgesDisplayed: 0,
    nudgesDismissed: 0,
  };
}

/**
 * Load learning state from disk
 */
export function loadLearningState(): LearningState {
  const filePath = getLearningStatePath();

  if (fs.existsSync(filePath)) {
    try {
      const data = fs.readFileSync(filePath, 'utf-8');
      const state = JSON.parse(data) as LearningState;
      return migrateLearningState(state);
    } catch {
      return createInitialLearningState();
    }
  }

  return createInitialLearningState();
}

/**
 * Save learning state to disk
 */
export function saveLearningState(state: LearningState): void {
  const dirPath = path.join(os.homedir(), LEARNING_DIR);
  const filePath = getLearningStatePath();

  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }

  fs.writeFileSync(filePath, JSON.stringify(state, null, 2));
}

/**
 * Add a nudge to the queue
 */
export function addNudge(state: LearningState, nudge: Omit<Nudge, 'id' | 'createdAt'>): LearningState {
  const now = new Date();
  const newNudge: Nudge = {
    ...nudge,
    id: `nudge-${now.getTime()}`,
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + NUDGE_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString(),
  };

  // Add to queue, keeping max size
  const updatedNudges = [...state.pendingNudges, newNudge]
    .filter(n => !n.dismissed)
    .filter(n => !n.expiresAt || new Date(n.expiresAt) > now)
    .sort((a, b) => b.priority - a.priority)
    .slice(0, MAX_PENDING_NUDGES);

  return {
    ...state,
    pendingNudges: updatedNudges,
  };
}

/**
 * Get pending nudges (not dismissed, not expired)
 */
export function getPendingNudges(state: LearningState): Nudge[] {
  const now = new Date();
  return state.pendingNudges
    .filter(n => !n.dismissed)
    .filter(n => !n.expiresAt || new Date(n.expiresAt) > now)
    .sort((a, b) => b.priority - a.priority);
}

/**
 * Dismiss a nudge by ID
 */
export function dismissNudge(state: LearningState, nudgeId: string): LearningState {
  return {
    ...state,
    pendingNudges: state.pendingNudges.map(n =>
      n.id === nudgeId ? { ...n, dismissed: true } : n
    ),
    nudgesDismissed: state.nudgesDismissed + 1,
  };
}

/**
 * Mark nudges as displayed
 */
export function markNudgesDisplayed(state: LearningState, count: number): LearningState {
  return {
    ...state,
    nudgesDisplayed: state.nudgesDisplayed + count,
  };
}

/**
 * Record retrospective completion
 */
export function recordRetroCompletion(
  state: LearningState,
  summary: RetroSummary
): LearningState {
  const today = new Date().toISOString().split('T')[0];
  return {
    ...state,
    lastWeeklyRetro: today,
    retroDue: false,
    retroDueReason: '',
    lastRetroSummary: summary,
    totalRetrosCompleted: state.totalRetrosCompleted + 1,
  };
}

/**
 * Migrate old learning state versions
 */
function migrateLearningState(state: LearningState): LearningState {
  if (!state.version) {
    state.version = LEARNING_STATE_VERSION;
  }

  // Add any missing fields
  if (state.totalRetrosCompleted === undefined) {
    state.totalRetrosCompleted = 0;
  }
  if (state.nudgesDisplayed === undefined) {
    state.nudgesDisplayed = 0;
  }
  if (state.nudgesDismissed === undefined) {
    state.nudgesDismissed = 0;
  }

  return state;
}
