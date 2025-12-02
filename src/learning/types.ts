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
