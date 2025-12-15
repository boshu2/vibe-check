/**
 * Sessions Command (VIBE-046)
 *
 * Identify work sessions from git history using configurable time gap threshold.
 * Proven algorithm from release-engineering retrospective.
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { getCommits, isGitRepo } from '../git.js';
import { detectSessions, SessionDetectionResult, DetectedSession } from '../analyzers/sessions.js';
import { format } from 'date-fns';

export interface SessionsOptions {
  since?: string;
  until?: string;
  threshold: number;
  format: string;
  repo: string;
  verbose: boolean;
  limit?: number;
}

export function createSessionsCommand(): Command {
  const cmd = new Command('sessions')
    .description('Identify work sessions from git history (VIBE-046)')
    .option('--since <date>', 'Start date for analysis', '3 months ago')
    .option('--until <date>', 'End date for analysis (default: now)')
    .option(
      '-t, --threshold <minutes>',
      'Gap threshold to start new session (default: 90)',
      '90'
    )
    .option('-f, --format <type>', 'Output format: terminal, json, markdown', 'terminal')
    .option('-r, --repo <path>', 'Repository path', process.cwd())
    .option('-v, --verbose', 'Show verbose output', false)
    .option('-l, --limit <n>', 'Limit number of sessions shown')
    .action(async (options) => {
      await runSessions({
        ...options,
        threshold: parseInt(options.threshold, 10) || 90,
        limit: options.limit ? parseInt(options.limit, 10) : undefined,
      });
    });

  return cmd;
}

export async function runSessions(options: SessionsOptions): Promise<SessionDetectionResult | null> {
  try {
    const { since, until, threshold, format: outputFormat, repo, verbose, limit } = options;

    // Check if repo is valid
    if (!(await isGitRepo(repo))) {
      console.error(chalk.red(`Not a git repository: ${repo}`));
      process.exit(1);
    }

    if (verbose) {
      console.error(chalk.gray(`Analyzing repository: ${repo}`));
      console.error(chalk.gray(`Since: ${since}`));
      if (until) console.error(chalk.gray(`Until: ${until}`));
      console.error(chalk.gray(`Session gap threshold: ${threshold} minutes`));
    }

    // Get commits
    const commits = await getCommits(repo, since, until);

    if (commits.length === 0) {
      console.log(chalk.yellow('\nNo commits found in the specified range.\n'));
      console.log(chalk.gray('Try specifying a different date range:'));
      console.log(chalk.gray('  vibe-check sessions --since "6 months ago"'));
      process.exit(0);
    }

    if (verbose) {
      console.error(chalk.gray(`Found ${commits.length} commits`));
    }

    // Detect sessions
    const result = detectSessions(commits, threshold);

    // Output based on format
    switch (outputFormat) {
      case 'json':
        outputJson(result, limit);
        break;
      case 'markdown':
        outputMarkdown(result, limit);
        break;
      default:
        outputTerminal(result, limit);
    }

    return result;
  } catch (error) {
    if (error instanceof Error) {
      console.error(chalk.red(`Error: ${error.message}`));
    }
    process.exit(1);
  }
}

function outputJson(result: SessionDetectionResult, limit?: number): void {
  const sessions = limit ? result.sessions.slice(-limit) : result.sessions;
  const output = {
    totalSessions: result.stats.totalSessions,
    totalCommits: result.stats.totalCommits,
    avgCommitsPerSession: result.stats.avgCommitsPerSession,
    avgDurationMinutes: result.stats.avgDurationMinutes,
    medianDurationMinutes: result.stats.medianDurationMinutes,
    longestSessionMinutes: result.stats.longestSessionMinutes,
    shortestSessionMinutes: result.stats.shortestSessionMinutes,
    analysisRange: {
      from: result.analysisRange.from.toISOString(),
      to: result.analysisRange.to.toISOString(),
    },
    sessions: sessions.map((s) => ({
      sessionId: s.sessionId,
      startDate: s.startDate.toISOString(),
      endDate: s.endDate.toISOString(),
      durationMinutes: s.durationMinutes,
      numCommits: s.commitCount,
      commits: s.commits.map((c) => c.hash),
    })),
  };
  console.log(JSON.stringify(output, null, 2));
}

function outputMarkdown(result: SessionDetectionResult, limit?: number): void {
  const { stats } = result;
  const sessions = limit ? result.sessions.slice(-limit) : result.sessions;

  console.log('# Session Analysis\n');
  console.log(`**Analysis Period:** ${format(result.analysisRange.from, 'yyyy-MM-dd')} to ${format(result.analysisRange.to, 'yyyy-MM-dd')}\n`);

  console.log('## Summary\n');
  console.log(`| Metric | Value |`);
  console.log(`|--------|-------|`);
  console.log(`| Total Sessions | ${stats.totalSessions} |`);
  console.log(`| Total Commits | ${stats.totalCommits} |`);
  console.log(`| Avg Commits/Session | ${stats.avgCommitsPerSession} |`);
  console.log(`| Avg Duration | ${stats.avgDurationMinutes} min |`);
  console.log(`| Median Duration | ${stats.medianDurationMinutes} min |`);
  console.log(`| Longest Session | ${stats.longestSessionMinutes} min |`);
  console.log(`| Shortest Session | ${stats.shortestSessionMinutes} min |`);
  console.log('');

  console.log('## Sessions\n');
  console.log('| # | Date | Duration | Commits |');
  console.log('|---|------|----------|---------|');
  for (const s of sessions) {
    const dateStr = format(s.startDate, 'yyyy-MM-dd HH:mm');
    const durationStr = formatDuration(s.durationMinutes);
    console.log(`| ${s.sessionId} | ${dateStr} | ${durationStr} | ${s.commitCount} |`);
  }
}

function outputTerminal(result: SessionDetectionResult, limit?: number): void {
  const { stats } = result;
  const sessions = limit ? result.sessions.slice(-limit) : result.sessions;

  console.log('');
  console.log(chalk.bold.cyan('📊 Session Analysis'));
  console.log(chalk.gray('─'.repeat(50)));
  console.log('');

  // Summary stats
  console.log(chalk.bold('Summary:'));
  console.log(`  Total Sessions:       ${chalk.cyan(stats.totalSessions)}`);
  console.log(`  Total Commits:        ${chalk.cyan(stats.totalCommits)}`);
  console.log(`  Avg Commits/Session:  ${chalk.cyan(stats.avgCommitsPerSession)}`);
  console.log(`  Avg Duration:         ${chalk.cyan(formatDuration(stats.avgDurationMinutes))}`);
  console.log(`  Median Duration:      ${chalk.cyan(formatDuration(stats.medianDurationMinutes))}`);
  console.log(`  Longest Session:      ${chalk.green(formatDuration(stats.longestSessionMinutes))}`);
  console.log(`  Shortest Session:     ${chalk.yellow(formatDuration(stats.shortestSessionMinutes))}`);
  console.log('');

  // Analysis range
  console.log(chalk.gray(`Period: ${format(result.analysisRange.from, 'MMM d, yyyy')} - ${format(result.analysisRange.to, 'MMM d, yyyy')}`));
  console.log('');

  // Sessions list
  if (sessions.length > 0) {
    console.log(chalk.bold('Recent Sessions:'));
    console.log('');

    // Show most recent sessions (reverse order)
    const recentSessions = [...sessions].reverse().slice(0, 10);
    for (const s of recentSessions) {
      const dateStr = format(s.startDate, 'MMM d, HH:mm');
      const durationStr = formatDuration(s.durationMinutes);
      const durationColor = getDurationColor(s.durationMinutes);

      console.log(
        `  ${chalk.gray(`#${s.sessionId.toString().padStart(3)}`)} ${chalk.white(dateStr)} ${durationColor(durationStr.padStart(8))} ${chalk.cyan(`${s.commitCount} commits`)}`
      );
    }

    if (sessions.length > 10) {
      console.log(chalk.gray(`  ... and ${sessions.length - 10} more sessions`));
    }
  }

  console.log('');
}

function formatDuration(minutes: number): string {
  if (minutes < 1) {
    return '<1m';
  } else if (minutes < 60) {
    return `${Math.round(minutes)}m`;
  } else {
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  }
}

function getDurationColor(minutes: number): (str: string) => string {
  if (minutes >= 120) {
    return chalk.green; // 2+ hours = great flow
  } else if (minutes >= 60) {
    return chalk.cyan; // 1+ hours = good
  } else if (minutes >= 30) {
    return chalk.yellow; // 30+ min = ok
  } else {
    return chalk.gray; // short session
  }
}
