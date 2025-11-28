import { differenceInMinutes } from 'date-fns';
import { Commit, MetricResult, Rating } from '../types';

const FOLLOWUP_WINDOW_MINUTES = 30;

export function calculateTrustPassRate(commits: Commit[]): MetricResult {
  if (commits.length === 0) {
    return {
      value: 100,
      unit: '%',
      rating: 'elite',
      description: 'No commits found',
    };
  }

  // Sort by date ascending
  const sorted = [...commits].sort((a, b) => a.date.getTime() - b.date.getTime());

  let trustedCommits = 0;

  for (let i = 0; i < sorted.length; i++) {
    const commit = sorted[i];
    const nextCommit = sorted[i + 1];

    // Check if next commit is a fix to same component within 30 min
    const needsFollowup =
      nextCommit &&
      nextCommit.type === 'fix' &&
      sameComponent(commit, nextCommit) &&
      differenceInMinutes(nextCommit.date, commit.date) < FOLLOWUP_WINDOW_MINUTES;

    if (!needsFollowup) {
      trustedCommits++;
    }
  }

  const rate = (trustedCommits / commits.length) * 100;
  const rating = getRating(rate);

  return {
    value: Math.round(rate),
    unit: '%',
    rating,
    description: getDescription(rating),
  };
}

function sameComponent(a: Commit, b: Commit): boolean {
  // If both have scopes, compare them
  if (a.scope && b.scope) {
    return a.scope.toLowerCase() === b.scope.toLowerCase();
  }

  // If neither has scope, check if messages reference same area
  // This is a simple heuristic - first word after type
  const aWords = a.message.split(/\s+/).slice(0, 3);
  const bWords = b.message.split(/\s+/).slice(0, 3);

  return aWords.some((word) => bWords.includes(word) && word.length > 3);
}

function getRating(rate: number): Rating {
  if (rate > 95) return 'elite';
  if (rate >= 80) return 'high';
  if (rate >= 60) return 'medium';
  return 'low';
}

function getDescription(rating: Rating): string {
  switch (rating) {
    case 'elite':
      return 'Code sticks on first try, high AI trust';
    case 'high':
      return 'Occasional fixes needed, mostly autonomous';
    case 'medium':
      return 'Regular intervention required';
    case 'low':
      return 'Heavy oversight needed, run tracer tests before implementation';
  }
}
