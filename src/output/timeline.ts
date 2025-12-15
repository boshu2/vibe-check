import chalk from 'chalk';
import { format } from 'date-fns';
import { TimelineResult, TimelineDay, TimelineSession, OverallRating } from '../types.js';

export interface TimelineOutputOptions {
  expand?: string | boolean; // 'all', a specific date like 'Nov-29', true for all, or undefined
}

/**
 * Format timeline for terminal output
 */
export function formatTimelineTerminal(
  timeline: TimelineResult,
  options: TimelineOutputOptions = {}
): string {
  const lines: string[] = [];

  // Header
  lines.push('');
  lines.push(chalk.bold.cyan('═'.repeat(64)));
  lines.push(chalk.bold.cyan('                      VIBE-CHECK TIMELINE'));
  const dateRange = `${format(timeline.from, 'MMM d')} - ${format(timeline.to, 'MMM d')} (${timeline.totalDays} days)`;
  lines.push(chalk.bold.cyan(`                    ${dateRange}`));
  lines.push(chalk.bold.cyan('═'.repeat(64)));

  // Trend line
  lines.push('');
  const trendBar = buildTrendSparkline(timeline.trend);
  const activeHours = Math.round(timeline.totalActiveMinutes / 60);
  lines.push(
    `  ${chalk.gray('TREND')}  ${trendBar}  ` +
    chalk.gray(`Active: ~${activeHours}h  Commits: ${timeline.totalCommits}  Features: ${timeline.totalFeatures}`)
  );

  // Days
  for (const day of timeline.days) {
    lines.push('');
    lines.push(formatDayHeader(day));
    lines.push(formatDaySummary(day));

    // Check if this day should be expanded
    const expandValue = options.expand;
    const shouldExpand = expandValue === true ||
      expandValue === 'all' ||
      expandValue === '' ||
      expandValue === 'true' ||
      (typeof expandValue === 'string' && day.displayDate.toLowerCase().includes(expandValue.toLowerCase()));

    if (shouldExpand) {
      // Show session details
      for (const session of day.sessions) {
        lines.push(formatSessionDetail(session));
      }
    } else {
      // Show session highlights
      for (const session of day.sessions) {
        lines.push(formatSessionHighlight(session));
      }
    }
  }

  // Insights section
  const insights = generateInsights(timeline);
  if (insights.length > 0) {
    lines.push('');
    lines.push(chalk.bold.cyan('═'.repeat(64)));
    lines.push(chalk.bold.white('  INSIGHTS'));
    lines.push('');
    for (const insight of insights) {
      lines.push(`  ${insight}`);
    }
  }

  lines.push('');
  lines.push(chalk.bold.cyan('═'.repeat(64)));
  lines.push(chalk.gray(`  Run with ${chalk.white('--expand')} to see session details`));
  lines.push('');

  return lines.join('\n');
}

/**
 * Build a sparkline from scores
 */
function buildTrendSparkline(scores: (number | null)[]): string {
  const bars = ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█'];

  return scores
    .map(score => {
      if (score === null) return chalk.gray('▁');
      // Score is 0-100, map to bar index
      const idx = Math.min(7, Math.floor(score / 12.5));
      const bar = bars[idx];
      if (score >= 80) return chalk.green(bar);
      if (score >= 60) return chalk.blue(bar);
      if (score >= 40) return chalk.yellow(bar);
      return chalk.red(bar);
    })
    .join('');
}

/**
 * Format day header
 */
function formatDayHeader(day: TimelineDay): string {
  const ratingStr = formatRating(day.dayRating);
  const ratingPercent = day.dayScore !== null ? `${day.dayScore}%` : '';
  const trophy = day.dayRating === 'ELITE' ? ' 🏆' : '';

  return chalk.bold(
    `  📅 ${day.displayDate} ${'─'.repeat(30)} ${ratingPercent} ${ratingStr}${trophy}`
  );
}

/**
 * Format day summary line
 */
function formatDaySummary(day: TimelineDay): string {
  const sessionCount = day.sessions.length;
  const spiralText = day.spiralCount === 0
    ? chalk.green('0 spirals')
    : chalk.yellow(`${day.spiralCount} spiral${day.spiralCount > 1 ? 's' : ''}`);

  return chalk.gray(
    `     ${sessionCount} session${sessionCount > 1 ? 's' : ''}, ` +
    `${day.totalCommits} commits, ${spiralText}, ` +
    chalk.green(`+${day.totalXp} XP`)
  );
}

/**
 * Format session highlight (collapsed view)
 */
function formatSessionHighlight(session: TimelineSession): string {
  const timeRange = `${format(session.start, 'HH:mm')}-${format(session.end, 'HH:mm')}`;
  const durationStr = formatDuration(session.duration);

  // Get main work summary
  const featCount = session.commits.filter(c => c.type === 'feat').length;
  const fixCount = session.commits.filter(c => c.type === 'fix').length;

  let workSummary = '';
  if (featCount > 0) {
    const firstFeat = session.commits.find(c => c.type === 'feat');
    workSummary = firstFeat ? truncate(firstFeat.subject, 35) : `${featCount} features`;
  } else if (fixCount > 0) {
    workSummary = `${fixCount} fix${fixCount > 1 ? 'es' : ''}`;
  } else {
    const first = session.commits[0];
    workSummary = truncate(first.subject, 35);
  }

  // Status icon
  const icon = getSessionIcon(session);

  return chalk.gray(`     ${icon} ${workSummary} (${timeRange}, ${durationStr})`);
}

/**
 * Format session detail (expanded view)
 */
function formatSessionDetail(session: TimelineSession): string {
  const lines: string[] = [];
  const timeRange = `${format(session.start, 'HH:mm')}-${format(session.end, 'HH:mm')}`;
  const durationStr = formatDuration(session.duration);

  // Session header
  const ratingStr = formatRating(session.overall);
  const flowIcon = session.flowState ? ' 🌊' : '';
  lines.push(
    chalk.white(`     ┌─ Session ${timeRange} (${durationStr}) ${ratingStr}${flowIcon}`)
  );

  // List commits
  for (const commit of session.commits) {
    const typeIcon = getTypeIcon(commit.type);
    const spiralMark = commit.spiralDepth > 0 ? chalk.yellow(` [spiral ${commit.spiralDepth}]`) : '';
    lines.push(
      chalk.gray(`     │  ${typeIcon} ${truncate(commit.subject, 45)}${spiralMark}`)
    );
  }

  // Session footer with metrics
  const trustStr = `Trust: ${session.trustPassRate}%`;
  const reworkStr = `Rework: ${Math.round(session.reworkRatio)}%`;
  lines.push(
    chalk.gray(`     └─ ${trustStr}, ${reworkStr}`)
  );

  return lines.join('\n');
}

/**
 * Get icon for session based on its characteristics
 */
function getSessionIcon(session: TimelineSession): string {
  if (session.flowState) return '🌊';
  if (session.spirals.length > 0) return '⚠';
  if (session.overall === 'ELITE') return '✓';
  return '○';
}

/**
 * Get icon for commit type
 */
function getTypeIcon(type: string): string {
  switch (type) {
    case 'feat': return '●';
    case 'fix': return '○';
    case 'docs': return '◇';
    case 'refactor': return '◆';
    case 'test': return '◎';
    default: return '○';
  }
}

/**
 * Format rating with color
 */
function formatRating(rating: OverallRating): string {
  switch (rating) {
    case 'ELITE': return chalk.green.bold('ELITE');
    case 'HIGH': return chalk.blue.bold('HIGH');
    case 'MEDIUM': return chalk.yellow.bold('MEDIUM');
    case 'LOW': return chalk.red.bold('LOW');
  }
}

/**
 * Format duration in human-readable form
 */
function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

/**
 * Truncate string with ellipsis
 */
function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.substring(0, maxLen - 1) + '…';
}

/**
 * Generate insights from timeline data
 */
function generateInsights(timeline: TimelineResult): string[] {
  const insights: string[] = [];

  // Post-delete sprint (Phase 2) - show first as it's the killer insight
  if (timeline.postDeleteSprint?.detected) {
    insights.push(
      chalk.magenta(`⚡ Post-delete sprint: ${timeline.postDeleteSprint.message}`)
    );
  }

  // Flow states
  if (timeline.flowStates > 0) {
    const avgFlowDuration = timeline.sessions
      .filter(s => s.flowState)
      .reduce((sum, s) => sum + s.duration, 0) / timeline.flowStates;
    insights.push(
      `🌊 Flow states: ${timeline.flowStates} detected (avg ${Math.round(avgFlowDuration)} min)`
    );
  }

  // Thrashing (Phase 2)
  if (timeline.thrashing?.detected) {
    insights.push(
      chalk.yellow(`🔄 Thrashing: ${timeline.thrashing.message}`)
    );
    // Show worst thrashing file
    const worstFile = timeline.thrashing.files[0];
    if (worstFile) {
      insights.push(
        chalk.gray(`   └─ ${truncate(worstFile.path, 40)}: ${worstFile.touchCount} edits, ${worstFile.efficiency}% efficiency`)
      );
    }
  }

  // Phase 3: Detours (code added then deleted)
  if (timeline.detours?.detected) {
    insights.push(
      chalk.yellow(timeline.detours.message)
    );
    // Show top detour details
    const topDetour = timeline.detours.detours[0];
    if (topDetour) {
      insights.push(
        chalk.gray(`   └─ ${topDetour.scope}: ${topDetour.linesAdded} lines built, ${topDetour.linesDeleted} deleted`)
      );
    }
  }

  // Phase 3: Late-night spirals
  if (timeline.lateNightSpirals?.detected) {
    insights.push(
      chalk.yellow(timeline.lateNightSpirals.message)
    );
  }

  // Spirals
  if (timeline.totalSpirals > 0) {
    insights.push(
      chalk.yellow(`⚠ Debug spirals: ${timeline.totalSpirals} detected`)
    );
  }

  // Productivity ratio
  const wallClockHours = timeline.totalDays * 24;
  const activeHours = timeline.totalActiveMinutes / 60;
  const efficiencyPercent = Math.round((activeHours / wallClockHours) * 100);
  insights.push(
    chalk.gray(`⏱ Active time: ${Math.round(activeHours)}h of ${wallClockHours}h (${efficiencyPercent}% efficiency)`)
  );

  // Best day
  const bestDay = timeline.days.reduce((best, day) =>
    (day.dayScore || 0) > (best.dayScore || 0) ? day : best
  );
  if (bestDay.dayScore && bestDay.dayScore >= 80) {
    insights.push(
      chalk.green(`🏆 Best day: ${bestDay.displayDate} (${bestDay.dayScore}%)`)
    );
  }

  // Feature velocity
  if (timeline.totalFeatures > 0) {
    const featuresPerHour = timeline.totalFeatures / (timeline.totalActiveMinutes / 60);
    insights.push(
      chalk.gray(`⚡ Feature velocity: ${featuresPerHour.toFixed(1)} features/hour`)
    );
  }

  // Recommendation based on patterns
  const recommendation = generateRecommendation(timeline);
  if (recommendation) {
    insights.push('');
    insights.push(chalk.cyan(`💡 ${recommendation}`));
  }

  return insights;
}

/**
 * Generate a recommendation based on detected patterns
 */
function generateRecommendation(timeline: TimelineResult): string | null {
  // Late-night spirals - strongest signal for behavior change
  if (timeline.lateNightSpirals?.detected && timeline.lateNightSpirals.spirals.length > 0) {
    const totalTime = timeline.lateNightSpirals.totalDuration;
    if (totalTime > 30) {
      return 'Late-night debugging is rarely efficient - sleep on it and tackle with fresh eyes';
    }
  }

  // Detours detected - learn from experiments
  if (timeline.detours?.detected && timeline.detours.totalTimeLost > 60) {
    return 'Significant detour detected - try smaller experiments or spikes before committing';
  }

  // Post-delete sprint detected - reinforce the pattern
  if (timeline.postDeleteSprint?.detected) {
    return 'Trust simplification impulses - deletion often unlocks velocity';
  }

  // Thrashing detected - suggest stepping back
  if (timeline.thrashing?.detected && timeline.thrashing.files.length > 2) {
    return 'Multiple files with repeated edits - consider stepping back to design';
  }

  // Many spirals - suggest tracer tests
  if (timeline.totalSpirals > 2) {
    return 'Multiple debug spirals - try writing a tracer test before the next feature';
  }

  // Flow states detected - show what works
  if (timeline.flowStates > 0) {
    const flowSessions = timeline.sessions.filter(s => s.flowState);
    const avgTime = flowSessions.reduce((sum, s) => {
      const hour = s.start.getHours();
      return sum + hour;
    }, 0) / flowSessions.length;
    const peakHour = Math.round(avgTime);
    return `Flow states peak around ${peakHour}:00 - protect this time`;
  }

  return null;
}
