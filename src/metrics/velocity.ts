import { differenceInMinutes } from 'date-fns';
import { Commit, MetricResult, Rating } from '../types.js';

/**
 * Gap threshold for session detection. Commits separated by more than
 * this gap are considered part of different work sessions.
 */
const SESSION_GAP_MINUTES = 120; // 2 hours = new session

/**
 * Minimum time assumed per commit for velocity calculation.
 *
 * Rationale: Commits represent visible checkpoints, but work happens between
 * commits. A commit that appears instant (0 minutes from previous) still
 * required time to write code, test, and review. This floor prevents
 * unrealistically high velocities from rapid-fire commits.
 *
 * The 10-minute floor is based on typical "atomic commit" workflows where
 * each commit represents a small, reviewable change.
 */
const MIN_MINUTES_PER_COMMIT = 10;

/**
 * Calculate iteration velocity as commits per active hour.
 *
 * Velocity measures how tight your feedback loops are. Higher velocity
 * indicates more frequent checkpoints and faster iteration cycles.
 *
 * Edge cases:
 * - 0 commits: Returns 0 velocity (no data)
 * - 1 commit: Returns 'unknown' - velocity requires 2+ commits to measure
 * - Rapid commits: Floor applied to prevent unrealistic values
 */
export function calculateIterationVelocity(commits: Commit[]): MetricResult {
  if (commits.length === 0) {
    return {
      value: 0,
      unit: 'commits/hour',
      rating: 'medium',
      description: 'Insufficient data - no commits to analyze',
    };
  }

  // Single commit: velocity is undefined, not calculable
  if (commits.length === 1) {
    return {
      value: 0,
      unit: 'commits/hour',
      rating: 'medium',
      description: 'Single commit - velocity requires 2+ commits to measure',
    };
  }

  const activeHours = calculateActiveHours(commits);

  if (activeHours === 0) {
    return {
      value: commits.length,
      unit: 'commits/hour',
      rating: 'high',
      description: 'All commits in rapid succession',
    };
  }

  const velocity = commits.length / activeHours;
  const rating = getRating(velocity);

  return {
    value: Math.round(velocity * 10) / 10,
    unit: 'commits/hour',
    rating,
    description: getDescription(rating),
  };
}

/**
 * Calculate total active work hours from commit timestamps.
 *
 * Active hours = sum of session durations, where sessions are separated
 * by gaps > SESSION_GAP_MINUTES. A floor of MIN_MINUTES_PER_COMMIT per
 * commit is applied to account for work time between commits.
 *
 * @param commits - Array of commits with timestamps
 * @returns Active hours (minimum 0.1 to avoid division by zero)
 */
export function calculateActiveHours(commits: Commit[]): number {
  if (commits.length < 2) {
    return 0.1; // Minimum to avoid division by zero
  }

  // Sort by date ascending
  const sorted = [...commits].sort((a, b) => a.date.getTime() - b.date.getTime());

  let totalMinutes = 0;
  let sessionStart = sorted[0].date;

  for (let i = 1; i < sorted.length; i++) {
    const gap = differenceInMinutes(sorted[i].date, sorted[i - 1].date);

    if (gap > SESSION_GAP_MINUTES) {
      // End current session, start new one
      totalMinutes += differenceInMinutes(sorted[i - 1].date, sessionStart);
      sessionStart = sorted[i].date;
    }
  }

  // Add final session
  totalMinutes += differenceInMinutes(sorted[sorted.length - 1].date, sessionStart);

  // Apply minimum time per commit to account for work between commits.
  // See MIN_MINUTES_PER_COMMIT JSDoc for rationale.
  const minMinutes = Math.max(totalMinutes, commits.length * MIN_MINUTES_PER_COMMIT);

  return minMinutes / 60;
}

function getRating(velocity: number): Rating {
  if (velocity > 5) return 'elite';
  if (velocity >= 3) return 'high';
  if (velocity >= 1) return 'medium';
  return 'low';
}

function getDescription(rating: Rating): string {
  switch (rating) {
    case 'elite':
      return 'Excellent iteration speed, tight feedback loops';
    case 'high':
      return 'Good iteration speed';
    case 'medium':
      return 'Normal pace';
    case 'low':
      return 'Slow iteration, consider smaller commits';
  }
}
