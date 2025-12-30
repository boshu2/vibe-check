#!/usr/bin/env node

import { Command } from 'commander';
import { createRequire } from 'module';
import { runAnalyze } from './commands/index.js';
import { createContext, setContext } from './internal/context/index.js';
import { ExitCode } from './errors.js';

const require = createRequire(import.meta.url);
const { version } = require('../package.json');

const program = new Command();

program
  .name('vc')
  .description('Quick check: are you building or spiraling?')
  .version(version);

// Global hooks - set up context before action
program.hook('preAction', async (thisCommand) => {
  const opts = thisCommand.opts();

  let outputMode: 'terminal' | 'json' = 'terminal';
  if (opts.json || opts.format === 'json') {
    outputMode = 'json';
  }

  const timeout = parseInt(opts.timeout || '120', 10);
  const maxCommits = opts.maxCommits ? parseInt(opts.maxCommits, 10) : undefined;

  const ctx = createContext({
    repo: opts.repo || process.cwd(),
    outputMode,
    verbose: opts.verbose || false,
    quiet: opts.quiet || false,
    debug: opts.debug || undefined,
    timeout: isNaN(timeout) ? 120 : timeout,
    maxCommits: maxCommits && !isNaN(maxCommits) ? maxCommits : undefined,
    version,
  });
  setContext(ctx);
});

// Main command options and action
program
  .option('--json', 'Output JSON')
  .option('--timeout <seconds>', 'Git timeout in seconds', '120')
  .option('--max-commits <number>', 'Max commits to analyze')
  .option('--since <date>', 'Start date (e.g., "1 week ago")')
  .option('--until <date>', 'End date (default: now)')
  .option('-f, --format <type>', 'Output format: terminal, json, markdown', 'terminal')
  .option('-r, --repo <path>', 'Repository path', process.cwd())
  .option('-v, --verbose', 'Verbose output', false)
  .option('-q, --quiet', 'Quiet output', false)
  .option('--debug', 'Debug logging', false)
  .option('--score', 'Include VibeScore metrics', false)
  .option('-o, --output <file>', 'Write JSON to file')
  .option('-s, --simple', 'Simple output', false)
  .option('--scope <scope>', 'Filter by scope')
  .action(async (options) => {
    // --json flag overrides --format
    const format = options.json ? 'json' : options.format;
    const exitCode = await runAnalyze({
      since: options.since,
      until: options.until,
      format,
      repo: options.repo,
      verbose: options.verbose,
      score: options.score,
      output: options.output,
      simple: options.simple,
      scope: options.scope,
    });
    if (exitCode !== ExitCode.SUCCESS) {
      process.exit(exitCode);
    }
  });

program.parse();
