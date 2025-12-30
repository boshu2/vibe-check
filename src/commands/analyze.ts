// ============================================================================
// IMPORTS
// ============================================================================

import { Command } from 'commander';
import chalk from 'chalk';
import { isGitRepo } from '../git.js';
import {
  OutputFormat,
} from '../types.js';
import {
  GitError,
  ValidationError,
  ExitCode,
  isVibeCheckError,
  formatError,
} from '../errors.js';
import {
  loadAnalyzeData,
  computeAnalyzeMetrics,
  formatAnalyzeOutput,
  handleNoCommits,
} from './analyze-helpers.js';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface AnalyzeOptions {
  since?: string;
  until?: string;
  format: string;
  repo: string;
  verbose: boolean;
  score: boolean;
  output?: string;
  simple: boolean;
  scope?: string;
}

// ============================================================================
// Validation Helpers
// ============================================================================

const VALID_FORMATS: OutputFormat[] = ['terminal', 'json', 'markdown'];

function validateOptions(options: AnalyzeOptions): void {
  if (!VALID_FORMATS.includes(options.format as OutputFormat)) {
    throw ValidationError.invalidFormat(options.format, VALID_FORMATS);
  }
}

async function validateRepo(repo: string): Promise<void> {
  if (!(await isGitRepo(repo))) {
    throw GitError.notARepo(repo);
  }
}

// ============================================================================
// Command Implementation
// ============================================================================

export function createAnalyzeCommand(): Command {
  const cmd = new Command('analyze')
    .description('Analyze git history for vibe coding metrics')
    .option('--since <date>', 'Start date for analysis (e.g., "1 week ago")')
    .option('--until <date>', 'End date for analysis (default: now)')
    .option('-f, --format <type>', 'Output format: terminal, json, markdown', 'terminal')
    .option('-r, --repo <path>', 'Repository path', process.cwd())
    .option('-v, --verbose', 'Show verbose output', false)
    .option('--score', 'Include VibeScore metrics', false)
    .option('-o, --output <file>', 'Write JSON results to file')
    .option('-s, --simple', 'Simplified output (fewer details)', false)
    .option('--scope <scope>', 'Filter analysis to specific scope (e.g., "auth", "api")')
    .action(async (options) => {
      const exitCode = await runAnalyze(options);
      if (exitCode !== ExitCode.SUCCESS) {
        process.exit(exitCode);
      }
    });

  return cmd;
}

/**
 * Main analyze function - orchestrator pattern
 * Coordinates: validation -> data loading -> metrics -> output
 * Returns exit code instead of calling process.exit
 */
export async function runAnalyze(options: AnalyzeOptions): Promise<ExitCode> {
  try {
    const { since, until, format, repo, verbose, score, output, simple, scope } = options;

    // Step 1: Validate options and repo
    validateOptions(options);
    await validateRepo(repo);

    // Step 2: Load data from git
    const { commits } = await loadAnalyzeData(repo, since, until, scope, verbose);

    // Handle no commits case
    if (commits.length === 0) {
      console.log(handleNoCommits(format as OutputFormat, since));
      return ExitCode.SUCCESS;
    }

    // Step 3: Compute metrics
    const { result, resultV2 } = await computeAnalyzeMetrics(commits, repo, {
      includeEnhanced: score,
      since,
      until,
      verbose,
    });

    // Step 4: Format and output results
    const formattedOutput = formatAnalyzeOutput(resultV2, {
      format: format as OutputFormat,
      simple,
      outputFile: output,
      verbose,
    });
    console.log(formattedOutput);

    // Return appropriate exit code based on overall rating
    return result.overall === 'LOW' ? ExitCode.GENERAL_ERROR : ExitCode.SUCCESS;

  } catch (error) {
    return handleAnalyzeError(error, options);
  }
}

/**
 * Handle errors from analyze command with appropriate formatting
 */
function handleAnalyzeError(error: unknown, options: AnalyzeOptions): ExitCode {
  if (isVibeCheckError(error)) {
    if (options.format === 'json') {
      console.log(JSON.stringify(error.toJSON()));
    } else {
      console.error(chalk.red(`Error: ${error.message}`));
      if (options.verbose && error.stack) {
        console.error(chalk.gray(error.stack));
      }
    }
    return error.code;
  }

  // Handle unknown errors
  if (options.format === 'json') {
    console.log(JSON.stringify({ error: formatError(error) }));
  } else {
    console.error(chalk.red(`Error: ${formatError(error)}`));
    if (options.verbose && error instanceof Error && error.stack) {
      console.error(chalk.gray(error.stack));
    }
  }
  return ExitCode.GENERAL_ERROR;
}
