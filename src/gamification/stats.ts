import { SessionRecord } from './types.js';

/**
 * Create a sparkline from values
 */
export function createSparkline(values: number[]): string {
  if (values.length === 0) return '';

  const chars = ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█'];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  return values
    .map(v => chars[Math.floor(((v - min) / range) * 7)])
    .join('');
}

/**
 * Get trend indicator
 */
export function getTrend(values: number[]): { direction: 'up' | 'down' | 'stable'; emoji: string } {
  if (values.length < 2) return { direction: 'stable', emoji: '➡️' };

  const recent = values.slice(-3);
  const older = values.slice(0, 3);

  const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
  const olderAvg = older.reduce((a, b) => a + b, 0) / older.length;

  const diff = recentAvg - olderAvg;

  if (diff > 5) return { direction: 'up', emoji: '↑' };
  if (diff < -5) return { direction: 'down', emoji: '↓' };
  return { direction: 'stable', emoji: '→' };
}

export interface WeeklyStats {
  avgScore: number;
  sessions: number;
  totalCommits: number;
  eliteCount: number;
  spiralCount: number;
  sparkline: string;
  trend: { direction: string; emoji: string };
  xpEarned: number;
}

/**
 * Calculate weekly statistics
 */
export function getWeeklyStats(sessions: SessionRecord[]): WeeklyStats {
  const weekStart = getWeekStartDate(new Date());
  const weekSessions = sessions.filter(s => new Date(s.date) >= weekStart);

  if (weekSessions.length === 0) {
    return {
      avgScore: 0,
      sessions: 0,
      totalCommits: 0,
      eliteCount: 0,
      spiralCount: 0,
      sparkline: '',
      trend: { direction: 'stable', emoji: '→' },
      xpEarned: 0,
    };
  }

  const scores = weekSessions.map(s => s.vibeScore);

  return {
    avgScore: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
    sessions: weekSessions.length,
    totalCommits: weekSessions.reduce((sum, s) => sum + s.commits, 0),
    eliteCount: weekSessions.filter(s => s.overall === 'ELITE').length,
    spiralCount: weekSessions.reduce((sum, s) => sum + s.spirals, 0),
    sparkline: createSparkline(scores),
    trend: getTrend(scores),
    xpEarned: weekSessions.reduce((sum, s) => sum + s.xpEarned, 0),
  };
}

/**
 * Format weekly stats for display
 */
export function formatWeeklyStats(stats: WeeklyStats): string {
  const lines: string[] = [];

  lines.push('📅 THIS WEEK');
  lines.push(`   Avg Score: ${stats.avgScore}% ${stats.trend.emoji}`);
  lines.push(`   Sessions: ${stats.sessions}`);
  lines.push(`   XP Earned: ${stats.xpEarned}`);
  lines.push(`   ELITE: ${stats.eliteCount} | Spirals: ${stats.spiralCount}`);

  if (stats.sparkline) {
    lines.push(`   Trend: ${stats.sparkline}`);
  }

  return lines.join('\n');
}

function getWeekStartDate(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}
