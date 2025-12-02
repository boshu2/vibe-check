/**
 * Insight Engine - generates prioritized insights from all data sources
 */

import { Insight, DashboardData } from './types';
import {
  generatePeakHoursInsight,
  generateImprovementStreakInsight,
  generateProblematicScopesInsight,
  generateStreakRiskInsight,
  generatePersonalBestInsight,
  generateLevelProgressInsight,
  generateLateNightInsight,
  generateRecentAchievementInsight,
  generateBestDayInsight,
} from './generators';
import { UserProfile, LEVELS } from '../gamification/types';
import { loadStore, readCommitLog } from '../storage';
import { loadProfile } from '../gamification/profile';
import { ACHIEVEMENTS } from '../gamification/achievements';
import { Commit } from '../types';

export { Insight, DashboardData } from './types';

/**
 * Generate all insights from available data
 */
export function generateInsights(
  profile: UserProfile,
  commits: Commit[],
  repoPath: string
): Insight[] {
  const store = loadStore(repoPath);
  const insights: Insight[] = [];

  // Run all generators
  const generators = [
    () => generatePeakHoursInsight(commits),
    () => generateBestDayInsight(commits),
    () => generateImprovementStreakInsight(store),
    () => generateProblematicScopesInsight(commits),
    () => generateStreakRiskInsight(profile),
    () => generatePersonalBestInsight(profile),
    () => generateLevelProgressInsight(profile),
    () => generateLateNightInsight(commits),
    () => generateRecentAchievementInsight(profile),
  ];

  for (const gen of generators) {
    try {
      const insight = gen();
      if (insight) insights.push(insight);
    } catch {
      // Skip failed generators
    }
  }

  // Sort by priority (highest first)
  return insights.sort((a, b) => b.priority - a.priority);
}

/**
 * Build complete dashboard data export
 */
export function buildDashboardData(repoPath: string = process.cwd()): DashboardData {
  const profile = loadProfile();
  const commits = readCommitLog(repoPath);
  const store = loadStore(repoPath);

  // Level info
  const levelInfo = LEVELS.find(l => l.level === profile.xp.level) || LEVELS[0];

  // Calculate averages
  const sessions = profile.sessions;
  const now = Date.now();
  const day7Sessions = sessions.filter(s => {
    const d = new Date(s.date);
    return now - d.getTime() < 7 * 24 * 60 * 60 * 1000;
  });
  const day30Sessions = sessions.filter(s => {
    const d = new Date(s.date);
    return now - d.getTime() < 30 * 24 * 60 * 60 * 1000;
  });

  const avg = (arr: number[]) => arr.length > 0 ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0;

  // Rating distribution from metric-based quality grades
  const ratingDistribution: Record<string, number> = { ELITE: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
  for (const s of sessions) {
    ratingDistribution[s.overall] = (ratingDistribution[s.overall] || 0) + 1;
  }

  // Hourly activity from commits
  const hourlyActivity: Record<string, number> = {};
  for (const commit of commits) {
    const hour = commit.date.getHours().toString();
    hourlyActivity[hour] = (hourlyActivity[hour] || 0) + 1;
  }

  // Scope health
  const scopeStats = new Map<string, { total: number; fixes: number }>();
  for (const commit of commits) {
    const scope = commit.scope || '(no scope)';
    if (!scopeStats.has(scope)) scopeStats.set(scope, { total: 0, fixes: 0 });
    const stats = scopeStats.get(scope)!;
    stats.total++;
    if (commit.type === 'fix') stats.fixes++;
  }
  const scopeHealth = Array.from(scopeStats.entries())
    .map(([scope, stats]) => ({
      scope,
      commits: stats.total,
      fixRatio: stats.total > 0 ? Math.round((stats.fixes / stats.total) * 100) : 0,
    }))
    .sort((a, b) => b.commits - a.commits)
    .slice(0, 10);

  // Score trend (last 30 sessions, oldest first for chart)
  const scoreTrend = sessions.slice(-30).map(s => ({
    date: s.date,
    score: s.vibeScore,
    rating: s.overall,  // Metric-based quality grade
  }));

  // Calculate average metrics from recent sessions with metrics data
  const avgNum = (arr: number[]) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
  const recentWithMetrics = sessions.filter(s => s.metrics).slice(-10);
  const avgMetrics = recentWithMetrics.length > 0 ? {
    iterationVelocity: Math.round(avgNum(recentWithMetrics.map(s => s.metrics!.iterationVelocity)) * 10) / 10,
    reworkRatio: Math.round(avgNum(recentWithMetrics.map(s => s.metrics!.reworkRatio))),
    trustPassRate: Math.round(avgNum(recentWithMetrics.map(s => s.metrics!.trustPassRate))),
    flowEfficiency: Math.round(avgNum(recentWithMetrics.map(s => s.metrics!.flowEfficiency))),
    debugSpiralDuration: Math.round(avgNum(recentWithMetrics.map(s => s.metrics!.debugSpiralDuration))),
  } : null;

  // Generate insights
  const insights = generateInsights(profile, commits, repoPath);

  // Map achievements
  const allAchievements = ACHIEVEMENTS.map(a => {
    const unlocked = profile.achievements.find(ua => ua.id === a.id);
    return {
      id: a.id,
      name: a.name,
      icon: a.icon,
      description: a.description,
      unlockedAt: unlocked?.unlockedAt,
    };
  });

  // Get latest session for current stats
  const latestSession = sessions.length > 0 ? sessions[sessions.length - 1] : null;

  return {
    version: '1.0.0',
    generatedAt: new Date().toISOString(),
    repo: repoPath,

    profile: {
      level: profile.xp.level,
      levelName: profile.xp.levelName,
      levelIcon: levelInfo.icon,
      xp: {
        current: profile.xp.currentLevelXP,
        next: profile.xp.nextLevelXP,
        total: profile.xp.total,
      },
      streak: {
        current: profile.streak.current,
        longest: profile.streak.longest,
      },
      achievementCount: profile.achievements.length,
      totalAchievements: ACHIEVEMENTS.length,
    },

    stats: {
      current: {
        vibeScore: latestSession?.vibeScore || 0,
        rating: latestSession?.overall || 'N/A',  // Metric-based quality grade
      },
      averages: {
        day7: avg(day7Sessions.map(s => s.vibeScore)),
        day30: avg(day30Sessions.map(s => s.vibeScore)),
        allTime: avg(sessions.map(s => s.vibeScore)),
      },
      totals: {
        sessions: sessions.length,
        commits: commits.length,
        spirals: sessions.reduce((sum, s) => sum + s.spirals, 0),
        features: store.sessions.reduce((sum, s) => sum + s.commitCount, 0),
      },
    },

    charts: {
      scoreTrend,
      ratingDistribution,
      hourlyActivity,
      scopeHealth,
      avgMetrics,  // Average metrics for radar chart
    },

    insights,

    sessions: sessions.slice(-50).reverse().map(s => ({
      date: s.date,
      vibeScore: s.vibeScore,
      rating: s.overall,  // Metric-based quality grade
      commits: s.commits,
      spirals: s.spirals,
      xpEarned: s.xpEarned,
      metrics: s.metrics || null,  // Include detailed metrics if available
    })),

    achievements: allAchievements,
  };
}
