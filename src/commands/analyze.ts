import { Command } from 'commander';
import chalk from 'chalk';
import { writeFileSync } from 'fs';
import { getCommits, isGitRepo, getFileStats } from '../git';
import { analyzeCommits } from '../metrics';
import { formatOutput } from '../output';
import { formatJson } from '../output/json';
import {
  OutputFormat,
  VibeCheckResultV2,
} from '../types';
import { calculateFileChurn } from '../metrics/file-churn';
import { calculateTimeSpiral } from '../metrics/time-spiral';
import { calculateVelocityAnomaly } from '../metrics/velocity-anomaly';
import { calculateCodeStability } from '../metrics/code-stability';
import { calculateVibeScore } from '../score';
import { recordSession as recordGamificationSession } from '../gamification/profile';
import { LEVELS } from '../gamification/types';
import { loadSession, clearSession, LEVEL_INFO } from './start';
import {
  detectSessionBoundary,
  recordSession as recordSessionHistory,
  compareToBaseline,
  loadSessionHistory,
} from '../sessions';

export interface AnalyzeOptions {
  since?: string;
  until?: string;
  format: string;
  repo: string;
  verbose: boolean;
  score: boolean;
  output?: string;
  simple: boolean;
}

export function createAnalyzeCommand(): Command {
  const cmd = new Command('analyze')
    .description('Analyze git history for vibe coding metrics')
    .option('--since <date>', 'Start date for analysis (e.g., "1 week ago")')
    .option('--until <date>', 'End date for analysis (default: now)')
    .option('-f, --format <type>', 'Output format: terminal, json, markdown', 'terminal')
    .option('-r, --repo <path>', 'Repository path', process.cwd())
    .option('-v, --verbose', 'Show verbose output', false)
    .option('--score', 'Include VibeScore and code pattern metrics', false)
    .option('-o, --output <file>', 'Write JSON results to file')
    .option('-s, --simple', 'Simplified output (fewer details)', false)
    .action(async (options) => {
      await runAnalyze(options);
    });

  return cmd;
}

export async function runAnalyze(options: AnalyzeOptions): Promise<void> {
  try {
    const { since, until, format, repo, verbose, score, output, simple } = options;

    // Check for active session
    const session = loadSession(repo);

    // Validate format
    const validFormats: OutputFormat[] = ['terminal', 'json', 'markdown'];
    if (!validFormats.includes(format as OutputFormat)) {
      console.error(chalk.red(`Invalid format: ${format}`));
      console.error(chalk.gray(`Valid formats: ${validFormats.join(', ')}`));
      process.exit(1);
    }

    // Check if repo is valid
    if (!(await isGitRepo(repo))) {
      console.error(chalk.red(`Not a git repository: ${repo}`));
      process.exit(1);
    }

    if (verbose) {
      console.error(chalk.gray(`Analyzing repository: ${repo}`));
      if (since) console.error(chalk.gray(`Since: ${since}`));
      if (until) console.error(chalk.gray(`Until: ${until}`));
    }

    // Get commits
    const commits = await getCommits(repo, since, until);

    if (commits.length === 0) {
      if (format === 'terminal') {
        console.log(chalk.yellow('\nNo commits found in the specified range.\n'));
        if (!since) {
          console.log(chalk.gray('Try specifying a date range:'));
          console.log(chalk.gray('  vibe-check --since "1 week ago"'));
          console.log(chalk.gray('  vibe-check --since "2025-11-01"'));
        }
      } else if (format === 'json') {
        console.log(JSON.stringify({ error: 'No commits found', commits: 0 }));
      } else {
        console.log('# Vibe-Check Report\n\nNo commits found in the specified range.');
      }
      process.exit(0);
    }

    if (verbose) {
      console.error(chalk.gray(`Found ${commits.length} commits`));
    }

    // Analyze commits (semantic metrics)
    const result = analyzeCommits(commits);

    // Build enhanced result
    const resultV2: VibeCheckResultV2 = {
      ...result,
      semanticMetrics: result.metrics,
    };

    // Enhanced analysis - always compute for session comparison
    const needsEnhanced = score || session !== null;
    if (needsEnhanced) {
      if (verbose) {
        console.error(chalk.gray('Computing semantic-free metrics...'));
      }

      // Get file stats for semantic-free metrics
      const fileStats = await getFileStats(repo, since, until);

      // Calculate semantic-free metrics
      const fileChurn = calculateFileChurn(commits, fileStats.filesPerCommit);
      const timeSpiral = calculateTimeSpiral(commits);
      const velocityAnomaly = calculateVelocityAnomaly(commits);
      const codeStability = calculateCodeStability(commits, fileStats.lineStats);

      resultV2.semanticFreeMetrics = {
        fileChurn,
        timeSpiral,
        velocityAnomaly,
        codeStability,
      };

      // Calculate VibeScore
      const vibeScore = calculateVibeScore({
        fileChurn,
        timeSpiral,
        velocityAnomaly,
        codeStability,
      });
      resultV2.vibeScore = vibeScore;
    }

    // Write to file if requested (always JSON format)
    if (output) {
      const jsonOutput = formatJson(resultV2);
      writeFileSync(output, jsonOutput);
      if (verbose) {
        console.error(chalk.gray(`Results written to: ${output}`));
      }
    }

    // Output result to console
    const formattedOutput = formatOutput(resultV2, format as OutputFormat, { simple });
    console.log(formattedOutput);

    // Get metrics for session tracking
    const trustPassRate = result.metrics.trustPassRate.value;
    const reworkRatio = result.metrics.reworkRatio.value;
    const spiralCount = result.fixChains.filter(fc => fc.isSpiral).length;

    // Session comparison (if manual session was active via `start`)
    if (session && format === 'terminal') {
      const levelInfo = LEVEL_INFO[session.level];

      // Parse expectations (already in percentage form like ">65%")
      const expectTrust = parseFloat(levelInfo.expectTrust.replace(/[><%]/g, ''));
      const expectRework = parseFloat(levelInfo.expectRework.replace(/[<%]/g, ''));

      // Calculate session duration
      const startTime = new Date(session.startedAt);
      const duration = Math.round((Date.now() - startTime.getTime()) / 60000);

      console.log('');
      console.log(chalk.bold.cyan('SESSION COMPLETE'));
      console.log('');
      console.log(`  Declared: Level ${session.level} - ${levelInfo.name} (${levelInfo.trust} trust)`);
      console.log(`  Duration: ${duration} min, ${commits.length} commits`);
      console.log('');

      // Compare trust pass rate
      const trustOk = trustPassRate >= expectTrust;
      const trustIcon = trustOk ? chalk.green('✓') : chalk.yellow('⚠');
      const trustExpect = `expected ${levelInfo.expectTrust}`;
      console.log(`  Trust Pass:  ${Math.round(trustPassRate)}% (${trustExpect}) ${trustIcon}`);

      // Compare rework ratio
      const reworkOk = reworkRatio <= expectRework;
      const reworkIcon = reworkOk ? chalk.green('✓') : chalk.yellow('⚠');
      const reworkExpect = `expected ${levelInfo.expectRework}`;
      console.log(`  Rework:      ${Math.round(reworkRatio)}% (${reworkExpect}) ${reworkIcon}`);

      console.log('');

      // Verdict
      if (trustOk && reworkOk) {
        console.log(chalk.green(`  ✓ Level ${session.level} was appropriate for this work`));
      } else if (!trustOk && !reworkOk) {
        const suggestedLevel = Math.max(0, session.level - 2);
        console.log(chalk.yellow(`  ⚠ Level ${session.level} was too optimistic`));
        console.log(chalk.gray(`    Consider Level ${suggestedLevel} for similar tasks`));
      } else if (!trustOk) {
        const suggestedLevel = Math.max(0, session.level - 1);
        console.log(chalk.yellow(`  ⚠ Trust was lower than expected`));
        console.log(chalk.gray(`    Consider Level ${suggestedLevel} for similar tasks`));
      } else {
        // High trust but also high rework - likely iteration pattern
        console.log(chalk.blue(`  ℹ Good trust but high iteration`));
        console.log(chalk.gray(`    This might be expected for exploratory work`));
      }

      console.log('');

      // Clear the session
      clearSession(repo);
    }

    // Automatic session detection and baseline comparison (if no manual session)
    if (!session && format === 'terminal' && commits.length >= 3) {
      // Detect session boundary
      const sessionInfo = detectSessionBoundary(commits, repo);

      // Calculate duration
      const sessionDuration = Math.round(
        (result.period.to.getTime() - sessionInfo.sessionStart.getTime()) / 60000
      );

      // Record this session to history
      recordSessionHistory(
        repo,
        sessionInfo.sessionStart,
        result.period.to,
        commits.length,
        trustPassRate,
        reworkRatio,
        spiralCount,
        resultV2.vibeScore?.value
      );

      // Compare to baseline
      const comparison = compareToBaseline(
        repo,
        trustPassRate,
        reworkRatio,
        commits.length,
        sessionDuration
      );

      // Show baseline comparison
      if (comparison.hasBaseline && comparison.comparison) {
        console.log('');
        console.log(chalk.bold.cyan('VS YOUR BASELINE'));
        console.log('');

        const trustDelta = comparison.comparison.trustDelta;
        const reworkDelta = comparison.comparison.reworkDelta;

        const trustSign = trustDelta >= 0 ? '+' : '';
        const reworkSign = reworkDelta >= 0 ? '+' : '';

        const trustColor = trustDelta >= 0 ? chalk.green : chalk.yellow;
        const reworkColor = reworkDelta <= 0 ? chalk.green : chalk.yellow;

        console.log(`  Trust:  ${Math.round(trustPassRate)}% ${trustColor(`(${trustSign}${Math.round(trustDelta)}% vs avg ${comparison.baseline!.trustPassRate}%)`)}`);
        console.log(`  Rework: ${Math.round(reworkRatio)}% ${reworkColor(`(${reworkSign}${Math.round(reworkDelta)}% vs avg ${comparison.baseline!.reworkRatio}%)`)}`);
        console.log('');

        const verdictColor = comparison.comparison.verdict === 'above' ? chalk.green :
                            comparison.comparison.verdict === 'below' ? chalk.yellow :
                            chalk.gray;
        console.log(verdictColor(`  ${comparison.comparison.message}`));
        console.log('');
      } else {
        // Building baseline
        const history = loadSessionHistory(repo);
        const sessionsNeeded = 5 - history.sessions.length;
        if (sessionsNeeded > 0) {
          console.log('');
          console.log(chalk.gray(`  Building your baseline... ${history.sessions.length}/5 sessions recorded`));
          console.log('');
        }
      }
    }

    // Record session and show gamification (only for terminal format with score)
    if (format === 'terminal' && resultV2.vibeScore) {
      const vibeScorePercent = Math.round(resultV2.vibeScore.value * 100);

      const gamificationResult = recordGamificationSession(
        vibeScorePercent,
        result.overall,
        commits.length,
        spiralCount,
        result.period.from,
        result.period.to
      );

      // Show gamification summary
      console.log();
      console.log(chalk.cyan('─'.repeat(64)));

      const levelInfo = LEVELS.find(l => l.level === gamificationResult.profile.xp.level)!;
      const { streak, xp } = gamificationResult.profile;

      // Handle duplicate analysis (no XP awarded)
      if (gamificationResult.isDuplicate) {
        const streakFire = '🔥'.repeat(Math.min(streak.current, 5));
        const streakText = streak.current > 0 ? `${streakFire} ${streak.current}-day streak` : '';
        console.log(`  ${streakText}`);
        console.log(`  ${levelInfo.icon} Level ${xp.level} ${xp.levelName} ${chalk.gray(`(${xp.currentLevelXP}/${xp.nextLevelXP} XP)`)}`);
        console.log(chalk.gray(`  ℹ Already analyzed this period (no XP awarded)`));
        console.log(chalk.gray(`  Make new commits to earn XP!`));
        console.log(chalk.cyan('─'.repeat(64)));
        console.log();
        return;
      }

      // Streak line
      const streakFire = '🔥'.repeat(Math.min(streak.current, 5));
      const streakText = streak.current > 0
        ? `${streakFire} ${streak.current}-day streak${gamificationResult.streakExtended ? chalk.yellow(' (+1!)') : ''}`
        : chalk.gray('Start a streak by running vibe-check daily!');
      console.log(`  ${streakText}`);

      // XP line
      const xpGained = gamificationResult.xpEarned;
      console.log(`  ${levelInfo.icon} Level ${xp.level} ${xp.levelName} ${chalk.gray(`(${xp.currentLevelXP}/${xp.nextLevelXP} XP)`)} ${chalk.green(`+${xpGained} XP`)}`);

      // Level up celebration
      if (gamificationResult.leveledUp) {
        console.log();
        console.log(chalk.bold.magenta(`  🎉 LEVEL UP! You are now ${gamificationResult.newLevel}!`));
      }

      // Personal best
      if (gamificationResult.isPersonalBest) {
        console.log(chalk.bold.yellow(`  🏆 NEW PERSONAL BEST: ${vibeScorePercent}%`));
      }

      // Achievement unlocks
      if (gamificationResult.achievementsUnlocked.length > 0) {
        console.log();
        for (const ach of gamificationResult.achievementsUnlocked) {
          console.log(chalk.bold.green(`  🏆 ACHIEVEMENT UNLOCKED: ${ach.icon} ${ach.name}`));
          console.log(chalk.gray(`     ${ach.description}`));
        }
      }

      console.log(chalk.cyan('─'.repeat(64)));
      console.log(chalk.gray(`  Run ${chalk.white('vibe-check profile')} to see your full stats`));
      console.log();
    }

    // Exit with appropriate code based on overall rating
    if (result.overall === 'LOW') {
      process.exit(1);
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
