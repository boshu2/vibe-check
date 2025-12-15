import * as path from 'path';
import {
  TimelineResult,
  TimelineSession,
  TimelineDay,
  TimelineEvent,
} from '../types.js';
import { atomicWriteSync, safeReadJsonSync } from './atomic.js';
import { CURRENT_SCHEMA_VERSION, SchemaVersion } from './schema.js';

const STORE_DIR = '.vibe-check';
const TIMELINE_FILE = 'timeline.json';

export interface TimelineStore {
  version: SchemaVersion;
  lastUpdated: string;
  lastCommitHash: string; // For incremental sync

  // Cached timeline data
  sessions: StoredSession[];

  // Compounding learnings
  insights: StoredInsight[];
  patterns: PatternStats;
  trends: TrendData;
}

export interface StoredSession {
  id: string;
  date: string; // YYYY-MM-DD
  start: string; // ISO timestamp
  end: string;
  duration: number;
  commitCount: number;
  commitHashes: string[]; // For deduplication

  // Metrics
  overall: string;
  trustPassRate: number;
  reworkRatio: number;
  xpEarned: number;

  // Patterns detected
  flowState: boolean;
  spiralCount: number;
  spiralComponents: string[];
}

export interface StoredInsight {
  id: string;
  type: 'pattern' | 'trend' | 'recommendation';
  category: string;
  message: string;
  firstSeen: string;
  lastSeen: string;
  occurrences: number;
  metadata?: Record<string, unknown>;
}

export interface PatternStats {
  // Flow state stats
  totalFlowStates: number;
  avgFlowDuration: number;
  peakFlowHour: number; // 0-23

  // Spiral stats
  totalSpirals: number;
  avgSpiralDuration: number;
  spiralsByComponent: Record<string, number>;
  spiralsByHour: Record<number, number>;

  // Late night stats
  lateNightSessions: number;
  lateNightAvgDuration: number;

  // Detour stats
  totalDetours: number;
  totalTimeLostToDetours: number;

  // Post-delete sprints
  postDeleteSprints: number;
  avgVelocityIncrease: number;
}

export interface TrendData {
  // Weekly trends (last 12 weeks)
  weekly: WeekTrend[];

  // Monthly trends (last 6 months)
  monthly: MonthTrend[];

  // Improvement tracking
  improvements: {
    metric: string;
    direction: 'up' | 'down' | 'stable';
    change: number; // percentage
    period: string;
  }[];
}

export interface WeekTrend {
  weekStart: string; // YYYY-MM-DD
  sessions: number;
  commits: number;
  flowStates: number;
  spirals: number;
  avgScore: number;
  activeMinutes: number;
}

export interface MonthTrend {
  month: string; // YYYY-MM
  sessions: number;
  commits: number;
  flowStates: number;
  spirals: number;
  avgScore: number;
  activeMinutes: number;
}

/**
 * Get store directory path (repo-local)
 */
export function getStoreDir(repoPath: string = process.cwd()): string {
  return path.join(repoPath, STORE_DIR);
}

/**
 * Get timeline store file path
 */
export function getStorePath(repoPath: string = process.cwd()): string {
  return path.join(getStoreDir(repoPath), TIMELINE_FILE);
}

/**
 * Create initial empty store
 */
export function createInitialStore(): TimelineStore {
  return {
    version: CURRENT_SCHEMA_VERSION,
    lastUpdated: new Date().toISOString(),
    lastCommitHash: '',
    sessions: [],
    insights: [],
    patterns: {
      totalFlowStates: 0,
      avgFlowDuration: 0,
      peakFlowHour: 12,
      totalSpirals: 0,
      avgSpiralDuration: 0,
      spiralsByComponent: {},
      spiralsByHour: {},
      lateNightSessions: 0,
      lateNightAvgDuration: 0,
      totalDetours: 0,
      totalTimeLostToDetours: 0,
      postDeleteSprints: 0,
      avgVelocityIncrease: 0,
    },
    trends: {
      weekly: [],
      monthly: [],
      improvements: [],
    },
  };
}

/**
 * Load timeline store from disk
 */
export function loadStore(repoPath: string = process.cwd()): TimelineStore {
  const filePath = getStorePath(repoPath);
  const initialStore = createInitialStore();

  const store = safeReadJsonSync<TimelineStore>(filePath, initialStore);

  // Always migrate (handles both old versions and fresh stores)
  return migrateTimelineStore(store);
}

/**
 * Save timeline store to disk
 */
export function saveStore(store: TimelineStore, repoPath: string = process.cwd()): void {
  const filePath = getStorePath(repoPath);

  store.lastUpdated = new Date().toISOString();

  // Use atomic write to prevent corruption
  atomicWriteSync(filePath, JSON.stringify(store, null, 2));
}

/**
 * Get last known commit hash for incremental sync
 */
export function getLastCommitHash(repoPath: string = process.cwd()): string {
  const store = loadStore(repoPath);
  return store.lastCommitHash;
}

/**
 * Check if a session already exists (by commit hashes)
 */
export function sessionExists(store: TimelineStore, commitHashes: string[]): boolean {
  const hashSet = new Set(commitHashes);

  for (const session of store.sessions) {
    // Check for significant overlap (>80% of commits match)
    const matchCount = session.commitHashes.filter(h => hashSet.has(h)).length;
    const overlapRatio = matchCount / Math.max(session.commitHashes.length, commitHashes.length);

    if (overlapRatio > 0.8) {
      return true;
    }
  }

  return false;
}

/**
 * Convert TimelineSession to StoredSession for persistence
 */
export function sessionToStored(session: TimelineSession): StoredSession {
  return {
    id: session.id,
    date: session.start.toISOString().split('T')[0],
    start: session.start.toISOString(),
    end: session.end.toISOString(),
    duration: session.duration,
    commitCount: session.commits.length,
    commitHashes: session.commits.map(c => c.hash),
    overall: session.overall,
    trustPassRate: session.trustPassRate,
    reworkRatio: session.reworkRatio,
    xpEarned: session.xpEarned,
    flowState: session.flowState,
    spiralCount: session.spirals.length,
    spiralComponents: session.spirals.map(s => s.component),
  };
}

/**
 * Update store with new timeline data
 */
export function updateStore(
  store: TimelineStore,
  timeline: TimelineResult,
  lastCommitHash: string
): TimelineStore {
  // Add new sessions (skip duplicates)
  for (const session of timeline.sessions) {
    const commitHashes = session.commits.map(c => c.hash);

    if (!sessionExists(store, commitHashes)) {
      store.sessions.push(sessionToStored(session));
    }
  }

  // Update pattern stats
  updatePatternStats(store, timeline);

  // Update trends
  updateTrends(store);

  // Generate new insights
  generateInsights(store, timeline);

  // Update last commit hash
  store.lastCommitHash = lastCommitHash;

  // Keep only last 500 sessions (roughly 1 year of daily coding)
  if (store.sessions.length > 500) {
    store.sessions = store.sessions.slice(-500);
  }

  return store;
}

/**
 * Update pattern statistics from new timeline data
 */
function updatePatternStats(store: TimelineStore, timeline: TimelineResult): void {
  const stats = store.patterns;

  // Flow states
  const flowSessions = timeline.sessions.filter(s => s.flowState);
  if (flowSessions.length > 0) {
    stats.totalFlowStates += flowSessions.length;
    const totalFlowDuration = flowSessions.reduce((sum, s) => sum + s.duration, 0);
    stats.avgFlowDuration = Math.round(
      (stats.avgFlowDuration * (stats.totalFlowStates - flowSessions.length) + totalFlowDuration) /
      stats.totalFlowStates
    );

    // Calculate peak flow hour
    const hourCounts: Record<number, number> = {};
    for (const session of flowSessions) {
      const hour = session.start.getHours();
      hourCounts[hour] = (hourCounts[hour] || 0) + 1;
    }
    const peakHour = Object.entries(hourCounts)
      .sort((a, b) => b[1] - a[1])[0];
    if (peakHour) {
      stats.peakFlowHour = parseInt(peakHour[0]);
    }
  }

  // Spirals
  const spiralCount = timeline.totalSpirals;
  if (spiralCount > 0) {
    stats.totalSpirals += spiralCount;

    // Track spirals by component and hour
    for (const session of timeline.sessions) {
      for (const spiral of session.spirals) {
        stats.spiralsByComponent[spiral.component] =
          (stats.spiralsByComponent[spiral.component] || 0) + 1;

        const hour = session.start.getHours();
        stats.spiralsByHour[hour] = (stats.spiralsByHour[hour] || 0) + 1;
      }
    }
  }

  // Late night sessions
  if (timeline.lateNightSpirals?.detected) {
    stats.lateNightSessions += timeline.lateNightSpirals.spirals.length;
    if (timeline.lateNightSpirals.totalDuration > 0) {
      stats.lateNightAvgDuration = Math.round(
        (stats.lateNightAvgDuration * (stats.lateNightSessions - timeline.lateNightSpirals.spirals.length) +
         timeline.lateNightSpirals.totalDuration) / stats.lateNightSessions
      );
    }
  }

  // Detours
  if (timeline.detours?.detected) {
    stats.totalDetours += timeline.detours.detours.length;
    stats.totalTimeLostToDetours += timeline.detours.totalTimeLost;
  }

  // Post-delete sprints
  if (timeline.postDeleteSprint?.detected) {
    stats.postDeleteSprints += 1;
    stats.avgVelocityIncrease = Math.round(
      (stats.avgVelocityIncrease * (stats.postDeleteSprints - 1) +
       timeline.postDeleteSprint.velocityIncrease) / stats.postDeleteSprints * 10
    ) / 10;
  }
}

/**
 * Update weekly and monthly trends
 */
function updateTrends(store: TimelineStore): void {
  const sessions = store.sessions;
  if (sessions.length === 0) return;

  // Group sessions by week
  const weeklyMap = new Map<string, StoredSession[]>();
  const monthlyMap = new Map<string, StoredSession[]>();

  for (const session of sessions) {
    const date = new Date(session.start);

    // Week key (Monday of that week)
    const weekStart = new Date(date);
    weekStart.setDate(date.getDate() - date.getDay() + 1);
    const weekKey = weekStart.toISOString().split('T')[0];

    if (!weeklyMap.has(weekKey)) weeklyMap.set(weekKey, []);
    weeklyMap.get(weekKey)!.push(session);

    // Month key
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    if (!monthlyMap.has(monthKey)) monthlyMap.set(monthKey, []);
    monthlyMap.get(monthKey)!.push(session);
  }

  // Convert to trend arrays (last 12 weeks)
  store.trends.weekly = Array.from(weeklyMap.entries())
    .sort((a, b) => b[0].localeCompare(a[0]))
    .slice(0, 12)
    .map(([weekStart, weekSessions]) => ({
      weekStart,
      sessions: weekSessions.length,
      commits: weekSessions.reduce((sum, s) => sum + s.commitCount, 0),
      flowStates: weekSessions.filter(s => s.flowState).length,
      spirals: weekSessions.reduce((sum, s) => sum + s.spiralCount, 0),
      avgScore: Math.round(
        weekSessions.reduce((sum, s) => sum + s.trustPassRate, 0) / weekSessions.length
      ),
      activeMinutes: weekSessions.reduce((sum, s) => sum + s.duration, 0),
    }))
    .reverse();

  // Convert to monthly trends (last 6 months)
  store.trends.monthly = Array.from(monthlyMap.entries())
    .sort((a, b) => b[0].localeCompare(a[0]))
    .slice(0, 6)
    .map(([month, monthSessions]) => ({
      month,
      sessions: monthSessions.length,
      commits: monthSessions.reduce((sum, s) => sum + s.commitCount, 0),
      flowStates: monthSessions.filter(s => s.flowState).length,
      spirals: monthSessions.reduce((sum, s) => sum + s.spiralCount, 0),
      avgScore: Math.round(
        monthSessions.reduce((sum, s) => sum + s.trustPassRate, 0) / monthSessions.length
      ),
      activeMinutes: monthSessions.reduce((sum, s) => sum + s.duration, 0),
    }))
    .reverse();

  // Calculate improvements (compare last 2 weeks)
  if (store.trends.weekly.length >= 2) {
    const recent = store.trends.weekly[store.trends.weekly.length - 1];
    const previous = store.trends.weekly[store.trends.weekly.length - 2];

    store.trends.improvements = [];

    // Flow states improvement
    if (previous.flowStates > 0) {
      const change = ((recent.flowStates - previous.flowStates) / previous.flowStates) * 100;
      store.trends.improvements.push({
        metric: 'flowStates',
        direction: change > 5 ? 'up' : change < -5 ? 'down' : 'stable',
        change: Math.round(change),
        period: 'week',
      });
    }

    // Spirals improvement (lower is better)
    if (previous.spirals > 0) {
      const change = ((recent.spirals - previous.spirals) / previous.spirals) * 100;
      store.trends.improvements.push({
        metric: 'spirals',
        direction: change < -5 ? 'up' : change > 5 ? 'down' : 'stable', // Inverted
        change: Math.round(-change), // Positive = fewer spirals
        period: 'week',
      });
    }
  }
}

/**
 * Generate compounding insights from accumulated data
 */
function generateInsights(store: TimelineStore, timeline: TimelineResult): void {
  const stats = store.patterns;
  const now = new Date().toISOString();

  // Late night insight
  if (stats.lateNightSessions >= 3) {
    const existingInsight = store.insights.find(i => i.id === 'late-night-pattern');
    if (existingInsight) {
      existingInsight.lastSeen = now;
      existingInsight.occurrences = stats.lateNightSessions;
      existingInsight.message = `You've had ${stats.lateNightSessions} late-night spirals, averaging ${stats.lateNightAvgDuration}m each. Fresh eyes typically resolve these faster.`;
    } else {
      store.insights.push({
        id: 'late-night-pattern',
        type: 'pattern',
        category: 'timing',
        message: `You've had ${stats.lateNightSessions} late-night spirals, averaging ${stats.lateNightAvgDuration}m each. Fresh eyes typically resolve these faster.`,
        firstSeen: now,
        lastSeen: now,
        occurrences: stats.lateNightSessions,
      });
    }
  }

  // Peak flow hour insight
  if (stats.totalFlowStates >= 5) {
    const hour = stats.peakFlowHour;
    const hourStr = hour < 12 ? `${hour}am` : hour === 12 ? '12pm' : `${hour - 12}pm`;

    const existingInsight = store.insights.find(i => i.id === 'peak-flow-hour');
    if (existingInsight) {
      existingInsight.lastSeen = now;
      existingInsight.occurrences = stats.totalFlowStates;
      existingInsight.message = `Your flow states peak around ${hourStr}. Protect this time for deep work.`;
    } else {
      store.insights.push({
        id: 'peak-flow-hour',
        type: 'recommendation',
        category: 'timing',
        message: `Your flow states peak around ${hourStr}. Protect this time for deep work.`,
        firstSeen: now,
        lastSeen: now,
        occurrences: stats.totalFlowStates,
        metadata: { peakHour: hour },
      });
    }
  }

  // Component spiral pattern
  const topSpiralComponent = Object.entries(stats.spiralsByComponent)
    .sort((a, b) => b[1] - a[1])[0];

  if (topSpiralComponent && topSpiralComponent[1] >= 3) {
    const [component, count] = topSpiralComponent;
    const existingInsight = store.insights.find(i => i.id === `spiral-component-${component}`);
    if (existingInsight) {
      existingInsight.lastSeen = now;
      existingInsight.occurrences = count;
    } else {
      store.insights.push({
        id: `spiral-component-${component}`,
        type: 'pattern',
        category: 'component',
        message: `"${component}" has caused ${count} debug spirals. Consider adding tracer tests.`,
        firstSeen: now,
        lastSeen: now,
        occurrences: count,
        metadata: { component },
      });
    }
  }

  // Post-delete velocity insight
  if (stats.postDeleteSprints >= 2 && stats.avgVelocityIncrease > 1.5) {
    const existingInsight = store.insights.find(i => i.id === 'post-delete-velocity');
    if (existingInsight) {
      existingInsight.lastSeen = now;
      existingInsight.occurrences = stats.postDeleteSprints;
      existingInsight.message = `Deleting code has boosted your velocity ${stats.avgVelocityIncrease}x on average (${stats.postDeleteSprints} times). Trust simplification.`;
    } else {
      store.insights.push({
        id: 'post-delete-velocity',
        type: 'pattern',
        category: 'velocity',
        message: `Deleting code has boosted your velocity ${stats.avgVelocityIncrease}x on average (${stats.postDeleteSprints} times). Trust simplification.`,
        firstSeen: now,
        lastSeen: now,
        occurrences: stats.postDeleteSprints,
      });
    }
  }

  // Keep only 20 most recent/relevant insights
  store.insights = store.insights
    .sort((a, b) => new Date(b.lastSeen).getTime() - new Date(a.lastSeen).getTime())
    .slice(0, 20);
}

/**
 * Migrate old store versions
 */
function migrateTimelineStore(store: TimelineStore): TimelineStore {
  // Handle missing or old versions
  if (!store.version || store.version === '1.0.0') {
    // Migrate from 1.0.0 to current
    store.version = CURRENT_SCHEMA_VERSION;
  }

  if (!store.insights) {
    store.insights = [];
  }

  if (!store.patterns) {
    store.patterns = createInitialStore().patterns;
  }

  if (!store.trends) {
    store.trends = createInitialStore().trends;
  }

  // Ensure version is current after all migrations
  store.version = CURRENT_SCHEMA_VERSION;

  return store;
}
