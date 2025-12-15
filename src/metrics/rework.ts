import { Commit, MetricResult, Rating } from '../types.js';

export function calculateReworkRatio(commits: Commit[]): MetricResult {
  if (commits.length === 0) {
    return {
      value: 0,
      unit: '%',
      rating: 'elite',
      description: 'No commits found',
    };
  }

  const fixCommits = commits.filter((c) => c.type === 'fix').length;
  const ratio = (fixCommits / commits.length) * 100;
  const rating = getRating(ratio);

  return {
    value: Math.round(ratio),
    unit: '%',
    rating,
    description: getDescription(rating, fixCommits, commits.length),
  };
}

function getRating(ratio: number): Rating {
  if (ratio < 30) return 'elite';
  if (ratio < 50) return 'high';
  if (ratio < 70) return 'medium';
  return 'low';
}

function getDescription(rating: Rating, fixes: number, total: number): string {
  const fixText = `${fixes}/${total} commits are fixes`;

  switch (rating) {
    case 'elite':
      return `${fixText}. Mostly forward progress`;
    case 'high':
      return `${fixText}. Normal for complex work`;
    case 'medium':
      return `${fixText}. Consider validating assumptions before coding`;
    case 'low':
      return `${fixText}. High rework, stop and reassess approach`;
  }
}
