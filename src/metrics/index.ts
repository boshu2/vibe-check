import { Commit, VibeCheckResult, OverallRating, Rating } from '../types.js';
import { calculateIterationVelocity, calculateActiveHours } from './velocity.js';
import { calculateReworkRatio } from './rework.js';
import { calculateTrustPassRate } from './trust.js';
import {
  detectFixChains,
  calculateDebugSpiralDuration,
  calculatePatternSummary,
} from './spirals.js';
import { calculateFlowEfficiency } from './flow.js';

export function analyzeCommits(commits: Commit[]): VibeCheckResult {
  if (commits.length === 0) {
    return emptyResult();
  }

  // Sort commits by date
  const sorted = [...commits].sort((a, b) => a.date.getTime() - b.date.getTime());
  const from = sorted[0].date;
  const to = sorted[sorted.length - 1].date;
  const activeHours = calculateActiveHours(sorted);

  // Count commit types
  const commitCounts = countCommitTypes(sorted);

  // Detect fix chains
  const fixChains = detectFixChains(sorted);

  // Calculate all metrics
  const iterationVelocity = calculateIterationVelocity(sorted);
  const reworkRatio = calculateReworkRatio(sorted);
  const trustPassRate = calculateTrustPassRate(sorted);
  const debugSpiralDuration = calculateDebugSpiralDuration(fixChains);
  const flowEfficiency = calculateFlowEfficiency(activeHours * 60, fixChains);

  // Calculate pattern summary
  const patterns = calculatePatternSummary(fixChains);

  // Determine overall rating
  const overall = calculateOverallRating([
    iterationVelocity.rating,
    reworkRatio.rating,
    trustPassRate.rating,
    debugSpiralDuration.rating,
    flowEfficiency.rating,
  ]);

  return {
    period: {
      from,
      to,
      activeHours: Math.round(activeHours * 10) / 10,
    },
    commits: commitCounts,
    metrics: {
      iterationVelocity,
      reworkRatio,
      trustPassRate,
      debugSpiralDuration,
      flowEfficiency,
    },
    fixChains,
    patterns,
    overall,
  };
}

function countCommitTypes(commits: Commit[]): VibeCheckResult['commits'] {
  const counts = {
    total: commits.length,
    feat: 0,
    fix: 0,
    docs: 0,
    other: 0,
  };

  for (const commit of commits) {
    switch (commit.type) {
      case 'feat':
        counts.feat++;
        break;
      case 'fix':
        counts.fix++;
        break;
      case 'docs':
        counts.docs++;
        break;
      default:
        counts.other++;
    }
  }

  return counts;
}

function calculateOverallRating(ratings: Rating[]): OverallRating {
  const scores: Record<Rating, number> = {
    elite: 4,
    high: 3,
    medium: 2,
    low: 1,
  };

  const avgScore =
    ratings.reduce((sum, r) => sum + scores[r], 0) / ratings.length;

  if (avgScore >= 3.5) return 'ELITE';
  if (avgScore >= 2.5) return 'HIGH';
  if (avgScore >= 1.5) return 'MEDIUM';
  return 'LOW';
}

function emptyResult(): VibeCheckResult {
  return {
    period: {
      from: new Date(),
      to: new Date(),
      activeHours: 0,
    },
    commits: {
      total: 0,
      feat: 0,
      fix: 0,
      docs: 0,
      other: 0,
    },
    metrics: {
      iterationVelocity: {
        value: 0,
        unit: 'commits/hour',
        rating: 'low',
        description: 'No commits found',
      },
      reworkRatio: {
        value: 0,
        unit: '%',
        rating: 'elite',
        description: 'No commits found',
      },
      trustPassRate: {
        value: 100,
        unit: '%',
        rating: 'elite',
        description: 'No commits found',
      },
      debugSpiralDuration: {
        value: 0,
        unit: 'min',
        rating: 'elite',
        description: 'No debug spirals detected',
      },
      flowEfficiency: {
        value: 100,
        unit: '%',
        rating: 'elite',
        description: 'No active time recorded',
      },
    },
    fixChains: [],
    patterns: {
      categories: {},
      total: 0,
      tracerAvailable: 0,
    },
    overall: 'HIGH',
  };
}

export { calculateActiveHours } from './velocity.js';
