import { VibeCheckResult } from '../types';

export function formatJson(result: VibeCheckResult): string {
  // Create a JSON-friendly version with ISO date strings
  const output = {
    period: {
      from: result.period.from.toISOString(),
      to: result.period.to.toISOString(),
      activeHours: result.period.activeHours,
    },
    commits: result.commits,
    metrics: {
      iterationVelocity: {
        value: result.metrics.iterationVelocity.value,
        unit: result.metrics.iterationVelocity.unit,
        rating: result.metrics.iterationVelocity.rating,
      },
      reworkRatio: {
        value: result.metrics.reworkRatio.value,
        unit: result.metrics.reworkRatio.unit,
        rating: result.metrics.reworkRatio.rating,
      },
      trustPassRate: {
        value: result.metrics.trustPassRate.value,
        unit: result.metrics.trustPassRate.unit,
        rating: result.metrics.trustPassRate.rating,
      },
      debugSpiralDuration: {
        value: result.metrics.debugSpiralDuration.value,
        unit: result.metrics.debugSpiralDuration.unit,
        rating: result.metrics.debugSpiralDuration.rating,
      },
      flowEfficiency: {
        value: result.metrics.flowEfficiency.value,
        unit: result.metrics.flowEfficiency.unit,
        rating: result.metrics.flowEfficiency.rating,
      },
    },
    fixChains: result.fixChains.map((chain) => ({
      component: chain.component,
      commits: chain.commits,
      duration: chain.duration,
      isSpiral: chain.isSpiral,
      pattern: chain.pattern,
    })),
    patterns: result.patterns,
    overall: result.overall,
  };

  return JSON.stringify(output, null, 2);
}
