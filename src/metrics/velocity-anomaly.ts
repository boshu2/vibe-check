import { Commit, VelocityAnomalyResult, Rating } from '../types';
import { calculateActiveHours } from './velocity';

interface Baseline {
  mean: number;
  stdDev: number;
}

/**
 * Calculate velocity anomaly score.
 * Measures how far current velocity is from personal baseline.
 * Works WITHOUT semantic commits.
 */
export function calculateVelocityAnomaly(
  commits: Commit[],
  baseline?: Baseline
): VelocityAnomalyResult {
  const activeHours = calculateActiveHours(commits);
  const currentVelocity = activeHours > 0 ? commits.length / activeHours : 0;

  /**
   * Default baseline when no historical data exists.
   *
   * Rationale:
   * - 3 commits/hour assumes ~20 min work cycles
   * - 1.5 stdDev allows 0-6 commits/hour as "normal" (±2σ)
   *
   * These are PLACEHOLDER values. The model learns your actual
   * baseline from calibration samples over time.
   *
   * NOT empirically validated across developer populations.
   */
  const defaultBaseline: Baseline = {
    mean: 3.0,
    stdDev: 1.5,
  };
  const base = baseline || defaultBaseline;

  // Z-score: how many std devs from personal mean
  const zScore = base.stdDev > 0
    ? Math.abs(currentVelocity - base.mean) / base.stdDev
    : 0;

  // Sigmoid transform: z=0 → 1.0, z=2 → 0.12, z=3 → 0.05
  const score = 1 / (1 + Math.exp(zScore - 1.5));

  return {
    value: Math.round(score * 100),
    unit: '%',
    rating: getAnomalyRating(zScore),
    description: getAnomalyDescription(zScore, currentVelocity, base),
    currentVelocity: Math.round(currentVelocity * 10) / 10,
    baselineMean: base.mean,
    baselineStdDev: base.stdDev,
    zScore: Math.round(zScore * 100) / 100,
  };
}

function getAnomalyRating(zScore: number): Rating {
  if (zScore < 1.0) return 'elite';
  if (zScore < 1.5) return 'high';
  if (zScore < 2.0) return 'medium';
  return 'low';
}

function getAnomalyDescription(zScore: number, velocity: number, base: Baseline): string {
  const velStr = velocity.toFixed(1);
  const baseStr = base.mean.toFixed(1);

  if (zScore < 1.0) return `Elite: ${velStr}/hr (near baseline ${baseStr}/hr)`;
  if (zScore < 1.5) return `High: ${velStr}/hr (${zScore.toFixed(1)}σ from baseline)`;
  if (zScore < 2.0) return `Medium: ${velStr}/hr (${zScore.toFixed(1)}σ from baseline)`;
  return `Low: ${velStr}/hr (${zScore.toFixed(1)}σ from baseline) - unusual pattern`;
}
