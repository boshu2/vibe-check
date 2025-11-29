import chalk from 'chalk';
import { VibeCheckResult, VibeCheckResultV2, Rating, OverallRating } from '../types';
import { format } from 'date-fns';

function isV2Result(result: VibeCheckResult | VibeCheckResultV2): result is VibeCheckResultV2 {
  return 'semanticMetrics' in result;
}

export function formatTerminal(result: VibeCheckResult | VibeCheckResultV2): string {
  const lines: string[] = [];

  // Header
  lines.push('');
  lines.push(chalk.bold.cyan('=' .repeat(64)));
  lines.push(chalk.bold.cyan('                    VIBE-CHECK RESULTS'));
  lines.push(chalk.bold.cyan('=' .repeat(64)));

  // Period info - show commit range with context
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
  lines.push(
    chalk.gray(
      `  Commits: ${result.commits.total} total (${result.commits.feat} feat, ${result.commits.fix} fix, ${result.commits.docs} docs, ${result.commits.other} other)`
    )
  );

  // Metrics table (semantic metrics)
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

  // V2: Code pattern metrics and VibeScore
  if (isV2Result(result) && result.semanticFreeMetrics) {
    lines.push('');
    lines.push(chalk.bold.magenta('  CODE PATTERNS'));
    lines.push(chalk.gray('  ' + '-'.repeat(50)));

    const sfMetrics = [
      { name: 'File Churn', metric: result.semanticFreeMetrics.fileChurn },
      { name: 'Time Spiral', metric: result.semanticFreeMetrics.timeSpiral },
      { name: 'Velocity Anomaly', metric: result.semanticFreeMetrics.velocityAnomaly },
      { name: 'Code Stability', metric: result.semanticFreeMetrics.codeStability },
    ];

    for (const { name, metric } of sfMetrics) {
      const valueStr = `${metric.value}${metric.unit}`.padEnd(10);
      const ratingStr = formatRating(metric.rating);
      lines.push(`  ${name.padEnd(26)} ${valueStr} ${ratingStr}`);
    }

    if (result.vibeScore) {
      lines.push('');
      lines.push(
        chalk.bold.cyan(`  VIBE SCORE: ${formatVibeScore(result.vibeScore.value)}`)
      );
    }
  }

  // Overall rating
  lines.push('');
  lines.push(chalk.bold.cyan('-'.repeat(64)));
  lines.push(`  ${chalk.bold('OVERALL:')} ${formatOverallRating(result.overall)}`);
  lines.push(chalk.bold.cyan('-'.repeat(64)));

  // Quick Summary: Top strength and area to improve
  const metricsList = [
    { name: 'Iteration Velocity', metric: result.metrics.iterationVelocity, tip: 'Ship smaller increments more frequently' },
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

  // Only show summary if there's variation
  if (topStrength.metric.rating !== topIssue.metric.rating) {
    lines.push('');
    lines.push(chalk.green(`  ✓ Strength: ${topStrength.name} (${topStrength.metric.rating.toUpperCase()})`));

    if (topIssue.metric.rating === 'low' || topIssue.metric.rating === 'medium') {
      lines.push(chalk.yellow(`  → Focus: ${topIssue.name} (${topIssue.metric.rating.toUpperCase()})`));
    }
  }

  // Opportunities section - actionable recommendations for low/medium metrics
  const opportunities = metricsList.filter(
    m => m.metric.rating === 'low' || m.metric.rating === 'medium'
  );

  if (opportunities.length > 0) {
    lines.push('');
    lines.push(chalk.bold.yellow('  💡 OPPORTUNITIES'));
    for (const opp of opportunities.slice(0, 3)) { // Max 3
      const icon = opp.metric.rating === 'low' ? '🔴' : '🟡';
      lines.push(chalk.yellow(`  ${icon} ${opp.name}: ${opp.tip}`));
    }
  }

  // Near-miss psychology - motivational close calls
  const nearMisses = getNearMisses(result, metricsList);
  if (nearMisses.length > 0) {
    lines.push('');
    lines.push(chalk.bold.magenta('  🎯 SO CLOSE!'));
    for (const miss of nearMisses) {
      lines.push(chalk.magenta(`  ${miss}`));
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

function formatVibeScore(score: number): string {
  const pct = Math.round(score * 100);
  if (score >= 0.85) return chalk.green.bold(`${pct}%`);
  if (score >= 0.70) return chalk.blue.bold(`${pct}%`);
  if (score >= 0.50) return chalk.yellow.bold(`${pct}%`);
  return chalk.red.bold(`${pct}%`);
}

/**
 * Simple/compact terminal output - just the essentials
 */
export function formatTerminalSimple(result: VibeCheckResult | VibeCheckResultV2): string {
  const lines: string[] = [];

  // One-line summary
  const fromStr = format(result.period.from, 'MMM d');
  const toStr = format(result.period.to, 'MMM d');
  const overallColor = getOverallColor(result.overall);

  lines.push('');
  lines.push(chalk.bold.cyan('VIBE-CHECK') + chalk.gray(` ${fromStr} - ${toStr}`));
  lines.push('');

  // Overall rating - the main info
  lines.push(`  ${chalk.bold('Rating:')} ${overallColor(result.overall)}`);

  // Key metrics on one line each
  const trust = result.metrics.trustPassRate;
  const rework = result.metrics.reworkRatio;
  lines.push(`  ${chalk.bold('Trust:')} ${trust.value}${trust.unit} ${formatRating(trust.rating)}`);
  lines.push(`  ${chalk.bold('Rework:')} ${rework.value}${rework.unit} ${formatRating(rework.rating)}`);

  // VibeScore if available
  if (isV2Result(result) && result.vibeScore) {
    lines.push(`  ${chalk.bold('Score:')} ${formatVibeScore(result.vibeScore.value)}`);
  }

  // Spirals - only if any detected
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

/**
 * Find near-miss motivational messages
 */
function getNearMisses(
  result: VibeCheckResult | VibeCheckResultV2,
  metrics: { name: string; metric: { rating: string; value: number }; tip: string }[]
): string[] {
  const misses: string[] = [];

  // Check for near-ELITE overall
  if (result.overall === 'HIGH') {
    const eliteCount = metrics.filter(m => m.metric.rating === 'elite').length;
    if (eliteCount >= 3) {
      misses.push('Just 1-2 metrics away from ELITE overall!');
    }
  }

  // Check for near-90% score
  if (isV2Result(result) && result.vibeScore) {
    const score = result.vibeScore.value * 100;
    if (score >= 85 && score < 90) {
      misses.push(`${Math.round(score)}% vibe score - just ${90 - Math.round(score)}% from the Ninety Club!`);
    }
  }

  // Check for near-perfect trust
  const trust = result.metrics.trustPassRate;
  if (trust.value >= 90 && trust.value < 100 && trust.rating !== 'elite') {
    misses.push(`${trust.value}% trust - ${100 - trust.value}% from Perfect Trust!`);
  }

  // Check for near-zero spirals
  if (result.fixChains.length === 1 && result.commits.total >= 20) {
    misses.push('Only 1 spiral! Next time could be Zen Master territory.');
  }

  return misses.slice(0, 2); // Max 2 near-misses
}
