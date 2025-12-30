/**
 * Analyze command helper functions - encapsulates data loading, metrics computation, and output formatting
 * Reduces coupling in analyze.ts by providing focused single-responsibility functions
 */

import chalk from 'chalk';
import { writeFileSync } from 'fs';
import { getCommits } from '../git.js';
import { analyzeCommits } from '../metrics/index.js';
import { formatOutput } from '../output/index.js';
import { formatJson } from '../output/json.js';
import {
  OutputFormat,
  VibeCheckResultV2,
  Commit,
} from '../types.js';
import { getContext, hasContext, debugLog } from '../internal/context/index.js';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface AnalyzeData {
  commits: Commit[];
  filtered: boolean;
  filterScope?: string;
}

export interface ComputedMetrics {
  result: ReturnType<typeof analyzeCommits>;
  resultV2: VibeCheckResultV2;
}

// ============================================================================
// Data Loading
// ============================================================================

/**
 * Load commits from git repository with optional scope filtering
 */
export async function loadAnalyzeData(
  repo: string,
  since?: string,
  until?: string,
  scope?: string,
  verbose?: boolean
): Promise<AnalyzeData> {
  // Use debug logging if context is available
  const ctx = hasContext() ? getContext() : null;

  if (ctx) {
    debugLog(ctx, `Analyzing repository: ${repo}`);
    if (since) debugLog(ctx, `Since: ${since}`);
    if (until) debugLog(ctx, `Until: ${until}`);
    if (scope) debugLog(ctx, `Scope filter: ${scope}`);
  } else if (verbose) {
    // Fallback for when context isn't available
    console.error(chalk.gray(`Analyzing repository: ${repo}`));
    if (since) console.error(chalk.gray(`Since: ${since}`));
    if (until) console.error(chalk.gray(`Until: ${until}`));
    if (scope) console.error(chalk.gray(`Scope filter: ${scope}`));
  }

  // Get commits from git
  const timeout = ctx?.timeout;
  const maxCommits = ctx?.maxCommits;
  let commits = await getCommits(repo, since, until, timeout, maxCommits);
  let filtered = false;

  // Apply scope filter if specified
  if (scope) {
    commits = commits.filter(c => c.scope === scope);
    filtered = true;
    if (ctx) {
      debugLog(ctx, `Filtered to ${commits.length} commits in scope "${scope}"`);
    } else if (verbose) {
      console.error(chalk.gray(`Filtered to ${commits.length} commits in scope "${scope}"`));
    }
  }

  if (ctx) {
    debugLog(ctx, `Found ${commits.length} commits`);
  } else if (verbose) {
    console.error(chalk.gray(`Found ${commits.length} commits`));
  }

  return {
    commits,
    filtered,
    filterScope: scope,
  };
}

// ============================================================================
// Metrics Computation
// ============================================================================

/**
 * Compute all metrics from commits
 */
export async function computeAnalyzeMetrics(
  commits: Commit[],
  _repo: string,
  options: {
    includeEnhanced?: boolean;
    since?: string;
    until?: string;
    verbose?: boolean;
  } = {}
): Promise<ComputedMetrics> {
  // Analyze commits (semantic metrics)
  const result = analyzeCommits(commits);

  // Build result
  const resultV2: VibeCheckResultV2 = {
    ...result,
    semanticMetrics: result.metrics,
  };

  return { result, resultV2 };
}

// ============================================================================
// Output Formatting
// ============================================================================

export interface OutputOptions {
  format: OutputFormat;
  simple?: boolean;
  outputFile?: string;
  verbose?: boolean;
}

/**
 * Format and output analysis results
 */
export function formatAnalyzeOutput(
  resultV2: VibeCheckResultV2,
  options: OutputOptions
): string {
  const { format, simple = false, outputFile, verbose } = options;

  // Write to file if requested
  if (outputFile) {
    const jsonOutput = formatJson(resultV2);
    writeFileSync(outputFile, jsonOutput);
    const ctx = hasContext() ? getContext() : null;
    if (ctx) {
      debugLog(ctx, `Results written to: ${outputFile}`);
    } else if (verbose) {
      console.error(chalk.gray(`Results written to: ${outputFile}`));
    }
  }

  // Format output for console
  return formatOutput(resultV2, format, { simple, verbose });
}

/**
 * Handle the "no commits found" case with appropriate output
 */
export function handleNoCommits(
  format: OutputFormat,
  since?: string
): string {
  if (format === 'terminal') {
    let output = chalk.yellow('\nNo commits found in the specified range.\n');
    if (!since) {
      output += chalk.gray('Try specifying a date range:\n');
      output += chalk.gray('  vc --since "1 week ago"\n');
      output += chalk.gray('  vc --since "2025-11-01"\n');
    }
    return output;
  } else if (format === 'json') {
    return JSON.stringify({ error: 'No commits found', commits: 0 });
  } else {
    return '# Vibe-Check Report\n\nNo commits found in the specified range.';
  }
}
