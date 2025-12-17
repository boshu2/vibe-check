/**
 * Forensics Command (VIBE-045)
 *
 * Analyze git history to detect failure patterns and calculate quality metrics.
 * Proven algorithm from release-engineering retrospective (475 commits analyzed).
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { getCommits, isGitRepo } from '../git.js';
import {
  detectPatterns,
  PatternDetectionResult,
} from '../analyzers/patterns.js';
import {
  calculateQualityMetrics,
  getRecommendation,
  QualityMetrics,
} from '../analyzers/quality.js';
import {
  analyzeModularity,
  ModularityResult,
  FileModularity,
} from '../analyzers/modularity.js';
import { format } from 'date-fns';

export interface ForensicsOptions {
  since?: string;
  until?: string;
  format: string;
  repo: string;
  verbose: boolean;
}

export interface ModularityForensics {
  avgScore: number;
  filesAnalyzed: number;
  problemFiles: FileModularity[];
  hasIssues: boolean;
}

export interface ForensicsResult {
  analysisPeriod: {
    from: string;
    to: string;
  };
  totalCommits: number;
  patterns: PatternDetectionResult;
  qualityMetrics: QualityMetrics;
  modularity: ModularityForensics;
  recommendation: 'sweep' | 'maintain' | 'celebrate';
}

export function createForensicsCommand(): Command {
  const cmd = new Command('forensics')
    .description('Analyze git history for failure patterns (VIBE-045)')
    .option('--since <date>', 'Start date for analysis', '3 months ago')
    .option('--until <date>', 'End date for analysis (default: now)')
    .option('-f, --format <type>', 'Output format: terminal, json, markdown', 'terminal')
    .option('-r, --repo <path>', 'Repository path', process.cwd())
    .option('-v, --verbose', 'Show verbose output', false)
    .action(async (options) => {
      await runForensics(options);
    });

  return cmd;
}

export async function runForensics(options: ForensicsOptions): Promise<ForensicsResult | null> {
  try {
    const { since, until, format: outputFormat, repo, verbose } = options;

    // Check if repo is valid
    if (!(await isGitRepo(repo))) {
      console.error(chalk.red(`Not a git repository: ${repo}`));
      process.exit(1);
    }

    if (verbose) {
      console.error(chalk.gray(`Analyzing repository: ${repo}`));
      console.error(chalk.gray(`Since: ${since}`));
      if (until) console.error(chalk.gray(`Until: ${until}`));
    }

    // Get commits
    const commits = await getCommits(repo, since, until);

    if (commits.length === 0) {
      console.log(chalk.yellow('\nNo commits found in the specified range.\n'));
      console.log(chalk.gray('Try specifying a different date range:'));
      console.log(chalk.gray('  vibe-check forensics --since "6 months ago"'));
      process.exit(0);
    }

    if (verbose) {
      console.error(chalk.gray(`Found ${commits.length} commits`));
    }

    // Detect patterns
    const patterns = detectPatterns(commits);

    // Calculate quality metrics
    const qualityMetrics = calculateQualityMetrics(commits);

    // Analyze modularity
    const modularityResult = analyzeModularity(repo, { minLines: 100 });
    const problemFiles = modularityResult.files.filter(f => f.score < 7);
    const modularity: ModularityForensics = {
      avgScore: modularityResult.summary.avgScore,
      filesAnalyzed: modularityResult.files.length,
      problemFiles: problemFiles.slice(0, 10), // Top 10 worst
      hasIssues: problemFiles.length > 0,
    };

    // Get recommendation (factor in modularity issues)
    const hasModularityProblems = problemFiles.some(f => f.score < 5);
    const recommendation = getRecommendation(
      qualityMetrics,
      patterns.debugSpirals !== null || hasModularityProblems
    );

    // Sort commits to get date range
    const sortedCommits = [...commits].sort(
      (a, b) => a.date.getTime() - b.date.getTime()
    );

    const result: ForensicsResult = {
      analysisPeriod: {
        from: sortedCommits[0].date.toISOString(),
        to: sortedCommits[sortedCommits.length - 1].date.toISOString(),
      },
      totalCommits: commits.length,
      patterns,
      qualityMetrics,
      modularity,
      recommendation,
    };

    // Output based on format
    switch (outputFormat) {
      case 'json':
        outputJson(result);
        break;
      case 'markdown':
        outputMarkdown(result);
        break;
      default:
        outputTerminal(result);
    }

    return result;
  } catch (error) {
    if (error instanceof Error) {
      console.error(chalk.red(`Error: ${error.message}`));
    }
    process.exit(1);
  }
}

function outputJson(result: ForensicsResult): void {
  console.log(JSON.stringify(result, null, 2));
}

function outputMarkdown(result: ForensicsResult): void {
  const { analysisPeriod, totalCommits, patterns, qualityMetrics, modularity, recommendation } = result;

  console.log('# Git Forensics Report\n');
  console.log(`**Analysis Period:** ${analysisPeriod.from.split('T')[0]} to ${analysisPeriod.to.split('T')[0]}`);
  console.log(`**Total Commits:** ${totalCommits}\n`);

  // Quality Metrics
  console.log('## Quality Metrics\n');
  console.log('| Metric | Value |');
  console.log('|--------|-------|');
  console.log(`| Conventional Commits | ${qualityMetrics.conventionalCommits.percentage}% (${qualityMetrics.conventionalCommits.count}) |`);
  console.log(`| Descriptive Commits | ${qualityMetrics.descriptiveCommits.percentage}% (${qualityMetrics.descriptiveCommits.count}) |`);
  console.log(`| Vague Commits | ${qualityMetrics.vagueCommits.percentage}% (${qualityMetrics.vagueCommits.count}) |`);
  console.log('');

  // Patterns Detected
  console.log('## Patterns Detected\n');

  // Debug spirals
  if (patterns.debugSpirals) {
    console.log('### Debug Spirals ⚠️\n');
    console.log(`- **Count:** ${patterns.debugSpirals.count} commits`);
    console.log(`- **Duration:** ${patterns.debugSpirals.durationMinutes} minutes`);
    console.log(`- **Dates:** ${patterns.debugSpirals.dates.join(', ')}`);
    console.log('');
  } else {
    console.log('### Debug Spirals ✅\n');
    console.log('No debug spirals detected.\n');
  }

  // Vague commits
  if (patterns.vagueCommits.count > 0) {
    console.log('### Vague Commits\n');
    console.log(`- **Count:** ${patterns.vagueCommits.count} (${patterns.vagueCommits.percentage}%)`);
    console.log(`- **Examples:** ${patterns.vagueCommits.examples.slice(0, 5).map(e => `\`${e}\``).join(', ')}`);
    console.log('');
  }

  // Context amnesia
  if (patterns.contextAmnesia.scopes.length > 0) {
    console.log('### Context Amnesia\n');
    console.log('| Scope | Visits |');
    console.log('|-------|--------|');
    for (const s of patterns.contextAmnesia.scopes.slice(0, 5)) {
      console.log(`| ${s.name} | ${s.visits} |`);
    }
    console.log('');
  }

  // Modularity
  console.log('## Modularity Health\n');
  console.log(`**Average Score:** ${modularity.avgScore}/10 (${modularity.filesAnalyzed} files analyzed)\n`);

  if (modularity.hasIssues) {
    console.log('### Files Needing Attention\n');
    console.log('| File | Lines | Score | Issue |');
    console.log('|------|-------|-------|-------|');
    for (const f of modularity.problemFiles.slice(0, 10)) {
      const issue = f.flags[0] || 'needs review';
      console.log(`| ${f.file} | ${f.lines} | ${f.score}/10 | ${issue} |`);
    }
    console.log('');
  } else {
    console.log('✅ All files have good modularity.\n');
  }

  // Recommendation
  console.log('## Recommendation\n');
  const emoji = recommendation === 'celebrate' ? '🎉' : recommendation === 'sweep' ? '🧹' : '👍';
  console.log(`**${emoji} ${recommendation.toUpperCase()}**\n`);

  if (recommendation === 'sweep') {
    console.log('Consider cleaning up commit history and improving commit message discipline.');
  } else if (recommendation === 'celebrate') {
    console.log('Excellent commit hygiene! Keep up the good work.');
  } else {
    console.log('Commit quality is acceptable. Continue current practices.');
  }
}

function outputTerminal(result: ForensicsResult): void {
  const { analysisPeriod, totalCommits, patterns, qualityMetrics, modularity, recommendation } = result;

  console.log('');
  console.log(chalk.bold.cyan('🔍 Git Forensics Report'));
  console.log(chalk.gray('─'.repeat(50)));
  console.log('');

  // Period and count
  const fromDate = new Date(analysisPeriod.from);
  const toDate = new Date(analysisPeriod.to);
  console.log(`Period: ${format(fromDate, 'MMM d, yyyy')} - ${format(toDate, 'MMM d, yyyy')}`);
  console.log(`Commits: ${chalk.cyan(totalCommits)}`);
  console.log('');

  // Quality metrics
  console.log(chalk.bold('Quality Metrics:'));
  const convColor = qualityMetrics.conventionalCommits.percentage >= 80 ? chalk.green : qualityMetrics.conventionalCommits.percentage >= 50 ? chalk.yellow : chalk.red;
  const vagueColor = qualityMetrics.vagueCommits.percentage <= 10 ? chalk.green : qualityMetrics.vagueCommits.percentage <= 30 ? chalk.yellow : chalk.red;

  console.log(`  Conventional: ${convColor(qualityMetrics.conventionalCommits.percentage + '%')} (${qualityMetrics.conventionalCommits.count} commits)`);
  console.log(`  Descriptive:  ${chalk.cyan(qualityMetrics.descriptiveCommits.percentage + '%')} (${qualityMetrics.descriptiveCommits.count} commits)`);
  console.log(`  Vague:        ${vagueColor(qualityMetrics.vagueCommits.percentage + '%')} (${qualityMetrics.vagueCommits.count} commits)`);
  console.log('');

  // Patterns
  console.log(chalk.bold('Patterns Detected:'));

  // Debug spirals
  if (patterns.debugSpirals) {
    console.log(chalk.red(`  ⚠️  Debug Spirals: ${patterns.debugSpirals.count} commits over ${patterns.debugSpirals.durationMinutes} min`));
  } else {
    console.log(chalk.green('  ✅ No debug spirals'));
  }

  // Context amnesia
  if (patterns.contextAmnesia.scopes.length > 0) {
    const topScopes = patterns.contextAmnesia.scopes.slice(0, 3).map(s => `${s.name}(${s.visits})`).join(', ');
    console.log(chalk.yellow(`  ⚠️  Context Amnesia: ${topScopes}`));
  } else {
    console.log(chalk.green('  ✅ No context amnesia'));
  }

  // Vague commits examples
  if (patterns.vagueCommits.examples.length > 0) {
    const examples = patterns.vagueCommits.examples.slice(0, 3).map(e => `"${e}"`).join(', ');
    console.log(chalk.gray(`  📝 Vague examples: ${examples}`));
  }

  console.log('');

  // Modularity
  console.log(chalk.bold('Modularity Health:'));
  const modScoreColor = modularity.avgScore >= 8 ? chalk.green : modularity.avgScore >= 6 ? chalk.yellow : chalk.red;
  console.log(`  Average Score: ${modScoreColor(modularity.avgScore + '/10')} (${modularity.filesAnalyzed} files analyzed)`);

  if (modularity.hasIssues) {
    console.log(chalk.yellow(`  ⚠️  ${modularity.problemFiles.length} files need attention:`));
    modularity.problemFiles.slice(0, 5).forEach(f => {
      const scoreStr = f.score < 5 ? chalk.red(`${f.score}/10`) : chalk.yellow(`${f.score}/10`);
      const flags = f.flags.length > 0 ? chalk.gray(` (${f.flags[0]})`) : '';
      console.log(`     ${scoreStr} ${f.file} ${chalk.gray(f.lines + ' lines')}${flags}`);
    });
    if (modularity.problemFiles.length > 5) {
      console.log(chalk.gray(`     ...and ${modularity.problemFiles.length - 5} more`));
    }
  } else {
    console.log(chalk.green('  ✅ All files have good modularity'));
  }

  console.log('');

  // Recommendation
  console.log(chalk.bold('Recommendation:'));
  if (recommendation === 'sweep') {
    console.log(chalk.yellow('  🧹 SWEEP - Consider cleanup and commit discipline improvement'));
  } else if (recommendation === 'celebrate') {
    console.log(chalk.green('  🎉 CELEBRATE - Excellent commit hygiene!'));
  } else {
    console.log(chalk.cyan('  👍 MAINTAIN - Commit quality is acceptable'));
  }

  console.log('');
}
