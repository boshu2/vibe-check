import { Command } from 'commander';
import chalk from 'chalk';
import {
  getPatternStats,
  getPatternDisplayName,
  getResolutionDisplayName,
  readSpiralHistory,
} from '../storage/spiral-history.js';

export function createInsightsCommand(): Command {
  const cmd = new Command('insights')
    .description('Show your spiral patterns and what works for you')
    .option('-d, --days <number>', 'Days to analyze (default: 30)', '30')
    .option('-f, --format <type>', 'Output format: terminal, json', 'terminal')
    .action(async (options) => {
      await runInsights(options);
    });

  return cmd;
}

async function runInsights(options: {
  days: string;
  format: string;
}): Promise<void> {
  const days = parseInt(options.days, 10) || 30;
  const format = options.format;

  const stats = getPatternStats(days);
  const allHistory = readSpiralHistory();

  if (format === 'json') {
    console.log(JSON.stringify({
      period_days: days,
      total_spirals: allHistory.length,
      patterns: stats.map(s => ({
        pattern: s.pattern,
        display_name: getPatternDisplayName(s.pattern),
        times: s.times,
        avg_duration_min: s.avgDuration,
        best_fix: s.bestFix,
        components: s.components,
      })),
    }, null, 2));
    return;
  }

  // Terminal output
  console.log('');
  console.log(chalk.bold.cyan('═'.repeat(64)));
  console.log(chalk.bold.cyan('  YOUR SPIRAL PATTERNS'));
  console.log(chalk.bold.cyan('═'.repeat(64)));
  console.log('');

  if (stats.length === 0) {
    console.log(chalk.gray('  No spirals recorded in the last ' + days + ' days.'));
    console.log(chalk.gray('  Run vibe-check analyze or session end to start tracking.'));
    console.log('');
    return;
  }

  // Summary stats
  const totalSpirals = stats.reduce((sum, s) => sum + s.times, 0);
  const avgDuration = stats.reduce((sum, s) => sum + s.avgDuration * s.times, 0) / totalSpirals;

  console.log(chalk.white(`  Period: Last ${days} days`));
  console.log(chalk.white(`  Total spirals: ${totalSpirals}`));
  console.log(chalk.white(`  Avg duration: ${Math.round(avgDuration)} min`));
  console.log('');

  // Pattern breakdown
  console.log(chalk.bold.white('  PATTERNS BY FREQUENCY'));
  console.log('');

  for (const stat of stats) {
    const patternName = getPatternDisplayName(stat.pattern);
    const bar = '█'.repeat(Math.min(stat.times * 2, 20));
    const fixText = stat.bestFix
      ? getResolutionDisplayName(stat.bestFix).toLowerCase()
      : 'no resolution data';

    console.log(chalk.yellow(`  ${patternName}`));
    console.log(`    ${chalk.cyan(bar)} ${stat.times}x, avg ${stat.avgDuration} min`);
    console.log(chalk.gray(`    Best fix: ${fixText}`));
    console.log(chalk.gray(`    Components: ${stat.components.slice(0, 3).join(', ')}${stat.components.length > 3 ? '...' : ''}`));
    console.log('');
  }

  // Top trigger identification
  if (stats.length > 0) {
    const topPattern = stats[0];
    const topPatternName = getPatternDisplayName(topPattern.pattern);
    const topComponents = topPattern.components.slice(0, 2).join(', ');

    console.log(chalk.bold.white('  TOP TRIGGER'));
    console.log('');
    console.log(chalk.yellow(`  ${topPatternName} in ${topComponents}`));
    console.log('');

    // Generate recommendation
    if (topPattern.bestFix) {
      const fixName = getResolutionDisplayName(topPattern.bestFix).toLowerCase();
      console.log(chalk.bold.cyan('  RECOMMENDATION'));
      console.log('');
      console.log(chalk.white(`  Your go-to fix for ${topPatternName} is ${fixName}.`));

      // Specific recommendations by fix type
      switch (topPattern.bestFix) {
        case 'TEST':
          console.log(chalk.gray(`  Consider adding a tracer test for ${topComponents} before starting.`));
          break;
        case 'BREAK':
          console.log(chalk.gray(`  Set a timer to take breaks when working on ${topComponents}.`));
          break;
        case 'DOCS':
          console.log(chalk.gray(`  Bookmark the docs for ${topComponents} for quick reference.`));
          break;
        case 'HELP':
          console.log(chalk.gray(`  Consider pairing on ${topComponents} tasks.`));
          break;
        case 'ROLLBACK':
          console.log(chalk.gray(`  Make smaller commits when working on ${topComponents}.`));
          break;
      }
    } else {
      console.log(chalk.bold.cyan('  RECOMMENDATION'));
      console.log('');
      console.log(chalk.white(`  No resolution data yet for ${topPatternName}.`));
      console.log(chalk.gray(`  After your next spiral, try: test, break, docs, or ask for help.`));
    }
    console.log('');
  }

  console.log(chalk.cyan('═'.repeat(64)));
  console.log(chalk.gray(`  Run with --days 90 for longer history, --format json for export`));
  console.log('');
}
