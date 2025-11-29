import { Command } from 'commander';
import chalk from 'chalk';
import { getCommits, isGitRepo, getFileStats } from '../git';
import { analyzeCommits } from '../metrics';
import { formatOutput } from '../output';
import {
  OutputFormat,
  VibeCheckResultV2,
  QuestionResponses,
  CalibrationSample,
} from '../types';
import { calculateFileChurn } from '../metrics/file-churn';
import { calculateTimeSpiral } from '../metrics/time-spiral';
import { calculateVelocityAnomaly } from '../metrics/velocity-anomaly';
import { calculateCodeStability } from '../metrics/code-stability';
import { calculateVibeScore } from '../score';
import { predictWithConfidence } from '../recommend';
import { addSample, assessOutcome } from '../calibration';
import { recordSession, loadProfile } from '../gamification/profile';
import { LEVELS } from '../gamification/types';

export interface AnalyzeOptions {
  since?: string;
  until?: string;
  format: string;
  repo: string;
  verbose: boolean;
  score: boolean;
  recommend: boolean;
  calibrate?: string;
}

export function createAnalyzeCommand(): Command {
  const cmd = new Command('analyze')
    .description('Analyze git history for vibe coding metrics')
    .option('--since <date>', 'Start date for analysis (e.g., "1 week ago")')
    .option('--until <date>', 'End date for analysis (default: now)')
    .option('-f, --format <type>', 'Output format: terminal, json, markdown', 'terminal')
    .option('-r, --repo <path>', 'Repository path', process.cwd())
    .option('-v, --verbose', 'Show verbose output', false)
    .option('--score', 'Include VibeScore (semantic-free metrics)', false)
    .option('--recommend', 'Include level recommendation', false)
    .option('--calibrate <level>', 'Record calibration sample with declared level (0-5)')
    .action(async (options) => {
      await runAnalyze(options);
    });

  return cmd;
}

export async function runAnalyze(options: AnalyzeOptions): Promise<void> {
  try {
    const { since, until, format, repo, verbose, score, recommend, calibrate } = options;

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

    // Enhanced analysis if requested
    if (score || recommend || calibrate !== undefined) {
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

      if (recommend) {
        // Default questions (neutral for now)
        const defaultQuestions: QuestionResponses = {
          reversibility: 0,
          blastRadius: 0,
          verificationCost: 0,
          domainComplexity: 0,
          aiTrackRecord: 0,
        };

        const features = [
          defaultQuestions.reversibility,
          defaultQuestions.blastRadius,
          defaultQuestions.verificationCost,
          defaultQuestions.domainComplexity,
          defaultQuestions.aiTrackRecord,
          fileChurn.value / 100,
          timeSpiral.value / 100,
          velocityAnomaly.value / 100,
          codeStability.value / 100,
        ];

        const prediction = predictWithConfidence(features);
        resultV2.recommendation = {
          level: prediction.level as 0 | 1 | 2 | 3 | 4 | 5,
          confidence: Math.round(prediction.confidence * 100) / 100,
          probabilities: prediction.probs,
          ci: prediction.ci,
          questions: defaultQuestions,
        };
      }

      if (calibrate !== undefined) {
        const declaredLevel = parseInt(calibrate, 10);
        if (declaredLevel >= 0 && declaredLevel <= 5) {
          const outcome = assessOutcome(vibeScore.value, declaredLevel);
          const sample: CalibrationSample = {
            timestamp: new Date(),
            vibeScore: vibeScore.value,
            declaredLevel: declaredLevel as 0 | 1 | 2 | 3 | 4 | 5,
            outcome,
            features: [
              fileChurn.value / 100,
              timeSpiral.value / 100,
              velocityAnomaly.value / 100,
              codeStability.value / 100,
            ],
            modelVersion: '2.0.0',
          };
          addSample(repo, sample);
          if (verbose) {
            console.error(
              chalk.gray(
                `Calibration sample recorded: Level ${declaredLevel} → Score ${vibeScore.value} (${outcome})`
              )
            );
          }
        } else {
          console.error(
            chalk.yellow(`Warning: Invalid calibrate level ${calibrate}, must be 0-5`)
          );
        }
      }
    }

    // Output result
    const output = formatOutput(resultV2, format as OutputFormat);
    console.log(output);

    // Record session and show gamification (only for terminal format with score)
    if (format === 'terminal' && resultV2.vibeScore) {
      const spiralCount = result.fixChains.filter(fc => fc.isSpiral).length;
      const vibeScorePercent = Math.round(resultV2.vibeScore.value * 100);

      const gamificationResult = recordSession(
        vibeScorePercent,
        result.overall,
        commits.length,
        spiralCount
      );

      // Show gamification summary
      console.log();
      console.log(chalk.cyan('─'.repeat(64)));

      const levelInfo = LEVELS.find(l => l.level === gamificationResult.profile.xp.level)!;
      const { streak, xp } = gamificationResult.profile;

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
