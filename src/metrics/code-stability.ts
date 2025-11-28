import { Commit, CodeStabilityResult, Rating } from '../types';

/**
 * Calculate code stability score.
 * Measures what percentage of added lines survive.
 *
 * NOTE: Full implementation requires git blame analysis.
 * This is a simplified version using addition/deletion ratios.
 */
export function calculateCodeStability(
  commits: Commit[],
  stats?: { additions: number; deletions: number }[]
): CodeStabilityResult {
  if (!stats || stats.length === 0) {
    // Without stats, estimate from commit patterns
    return estimateStability(commits);
  }

  let totalAdditions = 0;
  let totalDeletions = 0;

  for (const stat of stats) {
    totalAdditions += stat.additions;
    totalDeletions += stat.deletions;
  }

  // Stability = net retention
  // If deletions > additions, code is being removed (refactoring)
  // If additions > deletions, code is being added
  // High churn (both high) = low stability

  const churnRate = totalAdditions > 0
    ? Math.min(totalDeletions / totalAdditions, 1.0)
    : 0;

  const score = 1 - (churnRate * 0.5); // Partial penalty for deletions

  return {
    value: Math.round(score * 100),
    unit: '%',
    rating: getStabilityRating(score),
    description: getStabilityDescription(score, totalAdditions, totalDeletions),
    linesAdded: totalAdditions,
    linesSurviving: Math.round(totalAdditions * score),
  };
}

function estimateStability(commits: Commit[]): CodeStabilityResult {
  // Without line stats, use commit message patterns
  const fixCommits = commits.filter(c =>
    c.message.toLowerCase().includes('fix') ||
    c.message.toLowerCase().includes('revert') ||
    c.message.toLowerCase().includes('undo')
  ).length;

  const fixRatio = commits.length > 0 ? fixCommits / commits.length : 0;
  const score = 1 - fixRatio;

  return {
    value: Math.round(score * 100),
    unit: '%',
    rating: getStabilityRating(score),
    description: `Estimated: ${Math.round(fixRatio * 100)}% fix/revert commits`,
    linesAdded: 0,
    linesSurviving: 0,
  };
}

function getStabilityRating(score: number): Rating {
  if (score >= 0.85) return 'elite';
  if (score >= 0.70) return 'high';
  if (score >= 0.50) return 'medium';
  return 'low';
}

function getStabilityDescription(score: number, added: number, deleted: number): string {
  const pct = Math.round(score * 100);
  if (score >= 0.85) return `Elite: ${pct}% stability (+${added}/-${deleted})`;
  if (score >= 0.70) return `High: ${pct}% stability (+${added}/-${deleted})`;
  if (score >= 0.50) return `Medium: ${pct}% stability (+${added}/-${deleted})`;
  return `Low: ${pct}% stability (+${added}/-${deleted}) - high churn`;
}
