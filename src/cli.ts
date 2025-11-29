#!/usr/bin/env node

import { Command } from 'commander';
import { createAnalyzeCommand, createLevelCommand, createProfileCommand, runAnalyze } from './commands';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { version } = require('../package.json');

const program = new Command();

program
  .name('vibe-check')
  .description('Measure and classify vibe coding effectiveness')
  .version(version);

// Add subcommands
program.addCommand(createAnalyzeCommand());
program.addCommand(createLevelCommand());
program.addCommand(createProfileCommand());

// Default behavior: if no subcommand, run analyze with passed options
// This maintains backwards compatibility with v1.x usage
program
  .option('--since <date>', 'Start date for analysis (e.g., "1 week ago")')
  .option('--until <date>', 'End date for analysis (default: now)')
  .option('-f, --format <type>', 'Output format: terminal, json, markdown', 'terminal')
  .option('-r, --repo <path>', 'Repository path', process.cwd())
  .option('-v, --verbose', 'Show verbose output', false)
  .option('--score', 'Include VibeScore (semantic-free metrics)', false)
  .option('--recommend', 'Include level recommendation', false)
  .option('--calibrate <level>', 'Record calibration sample with declared level (0-5)')
  .option('-o, --output <file>', 'Write JSON results to file')
  .action(async (options) => {
    // Default action runs analyze (backwards compatibility)
    await runAnalyze({
      since: options.since,
      until: options.until,
      format: options.format,
      repo: options.repo,
      verbose: options.verbose,
      score: options.score,
      recommend: options.recommend,
      calibrate: options.calibrate,
      output: options.output,
    });
  });

program.parse();
