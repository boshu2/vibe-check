/**
 * Insight generators - each produces insights from specific data sources
 */

import { Insight } from './types.js';
import { UserProfile } from '../gamification/types.js';
import { TimelineStore } from '../storage/timeline-store.js';
import { Commit } from '../types.js';

/**
 * Find peak productivity hours from commits
 */
export function generatePeakHoursInsight(commits: Commit[]): Insight | null {
  if (commits.length < 10) return null;

  const hourCounts: Record<number, number> = {};
  for (const commit of commits) {
    const hour = commit.date.getHours();
    hourCounts[hour] = (hourCounts[hour] || 0) + 1;
  }

  const sorted = Object.entries(hourCounts)
    .map(([h, c]) => ({ hour: parseInt(h), count: c }))
    .sort((a, b) => b.count - a.count);

  if (sorted.length === 0) return null;

  const peakHour = sorted[0].hour;
  const peakPct = Math.round((sorted[0].count / commits.length) * 100);
  const hourStr = peakHour < 12 ? `${peakHour || 12}am` : peakHour === 12 ? '12pm' : `${peakHour - 12}pm`;

  return {
    id: 'peak-hours',
    category: 'productivity',
    severity: 'info',
    icon: '⏰',
    title: 'Peak Productivity',
    message: `You're most productive around ${hourStr} (${peakPct}% of commits)`,
    metric: 'peak_hour',
    value: peakHour,
    action: 'Protect this time for deep work',
    source: 'commits',
    priority: 5,
  };
}

/**
 * Detect improvement streak from trends
 */
export function generateImprovementStreakInsight(store: TimelineStore): Insight | null {
  const weeks = store.trends.weekly;
  if (weeks.length < 2) return null;

  let streak = 0;
  for (let i = weeks.length - 2; i >= 0; i--) {
    const current = weeks[i];
    const next = weeks[i + 1];
    const currentRate = current.sessions > 0 ? current.spirals / current.sessions : 0;
    const nextRate = next.sessions > 0 ? next.spirals / next.sessions : 0;
    if (nextRate <= currentRate) {
      streak++;
    } else {
      break;
    }
  }

  if (streak < 2) return null;

  return {
    id: 'improvement-streak',
    category: 'growth',
    severity: 'success',
    icon: '🎯',
    title: 'Improvement Streak',
    message: `${streak}-week improvement streak! Your spiral rate keeps dropping.`,
    metric: 'improvement_weeks',
    value: streak,
    source: 'timeline.trends',
    priority: 7,
  };
}

/**
 * Find problematic scopes with high fix ratios
 */
export function generateProblematicScopesInsight(commits: Commit[]): Insight | null {
  const scopeStats = new Map<string, { total: number; fixes: number }>();

  for (const commit of commits) {
    const scope = commit.scope || '(no scope)';
    if (!scopeStats.has(scope)) {
      scopeStats.set(scope, { total: 0, fixes: 0 });
    }
    const stats = scopeStats.get(scope)!;
    stats.total++;
    if (commit.type === 'fix') stats.fixes++;
  }

  const problematic = Array.from(scopeStats.entries())
    .map(([scope, stats]) => ({
      scope,
      ...stats,
      ratio: stats.total > 0 ? stats.fixes / stats.total : 0,
    }))
    .filter(s => s.total >= 3 && s.ratio >= 0.5)
    .sort((a, b) => b.ratio - a.ratio);

  if (problematic.length === 0) return null;

  const worst = problematic[0];
  const pct = Math.round(worst.ratio * 100);

  return {
    id: 'problematic-scope',
    category: 'warning',
    severity: 'warning',
    icon: '⚠️',
    title: 'High-Risk Scope',
    message: `"${worst.scope}" has ${pct}% fix commits (${worst.fixes}/${worst.total})`,
    metric: 'scope_fix_ratio',
    value: worst.ratio,
    action: 'Consider adding tracer tests for this area',
    source: 'commits',
    priority: 8,
  };
}

/**
 * Check for streak at risk
 */
export function generateStreakRiskInsight(profile: UserProfile): Insight | null {
  const { streak } = profile;
  if (streak.current < 3) return null;

  const today = new Date().toISOString().split('T')[0];
  if (streak.lastActiveDate === today) return null;

  const lastActive = new Date(streak.lastActiveDate);
  const now = new Date();
  const daysSince = Math.floor((now.getTime() - lastActive.getTime()) / (1000 * 60 * 60 * 24));

  if (daysSince === 0) return null;

  return {
    id: 'streak-risk',
    category: 'warning',
    severity: daysSince >= 1 ? 'warning' : 'info',
    icon: '🔥',
    title: 'Streak at Risk',
    message: `Your ${streak.current}-day streak needs a session today!`,
    action: 'Run vibe-check --score to maintain streak',
    source: 'profile',
    priority: 9,
  };
}

/**
 * Celebrate personal best
 */
export function generatePersonalBestInsight(profile: UserProfile): Insight | null {
  const sessions = profile.sessions;
  if (sessions.length < 2) return null;

  const latest = sessions[sessions.length - 1];
  const previousScores = sessions.slice(0, -1).map(s => s.vibeScore);
  const previousBest = Math.max(...previousScores);

  if (latest.vibeScore > previousBest) {
    return {
      id: 'personal-best',
      category: 'celebration',
      severity: 'success',
      icon: '🏆',
      title: 'New Personal Best!',
      message: `${latest.vibeScore}% beats your previous best of ${previousBest}%`,
      metric: 'vibe_score',
      value: latest.vibeScore,
      comparison: {
        type: 'previous',
        label: 'Previous best',
        value: previousBest,
        change: latest.vibeScore - previousBest,
      },
      source: 'profile',
      priority: 10,
    };
  }

  return null;
}

/**
 * Show level progress
 */
export function generateLevelProgressInsight(profile: UserProfile): Insight | null {
  const { xp } = profile;
  const progress = Math.round((xp.currentLevelXP / xp.nextLevelXP) * 100);

  if (progress >= 80) {
    return {
      id: 'level-close',
      category: 'growth',
      severity: 'info',
      icon: '📈',
      title: 'Level Up Soon!',
      message: `${progress}% to Level ${xp.level + 1} (${xp.nextLevelXP - xp.currentLevelXP} XP to go)`,
      metric: 'level_progress',
      value: progress,
      source: 'profile',
      priority: 6,
    };
  }

  return null;
}

/**
 * Late night warning
 */
export function generateLateNightInsight(commits: Commit[]): Insight | null {
  const recentCommits = commits.slice(-20);
  if (recentCommits.length < 5) return null;

  const lateNight = recentCommits.filter(c => {
    const hour = c.date.getHours();
    return hour >= 23 || hour < 5;
  });

  if (lateNight.length < 3) return null;

  const pct = Math.round((lateNight.length / recentCommits.length) * 100);

  return {
    id: 'late-night',
    category: 'warning',
    severity: 'warning',
    icon: '🌙',
    title: 'Late Night Sessions',
    message: `${pct}% of recent commits are between 11pm-5am`,
    action: 'Late night coding correlates with more spirals',
    source: 'commits',
    priority: 7,
  };
}

/**
 * Recent achievement
 */
export function generateRecentAchievementInsight(profile: UserProfile): Insight | null {
  const recent = profile.achievements
    .filter(a => a.unlockedAt)
    .sort((a, b) => new Date(b.unlockedAt!).getTime() - new Date(a.unlockedAt!).getTime())
    .slice(0, 1);

  if (recent.length === 0) return null;

  const ach = recent[0];
  const unlockedDate = new Date(ach.unlockedAt!);
  const daysSince = Math.floor((Date.now() - unlockedDate.getTime()) / (1000 * 60 * 60 * 24));

  if (daysSince > 7) return null;

  return {
    id: 'recent-achievement',
    category: 'celebration',
    severity: 'success',
    icon: ach.icon,
    title: 'Achievement Unlocked!',
    message: `${ach.name}: ${ach.description}`,
    source: 'profile',
    priority: 8,
  };
}

/**
 * Best day of week insight
 */
export function generateBestDayInsight(commits: Commit[]): Insight | null {
  if (commits.length < 20) return null;

  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const dayCounts: Record<number, number> = {};

  for (const commit of commits) {
    const day = commit.date.getDay();
    dayCounts[day] = (dayCounts[day] || 0) + 1;
  }

  const sorted = Object.entries(dayCounts)
    .map(([d, c]) => ({ day: parseInt(d), count: c }))
    .sort((a, b) => b.count - a.count);

  if (sorted.length === 0) return null;

  const bestDay = sorted[0].day;
  const bestPct = Math.round((sorted[0].count / commits.length) * 100);

  return {
    id: 'best-day',
    category: 'productivity',
    severity: 'info',
    icon: '📅',
    title: 'Best Coding Day',
    message: `${dayNames[bestDay]} is your most productive day (${bestPct}% of commits)`,
    metric: 'best_day',
    value: bestDay,
    source: 'commits',
    priority: 4,
  };
}
