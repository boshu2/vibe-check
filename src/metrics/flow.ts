import { FixChain, MetricResult, Rating } from '../types.js';

/**
 * Estimated time spent on an isolated fix commit (not part of a spiral).
 * Isolated fixes are quick corrections that don't spiral into multiple attempts.
 * This is a conservative estimate to avoid over-penalizing normal iteration.
 */
const ISOLATED_FIX_MINUTES = 5;

/**
 * Calculate flow efficiency as percentage of productive time.
 *
 * Flow Efficiency measures time spent building vs debugging:
 * - Subtracts detected spiral time (3+ consecutive fix chains)
 * - Subtracts estimated time for isolated fix commits
 *
 * Formula: ((activeMinutes - debuggingMinutes) / activeMinutes) * 100
 *
 * Debugging time includes:
 * 1. Spiral duration (from detected fix chains)
 * 2. Isolated fixes (totalFixCommits - fixesInSpirals) * ISOLATED_FIX_MINUTES
 *
 * @param activeMinutes - Total active work time in minutes
 * @param spirals - Detected fix chains (may or may not be spirals)
 * @param totalFixCommits - Total number of fix commits (optional, for isolated fix calculation)
 */
export function calculateFlowEfficiency(
  activeMinutes: number,
  spirals: FixChain[],
  totalFixCommits: number = 0
): MetricResult {
  if (activeMinutes === 0) {
    return {
      value: 0,
      unit: '%',
      rating: 'medium',
      description: 'Insufficient data - no active time recorded',
    };
  }

  // Time in detected spirals (3+ consecutive fixes)
  const spiralMinutes = spirals
    .filter((s) => s.isSpiral)
    .reduce((sum, s) => sum + s.duration, 0);

  // Count fixes that are part of spirals (s.commits is already a count, not an array)
  const fixesInSpirals = spirals
    .filter((s) => s.isSpiral)
    .reduce((sum, s) => sum + s.commits, 0);

  // Isolated fixes = total fixes - fixes in spirals
  const isolatedFixes = Math.max(0, totalFixCommits - fixesInSpirals);
  const isolatedFixMinutes = isolatedFixes * ISOLATED_FIX_MINUTES;

  // Total debugging time = spiral time + isolated fix time
  const debuggingMinutes = spiralMinutes + isolatedFixMinutes;

  const efficiency = ((activeMinutes - debuggingMinutes) / activeMinutes) * 100;
  const clampedEfficiency = Math.max(0, Math.min(100, efficiency));
  const rating = getRating(clampedEfficiency);

  return {
    value: Math.round(clampedEfficiency),
    unit: '%',
    rating,
    description: getDescription(rating, spiralMinutes, isolatedFixes),
  };
}

function getRating(efficiency: number): Rating {
  if (efficiency > 90) return 'elite';
  if (efficiency >= 75) return 'high';
  if (efficiency >= 50) return 'medium';
  return 'low';
}

function getDescription(rating: Rating, spiralMinutes: number, isolatedFixes: number): string {
  const parts: string[] = [];

  if (spiralMinutes > 0) {
    parts.push(`${spiralMinutes}m in spirals`);
  }
  if (isolatedFixes > 0) {
    parts.push(`${isolatedFixes} isolated fix${isolatedFixes > 1 ? 'es' : ''}`);
  }

  const debugText = parts.length > 0 ? parts.join(', ') : 'No debugging detected';

  switch (rating) {
    case 'elite':
      return `${debugText}. Excellent productive flow`;
    case 'high':
      return `${debugText}. Good balance`;
    case 'medium':
      return `${debugText}. Significant debugging overhead`;
    case 'low':
      return `${debugText}. More debugging than building`;
  }
}
