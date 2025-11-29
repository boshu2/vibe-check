export interface RankBadge {
  id: string;
  name: string;
  icon: string;
  color: string;
  requirement: string;
  threshold: {
    type: 'sessions' | 'streak' | 'xp' | 'score';
    value: number;
  };
}

export const RANK_BADGES: RankBadge[] = [
  {
    id: 'bronze',
    name: 'Bronze',
    icon: '🥉',
    color: '#CD7F32',
    requirement: '10 sessions',
    threshold: { type: 'sessions', value: 10 },
  },
  {
    id: 'silver',
    name: 'Silver',
    icon: '🥈',
    color: '#C0C0C0',
    requirement: '50 sessions',
    threshold: { type: 'sessions', value: 50 },
  },
  {
    id: 'gold',
    name: 'Gold',
    icon: '🥇',
    color: '#FFD700',
    requirement: '100 sessions',
    threshold: { type: 'sessions', value: 100 },
  },
  {
    id: 'platinum',
    name: 'Platinum',
    icon: '💎',
    color: '#E5E4E2',
    requirement: '14-day streak',
    threshold: { type: 'streak', value: 14 },
  },
  {
    id: 'diamond',
    name: 'Diamond',
    icon: '🔷',
    color: '#B9F2FF',
    requirement: '5000+ XP',
    threshold: { type: 'xp', value: 5000 },
  },
];

/**
 * Get current rank badge
 */
export function getCurrentBadge(
  sessions: number,
  streak: number,
  xp: number
): RankBadge | null {
  // Check from highest to lowest
  for (let i = RANK_BADGES.length - 1; i >= 0; i--) {
    const badge = RANK_BADGES[i];
    const { type, value } = badge.threshold;

    switch (type) {
      case 'sessions':
        if (sessions >= value) return badge;
        break;
      case 'streak':
        if (streak >= value) return badge;
        break;
      case 'xp':
        if (xp >= value) return badge;
        break;
    }
  }

  return null;
}

/**
 * Get next badge and progress
 */
export function getNextBadge(
  sessions: number,
  streak: number,
  xp: number
): { badge: RankBadge; progress: number; remaining: string } | null {
  const current = getCurrentBadge(sessions, streak, xp);
  const currentIdx = current ? RANK_BADGES.findIndex(b => b.id === current.id) : -1;

  if (currentIdx >= RANK_BADGES.length - 1) return null;

  const next = RANK_BADGES[currentIdx + 1];
  const { type, value } = next.threshold;

  let currentValue: number;
  let unit: string;

  switch (type) {
    case 'sessions':
      currentValue = sessions;
      unit = 'sessions';
      break;
    case 'streak':
      currentValue = streak;
      unit = 'day streak';
      break;
    case 'xp':
      currentValue = xp;
      unit = 'XP';
      break;
    default:
      return null;
  }

  const progress = Math.min((currentValue / value) * 100, 99);
  const remaining = `${value - currentValue} ${unit}`;

  return { badge: next, progress, remaining };
}

/**
 * Format badge display
 */
export function formatBadge(badge: RankBadge | null): string {
  if (!badge) return 'No badge yet';
  return `${badge.icon} ${badge.name} Tier`;
}
