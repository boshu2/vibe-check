import { Commit, TimeSpiralResult, Rating } from '../types';

const SPIRAL_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Calculate time spiral score.
 * Commits <5 minutes apart indicate frustrated rapid iteration.
 * Works WITHOUT semantic commits.
 */
export function calculateTimeSpiral(commits: Commit[]): TimeSpiralResult {
  if (commits.length < 2) {
    return {
      value: 100,
      unit: '%',
      rating: 'elite',
      description: 'Insufficient commits for analysis',
      spiralCommits: 0,
      totalCommits: commits.length,
    };
  }

  const sorted = [...commits].sort((a, b) => a.date.getTime() - b.date.getTime());
  let spiralCommits = 0;

  for (let i = 1; i < sorted.length; i++) {
    const gap = sorted[i].date.getTime() - sorted[i - 1].date.getTime();
    if (gap < SPIRAL_THRESHOLD_MS) {
      spiralCommits++;
    }
  }

  const spiralRatio = spiralCommits / commits.length;
  const score = 1 - spiralRatio; // Invert: high score = low spiraling

  return {
    value: Math.round(score * 100),
    unit: '%',
    rating: getSpiralRating(spiralRatio),
    description: getSpiralDescription(spiralRatio, spiralCommits, commits.length),
    spiralCommits,
    totalCommits: commits.length,
  };
}

function getSpiralRating(spiralRatio: number): Rating {
  if (spiralRatio < 0.15) return 'elite';
  if (spiralRatio < 0.30) return 'high';
  if (spiralRatio < 0.50) return 'medium';
  return 'low';
}

function getSpiralDescription(ratio: number, spiral: number, total: number): string {
  if (ratio < 0.15) return `Elite: ${spiral}/${total} rapid commits (<15%)`;
  if (ratio < 0.30) return `High: ${spiral}/${total} rapid commits (15-30%)`;
  if (ratio < 0.50) return `Medium: ${spiral}/${total} rapid commits (30-50%)`;
  return `Low: ${spiral}/${total} rapid commits (>50%) - frustrated iteration`;
}
