#!/usr/bin/env node

import { Command } from 'commander';
import { createRequire } from 'module';
import { createAnalyzeCommand, createStartCommand, createProfileCommand, createInitHookCommand, createWatchCommand, createTimelineCommand, createCacheCommand, createDashboardCommand, createSessionCommand, createInsightsCommand, createPipelineCommand, createSessionsCommand, createForensicsCommand, createAuditCommand, runAnalyze } from './commands/index.js';

const require = createRequire(import.meta.url);
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
program.addCommand(createTimelineCommand());
program.addCommand(createCacheCommand());
program.addCommand(createDashboardCommand());
program.addCommand(createSessionCommand());
program.addCommand(createInsightsCommand());
program.addCommand(createPipelineCommand());
program.addCommand(createSessionsCommand());
program.addCommand(createForensicsCommand());
program.addCommand(createAuditCommand());

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
  .option('--all-time', 'Analyze all commits from cache (ignores --since/--until)')
  .option('--scope <scope>', 'Filter analysis to specific scope (e.g., "auth", "api")')
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
      allTime: options.allTime,
      scope: options.scope,
    });
  });

program.parse();
