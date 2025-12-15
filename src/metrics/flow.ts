import { FixChain, MetricResult, Rating } from '../types.js';

export function calculateFlowEfficiency(
  activeMinutes: number,
  spirals: FixChain[]
): MetricResult {
  if (activeMinutes === 0) {
    return {
      value: 100,
      unit: '%',
      rating: 'elite',
      description: 'No active time recorded',
    };
  }

  const spiralMinutes = spirals
    .filter((s) => s.isSpiral)
    .reduce((sum, s) => sum + s.duration, 0);

  const efficiency = ((activeMinutes - spiralMinutes) / activeMinutes) * 100;
  const clampedEfficiency = Math.max(0, Math.min(100, efficiency));
  const rating = getRating(clampedEfficiency);

  return {
    value: Math.round(clampedEfficiency),
    unit: '%',
    rating,
    description: getDescription(rating, spiralMinutes),
  };
}

function getRating(efficiency: number): Rating {
  if (efficiency > 90) return 'elite';
  if (efficiency >= 75) return 'high';
  if (efficiency >= 50) return 'medium';
  return 'low';
}

function getDescription(rating: Rating, spiralMinutes: number): string {
  const spiralText =
    spiralMinutes > 0 ? `${spiralMinutes}m spent in debug spirals` : 'No debug spirals';

  switch (rating) {
    case 'elite':
      return `${spiralText}. Excellent productive flow`;
    case 'high':
      return `${spiralText}. Good balance`;
    case 'medium':
      return `${spiralText}. Significant debugging overhead`;
    case 'low':
      return `${spiralText}. More debugging than building`;
  }
}
