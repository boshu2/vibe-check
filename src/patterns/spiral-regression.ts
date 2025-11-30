/**
 * Spiral Regression Detection
 *
 * Detects when spiral patterns re-emerge after a period of improvement.
 * Uses weekly trend analysis to identify regressions.
 */

import { StoredSession, TrendData, WeekTrend } from '../storage/timeline-store';

export interface RegressionAlert {
  type: 'spiral_regression' | 'recovery_time_regression';
  severity: 'warning' | 'critical';
  message: string;
  metric: string;
  currentValue: number;
  baselineValue: number;
  changePercent: number;
  period: string;
  recommendation: string;
}

export interface RegressionAnalysis {
  hasRegression: boolean;
  alerts: RegressionAlert[];
  summary: string;
  improvementStreak: number; // Weeks of sustained improvement before regression
}

/**
 * Detect spiral regressions from trend data
 */
export function detectRegressions(trends: TrendData): RegressionAnalysis {
  const alerts: RegressionAlert[] = [];

  if (trends.weekly.length < 3) {
    return {
      hasRegression: false,
      alerts: [],
      summary: 'Not enough data for regression detection (need 3+ weeks)',
      improvementStreak: 0,
    };
  }

  // Check spiral rate regression
  const spiralRegression = detectSpiralRateRegression(trends.weekly);
  if (spiralRegression) {
    alerts.push(spiralRegression);
  }

  // Check flow state regression
  const flowRegression = detectFlowStateRegression(trends.weekly);
  if (flowRegression) {
    alerts.push(flowRegression);
  }

  // Calculate improvement streak (weeks of improvement before current)
  const improvementStreak = calculateImprovementStreak(trends.weekly);

  // Generate summary
  let summary: string;
  if (alerts.length === 0) {
    if (improvementStreak > 0) {
      summary = `${improvementStreak}-week improvement streak. Keep it up!`;
    } else {
      summary = 'No regressions detected';
    }
  } else {
    const critical = alerts.filter(a => a.severity === 'critical').length;
    if (critical > 0) {
      summary = `${critical} critical regression(s) detected - action needed`;
    } else {
      summary = `${alerts.length} warning(s) - monitor closely`;
    }
  }

  return {
    hasRegression: alerts.length > 0,
    alerts,
    summary,
    improvementStreak,
  };
}

/**
 * Detect if spiral rate has regressed after improvement
 */
function detectSpiralRateRegression(weeks: WeekTrend[]): RegressionAlert | null {
  if (weeks.length < 3) return null;

  // Get recent weeks (newest first in our data)
  const recent = weeks.slice(-3);
  const [oldest, middle, newest] = recent;

  // Calculate spiral rates (spirals per session)
  const oldestRate = oldest.sessions > 0 ? oldest.spirals / oldest.sessions : 0;
  const middleRate = middle.sessions > 0 ? middle.spirals / middle.sessions : 0;
  const newestRate = newest.sessions > 0 ? newest.spirals / newest.sessions : 0;

  // Pattern: was improving (rate went down), then got worse
  const wasImproving = middleRate < oldestRate;
  const hasRegressed = newestRate > middleRate * 1.5; // 50% increase threshold

  if (wasImproving && hasRegressed && newestRate > 0.1) {
    const changePercent = Math.round((newestRate - middleRate) / Math.max(middleRate, 0.01) * 100);

    return {
      type: 'spiral_regression',
      severity: changePercent > 100 ? 'critical' : 'warning',
      message: `Spiral rate increased ${changePercent}% after previous improvement`,
      metric: 'spiral_rate',
      currentValue: Math.round(newestRate * 100) / 100,
      baselineValue: Math.round(middleRate * 100) / 100,
      changePercent,
      period: `${newest.weekStart}`,
      recommendation: 'Review recent commits for unfamiliar patterns. Consider adding tracer tests.',
    };
  }

  return null;
}

/**
 * Detect if flow state frequency has regressed
 */
function detectFlowStateRegression(weeks: WeekTrend[]): RegressionAlert | null {
  if (weeks.length < 3) return null;

  const recent = weeks.slice(-3);
  const [oldest, middle, newest] = recent;

  // Calculate flow state rates
  const oldestRate = oldest.sessions > 0 ? oldest.flowStates / oldest.sessions : 0;
  const middleRate = middle.sessions > 0 ? middle.flowStates / middle.sessions : 0;
  const newestRate = newest.sessions > 0 ? newest.flowStates / newest.sessions : 0;

  // Pattern: had good flow (high rate), then dropped significantly
  const hadGoodFlow = middleRate >= 0.3; // At least 30% flow sessions
  const hasRegressed = newestRate < middleRate * 0.5 && middleRate > 0; // 50% drop

  if (hadGoodFlow && hasRegressed) {
    const changePercent = Math.round((middleRate - newestRate) / middleRate * 100);

    return {
      type: 'spiral_regression',
      severity: 'warning',
      message: `Flow state frequency dropped ${changePercent}% this week`,
      metric: 'flow_rate',
      currentValue: Math.round(newestRate * 100),
      baselineValue: Math.round(middleRate * 100),
      changePercent: -changePercent,
      period: `${newest.weekStart}`,
      recommendation: 'Protect deep work time. Check for interruption patterns.',
    };
  }

  return null;
}

/**
 * Calculate consecutive weeks of improvement
 */
function calculateImprovementStreak(weeks: WeekTrend[]): number {
  if (weeks.length < 2) return 0;

  let streak = 0;

  // Work backwards from second-to-last week
  for (let i = weeks.length - 2; i >= 0; i--) {
    const current = weeks[i];
    const next = weeks[i + 1];

    const currentRate = current.sessions > 0 ? current.spirals / current.sessions : 0;
    const nextRate = next.sessions > 0 ? next.spirals / next.sessions : 0;

    // Improvement = lower spiral rate
    if (nextRate <= currentRate) {
      streak++;
    } else {
      break;
    }
  }

  return streak;
}

/**
 * Analyze recovery time trends for a specific pattern
 */
export function analyzeRecoveryTimeTrend(
  sessions: StoredSession[],
  component: string
): {
  improving: boolean;
  trend: 'improving' | 'stable' | 'worsening';
  avgRecoveryTime: number;
  recentRecoveryTime: number;
  samples: number;
} {
  // Filter sessions with spirals in this component
  const relevantSessions = sessions.filter(
    s => s.spiralComponents.includes(component)
  );

  if (relevantSessions.length < 2) {
    return {
      improving: false,
      trend: 'stable',
      avgRecoveryTime: 0,
      recentRecoveryTime: 0,
      samples: relevantSessions.length,
    };
  }

  // Sort by date
  const sorted = [...relevantSessions].sort(
    (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime()
  );

  // Calculate average duration (proxy for recovery time)
  const allDurations = sorted.map(s => s.duration);
  const avgRecoveryTime = allDurations.reduce((a, b) => a + b, 0) / allDurations.length;

  // Recent average (last 3)
  const recentDurations = allDurations.slice(-3);
  const recentRecoveryTime = recentDurations.reduce((a, b) => a + b, 0) / recentDurations.length;

  // Determine trend
  const changePercent = (recentRecoveryTime - avgRecoveryTime) / avgRecoveryTime * 100;

  let trend: 'improving' | 'stable' | 'worsening';
  if (changePercent < -15) {
    trend = 'improving';
  } else if (changePercent > 15) {
    trend = 'worsening';
  } else {
    trend = 'stable';
  }

  return {
    improving: trend === 'improving',
    trend,
    avgRecoveryTime: Math.round(avgRecoveryTime),
    recentRecoveryTime: Math.round(recentRecoveryTime),
    samples: relevantSessions.length,
  };
}

/**
 * Get all component recovery trends
 */
export function getAllRecoveryTrends(sessions: StoredSession[]): Array<{
  component: string;
  trend: 'improving' | 'stable' | 'worsening';
  avgTime: number;
  recentTime: number;
  samples: number;
}> {
  // Get unique components with spirals
  const components = new Set<string>();
  for (const session of sessions) {
    for (const comp of session.spiralComponents) {
      components.add(comp);
    }
  }

  const trends = [];
  for (const component of components) {
    const analysis = analyzeRecoveryTimeTrend(sessions, component);
    if (analysis.samples >= 2) {
      trends.push({
        component,
        trend: analysis.trend,
        avgTime: analysis.avgRecoveryTime,
        recentTime: analysis.recentRecoveryTime,
        samples: analysis.samples,
      });
    }
  }

  // Sort by sample count (most data first)
  return trends.sort((a, b) => b.samples - a.samples);
}
