/**
 * Modularity Command
 *
 * Analyze code modularity with pattern-aware scoring.
 * Goes beyond simple LOC counting to assess whether large files
 * are well-organized or problematic.
 *
 * Usage:
 *   vibe-check modularity                    # Analyze current directory
 *   vibe-check modularity -r /path/to/repo   # Analyze specific repo
 *   vibe-check modularity --all              # Include small files too
 *   vibe-check modularity --pattern store    # Filter to specific pattern
 *   vibe-check modularity -f json            # JSON output
 */

import { Command } from 'commander';
import chalk from 'chalk';
import * as path from 'path';
import {
  analyzeModularity,
  ModularityResult,
  FileModularity,
  ModularityRating,
  FilePattern,
  ModularityOptions,
} from '../analyzers/modularity.js';

export interface ModularityCommandOptions {
  repo: string;
  format: 'terminal' | 'json';
  verbose: boolean;
  all: boolean;
  minLines: number;
  pattern?: string;
  top: number;
}

export function createModularityCommand(): Command {
  const cmd = new Command('modularity')
    .description('Analyze code modularity with pattern-aware scoring')
    .option('-r, --repo <path>', 'Repository path', process.cwd())
    .option('-f, --format <type>', 'Output format: terminal, json', 'terminal')
    .option('-v, --verbose', 'Show verbose output with details', false)
    .option('-a, --all', 'Include all files (not just large ones)', false)
    .option('-m, --min-lines <n>', 'Minimum lines to analyze', '100')
    .option('-p, --pattern <type>', 'Filter by pattern: controller, store, routes, types, etc.')
    .option('-t, --top <n>', 'Show top N files (default: 10)', '10')
    .action(async (options) => {
      await runModularity(options as ModularityCommandOptions);
    });

  return cmd;
}

export async function runModularity(options: ModularityCommandOptions): Promise<void> {
  const rootDir = path.resolve(options.repo);
  const minLines = parseInt(options.minLines as unknown as string, 10) || 100;
  const top = parseInt(options.top as unknown as string, 10) || 10;

  const analysisOptions: ModularityOptions = {
    minLines,
    includeAll: options.all,
    patterns: options.pattern ? [options.pattern as FilePattern] : undefined,
  };

  try {
    const result = analyzeModularity(rootDir, analysisOptions);

    if (options.format === 'json') {
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    // Terminal output
    printTerminalOutput(result, rootDir, options.verbose, top);

  } catch (error) {
    if (error instanceof Error) {
      console.error(chalk.red(`Error: ${error.message}`));
    }
    process.exit(1);
  }
}

function printTerminalOutput(
  result: ModularityResult,
  rootDir: string,
  verbose: boolean,
  top: number
): void {
  console.log('');
  console.log(chalk.bold.cyan('📐 Modularity Analysis'));
  console.log(chalk.gray('─'.repeat(60)));
  console.log('');

  // Summary stats
  const { summary } = result;
  console.log(
    `Analyzed ${chalk.white(summary.totalFiles)} files ` +
    `(${chalk.white(summary.totalLines.toLocaleString())} lines)`
  );
  console.log(`Average modularity score: ${formatScore(summary.avgScore)}`);
  console.log('');

  // Distribution
  console.log(chalk.bold('Score Distribution:'));
  const dist = summary.distribution;
  const total = dist.elite + dist.good + dist.acceptable + dist.needsWork + dist.poor;

  const bar = (count: number, colorFn: (s: string) => string) => {
    const pct = total > 0 ? Math.round((count / total) * 100) : 0;
    const width = Math.round(pct / 5);
    return colorFn('█'.repeat(width)) + chalk.gray('░'.repeat(20 - width)) + ` ${pct}%`;
  };

  console.log(`  Elite (9-10):      ${bar(dist.elite, (s) => chalk.green(s))}`);
  console.log(`  Good (7-8):        ${bar(dist.good, (s) => chalk.blue(s))}`);
  console.log(`  Acceptable (5-6):  ${bar(dist.acceptable, (s) => chalk.yellow(s))}`);
  console.log(`  Needs Work (3-4):  ${bar(dist.needsWork, (s) => chalk.hex('#FFA500')(s))}`);
  console.log(`  Poor (0-2):        ${bar(dist.poor, (s) => chalk.red(s))}`);
  console.log('');

  // Files needing attention (worst scores first)
  const needsAttention = result.files.filter(f => f.score < 7);
  if (needsAttention.length > 0) {
    console.log(chalk.bold.yellow(`⚠️  Files Needing Attention (${needsAttention.length}):`));
    console.log('');

    needsAttention.slice(0, top).forEach(file => {
      printFileResult(file, verbose);
    });

    if (needsAttention.length > top) {
      console.log(chalk.gray(`  ...and ${needsAttention.length - top} more`));
    }
    console.log('');
  } else {
    console.log(chalk.green('✅ All analyzed files have good modularity!'));
    console.log('');
  }

  // Largest files (for context)
  if (verbose && summary.largestFiles.length > 0) {
    console.log(chalk.bold('📊 Largest Files:'));
    summary.largestFiles.forEach(f => {
      console.log(
        `  ${chalk.white(f.file)}: ` +
        `${chalk.cyan(f.lines + ' lines')} ` +
        `(score: ${formatScore(f.score)})`
      );
    });
    console.log('');
  }

  // Exempted files summary
  if (verbose && result.exempted.length > 0) {
    console.log(chalk.gray(`ℹ️  ${result.exempted.length} files exempted (tests, generated)`));
    console.log('');
  }

  // Overall verdict
  printVerdict(summary.avgScore, needsAttention.length);
}

function printFileResult(file: FileModularity, verbose: boolean): void {
  const scoreStr = getScoreStr(file.score);
  const patternLabel = file.pattern ? chalk.gray(`[${file.pattern}]`) : '';

  console.log(
    `  ${scoreStr} ` +
    `${chalk.white(file.file)} ` +
    `${chalk.gray(file.lines + ' lines')} ` +
    patternLabel
  );

  if (file.flags.length > 0) {
    const flagStr = file.flags.map(f => chalk.dim(formatFlag(f))).join(', ');
    console.log(`       ${flagStr}`);
  }

  if (verbose) {
    const d = file.details;
    console.log(
      chalk.gray(`       sections: ${d.sectionCount}, `) +
      chalk.gray(`exports: ${d.exportCount}, `) +
      chalk.gray(`imports: ${d.importCount}`)
    );
  }
}

function formatFlag(flag: string): string {
  const labels: Record<string, string> = {
    'no-single-responsibility': '⚠ multiple responsibilities',
    'no-internal-structure': '⚠ no sections/organization',
    'high-coupling': '⚠ high coupling (many imports)',
    'low-cohesion': '⚠ low cohesion (bloated API)',
    'missing-tests': '⚠ missing tests',
    'god-class': '⚠ god class',
    'utility-grab-bag': '⚠ utility grab-bag',
  };
  return labels[flag] || flag;
}

function formatScore(score: number): string {
  return getScoreStr(score);
}

function getScoreStr(score: number): string {
  const text = `${score}/10`;
  if (score >= 9) return chalk.green(text);
  if (score >= 7) return chalk.blue(text);
  if (score >= 5) return chalk.yellow(text);
  if (score >= 3) return chalk.hex('#FFA500')(text);
  return chalk.red(text);
}

function printVerdict(avgScore: number, problemCount: number): void {
  console.log(chalk.gray('─'.repeat(60)));

  if (avgScore >= 8 && problemCount === 0) {
    console.log(chalk.green.bold('✨ Excellent modularity! Your codebase is well-organized.'));
  } else if (avgScore >= 7) {
    console.log(chalk.blue.bold('👍 Good modularity. Minor improvements possible.'));
  } else if (avgScore >= 5) {
    console.log(chalk.yellow.bold('⚠️  Acceptable modularity. Consider refactoring flagged files.'));
  } else {
    console.log(chalk.red.bold('🚨 Modularity needs attention. Several files require refactoring.'));
  }

  console.log('');
  console.log(chalk.gray('Tip: Use --verbose for detailed analysis, --pattern to filter'));
}
