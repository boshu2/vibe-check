import { Command } from 'commander';
import chalk from 'chalk';
import { runAndSaveRetro, isRetroDue } from '../learning/retrospective';
import { loadLearningState, saveLearningState, getPendingNudges, dismissNudge } from '../learning/storage';
import { formatPatternMemory, getPatternDisplayName, getPatternAdvice } from '../gamification/pattern-memory';
import { formatInterventionMemory } from '../gamification/intervention-memory';
import { loadProfile } from '../gamification/profile';

export function createLearnCommand(): Command {
  const cmd = new Command('learn')
    .description('Run learning operations - retrospectives, pattern analysis, nudge management')
    .option('--retro', 'Run weekly retrospective')
    .option('--status', 'Show learning status and pending nudges')
    .option('--pattern <name>', 'Show details for a specific pattern (e.g., SSL_TLS)')
    .option('--dismiss <id>', 'Dismiss a nudge by ID')
    .option('--dismiss-all', 'Dismiss all pending nudges')
    .action(async (options) => {
      await runLearn(options);
    });

  return cmd;
}

interface LearnOptions {
  retro?: boolean;
  status?: boolean;
  pattern?: string;
  dismiss?: string;
  dismissAll?: boolean;
}

async function runLearn(options: LearnOptions): Promise<void> {
  // Default to status if no options
  if (!options.retro && !options.pattern && !options.dismiss && !options.dismissAll) {
    options.status = true;
  }

  if (options.retro) {
    await runRetro();
    return;
  }

  if (options.status) {
    showStatus();
    return;
  }

  if (options.pattern) {
    showPattern(options.pattern);
    return;
  }

  if (options.dismissAll) {
    dismissAllNudges();
    return;
  }

  if (options.dismiss) {
    dismissSingleNudge(options.dismiss);
    return;
  }
}

async function runRetro(): Promise<void> {
  const retroCheck = isRetroDue();

  if (!retroCheck.due) {
    console.log(chalk.yellow(`\nRetrospective not due yet (${retroCheck.daysSince} days since last).`));
    console.log(chalk.gray('Run with --force to run anyway.\n'));

    // Ask if they want to run anyway
    const profile = loadProfile();
    if (profile.sessions.length >= 3) {
      console.log(chalk.gray('Running anyway since you have recent sessions...\n'));
      runAndSaveRetro();
    }
    return;
  }

  runAndSaveRetro();
}

function showStatus(): void {
  const state = loadLearningState();
  const profile = loadProfile();
  const nudges = getPendingNudges(state);
  const retroCheck = isRetroDue();

  console.log('');
  console.log(chalk.bold.cyan('='.repeat(64)));
  console.log(chalk.bold.cyan('  LEARNING STATUS'));
  console.log(chalk.bold.cyan('='.repeat(64)));
  console.log('');

  // Retro status
  if (retroCheck.due) {
    console.log(chalk.yellow(`  Retrospective due: ${retroCheck.reason}`));
    console.log(chalk.gray('     Run `vibe-check learn --retro` to complete'));
  } else {
    console.log(chalk.green(`  Retrospective: ${retroCheck.daysSince} days ago (due in ${7 - retroCheck.daysSince} days)`));
  }
  console.log('');

  // Pending nudges
  if (nudges.length > 0) {
    console.log(chalk.bold.white(`  PENDING NUDGES (${nudges.length})`));
    for (const nudge of nudges) {
      console.log(`    ${nudge.icon} ${nudge.title}`);
      console.log(chalk.gray(`       ${nudge.message}`));
      console.log(chalk.gray(`       ID: ${nudge.id}`));
    }
  } else {
    console.log(chalk.gray('  No pending nudges'));
  }
  console.log('');

  // Pattern summary
  const patternData = formatPatternMemory(profile.patternMemory);
  if (patternData.hasData) {
    console.log(chalk.bold.white('  PATTERN SUMMARY'));
    console.log(`    ${patternData.summary}`);
    console.log(chalk.gray(`    Avg recovery time: ${patternData.avgRecoveryTime} min`));
  }
  console.log('');

  // Stats
  console.log(chalk.bold.white('  LEARNING STATS'));
  console.log(`    Retrospectives completed: ${state.totalRetrosCompleted}`);
  console.log(`    Nudges displayed: ${state.nudgesDisplayed}`);
  console.log(`    Nudges dismissed: ${state.nudgesDismissed}`);
  console.log('');

  console.log(chalk.bold.cyan('='.repeat(64)));
  console.log('');
}

function showPattern(patternName: string): void {
  const profile = loadProfile();
  const displayName = getPatternDisplayName(patternName);
  const advice = getPatternAdvice(patternName);

  console.log('');
  console.log(chalk.bold.cyan(`  PATTERN: ${displayName}`));
  console.log('');

  const patternMemory = profile.patternMemory;
  if (!patternMemory) {
    console.log(chalk.gray('  No pattern data recorded yet.'));
    return;
  }

  const records = patternMemory.records.filter(r => r.pattern === patternName);
  const count = patternMemory.patternCounts[patternName] || 0;
  const totalMinutes = patternMemory.patternDurations[patternName] || 0;

  console.log(`  Occurrences: ${count}`);
  console.log(`  Total time lost: ${totalMinutes} min`);
  console.log(`  Avg recovery: ${count > 0 ? Math.round(totalMinutes / count) : 0} min`);
  console.log('');
  console.log(chalk.bold.yellow(`  ADVICE: ${advice}`));
  console.log('');

  // Recent occurrences
  if (records.length > 0) {
    console.log(chalk.bold.white('  RECENT OCCURRENCES'));
    for (const record of records.slice(-5).reverse()) {
      console.log(`    ${record.date}: ${record.component} (${record.duration} min, ${record.commits} commits)`);
    }
  }
  console.log('');
}

function dismissAllNudges(): void {
  let state = loadLearningState();
  const nudges = getPendingNudges(state);

  for (const nudge of nudges) {
    state = dismissNudge(state, nudge.id);
  }

  saveLearningState(state);
  console.log(chalk.green(`\n  Dismissed ${nudges.length} nudges.\n`));
}

function dismissSingleNudge(nudgeId: string): void {
  const state = loadLearningState();
  const updatedState = dismissNudge(state, nudgeId);
  saveLearningState(updatedState);
  console.log(chalk.green(`\n  Nudge dismissed.\n`));
}
