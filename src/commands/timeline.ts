import { Command } from 'commander';
import chalk from 'chalk';
import { getCommits, isGitRepo, getCommitStats, getLatestCommitHash } from '../git.js';
import { analyzeCommits } from '../metrics/index.js';
import { formatTimelineTerminal } from '../output/timeline.js';
import { formatTimelineMarkdown } from '../output/timeline-markdown.js';
import { formatTimelineHtml } from '../output/timeline-html.js';
import { loadStore, saveStore, updateStore, getStorePath, appendCommits } from '../storage/index.js';
import {
  Commit,
  TimelineResult,
  TimelineDay,
  TimelineSession,
  TimelineEvent,
  OverallRating,
  PostDeleteSprintInfo,
  ThrashingInfo,
  DetourInfo,
  LateNightSpiralInfo,
} from '../types.js';
import { format, differenceInMinutes, differenceInDays, parseISO } from 'date-fns';
import { detectFlowState as detectFlowStatePattern } from '../patterns/flow-state.js';
import { detectPostDeleteSprint } from '../patterns/post-delete-sprint.js';
import { detectThrashing } from '../patterns/thrashing.js';
import { detectDetour } from '../patterns/detour.js';
import { detectLateNightSpiral } from '../patterns/late-night.js';
import { detectRegressions, getAllRecoveryTrends } from '../patterns/spiral-regression.js';

// Session gap threshold: 60 minutes
const SESSION_GAP_MINUTES = 60;

export interface TimelineOptions {
  since?: string;
  until?: string;
  format: string;
  repo: string;
  verbose: boolean;
  expand?: string;
  noCache?: boolean;
  insights?: boolean;
}

export function createTimelineCommand(): Command {
  const cmd = new Command('timeline')
    .description('View your coding journey as a timeline with sessions and patterns')
    .option('--since <date>', 'Start date for analysis (default: "1 week ago")', '1 week ago')
    .option('--until <date>', 'End date for analysis (default: now)')
    .option('-f, --format <type>', 'Output format: terminal, json, markdown, html', 'terminal')
    .option('-r, --repo <path>', 'Repository path', process.cwd())
    .option('-v, --verbose', 'Show verbose output', false)
    .option('--expand [date]', 'Expand day details (all or specific date like "Nov-29")')
    .option('--no-cache', 'Skip cache and fetch fresh data from git')
    .option('--insights', 'Show compounding insights from historical data')
    .action(async (options) => {
      await runTimeline(options);
    });

  return cmd;
}

export async function runTimeline(options: TimelineOptions): Promise<void> {
  try {
    const { since, until, format: outputFormat, repo, verbose, expand, noCache, insights } = options;

    // Check if repo is valid
    if (!(await isGitRepo(repo))) {
      console.error(chalk.red(`Not a git repository: ${repo}`));
      process.exit(1);
    }

    // Load existing store for caching
    const store = loadStore(repo);
    const latestCommitHash = await getLatestCommitHash(repo);

    if (verbose) {
      console.error(chalk.gray(`Analyzing repository: ${repo}`));
      console.error(chalk.gray(`Since: ${since}`));
      if (until) console.error(chalk.gray(`Until: ${until}`));
      console.error(chalk.gray(`Cache: ${getStorePath(repo)}`));
      console.error(chalk.gray(`Last cached commit: ${store.lastCommitHash || 'none'}`));
      console.error(chalk.gray(`Latest commit: ${latestCommitHash}`));
    }

    // Get commits
    const commits = await getCommits(repo, since, until);

    if (commits.length === 0) {
      console.log(chalk.yellow('\nNo commits found in the specified range.\n'));
      console.log(chalk.gray('Try specifying a different date range:'));
      console.log(chalk.gray('  vibe-check timeline --since "1 month ago"'));
      process.exit(0);
    }

    if (verbose) {
      console.error(chalk.gray(`Found ${commits.length} commits`));
    }

    // Get commit stats for pattern detection
    if (verbose) {
      console.error(chalk.gray('Gathering file stats for pattern detection...'));
    }
    const commitStats = await getCommitStats(repo, since, until);

    // Build timeline with pattern detection
    const timeline = buildTimeline(commits, commitStats.filesPerCommit, commitStats.lineStatsPerCommit);

    // Update and save store (unless --no-cache)
    if (!noCache) {
      // Append commits to NDJSON log (source of truth)
      const appendedCount = appendCommits(commits, repo);
      if (verbose && appendedCount > 0) {
        console.error(chalk.gray(`Appended ${appendedCount} new commits to log`));
      }

      const updatedStore = updateStore(store, timeline, latestCommitHash);
      saveStore(updatedStore, repo);

      if (verbose) {
        console.error(chalk.gray(`Cache updated: ${updatedStore.sessions.length} sessions, ${updatedStore.insights.length} insights`));
      }
    }

    // Show insights if requested
    if (insights) {
      console.log('');
      console.log(chalk.bold.magenta('═'.repeat(64)));
      console.log(chalk.bold.magenta('  COMPOUNDING INSIGHTS'));
      console.log(chalk.bold.magenta('═'.repeat(64)));
      console.log('');

      // Check for regressions
      const regressionAnalysis = detectRegressions(store.trends);
      if (regressionAnalysis.hasRegression) {
        console.log(chalk.bold.red('  ⚠ REGRESSION ALERTS'));
        for (const alert of regressionAnalysis.alerts) {
          const icon = alert.severity === 'critical' ? chalk.red('🚨') : chalk.yellow('⚠');
          console.log(`  ${icon} ${alert.message}`);
          console.log(chalk.gray(`     ${alert.recommendation}`));
        }
        console.log('');
      } else if (regressionAnalysis.improvementStreak > 0) {
        console.log(chalk.green(`  🎯 ${regressionAnalysis.improvementStreak}-week improvement streak!`));
        console.log('');
      }

      // Show stored insights
      if (store.insights.length > 0) {
        for (const insight of store.insights.slice(0, 5)) {
          const icon = insight.type === 'pattern' ? '🔄' : insight.type === 'recommendation' ? '💡' : '📈';
          console.log(`  ${icon} ${insight.message}`);
          console.log(chalk.gray(`     (${insight.occurrences} occurrences)`));
        }
        console.log('');
      }

      // Show recovery time trends
      const recoveryTrends = getAllRecoveryTrends(store.sessions);
      const improvingComponents = recoveryTrends.filter(t => t.trend === 'improving');
      const worseningComponents = recoveryTrends.filter(t => t.trend === 'worsening');

      if (improvingComponents.length > 0) {
        console.log(chalk.bold.green('  📉 Improving Recovery Times:'));
        for (const comp of improvingComponents.slice(0, 3)) {
          console.log(chalk.green(`     ${comp.component}: ${comp.avgTime}m → ${comp.recentTime}m`));
        }
        console.log('');
      }

      if (worseningComponents.length > 0) {
        console.log(chalk.bold.yellow('  📈 Slower Recovery Times:'));
        for (const comp of worseningComponents.slice(0, 3)) {
          console.log(chalk.yellow(`     ${comp.component}: ${comp.avgTime}m → ${comp.recentTime}m`));
        }
        console.log('');
      }

      // Show week-over-week trends
      if (store.trends.improvements.length > 0) {
        console.log(chalk.bold.white('  Week-over-Week:'));
        for (const imp of store.trends.improvements) {
          const arrow = imp.direction === 'up' ? chalk.green('↑') : imp.direction === 'down' ? chalk.red('↓') : chalk.gray('→');
          console.log(`  ${arrow} ${imp.metric}: ${imp.change > 0 ? '+' : ''}${imp.change}%`);
        }
        console.log('');
      }
    }

    // Output based on format
    if (outputFormat === 'json') {
      // Include store insights in JSON output
      const output = {
        ...timeline,
        storedInsights: store.insights,
        trends: store.trends,
        patternStats: store.patterns,
      };
      console.log(JSON.stringify(output, null, 2));
    } else if (outputFormat === 'markdown') {
      const output = formatTimelineMarkdown(timeline);
      console.log(output);
    } else if (outputFormat === 'html') {
      const output = formatTimelineHtml(timeline);
      console.log(output);
    } else {
      // Terminal output
      const output = formatTimelineTerminal(timeline, { expand });
      console.log(output);
    }
  } catch (error) {
    if (error instanceof Error) {
      console.error(chalk.red(`Error: ${error.message}`));
      if (options.verbose) {
        console.error(chalk.gray(error.stack));
      }
    } else {
      console.error(chalk.red('An unexpected error occurred'));
    }
    process.exit(1);
  }
}

/**
 * Build a complete timeline from commits
 */
function buildTimeline(
  commits: Commit[],
  filesPerCommit: Map<string, string[]>,
  lineStatsPerCommit: Map<string, { additions: number; deletions: number }>
): TimelineResult {
  // Sort commits chronologically (oldest first)
  const sortedCommits = [...commits].sort((a, b) => a.date.getTime() - b.date.getTime());

  // Detect sessions
  const sessions = detectSessions(sortedCommits);

  // Group sessions into days
  const days = groupByDay(sessions);

  // Calculate aggregates
  const totalCommits = sortedCommits.length;
  const totalActiveMinutes = sessions.reduce((sum, s) => sum + s.duration, 0);
  const totalFeatures = sortedCommits.filter(c => c.type === 'feat').length;
  const totalFixes = sortedCommits.filter(c => c.type === 'fix').length;
  const totalSpirals = sessions.reduce((sum, s) => sum + s.spirals.length, 0);
  const flowStates = sessions.filter(s => s.flowState).length;
  const totalXp = sessions.reduce((sum, s) => sum + s.xpEarned, 0);

  // Build trend sparkline
  const trend = days.map(d => d.dayScore);

  // Calculate date range
  const from = sortedCommits[0].date;
  const to = sortedCommits[sortedCommits.length - 1].date;
  const totalDays = differenceInDays(to, from) + 1;

  // Phase 2: Detect post-delete sprint
  const postDeleteResult = detectPostDeleteSprint(sessions, lineStatsPerCommit);
  const postDeleteSprint: PostDeleteSprintInfo | null = postDeleteResult.detected
    ? {
        detected: true,
        linesDeleted: postDeleteResult.deleteSession?.linesDeleted || 0,
        velocityIncrease: postDeleteResult.velocityIncrease,
        message: postDeleteResult.message,
      }
    : null;

  // Phase 2: Detect thrashing across all events
  const allEvents = sessions.flatMap(s => s.commits);
  const thrashingResult = detectThrashing(allEvents, filesPerCommit, lineStatsPerCommit);
  const thrashing: ThrashingInfo | null = thrashingResult.detected
    ? {
        detected: true,
        files: thrashingResult.files.map(f => ({
          path: f.path,
          touchCount: f.touchCount,
          efficiency: f.efficiency,
        })),
        message: thrashingResult.message,
      }
    : null;

  // Phase 3: Detect detours (code added then deleted)
  const detourResult = detectDetour(allEvents, filesPerCommit, lineStatsPerCommit);
  const detours: DetourInfo | null = detourResult.detected
    ? {
        detected: true,
        detours: detourResult.detours.map(d => ({
          scope: d.scope,
          filesAffected: d.filesAffected,
          linesAdded: d.linesAdded,
          linesDeleted: d.linesDeleted,
          duration: d.duration,
        })),
        totalTimeLost: detourResult.totalTimeLost,
        message: detourResult.message,
      }
    : null;

  // Phase 3: Detect late-night spirals
  const lateNightResult = detectLateNightSpiral(sessions);
  const lateNightSpirals: LateNightSpiralInfo | null = lateNightResult.detected
    ? {
        detected: true,
        spirals: lateNightResult.spirals.map(s => ({
          component: s.component,
          duration: s.duration,
          fixCount: s.fixCount,
          resolved: s.resolved,
        })),
        totalDuration: lateNightResult.totalDuration,
        message: lateNightResult.message,
      }
    : null;

  return {
    from,
    to,
    activeDays: days.length,
    totalDays,
    days,
    sessions,
    totalCommits,
    totalActiveMinutes,
    totalFeatures,
    totalFixes,
    totalSpirals,
    flowStates,
    postDeleteSprint,
    thrashing,
    detours,
    lateNightSpirals,
    totalXp,
    trend,
  };
}

/**
 * Detect sessions from commits using 1-hour gap threshold
 */
function detectSessions(commits: Commit[]): TimelineSession[] {
  if (commits.length === 0) return [];

  const sessions: TimelineSession[] = [];
  let currentSession: TimelineEvent[] = [];
  let sessionCounter = 0;

  for (let i = 0; i < commits.length; i++) {
    const commit = commits[i];
    const prevCommit = i > 0 ? commits[i - 1] : null;

    // Calculate gap from previous commit
    const gapMinutes = prevCommit
      ? differenceInMinutes(commit.date, prevCommit.date)
      : 0;

    // Start new session if gap exceeds threshold
    if (gapMinutes > SESSION_GAP_MINUTES && currentSession.length > 0) {
      sessions.push(buildSession(currentSession, sessionCounter));
      sessionCounter++;
      currentSession = [];
    }

    // Add event to current session
    const event: TimelineEvent = {
      hash: commit.hash,
      timestamp: commit.date,
      author: commit.author,
      subject: commit.message,
      type: commit.type,
      scope: commit.scope,
      sessionId: `session-${sessionCounter}`,
      sessionPosition: currentSession.length,
      gapMinutes,
      isRefactor: commit.type === 'refactor',
      spiralDepth: 0, // Will be calculated in buildSession
    };

    currentSession.push(event);
  }

  // Don't forget the last session
  if (currentSession.length > 0) {
    sessions.push(buildSession(currentSession, sessionCounter));
  }

  return sessions;
}

/**
 * Build a session from events
 */
function buildSession(events: TimelineEvent[], sessionNum: number): TimelineSession {
  const start = events[0].timestamp;
  const end = events[events.length - 1].timestamp;
  const duration = differenceInMinutes(end, start) || 1; // At least 1 minute

  // Convert events back to Commit format for metrics analysis
  const commits: Commit[] = events.map(e => ({
    hash: e.hash,
    date: e.timestamp,
    message: e.subject,
    type: e.type,
    scope: e.scope,
    author: e.author,
  }));

  // Analyze metrics for this session
  const analysis = analyzeCommits(commits);

  // Detect fix chains (spirals)
  const spirals = analysis.fixChains.filter(fc => fc.isSpiral);

  // Mark spiral depth on events
  for (const spiral of spirals) {
    let depth = 1;
    for (const event of events) {
      if (event.type === 'fix' && event.scope === spiral.component) {
        event.spiralDepth = depth++;
      }
    }
  }

  // Detect flow state using enhanced pattern detection
  const flowStateResult = detectFlowStatePattern(events, duration);
  const flowState = flowStateResult.detected;

  // Calculate XP (simplified - base XP on session quality)
  const xpEarned = calculateSessionXp(analysis.overall, commits.length, spirals.length);

  return {
    id: `session-${sessionNum}`,
    start,
    end,
    duration,
    commits: events,
    vibeScore: null, // Would need semantic-free metrics for full score
    overall: analysis.overall,
    trustPassRate: analysis.metrics.trustPassRate.value,
    reworkRatio: analysis.metrics.reworkRatio.value,
    flowState,
    spirals,
    xpEarned,
  };
}

/**
 * Calculate XP for a session
 */
function calculateSessionXp(overall: OverallRating, commits: number, spirals: number): number {
  const baseXp = {
    'ELITE': 50,
    'HIGH': 30,
    'MEDIUM': 20,
    'LOW': 10,
  };

  let xp = baseXp[overall];
  xp += commits * 2; // 2 XP per commit
  xp -= spirals * 10; // -10 XP per spiral

  return Math.max(0, xp);
}

/**
 * Group sessions into days
 */
function groupByDay(sessions: TimelineSession[]): TimelineDay[] {
  const dayMap = new Map<string, TimelineSession[]>();

  for (const session of sessions) {
    const dateKey = format(session.start, 'yyyy-MM-dd');
    if (!dayMap.has(dateKey)) {
      dayMap.set(dateKey, []);
    }
    dayMap.get(dateKey)!.push(session);
  }

  // Convert map to array of TimelineDay
  const days: TimelineDay[] = [];
  for (const [dateKey, daySessions] of dayMap.entries()) {
    const date = parseISO(dateKey);
    const totalCommits = daySessions.reduce((sum, s) => sum + s.commits.length, 0);
    const totalDuration = daySessions.reduce((sum, s) => sum + s.duration, 0);
    const totalXp = daySessions.reduce((sum, s) => sum + s.xpEarned, 0);
    const spiralCount = daySessions.reduce((sum, s) => sum + s.spirals.length, 0);

    // Calculate day score (average of session trust pass rates)
    const scores = daySessions.map(s => s.trustPassRate);
    const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;

    // Calculate day rating
    const dayRating = calculateDayRating(daySessions);

    days.push({
      date: dateKey,
      displayDate: format(date, 'EEE MMM d'),
      sessions: daySessions,
      dayScore: Math.round(avgScore),
      dayRating,
      totalCommits,
      totalDuration,
      totalXp,
      spiralCount,
    });
  }

  // Sort by date
  days.sort((a, b) => a.date.localeCompare(b.date));

  return days;
}

/**
 * Calculate overall rating for a day
 */
function calculateDayRating(sessions: TimelineSession[]): OverallRating {
  const ratings = sessions.map(s => s.overall);

  // Count each rating type
  const counts = {
    'ELITE': ratings.filter(r => r === 'ELITE').length,
    'HIGH': ratings.filter(r => r === 'HIGH').length,
    'MEDIUM': ratings.filter(r => r === 'MEDIUM').length,
    'LOW': ratings.filter(r => r === 'LOW').length,
  };

  // Majority wins, with tie-breakers favoring higher ratings
  if (counts.ELITE >= counts.HIGH && counts.ELITE >= counts.MEDIUM && counts.ELITE >= counts.LOW) {
    return 'ELITE';
  }
  if (counts.HIGH >= counts.MEDIUM && counts.HIGH >= counts.LOW) {
    return 'HIGH';
  }
  if (counts.MEDIUM >= counts.LOW) {
    return 'MEDIUM';
  }
  return 'LOW';
}
