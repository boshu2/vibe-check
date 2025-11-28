import chalk from 'chalk';
import { VibeCheckResult, Rating, OverallRating } from '../types';
import { format } from 'date-fns';

export function formatTerminal(result: VibeCheckResult): string {
  const lines: string[] = [];

  // Header
  lines.push('');
  lines.push(chalk.bold.cyan('=' .repeat(64)));
  lines.push(chalk.bold.cyan('                    VIBE-CHECK RESULTS'));
  lines.push(chalk.bold.cyan('=' .repeat(64)));

  // Period info
  const fromStr = format(result.period.from, 'MMM d, yyyy');
  const toStr = format(result.period.to, 'MMM d, yyyy');
  lines.push('');
  lines.push(
    chalk.gray(`  Period: ${fromStr} - ${toStr} (${result.period.activeHours}h active)`)
  );
  lines.push(
    chalk.gray(
      `  Commits: ${result.commits.total} total (${result.commits.feat} feat, ${result.commits.fix} fix, ${result.commits.docs} docs, ${result.commits.other} other)`
    )
  );

  // Metrics table
  lines.push('');
  lines.push(chalk.bold.white('  METRIC                      VALUE      RATING'));
  lines.push(chalk.gray('  ' + '-'.repeat(50)));

  const metrics = [
    { name: 'Iteration Velocity', metric: result.metrics.iterationVelocity },
    { name: 'Rework Ratio', metric: result.metrics.reworkRatio },
    { name: 'Trust Pass Rate', metric: result.metrics.trustPassRate },
    { name: 'Debug Spiral Duration', metric: result.metrics.debugSpiralDuration },
    { name: 'Flow Efficiency', metric: result.metrics.flowEfficiency },
  ];

  for (const { name, metric } of metrics) {
    const valueStr = `${metric.value}${metric.unit}`.padEnd(10);
    const ratingStr = formatRating(metric.rating);
    lines.push(`  ${name.padEnd(26)} ${valueStr} ${ratingStr}`);
  }

  // Overall rating
  lines.push('');
  lines.push(chalk.bold.cyan('-'.repeat(64)));
  lines.push(`  ${chalk.bold('OVERALL:')} ${formatOverallRating(result.overall)}`);
  lines.push(chalk.bold.cyan('-'.repeat(64)));

  // Debug spirals
  if (result.fixChains.length > 0) {
    lines.push('');
    lines.push(
      chalk.bold.yellow(`  DEBUG SPIRALS (${result.fixChains.length} detected):`)
    );
    for (const chain of result.fixChains) {
      const patternStr = chain.pattern ? ` (${chain.pattern})` : '';
      lines.push(
        chalk.yellow(
          `  - ${chain.component}: ${chain.commits} commits, ${chain.duration}m${patternStr}`
        )
      );
    }
  }

  // Patterns
  if (result.patterns.total > 0) {
    lines.push('');
    lines.push(chalk.bold.magenta('  PATTERNS:'));
    for (const [pattern, count] of Object.entries(result.patterns.categories)) {
      const tracerNote = pattern !== 'OTHER' ? ' (tracer available)' : '';
      lines.push(chalk.magenta(`  - ${pattern}: ${count} fixes${tracerNote}`));
    }
  }

  lines.push('');
  lines.push(chalk.bold.cyan('=' .repeat(64)));
  lines.push('');

  return lines.join('\n');
}

function formatRating(rating: Rating): string {
  switch (rating) {
    case 'elite':
      return chalk.green.bold('ELITE');
    case 'high':
      return chalk.blue.bold('HIGH');
    case 'medium':
      return chalk.yellow.bold('MEDIUM');
    case 'low':
      return chalk.red.bold('LOW');
  }
}

function formatOverallRating(rating: OverallRating): string {
  switch (rating) {
    case 'ELITE':
      return chalk.green.bold('ELITE');
    case 'HIGH':
      return chalk.blue.bold('HIGH');
    case 'MEDIUM':
      return chalk.yellow.bold('MEDIUM');
    case 'LOW':
      return chalk.red.bold('LOW');
  }
}
