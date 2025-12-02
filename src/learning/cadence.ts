/**
 * Learning Cadence Scheduler
 *
 * Checks time-based and event-based triggers to generate nudges
 * and determine when retrospectives are due.
 */

import {
  LearningState,
  CadenceResult,
  Nudge,
  RETRO_CADENCE_DAYS,
  PATTERN_REPEAT_THRESHOLD,
  PATTERN_WINDOW_DAYS,
} from './types';
import { loadLearningState, saveLearningState, addNudge } from './storage';
import { PatternMemory } from '../gamification/types';
import { getPatternDisplayName } from '../gamification/pattern-memory';

/**
 * Run learning cadence check after a session
 *
 * Called from recordSession() to check all triggers and generate nudges.
 */
export function runLearningCadence(
  patternMemory: PatternMemory | undefined,
  streakCurrent: number,
  xpToNextLevel: number,
  totalXp: number
): CadenceResult {
  const state = loadLearningState();
  const today = new Date().toISOString().split('T')[0];
  let updatedState = { ...state };

  // 1. Check daily trigger (first session of day)
  if (state.lastDailyCheck !== today) {
    updatedState.lastDailyCheck = today;
    // Could add daily summary nudge here if desired
  }

  // 2. Check weekly retro trigger
  const daysSinceRetro = getDaysSince(state.lastWeeklyRetro);
  if (daysSinceRetro >= RETRO_CADENCE_DAYS) {
    updatedState.retroDue = true;
    updatedState.retroDueReason = `${daysSinceRetro} days since last retrospective`;
  }

  // 3. Check pattern repeat threshold
  const repeatedPattern = getRepeatedPattern(patternMemory);
  if (repeatedPattern) {
    const displayName = getPatternDisplayName(repeatedPattern.pattern);

    updatedState = addNudge(updatedState, {
      type: 'pattern',
      icon: '⚠️',
      title: `${displayName} Pattern Detected`,
      message: `${displayName} caused ${repeatedPattern.count} spirals this week (${repeatedPattern.totalMinutes} min)`,
      action: 'Try a tracer test to validate assumptions',
      priority: 8,
    });
  }

  // 4. Check achievement proximity (within 20% of next level)
  const xpProgress = xpToNextLevel > 0 ? (totalXp % xpToNextLevel) / xpToNextLevel : 0;
  if (xpProgress >= 0.8) {
    const xpNeeded = Math.round(xpToNextLevel * (1 - xpProgress));
    updatedState = addNudge(updatedState, {
      type: 'achievement',
      icon: '📈',
      title: 'Level Up Soon!',
      message: `Only ${xpNeeded} XP to your next level`,
      priority: 5,
    });
  }

  // 5. Check streak milestone proximity
  if (streakCurrent > 0 && streakCurrent % 7 === 6) {
    updatedState = addNudge(updatedState, {
      type: 'achievement',
      icon: '🔥',
      title: 'Streak Milestone Tomorrow!',
      message: `One more day for a ${streakCurrent + 1}-day streak`,
      priority: 6,
    });
  }

  // 6. Add retro nudge if due
  if (updatedState.retroDue) {
    updatedState = addNudge(updatedState, {
      type: 'retro',
      icon: '📅',
      title: 'Weekly Retro Due',
      message: updatedState.retroDueReason,
      action: 'Run `vibe-check learn --retro` to review your week',
      priority: 7,
    });
  }

  // Save updated state
  saveLearningState(updatedState);

  return {
    nudges: updatedState.pendingNudges.filter(n => !n.dismissed),
    retroDue: updatedState.retroDue,
    retroDueReason: updatedState.retroDueReason,
    learningState: updatedState,
  };
}

/**
 * Get days since a date string
 */
function getDaysSince(dateStr: string): number {
  if (!dateStr) return RETRO_CADENCE_DAYS + 1; // Force retro if no date
  const date = new Date(dateStr);
  const now = new Date();
  return Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Check if any pattern has repeated >= threshold times in the window
 */
function getRepeatedPattern(
  patternMemory: PatternMemory | undefined
): { pattern: string; count: number; totalMinutes: number } | null {
  if (!patternMemory || patternMemory.records.length === 0) {
    return null;
  }

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - PATTERN_WINDOW_DAYS);
  const cutoffStr = cutoff.toISOString().split('T')[0];

  // Count patterns in the window
  const recentRecords = patternMemory.records.filter(r => r.date >= cutoffStr);
  const patternCounts = new Map<string, { count: number; minutes: number }>();

  for (const record of recentRecords) {
    const current = patternCounts.get(record.pattern) || { count: 0, minutes: 0 };
    patternCounts.set(record.pattern, {
      count: current.count + 1,
      minutes: current.minutes + record.duration,
    });
  }

  // Find first pattern exceeding threshold
  for (const [pattern, data] of patternCounts) {
    if (data.count >= PATTERN_REPEAT_THRESHOLD) {
      return {
        pattern,
        count: data.count,
        totalMinutes: data.minutes,
      };
    }
  }

  return null;
}
