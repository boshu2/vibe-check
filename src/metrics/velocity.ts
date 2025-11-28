import { differenceInMinutes } from 'date-fns';
import { Commit, MetricResult, Rating } from '../types';

const SESSION_GAP_MINUTES = 120; // 2 hours = new session

export function calculateIterationVelocity(commits: Commit[]): MetricResult {
  if (commits.length === 0) {
    return {
      value: 0,
      unit: 'commits/hour',
      rating: 'low',
      description: 'No commits found',
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

  // Minimum of 10 minutes per session to account for work between commits
  const minMinutes = Math.max(totalMinutes, commits.length * 10);

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
