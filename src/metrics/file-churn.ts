import { Commit, FileChurnResult, Rating } from '../types.js';

const ONE_HOUR_MS = 60 * 60 * 1000;

/**
 * Churn threshold: 3+ touches to same file within 1 hour suggests thrashing.
 *
 * Rationale: Healthy development typically touches a file 1-2 times per
 * feature. Returning to the same file 3+ times in an hour often indicates:
 * - Incomplete understanding before starting
 * - Cascading changes from unexpected dependencies
 * - Debugging loops
 *
 * NOT empirically validated. Your mileage may vary.
 */
const CHURN_THRESHOLD = 3;

/**
 * Calculate file churn score.
 * Files touched 3+ times within 1 hour indicate thrashing.
 * Works WITHOUT semantic commits.
 */
export function calculateFileChurn(
  commits: Commit[],
  filesPerCommit: Map<string, string[]>
): FileChurnResult {
  // Track file touch timestamps
  const fileTouchTimes = new Map<string, Date[]>();

  for (const commit of commits) {
    const files = filesPerCommit.get(commit.hash) || [];
    for (const file of files) {
      const times = fileTouchTimes.get(file) || [];
      times.push(commit.date);
      fileTouchTimes.set(file, times);
    }
  }

  // Count files with 3+ touches in 1 hour
  let churnedFiles = 0;
  for (const [_file, times] of fileTouchTimes) {
    const sorted = times.sort((a, b) => a.getTime() - b.getTime());

    for (let i = 0; i <= sorted.length - CHURN_THRESHOLD; i++) {
      const span = sorted[i + CHURN_THRESHOLD - 1].getTime() - sorted[i].getTime();
      if (span < ONE_HOUR_MS) {
        churnedFiles++;
        break; // Count each file only once
      }
    }
  }

  const totalFiles = fileTouchTimes.size;
  const churnRatio = totalFiles > 0 ? churnedFiles / totalFiles : 0;
  const score = 1 - churnRatio; // Invert: high score = low churn

  return {
    value: Math.round(score * 100),
    unit: '%',
    rating: getChurnRating(churnRatio),
    description: getChurnDescription(churnRatio, churnedFiles, totalFiles),
    churnedFiles,
    totalFiles,
  };
}

function getChurnRating(churnRatio: number): Rating {
  if (churnRatio < 0.10) return 'elite';
  if (churnRatio < 0.25) return 'high';
  if (churnRatio < 0.40) return 'medium';
  return 'low';
}

function getChurnDescription(ratio: number, churned: number, total: number): string {
  if (ratio < 0.10) return `Elite: ${churned}/${total} files churned (<10%)`;
  if (ratio < 0.25) return `High: ${churned}/${total} files churned (10-25%)`;
  if (ratio < 0.40) return `Medium: ${churned}/${total} files churned (25-40%)`;
  return `Low: ${churned}/${total} files churned (>40%) - significant thrashing`;
}
