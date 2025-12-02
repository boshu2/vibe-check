# Automatic Learning & Retrospective Cadence - Implementation Plan

**Type:** Plan
**Created:** 2025-12-02
**Depends On:** `automatic-learning-cadence-research-2025-12-02.md`
**Loop:** Middle (bridges research to implementation)
**Tags:** learning-loop, retrospective, cadence, nudges, automation

---

## Overview

Implement automatic learning cadence for vibe-check, transforming passive data collection into active system improvement. This plan follows the **Hybrid A+B approach** from research:
- **Automatic triggers** in `recordSession()` for lightweight operations
- **Explicit `learn` command** for retrospectives and heavy operations
- **Nudge display** in CLI after analyze

**Scope:** 6 new files, 4 modified files, ~800 lines of new code

---

## Approach Selected

**From research:** Hybrid A+B - Hook lightweight cadence checks into `recordSession()`, provide explicit `learn` command for retrospectives.

**Rationale:**
- Automatic triggers catch users at natural breakpoints (post-session)
- Manual command respects user autonomy for retrospectives
- Low latency impact (cadence checks are O(1))
- Nudges displayed only when actionable

---

## PDC Strategy

### Prevent
- [x] Read all existing code (completed in research)
- [ ] Run `npm test` before starting
- [ ] Commit after each file creation

### Detect
- [ ] `npm run build` after each TypeScript file
- [ ] Test nudge display manually after integration
- [ ] Verify learning state persistence

### Correct
- [ ] Each module is independent - can revert selectively
- [ ] Learning state can be deleted to reset

---

## Files to Create

### 1. `src/learning/types.ts`

**Purpose:** Type definitions for learning system

```typescript
/**
 * Learning System Types
 *
 * Types for the automatic learning cadence system including:
 * - Learning state persistence
 * - Nudge queue management
 * - Retrospective summaries
 */

export type NudgeType = 'pattern' | 'intervention' | 'retro' | 'achievement' | 'learning';

export interface Nudge {
  id: string;
  type: NudgeType;
  icon: string;
  title: string;
  message: string;
  action?: string;
  priority: number;       // 1-10, higher = more important
  createdAt: string;      // ISO datetime
  expiresAt?: string;     // ISO datetime, null = never expires
  dismissed?: boolean;
}

export interface RetroSummary {
  date: string;           // ISO date
  periodStart: string;    // ISO date
  periodEnd: string;      // ISO date
  sessionsCount: number;
  commitsCount: number;
  activeMinutes: number;
  topPattern?: string;
  topIntervention?: string;
  keyInsight: string;
  trustPassRateChange?: number;
  spiralRateChange?: number;
  actionTaken?: string;
}

export interface LearningState {
  version: string;

  // Cadence tracking
  lastDailyCheck: string;        // ISO date (YYYY-MM-DD)
  lastWeeklyRetro: string;       // ISO date
  lastMonthlyReview: string;     // ISO date

  // Nudge queue (FIFO, max 5)
  pendingNudges: Nudge[];

  // Retrospective state
  retroDue: boolean;
  retroDueReason: string;
  lastRetroSummary?: RetroSummary;

  // Statistics
  totalRetrosCompleted: number;
  nudgesDisplayed: number;
  nudgesDismissed: number;
}

export interface CadenceResult {
  nudges: Nudge[];
  retroDue: boolean;
  retroDueReason?: string;
  learningState: LearningState;
}

export const NUDGE_TTL_DAYS = 7;
export const MAX_PENDING_NUDGES = 5;
export const RETRO_CADENCE_DAYS = 7;
export const PATTERN_REPEAT_THRESHOLD = 3;
export const PATTERN_WINDOW_DAYS = 7;
```

**Validation:** `npm run build`

---

### 2. `src/learning/storage.ts`

**Purpose:** Persist and load learning state

```typescript
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
```

**Validation:** `npm run build`

---

### 3. `src/learning/cadence.ts`

**Purpose:** Core cadence scheduler - checks triggers and generates nudges

```typescript
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
import { PatternMemory, InterventionMemory } from '../gamification/types';
import { getPatternDisplayName, getPatternAdvice } from '../gamification/pattern-memory';
import { getRecommendedIntervention, getInterventionDisplayName, getInterventionIcon } from '../gamification/intervention-memory';

/**
 * Run learning cadence check after a session
 *
 * Called from recordSession() to check all triggers and generate nudges.
 */
export function runLearningCadence(
  patternMemory: PatternMemory | undefined,
  interventionMemory: InterventionMemory | undefined,
  streakCurrent: number,
  xpToNextLevel: number,
  totalXp: number
): CadenceResult {
  const state = loadLearningState();
  const today = new Date().toISOString().split('T')[0];
  let updatedState = { ...state };

  const nudges: Nudge[] = [];

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
    const advice = getPatternAdvice(repeatedPattern.pattern);
    const intervention = getRecommendedIntervention(interventionMemory, repeatedPattern.pattern);
    const interventionText = intervention
      ? `Your top intervention for this: ${getInterventionIcon(intervention)} ${getInterventionDisplayName(intervention)}`
      : 'Try a tracer test to validate assumptions';

    updatedState = addNudge(updatedState, {
      type: 'pattern',
      icon: '⚠️',
      title: `${displayName} Pattern Detected`,
      message: `${displayName} caused ${repeatedPattern.count} spirals this week (${repeatedPattern.totalMinutes} min)`,
      action: interventionText,
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
```

**Validation:** `npm run build`

---

### 4. `src/learning/nudges.ts`

**Purpose:** Nudge display formatting for CLI output

```typescript
/**
 * Nudge Display System
 *
 * Formats and displays nudges in CLI output.
 */

import chalk from 'chalk';
import { Nudge } from './types';
import { loadLearningState, saveLearningState, markNudgesDisplayed, getPendingNudges } from './storage';

/**
 * Format nudges for CLI display (after gamification section)
 */
export function formatNudgesForCli(maxDisplay: number = 2): string[] {
  const state = loadLearningState();
  const nudges = getPendingNudges(state);

  if (nudges.length === 0) {
    return [];
  }

  const toDisplay = nudges.slice(0, maxDisplay);
  const lines: string[] = [];

  lines.push('');

  for (const nudge of toDisplay) {
    lines.push(formatSingleNudge(nudge));
  }

  if (nudges.length > maxDisplay) {
    lines.push(chalk.gray(`  ... and ${nudges.length - maxDisplay} more. Run \`vibe-check profile\` to see all.`));
  }

  // Mark as displayed
  const updatedState = markNudgesDisplayed(state, toDisplay.length);
  saveLearningState(updatedState);

  return lines;
}

/**
 * Format a single nudge for display
 */
function formatSingleNudge(nudge: Nudge): string {
  const lines: string[] = [];

  // Color based on type
  const colorFn = nudge.type === 'pattern' ? chalk.yellow :
                  nudge.type === 'retro' ? chalk.cyan :
                  nudge.type === 'achievement' ? chalk.green :
                  chalk.white;

  lines.push(colorFn(`  ${nudge.icon} ${nudge.title}`));
  lines.push(chalk.gray(`     ${nudge.message}`));

  if (nudge.action) {
    lines.push(chalk.gray(`     ${nudge.action}`));
  }

  return lines.join('\n');
}

/**
 * Get nudge summary for profile command
 */
export function getNudgeSummary(): {
  pending: number;
  displayed: number;
  dismissed: number;
  nudges: Nudge[];
} {
  const state = loadLearningState();
  const pending = getPendingNudges(state);

  return {
    pending: pending.length,
    displayed: state.nudgesDisplayed,
    dismissed: state.nudgesDismissed,
    nudges: pending,
  };
}
```

**Validation:** `npm run build`

---

### 5. `src/learning/retrospective.ts`

**Purpose:** Generate and display weekly retrospectives

```typescript
/**
 * Retrospective System
 *
 * Generates weekly retrospective summaries from accumulated data.
 */

import chalk from 'chalk';
import { RetroSummary } from './types';
import { loadLearningState, saveLearningState, recordRetroCompletion } from './storage';
import { loadProfile, getRecentSessions } from '../gamification/profile';
import { formatPatternMemory } from '../gamification/pattern-memory';
import { formatInterventionMemory } from '../gamification/intervention-memory';

/**
 * Generate a weekly retrospective summary
 */
export function generateWeeklyRetro(): RetroSummary {
  const profile = loadProfile();
  const sessions = getRecentSessions(profile, 7);

  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  // Calculate metrics
  const totalCommits = sessions.reduce((sum, s) => sum + s.commits, 0);
  const totalSpirals = sessions.reduce((sum, s) => sum + s.spirals, 0);
  const avgScore = sessions.length > 0
    ? Math.round(sessions.reduce((sum, s) => sum + s.vibeScore, 0) / sessions.length)
    : 0;

  // Get pattern analysis
  const patternData = formatPatternMemory(profile.patternMemory);
  const topPattern = patternData.topPatterns[0]?.pattern;

  // Get intervention analysis
  const interventionData = formatInterventionMemory(profile.interventionMemory);
  const topIntervention = interventionData.topInterventions[0]?.name;

  // Calculate changes from previous week
  const previousSessions = profile.sessions.slice(-14, -7);
  let trustPassRateChange: number | undefined;
  let spiralRateChange: number | undefined;

  if (previousSessions.length > 0 && sessions.length > 0) {
    const currentTrust = sessions.reduce((sum, s) =>
      sum + (s.metrics?.trustPassRate || 0), 0) / sessions.length;
    const prevTrust = previousSessions.reduce((sum, s) =>
      sum + (s.metrics?.trustPassRate || 0), 0) / previousSessions.length;
    trustPassRateChange = Math.round(currentTrust - prevTrust);

    const currentSpiralRate = totalSpirals / sessions.length;
    const prevSpiralRate = previousSessions.reduce((sum, s) => sum + s.spirals, 0) / previousSessions.length;
    spiralRateChange = Math.round((prevSpiralRate - currentSpiralRate) / (prevSpiralRate || 1) * 100);
  }

  // Generate key insight
  let keyInsight = '';
  if (totalSpirals === 0) {
    keyInsight = 'Zero spirals this week - excellent flow state!';
  } else if (topPattern && patternData.topPatterns[0]) {
    const topPatternData = patternData.topPatterns[0];
    keyInsight = `${topPatternData.displayName} is your main spiral trigger (${topPatternData.count} occurrences)`;
  } else {
    keyInsight = `${sessions.length} sessions completed with ${avgScore}% average score`;
  }

  return {
    date: now.toISOString().split('T')[0],
    periodStart: weekAgo.toISOString().split('T')[0],
    periodEnd: now.toISOString().split('T')[0],
    sessionsCount: sessions.length,
    commitsCount: totalCommits,
    activeMinutes: sessions.length * 30, // Estimate
    topPattern,
    topIntervention,
    keyInsight,
    trustPassRateChange,
    spiralRateChange,
  };
}

/**
 * Display retrospective in terminal
 */
export function displayRetro(summary: RetroSummary): void {
  const profile = loadProfile();
  const patternData = formatPatternMemory(profile.patternMemory);
  const interventionData = formatInterventionMemory(profile.interventionMemory);

  console.log('');
  console.log(chalk.bold.cyan('═'.repeat(64)));
  console.log(chalk.bold.cyan('  WEEKLY RETROSPECTIVE'));
  console.log(chalk.bold.cyan(`  ${summary.periodStart} - ${summary.periodEnd}`));
  console.log(chalk.bold.cyan('═'.repeat(64)));
  console.log('');

  // Sessions summary
  console.log(chalk.bold.white('  SESSIONS'));
  console.log(`    ${summary.sessionsCount} sessions | ${summary.commitsCount} commits`);
  console.log('');

  // Top patterns
  if (patternData.hasData && patternData.topPatterns.length > 0) {
    console.log(chalk.bold.white('  TOP SPIRAL TRIGGERS'));
    for (const pattern of patternData.topPatterns.slice(0, 3)) {
      console.log(`    ${pattern.displayName}: ${pattern.count} spirals (${pattern.totalMinutes} min)`);
      console.log(chalk.gray(`      ${pattern.advice}`));
    }
    console.log('');
  }

  // What worked
  if (interventionData.hasData && interventionData.topInterventions.length > 0) {
    console.log(chalk.bold.white('  WHAT WORKED'));
    for (const intervention of interventionData.topInterventions.slice(0, 3)) {
      console.log(`    ${intervention.icon} ${intervention.name}: ${intervention.count} times`);
    }
    console.log('');
  }

  // Progress
  console.log(chalk.bold.white('  PROGRESS'));
  if (summary.trustPassRateChange !== undefined) {
    const trustColor = summary.trustPassRateChange >= 0 ? chalk.green : chalk.yellow;
    const trustSign = summary.trustPassRateChange >= 0 ? '+' : '';
    console.log(`    Trust Pass Rate: ${trustColor(`${trustSign}${summary.trustPassRateChange}%`)}`);
  }
  if (summary.spiralRateChange !== undefined) {
    const spiralColor = summary.spiralRateChange >= 0 ? chalk.green : chalk.yellow;
    const spiralSign = summary.spiralRateChange >= 0 ? '+' : '';
    console.log(`    Spiral Reduction: ${spiralColor(`${spiralSign}${summary.spiralRateChange}%`)}`);
  }
  console.log('');

  // Key insight
  console.log(chalk.bold.cyan(`  KEY INSIGHT: ${summary.keyInsight}`));
  console.log('');

  console.log(chalk.bold.cyan('═'.repeat(64)));
  console.log('');
}

/**
 * Run and save retrospective
 */
export function runAndSaveRetro(): RetroSummary {
  const summary = generateWeeklyRetro();
  displayRetro(summary);

  const state = loadLearningState();
  const updatedState = recordRetroCompletion(state, summary);
  saveLearningState(updatedState);

  return summary;
}

/**
 * Check if retrospective is due
 */
export function isRetroDue(): { due: boolean; reason: string; daysSince: number } {
  const state = loadLearningState();

  if (!state.lastWeeklyRetro) {
    return { due: true, reason: 'No retrospective recorded yet', daysSince: 999 };
  }

  const lastRetro = new Date(state.lastWeeklyRetro);
  const now = new Date();
  const daysSince = Math.floor((now.getTime() - lastRetro.getTime()) / (1000 * 60 * 60 * 24));

  if (daysSince >= 7) {
    return { due: true, reason: `${daysSince} days since last retrospective`, daysSince };
  }

  return { due: false, reason: '', daysSince };
}
```

**Validation:** `npm run build`

---

### 6. `src/learning/index.ts`

**Purpose:** Export all learning module functions

```typescript
/**
 * Learning System - Automatic learning cadence for vibe-check
 *
 * This module provides:
 * - Cadence-based triggers for learning
 * - Nudge generation and display
 * - Weekly retrospectives
 */

export * from './types';
export * from './storage';
export * from './cadence';
export * from './nudges';
export * from './retrospective';
```

**Validation:** `npm run build`

---

### 7. `src/commands/learn.ts`

**Purpose:** Explicit learn command for retrospectives and learning operations

```typescript
import { Command } from 'commander';
import chalk from 'chalk';
import { runAndSaveRetro, isRetroDue, generateWeeklyRetro, displayRetro } from '../learning/retrospective';
import { loadLearningState, saveLearningState, getPendingNudges, dismissNudge } from '../learning/storage';
import { formatPatternMemory, getPatternDisplayName, getPatternAdvice } from '../gamification/pattern-memory';
import { formatInterventionMemory } from '../gamification/intervention-memory';
import { loadProfile } from '../gamification/profile';

export function createLearnCommand(): Command {
  const cmd = new Command('learn')
    .description('Run learning operations - retrospectives, pattern analysis, nudge management')
    .option('--retro', 'Run weekly retrospective')
    .option('--status', 'Show learning status and pending nudges')
    .option('--pattern <name>', 'Show details for a specific pattern (e.g., SSL_TLS)')
    .option('--dismiss <id>', 'Dismiss a nudge by ID')
    .option('--dismiss-all', 'Dismiss all pending nudges')
    .action(async (options) => {
      await runLearn(options);
    });

  return cmd;
}

interface LearnOptions {
  retro?: boolean;
  status?: boolean;
  pattern?: string;
  dismiss?: string;
  dismissAll?: boolean;
}

async function runLearn(options: LearnOptions): Promise<void> {
  // Default to status if no options
  if (!options.retro && !options.pattern && !options.dismiss && !options.dismissAll) {
    options.status = true;
  }

  if (options.retro) {
    await runRetro();
    return;
  }

  if (options.status) {
    showStatus();
    return;
  }

  if (options.pattern) {
    showPattern(options.pattern);
    return;
  }

  if (options.dismissAll) {
    dismissAllNudges();
    return;
  }

  if (options.dismiss) {
    dismissSingleNudge(options.dismiss);
    return;
  }
}

async function runRetro(): Promise<void> {
  const retroCheck = isRetroDue();

  if (!retroCheck.due) {
    console.log(chalk.yellow(`\nRetrospective not due yet (${retroCheck.daysSince} days since last).`));
    console.log(chalk.gray('Run with --force to run anyway.\n'));

    // Ask if they want to run anyway
    const profile = loadProfile();
    if (profile.sessions.length >= 3) {
      console.log(chalk.gray('Running anyway since you have recent sessions...\n'));
      runAndSaveRetro();
    }
    return;
  }

  runAndSaveRetro();
}

function showStatus(): void {
  const state = loadLearningState();
  const profile = loadProfile();
  const nudges = getPendingNudges(state);
  const retroCheck = isRetroDue();

  console.log('');
  console.log(chalk.bold.cyan('═'.repeat(64)));
  console.log(chalk.bold.cyan('  LEARNING STATUS'));
  console.log(chalk.bold.cyan('═'.repeat(64)));
  console.log('');

  // Retro status
  if (retroCheck.due) {
    console.log(chalk.yellow(`  📅 Retrospective due: ${retroCheck.reason}`));
    console.log(chalk.gray('     Run `vibe-check learn --retro` to complete'));
  } else {
    console.log(chalk.green(`  📅 Retrospective: ${retroCheck.daysSince} days ago (due in ${7 - retroCheck.daysSince} days)`));
  }
  console.log('');

  // Pending nudges
  if (nudges.length > 0) {
    console.log(chalk.bold.white(`  PENDING NUDGES (${nudges.length})`));
    for (const nudge of nudges) {
      console.log(`    ${nudge.icon} ${nudge.title}`);
      console.log(chalk.gray(`       ${nudge.message}`));
      console.log(chalk.gray(`       ID: ${nudge.id}`));
    }
  } else {
    console.log(chalk.gray('  No pending nudges'));
  }
  console.log('');

  // Pattern summary
  const patternData = formatPatternMemory(profile.patternMemory);
  if (patternData.hasData) {
    console.log(chalk.bold.white('  PATTERN SUMMARY'));
    console.log(`    ${patternData.summary}`);
    console.log(chalk.gray(`    Avg recovery time: ${patternData.avgRecoveryTime} min`));
  }
  console.log('');

  // Stats
  console.log(chalk.bold.white('  LEARNING STATS'));
  console.log(`    Retrospectives completed: ${state.totalRetrosCompleted}`);
  console.log(`    Nudges displayed: ${state.nudgesDisplayed}`);
  console.log(`    Nudges dismissed: ${state.nudgesDismissed}`);
  console.log('');

  console.log(chalk.bold.cyan('═'.repeat(64)));
  console.log('');
}

function showPattern(patternName: string): void {
  const profile = loadProfile();
  const displayName = getPatternDisplayName(patternName);
  const advice = getPatternAdvice(patternName);

  console.log('');
  console.log(chalk.bold.cyan(`  PATTERN: ${displayName}`));
  console.log('');

  const patternMemory = profile.patternMemory;
  if (!patternMemory) {
    console.log(chalk.gray('  No pattern data recorded yet.'));
    return;
  }

  const records = patternMemory.records.filter(r => r.pattern === patternName);
  const count = patternMemory.patternCounts[patternName] || 0;
  const totalMinutes = patternMemory.patternDurations[patternName] || 0;

  console.log(`  Occurrences: ${count}`);
  console.log(`  Total time lost: ${totalMinutes} min`);
  console.log(`  Avg recovery: ${count > 0 ? Math.round(totalMinutes / count) : 0} min`);
  console.log('');
  console.log(chalk.bold.yellow(`  ADVICE: ${advice}`));
  console.log('');

  // Recent occurrences
  if (records.length > 0) {
    console.log(chalk.bold.white('  RECENT OCCURRENCES'));
    for (const record of records.slice(-5).reverse()) {
      console.log(`    ${record.date}: ${record.component} (${record.duration} min, ${record.commits} commits)`);
    }
  }
  console.log('');
}

function dismissAllNudges(): void {
  let state = loadLearningState();
  const nudges = getPendingNudges(state);

  for (const nudge of nudges) {
    state = dismissNudge(state, nudge.id);
  }

  saveLearningState(state);
  console.log(chalk.green(`\n  Dismissed ${nudges.length} nudges.\n`));
}

function dismissSingleNudge(nudgeId: string): void {
  const state = loadLearningState();
  const updatedState = dismissNudge(state, nudgeId);
  saveLearningState(updatedState);
  console.log(chalk.green(`\n  Nudge dismissed.\n`));
}
```

**Validation:** `npm run build`

---

## Files to Modify

### 1. `src/gamification/profile.ts:255-258`

**Purpose:** Add learning cadence check after saving profile

**Before (line 255-258):**
```typescript
  // Save profile
  saveProfile(profile);

  return {
```

**After:**
```typescript
  // Save profile
  saveProfile(profile);

  // Run learning cadence check (generates nudges)
  const { runLearningCadence } = require('../learning/cadence');
  runLearningCadence(
    profile.patternMemory,
    profile.interventionMemory,
    profile.streak.current,
    profile.xp.nextLevelXP - profile.xp.currentLevelXP,
    profile.xp.total
  );

  return {
```

**Validation:** `npm run build && npm test`

---

### 2. `src/commands/analyze.ts:388-390`

**Purpose:** Display pending nudges after gamification section

**Before (line 388-390):**
```typescript
      console.log(chalk.cyan('─'.repeat(64)));
      console.log(chalk.gray(`  Run ${chalk.white('vibe-check profile')} to see your full stats`));
      console.log();
```

**After:**
```typescript
      console.log(chalk.cyan('─'.repeat(64)));

      // Display pending nudges from learning system
      const { formatNudgesForCli } = require('../learning/nudges');
      const nudgeLines = formatNudgesForCli(2);
      if (nudgeLines.length > 0) {
        for (const line of nudgeLines) {
          console.log(line);
        }
        console.log(chalk.cyan('─'.repeat(64)));
      }

      console.log(chalk.gray(`  Run ${chalk.white('vibe-check profile')} to see your full stats`));
      console.log();
```

**Validation:** `npm run build && npm run dev --score`

---

### 3. `src/cli.ts:4`

**Purpose:** Import learn command

**Before (line 4):**
```typescript
import { createAnalyzeCommand, createStartCommand, createProfileCommand, createInitHookCommand, createWatchCommand, createInterveneCommand, createTimelineCommand, createCacheCommand, createDashboardCommand, runAnalyze } from './commands';
```

**After:**
```typescript
import { createAnalyzeCommand, createStartCommand, createProfileCommand, createInitHookCommand, createWatchCommand, createInterveneCommand, createTimelineCommand, createCacheCommand, createDashboardCommand, createLearnCommand, runAnalyze } from './commands';
```

**Validation:** `npm run build`

---

### 4. `src/cli.ts:27` (add after line 27)

**Purpose:** Register learn command

**Before (line 27):**
```typescript
program.addCommand(createDashboardCommand());
```

**After:**
```typescript
program.addCommand(createDashboardCommand());
program.addCommand(createLearnCommand());
```

**Validation:** `npm run build && npm run dev learn --help`

---

### 5. `src/commands/index.ts:9` (add after line 9)

**Purpose:** Export learn command

**Before (line 9):**
```typescript
export { createDashboardCommand } from './dashboard';
```

**After:**
```typescript
export { createDashboardCommand } from './dashboard';
export { createLearnCommand } from './learn';
```

**Validation:** `npm run build`

---

## Implementation Order

**CRITICAL: Sequence matters. Do not reorder.**

| Step | Action | Validation | Rollback |
|------|--------|------------|----------|
| 0 | Run baseline tests | `npm test` passes | N/A |
| 1 | Create `src/learning/types.ts` | `npm run build` | Delete file |
| 2 | Create `src/learning/storage.ts` | `npm run build` | Delete file |
| 3 | Create `src/learning/cadence.ts` | `npm run build` | Delete file |
| 4 | Create `src/learning/nudges.ts` | `npm run build` | Delete file |
| 5 | Create `src/learning/retrospective.ts` | `npm run build` | Delete file |
| 6 | Create `src/learning/index.ts` | `npm run build` | Delete file |
| 7 | Create `src/commands/learn.ts` | `npm run build` | Delete file |
| 8 | Modify `src/commands/index.ts` | `npm run build` | Revert file |
| 9 | Modify `src/cli.ts` | `npm run build` | Revert file |
| 10 | Modify `src/gamification/profile.ts` | `npm run build` | Revert file |
| 11 | Modify `src/commands/analyze.ts` | `npm run build` | Revert file |
| 12 | Full test | `npm test && npm run dev --score` | Revert all |
| 13 | Commit | `git commit` | N/A |

---

## Validation Strategy

### Syntax Validation
```bash
npm run build
# Expected: No TypeScript errors
```

### Unit Test Validation
```bash
npm test
# Expected: All existing tests pass
```

### Integration Validation

**Test learn command:**
```bash
npm run dev learn --status
# Expected: Shows learning status, no errors

npm run dev learn --retro
# Expected: Shows retrospective summary

npm run dev learn --help
# Expected: Shows command options
```

**Test nudge display:**
```bash
npm run dev --score --since "1 week ago"
# Expected: Shows gamification + any pending nudges
```

**Test learning state persistence:**
```bash
cat ~/.vibe-check/learning-state.json
# Expected: JSON with version, cadence dates, nudges array
```

---

## Rollback Procedure

**Time to rollback:** ~3 minutes

### Full Rollback
```bash
# Step 1: Remove new files
rm -rf src/learning/
rm src/commands/learn.ts

# Step 2: Revert modified files
git checkout \
  src/gamification/profile.ts \
  src/commands/analyze.ts \
  src/commands/index.ts \
  src/cli.ts

# Step 3: Rebuild
npm run build

# Step 4: Verify
npm test
```

### Partial Rollback (keep learn command, remove auto-triggers)
```bash
git checkout src/gamification/profile.ts src/commands/analyze.ts
npm run build
```

---

## Risk Assessment

### Low Risk: Additional Latency
- **What:** Learning cadence check adds latency to analyze
- **Mitigation:** All checks are O(1) - just date comparisons and array filters
- **Detection:** `time npm run dev --score`
- **Recovery:** Revert profile.ts modification

### Low Risk: Learning State Corruption
- **What:** Invalid JSON in learning-state.json
- **Mitigation:** Try-catch with default state fallback
- **Detection:** Errors during `learn --status`
- **Recovery:** Delete ~/.vibe-check/learning-state.json

### Very Low Risk: Existing Tests
- **What:** New code could break existing functionality
- **Mitigation:** No existing files have logic changes, only additions
- **Detection:** `npm test`
- **Recovery:** Revert all changes

---

## Approval Checklist

**Human must verify before /implement:**

- [ ] Every file specified precisely (file:line)
- [ ] All templates complete (no placeholders)
- [ ] Validation commands provided
- [ ] Rollback procedure complete
- [ ] Implementation order is correct
- [ ] Risks identified and mitigated
- [ ] No breaking changes to existing functionality

---

## Summary: What Changes

### New Capabilities
1. **`vibe-check learn --status`** - View learning state, pending nudges, pattern summary
2. **`vibe-check learn --retro`** - Run weekly retrospective with summary
3. **`vibe-check learn --pattern <name>`** - Deep dive into specific spiral pattern
4. **`vibe-check learn --dismiss-all`** - Clear pending nudges
5. **Automatic nudges** - Displayed after gamification in analyze output
6. **Cadence triggers** - Weekly retro reminders, pattern warnings, level-up hints

### Data Flow
```
analyze --score
    ↓
recordSession()
    ↓ (new)
runLearningCadence() → generates nudges if conditions met
    ↓
display gamification
    ↓ (new)
formatNudgesForCli() → shows pending nudges
```

---

## Next Step

Once approved: `/implement automatic-learning-cadence-plan-2025-12-02.md`
