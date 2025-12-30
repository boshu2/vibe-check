import chalk from 'chalk';
import { VibeCheckResult, VibeCheckResultV2, Rating, OverallRating } from '../types.js';
import { format } from 'date-fns';

export interface TerminalOptions {
  verbose?: boolean;
}

export function formatTerminal(
  result: VibeCheckResult | VibeCheckResultV2,
  options: TerminalOptions = {}
): string {
  const { verbose = false } = options;
  const lines: string[] = [];

  // Header
  lines.push('');
  lines.push(chalk.bold.cyan('=' .repeat(64)));
  lines.push(chalk.bold.cyan('                    VIBE-CHECK RESULTS'));
  lines.push(chalk.bold.cyan('=' .repeat(64)));

  // Period info
  const fromStr = format(result.period.from, 'MMM d, yyyy');
  const toStr = format(result.period.to, 'MMM d, yyyy');
  const daySpan = Math.ceil(
    (result.period.to.getTime() - result.period.from.getTime()) / (1000 * 60 * 60 * 24)
  );
  const dayContext = daySpan <= 1 ? '' : ` over ${daySpan} days`;
  lines.push('');
  lines.push(
    chalk.gray(`  Period: ${fromStr} - ${toStr} (${result.period.activeHours}h active${dayContext})`)
  );
  const tracerStr = result.commits.tracer > 0 ? `, ${result.commits.tracer} tracer` : '';
  lines.push(
    chalk.gray(
      `  Commits: ${result.commits.total} total (${result.commits.feat} feat, ${result.commits.fix} fix, ${result.commits.docs} docs${tracerStr}, ${result.commits.other} other)`
    )
  );

  // Metrics table
  lines.push('');
  lines.push(chalk.bold.white('  METRIC                      VALUE      RATING'));
  lines.push(chalk.gray('  ' + '-'.repeat(50)));

  // Core actionable metrics (always shown)
  const coreMetrics = [
    { name: 'Rework Ratio', metric: result.metrics.reworkRatio },
    { name: 'Trust Pass Rate', metric: result.metrics.trustPassRate },
    { name: 'Debug Spiral Duration', metric: result.metrics.debugSpiralDuration },
    { name: 'Flow Efficiency', metric: result.metrics.flowEfficiency },
  ];

  // Vanity metrics (verbose only)
  const vanityMetrics = [
    { name: 'Iteration Velocity', metric: result.metrics.iterationVelocity },
  ];

  const metrics = verbose ? [...vanityMetrics, ...coreMetrics] : coreMetrics;

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

  // Quick Summary
  const metricsList = [
    { name: 'Rework Ratio', metric: result.metrics.reworkRatio, tip: 'Use tracer tests before complex features' },
    { name: 'Trust Pass Rate', metric: result.metrics.trustPassRate, tip: 'Review AI output more carefully before committing' },
    { name: 'Debug Spiral Duration', metric: result.metrics.debugSpiralDuration, tip: 'Stop and write a test when stuck >15min' },
    { name: 'Flow Efficiency', metric: result.metrics.flowEfficiency, tip: 'Reduce context switching, batch similar tasks' },
  ];

  const ratingOrder: Rating[] = ['elite', 'high', 'medium', 'low'];
  const sorted = [...metricsList].sort(
    (a, b) => ratingOrder.indexOf(a.metric.rating) - ratingOrder.indexOf(b.metric.rating)
  );

  const topStrength = sorted[0];
  const topIssue = sorted[sorted.length - 1];

  if (topStrength.metric.rating !== topIssue.metric.rating) {
    lines.push('');
    lines.push(chalk.green(`  ✓ Strength: ${topStrength.name} (${topStrength.metric.rating.toUpperCase()})`));

    if (topIssue.metric.rating === 'low' || topIssue.metric.rating === 'medium') {
      lines.push(chalk.yellow(`  → Focus: ${topIssue.name} (${topIssue.metric.rating.toUpperCase()})`));
    }
  }

  // Opportunities section
  const opportunities = metricsList.filter(
    m => m.metric.rating === 'low' || m.metric.rating === 'medium'
  );

  if (opportunities.length > 0) {
    lines.push('');
    lines.push(chalk.bold.yellow('  💡 OPPORTUNITIES'));
    for (const opp of opportunities.slice(0, 3)) {
      const icon = opp.metric.rating === 'low' ? '🔴' : '🟡';
      lines.push(chalk.yellow(`  ${icon} ${opp.name}: ${opp.tip}`));
    }
  }

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
      lines.push(chalk.magenta(`  - ${pattern}: ${count} fixes`));
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

/**
 * Simple/compact terminal output
 */
export function formatTerminalSimple(result: VibeCheckResult | VibeCheckResultV2): string {
  const lines: string[] = [];

  const fromStr = format(result.period.from, 'MMM d');
  const toStr = format(result.period.to, 'MMM d');
  const overallColor = getOverallColor(result.overall);

  lines.push('');
  lines.push(chalk.bold.cyan('VIBE-CHECK') + chalk.gray(` ${fromStr} - ${toStr}`));
  lines.push('');

  lines.push(`  ${chalk.bold('Rating:')} ${overallColor(result.overall)}`);

  const trust = result.metrics.trustPassRate;
  const rework = result.metrics.reworkRatio;
  lines.push(`  ${chalk.bold('Trust:')} ${trust.value}${trust.unit} ${formatRating(trust.rating)}`);
  lines.push(`  ${chalk.bold('Rework:')} ${rework.value}${rework.unit} ${formatRating(rework.rating)}`);

  if (result.fixChains.length > 0) {
    lines.push('');
    lines.push(chalk.yellow(`  ⚠ ${result.fixChains.length} debug spiral${result.fixChains.length > 1 ? 's' : ''} detected`));
  }

  lines.push('');
  lines.push(chalk.gray(`  Run without --simple for full details`));
  lines.push('');

  return lines.join('\n');
}

function getOverallColor(rating: OverallRating): (text: string) => string {
  switch (rating) {
    case 'ELITE': return chalk.green.bold;
    case 'HIGH': return chalk.blue.bold;
    case 'MEDIUM': return chalk.yellow.bold;
    case 'LOW': return chalk.red.bold;
  }
}
