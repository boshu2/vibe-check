/**
 * Insight types for vibe-check dashboard
 */

export type InsightCategory =
  | 'productivity'   // Peak hours, best days
  | 'patterns'       // Problematic scopes, spiral triggers
  | 'growth'         // Improvement streaks, trends
  | 'warning'        // Regression alerts, risks
  | 'celebration';   // Personal bests, achievements

export type InsightSeverity = 'info' | 'warning' | 'critical' | 'success';

export interface Insight {
  id: string;
  category: InsightCategory;
  severity: InsightSeverity;
  icon: string;
  title: string;
  message: string;
  metric?: string;
  value?: number;
  comparison?: {
    type: 'baseline' | 'previous' | 'goal';
    label: string;
    value: number;
    change: number;
  };
  action?: string;
  source: string;
  priority: number;  // 1-10, higher = more important
}

export interface DashboardData {
  version: string;
  generatedAt: string;
  repo: string;

  profile: {
    level: number;
    levelName: string;
    levelIcon: string;
    xp: { current: number; next: number; total: number };
    streak: { current: number; longest: number };
    achievementCount: number;
    totalAchievements: number;
  };

  stats: {
    current: { vibeScore: number; rating: string };
    averages: { day7: number; day30: number; allTime: number };
    totals: { sessions: number; commits: number; spirals: number; features: number };
  };

  charts: {
    scoreTrend: Array<{ date: string; score: number; rating: string }>;
    ratingDistribution: Record<string, number>;
    hourlyActivity: Record<string, number>;
    scopeHealth: Array<{ scope: string; commits: number; fixRatio: number }>;
  };

  insights: Insight[];

  sessions: Array<{
    date: string;
    vibeScore: number;
    rating: string;
    commits: number;
    spirals: number;
    xpEarned: number;
  }>;

  achievements: Array<{
    id: string;
    name: string;
    icon: string;
    description: string;
    unlockedAt?: string;
  }>;
}
