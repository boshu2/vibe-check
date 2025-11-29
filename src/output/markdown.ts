import { VibeCheckResult, VibeCheckResultV2 } from '../types';
import { format } from 'date-fns';

function isV2Result(result: VibeCheckResult | VibeCheckResultV2): result is VibeCheckResultV2 {
  return 'semanticMetrics' in result;
}

export function formatMarkdown(result: VibeCheckResult | VibeCheckResultV2): string {
  const lines: string[] = [];

  // Header
  lines.push('# Vibe-Check Report');
  lines.push('');

  // Period
  const fromStr = format(result.period.from, 'MMM d, yyyy');
  const toStr = format(result.period.to, 'MMM d, yyyy');
  lines.push(`**Period:** ${fromStr} - ${toStr} (${result.period.activeHours}h active)`);
  lines.push(
    `**Commits:** ${result.commits.total} total (${result.commits.feat} feat, ${result.commits.fix} fix, ${result.commits.docs} docs, ${result.commits.other} other)`
  );
  lines.push('');

  // Overall
  lines.push(`**Overall Rating:** ${result.overall}`);
  lines.push('');

  // V2: VibeScore
  if (isV2Result(result) && result.vibeScore) {
    const pct = Math.round(result.vibeScore.value * 100);
    lines.push(`**VibeScore:** ${pct}%`);
    lines.push('');
  }

  // V2: Level Recommendation
  if (isV2Result(result) && result.recommendation) {
    const rec = result.recommendation;
    lines.push(`**Recommended Level:** ${rec.level} (${Math.round(rec.confidence * 100)}% confidence, CI: [${rec.ci[0].toFixed(1)}, ${rec.ci[1].toFixed(1)}])`);
    lines.push('');
  }

  // Metrics table
  lines.push('## Semantic Metrics');
  lines.push('');
  lines.push('| Metric | Value | Rating | Description |');
  lines.push('|--------|-------|--------|-------------|');

  const metrics = [
    { name: 'Iteration Velocity', metric: result.metrics.iterationVelocity },
    { name: 'Rework Ratio', metric: result.metrics.reworkRatio },
    { name: 'Trust Pass Rate', metric: result.metrics.trustPassRate },
    { name: 'Debug Spiral Duration', metric: result.metrics.debugSpiralDuration },
    { name: 'Flow Efficiency', metric: result.metrics.flowEfficiency },
  ];

  for (const { name, metric } of metrics) {
    const rating = metric.rating.toUpperCase();
    lines.push(
      `| ${name} | ${metric.value}${metric.unit} | ${rating} | ${metric.description} |`
    );
  }
  lines.push('');

  // V2: Semantic-free metrics table
  if (isV2Result(result) && result.semanticFreeMetrics) {
    lines.push('## Semantic-Free Metrics (v2.0)');
    lines.push('');
    lines.push('| Metric | Value | Rating | Description |');
    lines.push('|--------|-------|--------|-------------|');

    const sfMetrics = [
      { name: 'File Churn', metric: result.semanticFreeMetrics.fileChurn },
      { name: 'Time Spiral', metric: result.semanticFreeMetrics.timeSpiral },
      { name: 'Velocity Anomaly', metric: result.semanticFreeMetrics.velocityAnomaly },
      { name: 'Code Stability', metric: result.semanticFreeMetrics.codeStability },
    ];

    for (const { name, metric } of sfMetrics) {
      const rating = metric.rating.toUpperCase();
      lines.push(
        `| ${name} | ${metric.value}${metric.unit} | ${rating} | ${metric.description} |`
      );
    }
    lines.push('');
  }

  // Debug spirals
  if (result.fixChains.length > 0) {
    lines.push('## Debug Spirals');
    lines.push('');
    lines.push('| Component | Commits | Duration | Pattern |');
    lines.push('|-----------|---------|----------|---------|');

    for (const chain of result.fixChains) {
      const pattern = chain.pattern || '-';
      lines.push(
        `| ${chain.component} | ${chain.commits} | ${chain.duration}m | ${pattern} |`
      );
    }
    lines.push('');
  }

  // Patterns
  if (result.patterns.total > 0) {
    lines.push('## Pattern Analysis');
    lines.push('');
    lines.push('| Pattern | Fix Count | Tracer Available |');
    lines.push('|---------|-----------|------------------|');

    for (const [pattern, count] of Object.entries(result.patterns.categories)) {
      const tracer = pattern !== 'OTHER' ? 'Yes' : 'No';
      lines.push(`| ${pattern} | ${count} | ${tracer} |`);
    }
    lines.push('');
    lines.push(
      `**${result.patterns.tracerAvailable}%** of fix patterns have tracer tests available.`
    );
    lines.push('');
  }

  // Recommendations
  lines.push('## Recommendations');
  lines.push('');

  if (result.metrics.reworkRatio.rating === 'low') {
    lines.push('- High rework ratio detected. Consider running tracer tests before implementation.');
  }
  if (result.metrics.trustPassRate.rating === 'low' || result.metrics.trustPassRate.rating === 'medium') {
    lines.push('- Trust pass rate below target. Validate assumptions before coding.');
  }
  if (result.metrics.debugSpiralDuration.rating === 'low') {
    lines.push('- Long debug spirals detected. Break work into smaller, verifiable steps.');
  }
  if (result.fixChains.length > 0) {
    const patterns = result.fixChains
      .filter((c) => c.pattern)
      .map((c) => c.pattern);
    if (patterns.length > 0) {
      lines.push(`- Consider adding tracer tests for: ${[...new Set(patterns)].join(', ')}`);
    }
  }

  if (lines[lines.length - 1] === '') {
    lines.push('- All metrics healthy. Maintain current practices.');
  }

  lines.push('');
  lines.push('---');
  lines.push(`*Generated by vibe-check on ${format(new Date(), 'yyyy-MM-dd HH:mm')}*`);

  return lines.join('\n');
}
