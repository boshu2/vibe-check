/**
 * Intervene Command - Record what broke your spiral
 *
 * Usage:
 *   vibe-check intervene <type> [options]
 *   vibe-check intervene --list
 *
 * Examples:
 *   vibe-check intervene TRACER_TEST
 *   vibe-check intervene BREAK --pattern SECRETS_AUTH --duration 45
 *   vibe-check intervene --list
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { loadProfile, saveProfile } from '../gamification/profile';
import {
  recordIntervention,
  getAllInterventionTypes,
  createInitialInterventionMemory,
  formatInterventionMemory,
  getInterventionDisplayName,
  getInterventionIcon,
} from '../gamification/intervention-memory';
import { InterventionType } from '../gamification/types';

const VALID_TYPES: InterventionType[] = [
  'TRACER_TEST',
  'BREAK',
  'DOCS',
  'REFACTOR',
  'HELP',
  'ROLLBACK',
  'OTHER',
];

export function createInterveneCommand(): Command {
  const cmd = new Command('intervene')
    .description('Record what intervention broke your debug spiral')
    .argument('[type]', 'Intervention type (use --list to see options)')
    .option('-l, --list', 'List all intervention types', false)
    .option('-p, --pattern <pattern>', 'The spiral pattern you were debugging')
    .option('-c, --component <component>', 'The component involved')
    .option('-d, --duration <minutes>', 'How long the spiral lasted', '30')
    .option('-n, --notes <notes>', 'Optional notes about what helped')
    .option('--stats', 'Show your intervention statistics', false)
    .action(async (type, options) => {
      await runIntervene(type, options);
    });

  return cmd;
}

async function runIntervene(
  type: string | undefined,
  options: {
    list: boolean;
    pattern?: string;
    component?: string;
    duration: string;
    notes?: string;
    stats: boolean;
  }
): Promise<void> {
  // List intervention types
  if (options.list) {
    showInterventionTypes();
    return;
  }

  // Show stats
  if (options.stats) {
    showInterventionStats();
    return;
  }

  // Validate type is provided
  if (!type) {
    console.log(chalk.yellow('\nNo intervention type specified.\n'));
    console.log('Usage: vibe-check intervene <type> [options]');
    console.log('');
    console.log('Run `vibe-check intervene --list` to see available types.');
    console.log('Run `vibe-check intervene --stats` to see your statistics.');
    return;
  }

  // Validate type
  const upperType = type.toUpperCase() as InterventionType;
  if (!VALID_TYPES.includes(upperType)) {
    console.log(chalk.red(`\nInvalid intervention type: ${type}`));
    console.log('');
    console.log('Valid types:');
    for (const t of VALID_TYPES) {
      const icon = getInterventionIcon(t);
      const name = getInterventionDisplayName(t);
      console.log(`  ${icon} ${chalk.cyan(t)} - ${name}`);
    }
    return;
  }

  // Parse duration
  const duration = parseInt(options.duration, 10);
  if (isNaN(duration) || duration < 0) {
    console.log(chalk.red('Invalid duration. Please provide a number of minutes.'));
    return;
  }

  // Load profile and record intervention
  const profile = loadProfile();

  // Initialize intervention memory if needed
  if (!profile.interventionMemory) {
    profile.interventionMemory = createInitialInterventionMemory();
  }

  // Record the intervention
  profile.interventionMemory = recordIntervention(profile.interventionMemory, {
    type: upperType,
    spiralPattern: options.pattern?.toUpperCase(),
    spiralComponent: options.component?.toLowerCase(),
    spiralDuration: duration,
    notes: options.notes,
  });

  // Save profile
  saveProfile(profile);

  // Show confirmation
  const icon = getInterventionIcon(upperType);
  const name = getInterventionDisplayName(upperType);

  console.log('');
  console.log(chalk.green(`${icon} Intervention recorded: ${name}`));
  console.log('');

  if (options.pattern) {
    console.log(`  Pattern: ${chalk.yellow(options.pattern.toUpperCase())}`);
  }
  if (options.component) {
    console.log(`  Component: ${chalk.cyan(options.component)}`);
  }
  console.log(`  Spiral duration: ${chalk.gray(`${duration} minutes`)}`);
  if (options.notes) {
    console.log(`  Notes: ${chalk.gray(options.notes)}`);
  }

  console.log('');
  console.log(
    chalk.gray(
      `Total interventions: ${profile.interventionMemory.totalInterventions}`
    )
  );
  console.log(chalk.gray('Run `vibe-check intervene --stats` to see patterns'));
  console.log('');
}

function showInterventionTypes(): void {
  const types = getAllInterventionTypes();

  console.log('');
  console.log(chalk.bold('Available Intervention Types'));
  console.log('');

  for (const { type, icon, name, description } of types) {
    console.log(`  ${icon} ${chalk.cyan(type.padEnd(12))} ${chalk.white(name)}`);
    console.log(`     ${chalk.gray(description)}`);
    console.log('');
  }

  console.log(chalk.gray('Usage: vibe-check intervene <TYPE> [--pattern PATTERN] [--duration MIN]'));
  console.log('');
  console.log(chalk.gray('Example: vibe-check intervene TRACER_TEST --pattern SECRETS_AUTH --duration 45'));
  console.log('');
}

function showInterventionStats(): void {
  const profile = loadProfile();
  const stats = formatInterventionMemory(profile.interventionMemory);

  console.log('');
  console.log(chalk.bold('🛠️  Your Intervention Statistics'));
  console.log('');

  if (!stats.hasData) {
    console.log(chalk.gray('  No interventions recorded yet.'));
    console.log('');
    console.log(chalk.gray('  When you break out of a debug spiral, record what helped:'));
    console.log(chalk.gray('  vibe-check intervene TRACER_TEST --pattern SECRETS_AUTH'));
    console.log('');
    return;
  }

  // Summary
  console.log(chalk.bold('Summary'));
  console.log(`  ${stats.summary}`);
  console.log(`  Average spiral duration: ${chalk.bold(stats.avgTimeToIntervene.toString())} minutes`);
  console.log('');

  // Top interventions
  if (stats.topInterventions.length > 0) {
    console.log(chalk.bold('Your Go-To Interventions'));
    for (const int of stats.topInterventions) {
      const pct = Math.round((int.count / stats.totalInterventions) * 100);
      const bar = createBar(pct);
      console.log(`  ${int.icon} ${int.name.padEnd(15)} ${bar} ${int.count}× (${pct}%)`);
    }
    console.log('');
  }

  // Pattern-specific recommendations
  if (stats.patternRecommendations.length > 0) {
    console.log(chalk.bold('What Works by Pattern'));
    for (const rec of stats.patternRecommendations) {
      console.log(`  ${chalk.yellow(rec.pattern)}: ${rec.interventions.join(', ')}`);
    }
    console.log('');
  }

  console.log(chalk.gray('Keep recording interventions to build your personalized playbook!'));
  console.log('');
}

function createBar(pct: number): string {
  const filled = Math.round(pct / 10);
  const empty = 10 - filled;
  return chalk.green('█'.repeat(filled)) + chalk.gray('░'.repeat(empty));
}
