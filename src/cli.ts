#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { getCommits, isGitRepo } from './git';
import { analyzeCommits } from './metrics';
import { formatOutput } from './output';
import { OutputFormat } from './types';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { version } = require('../package.json');

const program = new Command();

program
  .name('vibe-check')
  .description('Measure vibe coding effectiveness with git commit analysis')
  .version(version)
  .option('--since <date>', 'Start date for analysis (e.g., "1 week ago", "2025-11-01")')
  .option('--until <date>', 'End date for analysis (default: now)')
  .option(
    '-f, --format <type>',
    'Output format: terminal, json, markdown',
    'terminal'
  )
  .option('-r, --repo <path>', 'Repository path (default: current directory)', process.cwd())
  .option('-v, --verbose', 'Show verbose output', false)
  .action(async (options) => {
    try {
      const { since, until, format, repo, verbose } = options;

      // Validate format
      const validFormats: OutputFormat[] = ['terminal', 'json', 'markdown'];
      if (!validFormats.includes(format)) {
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

      // Analyze commits
      const result = analyzeCommits(commits);

      // Output result
      const output = formatOutput(result, format as OutputFormat);
      console.log(output);

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
  });

program.parse();
