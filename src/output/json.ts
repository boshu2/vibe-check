import { VibeCheckResult, VibeCheckResultV2 } from '../types';

function isV2Result(result: VibeCheckResult | VibeCheckResultV2): result is VibeCheckResultV2 {
  return 'semanticMetrics' in result;
}

export function formatJson(result: VibeCheckResult | VibeCheckResultV2): string {
  // Create a JSON-friendly version with ISO date strings
  const output: Record<string, unknown> = {
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

  // Add v2 fields if present
  if (isV2Result(result)) {
    if (result.vibeScore) {
      output.vibeScore = result.vibeScore;
    }
    if (result.semanticFreeMetrics) {
      output.semanticFreeMetrics = {
        fileChurn: {
          value: result.semanticFreeMetrics.fileChurn.value,
          unit: result.semanticFreeMetrics.fileChurn.unit,
          rating: result.semanticFreeMetrics.fileChurn.rating,
          description: result.semanticFreeMetrics.fileChurn.description,
          churnedFiles: result.semanticFreeMetrics.fileChurn.churnedFiles,
          totalFiles: result.semanticFreeMetrics.fileChurn.totalFiles,
        },
        timeSpiral: {
          value: result.semanticFreeMetrics.timeSpiral.value,
          unit: result.semanticFreeMetrics.timeSpiral.unit,
          rating: result.semanticFreeMetrics.timeSpiral.rating,
          description: result.semanticFreeMetrics.timeSpiral.description,
          spiralCommits: result.semanticFreeMetrics.timeSpiral.spiralCommits,
          totalCommits: result.semanticFreeMetrics.timeSpiral.totalCommits,
        },
        velocityAnomaly: {
          value: result.semanticFreeMetrics.velocityAnomaly.value,
          unit: result.semanticFreeMetrics.velocityAnomaly.unit,
          rating: result.semanticFreeMetrics.velocityAnomaly.rating,
          description: result.semanticFreeMetrics.velocityAnomaly.description,
          currentVelocity: result.semanticFreeMetrics.velocityAnomaly.currentVelocity,
          baselineMean: result.semanticFreeMetrics.velocityAnomaly.baselineMean,
          zScore: result.semanticFreeMetrics.velocityAnomaly.zScore,
        },
        codeStability: {
          value: result.semanticFreeMetrics.codeStability.value,
          unit: result.semanticFreeMetrics.codeStability.unit,
          rating: result.semanticFreeMetrics.codeStability.rating,
          description: result.semanticFreeMetrics.codeStability.description,
          linesAdded: result.semanticFreeMetrics.codeStability.linesAdded,
          linesSurviving: result.semanticFreeMetrics.codeStability.linesSurviving,
        },
      };
    }
  }

  return JSON.stringify(output, null, 2);
}
