#!/usr/bin/env node

import { Command } from 'commander';
import { createAnalyzeCommand, createStartCommand, createProfileCommand, createInitHookCommand, createWatchCommand, createInterveneCommand, createTimelineCommand, createCacheCommand, runAnalyze } from './commands';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { version } = require('../package.json');

const program = new Command();

program
  .name('vibe-check')
  .description('Quick check: are you building or spiraling?')
  .version(version)
  .enablePositionalOptions()
  .passThroughOptions();

// Add subcommands
program.addCommand(createAnalyzeCommand());
program.addCommand(createStartCommand());
program.addCommand(createProfileCommand());
program.addCommand(createInitHookCommand());
program.addCommand(createWatchCommand());
program.addCommand(createInterveneCommand());
program.addCommand(createTimelineCommand());
program.addCommand(createCacheCommand());

// Default behavior: if no subcommand, run analyze with passed options
// This maintains backwards compatibility with v1.x usage
program
  .option('--since <date>', 'Start date for analysis (e.g., "1 week ago")')
  .option('--until <date>', 'End date for analysis (default: now)')
  .option('-f, --format <type>', 'Output format: terminal, json, markdown', 'terminal')
  .option('-r, --repo <path>', 'Repository path', process.cwd())
  .option('-v, --verbose', 'Show verbose output', false)
  .option('--score', 'Include VibeScore and code pattern metrics', false)
  .option('-o, --output <file>', 'Write JSON results to file')
  .option('-s, --simple', 'Simplified output (fewer details)', false)
  .action(async (options) => {
    // Default action runs analyze (backwards compatibility)
    await runAnalyze({
      since: options.since,
      until: options.until,
      format: options.format,
      repo: options.repo,
      verbose: options.verbose,
      score: options.score,
      output: options.output,
      simple: options.simple,
    });
  });

program.parse();
