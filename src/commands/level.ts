import { Command } from 'commander';
import chalk from 'chalk';
import { QuestionResponses } from '../types';
import { VIBE_QUESTIONS } from '../recommend/questions';
import { predictWithConfidence, ModelState } from '../recommend';
import { loadCalibration } from '../calibration';
import { getCommits, isGitRepo, getFileStats } from '../git';
import { calculateFileChurn } from '../metrics/file-churn';
import { calculateTimeSpiral } from '../metrics/time-spiral';
import { calculateVelocityAnomaly } from '../metrics/velocity-anomaly';
import { calculateCodeStability } from '../metrics/code-stability';

interface LevelResult {
  level: number;
  confidence: number;
  responses: QuestionResponses;
  reasoning: string[];
  source: 'ml' | 'fallback';
  ece?: number;
  sampleCount?: number;
}

export function createLevelCommand(): Command {
  const cmd = new Command('level')
    .description('Classify vibe level for upcoming work (interactive)')
    .option('--quick', 'Non-interactive mode with neutral defaults', false)
    .option('--json', 'Output as JSON', false)
    .option('-r, --repo <path>', 'Repository path for metrics', process.cwd())
    .option('--since <date>', 'Git history start for metrics (default: 30 days ago)', '30 days ago')
    .option(
      '--answers <responses>',
      'Pre-filled answers as JSON (e.g., \'{"reversibility":1,"blastRadius":0}\')'
    )
    .action(async (options) => {
      await runLevel(options);
    });

  return cmd;
}

async function runLevel(options: {
  quick: boolean;
  json: boolean;
  repo: string;
  since: string;
  answers?: string;
}): Promise<void> {
  let responses: QuestionResponses;

  if (options.quick) {
    // Non-interactive: use defaults or provided answers
    responses = {
      reversibility: 0,
      blastRadius: 0,
      verificationCost: 0,
      domainComplexity: 0,
      aiTrackRecord: 0,
    };

    if (options.answers) {
      try {
        const provided = JSON.parse(options.answers);
        responses = { ...responses, ...provided };
      } catch {
        console.error(chalk.red('Invalid --answers JSON'));
        process.exit(1);
      }
    }
  } else {
    // Interactive mode
    if (!process.stdin.isTTY) {
      console.error(chalk.yellow('Non-interactive terminal detected. Use --quick for non-interactive mode.'));
      process.exit(1);
    }
    responses = await askQuestions();
  }

  const result = await classifyLevel(responses, options.repo, options.since);

  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    displayResult(result);
  }
}

async function askQuestions(): Promise<QuestionResponses> {
  // Dynamic import for enquirer
  const Enquirer = (await import('enquirer')).default;

  const responses: Partial<QuestionResponses> = {};

  console.log('');
  console.log(chalk.bold.cyan('═'.repeat(60)));
  console.log(chalk.bold.cyan('           VIBE LEVEL CLASSIFICATION'));
  console.log(chalk.bold.cyan('═'.repeat(60)));
  console.log('');
  console.log(chalk.gray('Answer 5 questions to determine the appropriate vibe level.'));
  console.log(chalk.gray('Use ↑/↓ arrows to select, Enter to confirm.'));
  console.log('');

  for (const question of VIBE_QUESTIONS) {
    const answer = await Enquirer.prompt<{ answer: string }>({
      type: 'select',
      name: 'answer',
      message: question.text,
      choices: question.options.map((opt) => ({
        name: opt.label,
        message: `${opt.label} ${chalk.gray('- ' + opt.description)}`,
        value: String(opt.value),
      })),
    });

    const selected = question.options.find((o) => o.label === answer.answer);
    responses[question.id] = (selected?.value ?? 0) as -2 | -1 | 0 | 1;
    console.log('');
  }

  return responses as QuestionResponses;
}

async function classifyLevel(
  responses: QuestionResponses,
  repoPath: string,
  since: string
): Promise<LevelResult> {
  // Try to get real metrics from git history
  let metricsFeatures = [0.7, 0.7, 0.7, 0.7]; // Defaults if no git history
  let source: 'ml' | 'fallback' = 'fallback';

  try {
    if (await isGitRepo(repoPath)) {
      const commits = await getCommits(repoPath, since);

      if (commits.length >= 3) {
        const fileStats = await getFileStats(repoPath, since);

        const fileChurn = calculateFileChurn(commits, fileStats.filesPerCommit);
        const timeSpiral = calculateTimeSpiral(commits);
        const velocityAnomaly = calculateVelocityAnomaly(commits);
        const codeStability = calculateCodeStability(commits, fileStats.lineStats);

        metricsFeatures = [
          fileChurn.value / 100,
          timeSpiral.value / 100,
          velocityAnomaly.value / 100,
          codeStability.value / 100,
        ];
        source = 'ml';
      }
    }
  } catch {
    // Fall back to defaults if git fails
  }

  // Load calibration state (contains learned weights)
  const calibration = loadCalibration(repoPath);

  // Build full feature vector: 5 questions + 4 metrics
  const features = [
    responses.reversibility,
    responses.blastRadius,
    responses.verificationCost,
    responses.domainComplexity,
    responses.aiTrackRecord,
    ...metricsFeatures,
  ];

  // Use ML model with learned weights
  const model: ModelState = {
    weights: calibration.weights,
    thresholds: calibration.thresholds,
  };

  const prediction = predictWithConfidence(features, model);

  // Use ML prediction (NOT additive formula)
  const level = prediction.level;
  const confidence = prediction.confidence;

  // Build reasoning
  const reasoning: string[] = [];

  if (source === 'ml') {
    reasoning.push(`Based on ${since} git history + your answers`);
    if (metricsFeatures[0] < 0.7) reasoning.push('File churn detected - code needed rework');
    if (metricsFeatures[1] < 0.7) reasoning.push('Time spirals detected - rapid fix commits');
  } else {
    reasoning.push('No git history available - using question answers only');
  }

  if (responses.reversibility <= -1) reasoning.push('Low reversibility requires careful review');
  if (responses.blastRadius <= -1) reasoning.push('Wide blast radius increases risk');
  if (responses.verificationCost <= -1) reasoning.push('High verification cost needs extra attention');
  if (responses.domainComplexity <= -1) reasoning.push('Domain complexity may cause AI errors');
  if (responses.aiTrackRecord <= -1) reasoning.push('AI track record suggests caution');

  if (reasoning.length === 0) {
    reasoning.push('Standard risk profile - proceed with appropriate level');
  }

  return {
    level,
    confidence,
    responses,
    reasoning,
    source,
    ece: calibration.ece,
    sampleCount: calibration.samples.length,
  };
}

function displayResult(result: LevelResult): void {
  const levelDescriptions: Record<number, { name: string; trust: string; verify: string }> = {
    5: { name: 'Full Automation', trust: '95%', verify: 'Final review only' },
    4: { name: 'High Trust', trust: '80%', verify: 'Spot check' },
    3: { name: 'Balanced', trust: '60%', verify: 'Review key outputs' },
    2: { name: 'AI-Augmented', trust: '40%', verify: 'Review every change' },
    1: { name: 'Human-Led', trust: '20%', verify: 'Review every line' },
    0: { name: 'Manual Only', trust: '0%', verify: 'No AI assistance' },
  };

  const desc = levelDescriptions[result.level];

  console.log('');
  console.log(chalk.bold.cyan('═'.repeat(60)));
  console.log('');

  // Level display with color coding
  const levelColor = result.level >= 4 ? chalk.green : result.level >= 2 ? chalk.yellow : chalk.red;
  console.log(`  ${chalk.bold('RECOMMENDED LEVEL:')} ${levelColor.bold(`${result.level} - ${desc.name}`)}`);
  console.log('');
  console.log(`  ${chalk.gray('Trust:')}  ${desc.trust}`);
  console.log(`  ${chalk.gray('Verify:')} ${desc.verify}`);
  console.log(`  ${chalk.gray('Confidence:')} ${(result.confidence * 100).toFixed(0)}%`);
  console.log('');

  // Model info
  if (result.source === 'ml') {
    console.log(chalk.green(`  ✓ Using ML model with ${result.sampleCount || 0} calibration samples`));
    if (result.ece !== undefined && result.ece > 0) {
      console.log(chalk.gray(`    ECE: ${(result.ece * 100).toFixed(1)}%`));
    }
  } else {
    console.log(chalk.yellow(`  ⚠ Fallback mode (no git history available)`));
  }

  console.log('');
  console.log(chalk.bold.yellow('  REASONING:'));
  for (const reason of result.reasoning) {
    console.log(chalk.yellow(`  • ${reason}`));
  }

  console.log('');
  console.log(chalk.bold.cyan('═'.repeat(60)));
  console.log('');
  console.log(chalk.gray(`  After your work, run:`));
  console.log(chalk.white(`  vibe-check --score --calibrate ${result.level}`));
  console.log('');
}
