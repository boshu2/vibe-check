import { Achievement, SessionRecord, StreakState, XPState } from './types.js';

// All available achievements
export const ACHIEVEMENTS: Omit<Achievement, 'unlockedAt' | 'progress'>[] = [
  // Streak achievements
  {
    id: 'first_check',
    name: 'First Blood',
    description: 'Run your first vibe-check',
    icon: '🩸',
    category: 'sessions',
    condition: 'Complete 1 session',
  },
  {
    id: 'week_warrior',
    name: 'Week Warrior',
    description: 'Maintain a 7-day streak',
    icon: '⚔️',
    category: 'streak',
    condition: '7-day streak',
  },
  {
    id: 'fortnight_force',
    name: 'Fortnight Force',
    description: 'Maintain a 14-day streak',
    icon: '🛡️',
    category: 'streak',
    condition: '14-day streak',
  },
  {
    id: 'monthly_master',
    name: 'Monthly Master',
    description: 'Maintain a 30-day streak',
    icon: '👑',
    category: 'streak',
    condition: '30-day streak',
  },

  // Score achievements
  {
    id: 'elite_vibes',
    name: 'Elite Vibes',
    description: 'Achieve ELITE rating in a session',
    icon: '✨',
    category: 'score',
    condition: 'Get ELITE rating',
  },
  {
    id: 'consistent_high',
    name: 'High Roller',
    description: 'Get HIGH or better for 5 consecutive sessions',
    icon: '🎰',
    category: 'score',
    condition: '5 consecutive HIGH+ sessions',
  },
  {
    id: 'perfect_week',
    name: 'Perfect Week',
    description: 'ELITE rating every day for a week',
    icon: '💎',
    category: 'score',
    condition: '7 consecutive ELITE sessions',
  },
  {
    id: 'score_90',
    name: 'Ninety Club',
    description: 'Achieve a Vibe Score of 90% or higher',
    icon: '🏅',
    category: 'score',
    condition: 'Vibe Score ≥ 90%',
  },

  // Session milestones
  {
    id: 'ten_sessions',
    name: 'Getting Started',
    description: 'Complete 10 vibe-check sessions',
    icon: '📊',
    category: 'sessions',
    condition: '10 sessions',
  },
  {
    id: 'fifty_sessions',
    name: 'Regular',
    description: 'Complete 50 vibe-check sessions',
    icon: '📈',
    category: 'sessions',
    condition: '50 sessions',
  },
  {
    id: 'hundred_sessions',
    name: 'Centurion',
    description: 'Complete 100 vibe-check sessions',
    icon: '💯',
    category: 'sessions',
    condition: '100 sessions',
  },

  // Special achievements
  {
    id: 'zen_master',
    name: 'Zen Master',
    description: '0 debug spirals in a 50+ commit session',
    icon: '🧘',
    category: 'special',
    condition: '50+ commits, 0 spirals',
  },
  {
    id: 'trust_builder',
    name: 'Trust Builder',
    description: 'Maintain 90%+ Trust Pass Rate for 10 sessions',
    icon: '🏗️',
    category: 'special',
    condition: '10 sessions with 90%+ trust',
  },
  {
    id: 'comeback_kid',
    name: 'Comeback Kid',
    description: 'Go from LOW to ELITE in the same week',
    icon: '🔄',
    category: 'special',
    condition: 'LOW → ELITE in 7 days',
  },
  {
    id: 'early_bird',
    name: 'Early Bird',
    description: 'Run vibe-check before 7 AM',
    icon: '🌅',
    category: 'special',
    condition: 'Session before 7 AM',
  },
  {
    id: 'night_owl',
    name: 'Night Owl',
    description: 'Run vibe-check after midnight',
    icon: '🦉',
    category: 'special',
    condition: 'Session after midnight',
  },
  {
    id: 'thousand_commits',
    name: 'Thousand Strong',
    description: 'Analyze 1000 total commits',
    icon: '🎯',
    category: 'special',
    condition: '1000 commits analyzed',
  },

  // Hidden achievements
  {
    id: 'perfect_score',
    name: '???',
    description: 'Achieve a perfect 100% Vibe Score',
    icon: '🌟',
    category: 'special',
    condition: '???',
    hidden: true,
  },
  {
    id: 'spiral_survivor',
    name: '???',
    description: 'Recover from 5+ spirals to ELITE in same session',
    icon: '🌀',
    category: 'special',
    condition: '???',
    hidden: true,
  },
];

/**
 * Check which achievements are newly unlocked based on current state
 */
export function checkAchievements(
  sessions: SessionRecord[],
  streak: StreakState,
  xp: XPState,
  currentSession: SessionRecord,
  unlockedIds: string[]
): Achievement[] {
  const newlyUnlocked: Achievement[] = [];
  const now = new Date().toISOString();

  for (const achievement of ACHIEVEMENTS) {
    // Skip already unlocked
    if (unlockedIds.includes(achievement.id)) continue;

    const unlocked = checkAchievementCondition(
      achievement.id,
      sessions,
      streak,
      xp,
      currentSession
    );

    if (unlocked) {
      newlyUnlocked.push({
        ...achievement,
        unlockedAt: now,
      });
    }
  }

  return newlyUnlocked;
}

function checkAchievementCondition(
  id: string,
  sessions: SessionRecord[],
  streak: StreakState,
  _xp: XPState,
  current: SessionRecord
): boolean {
  const totalSessions = sessions.length + 1;  // Include current

  switch (id) {
    // Session count
    case 'first_check':
      return totalSessions >= 1;
    case 'ten_sessions':
      return totalSessions >= 10;
    case 'fifty_sessions':
      return totalSessions >= 50;
    case 'hundred_sessions':
      return totalSessions >= 100;

    // Streak
    case 'week_warrior':
      return streak.current >= 7;
    case 'fortnight_force':
      return streak.current >= 14;
    case 'monthly_master':
      return streak.current >= 30;

    // Score
    case 'elite_vibes':
      return current.overall === 'ELITE';
    case 'score_90':
      return current.vibeScore >= 90;
    case 'perfect_score':
      return current.vibeScore === 100;

    // Consecutive sessions
    case 'consistent_high': {
      const last5 = [...sessions.slice(-4), current];
      return last5.length >= 5 &&
             last5.every(s => s.overall === 'ELITE' || s.overall === 'HIGH');
    }
    case 'perfect_week': {
      const last7 = [...sessions.slice(-6), current];
      return last7.length >= 7 && last7.every(s => s.overall === 'ELITE');
    }

    // Special
    case 'zen_master':
      return current.commits >= 50 && current.spirals === 0;

    case 'trust_builder': {
      // Would need trust pass rate in session record
      return false; // TODO: Implement when trust is tracked
    }

    case 'comeback_kid': {
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      const weekSessions = sessions.filter(s => new Date(s.date) >= weekAgo);
      const hadLow = weekSessions.some(s => s.overall === 'LOW');
      return hadLow && current.overall === 'ELITE';
    }

    case 'early_bird': {
      const hour = new Date(current.timestamp).getHours();
      return hour < 7;
    }

    case 'night_owl': {
      const hour = new Date(current.timestamp).getHours();
      return hour >= 0 && hour < 5;
    }

    case 'thousand_commits': {
      const totalCommits = sessions.reduce((sum, s) => sum + s.commits, 0) + current.commits;
      return totalCommits >= 1000;
    }

    case 'spiral_survivor':
      return current.spirals >= 5 && current.overall === 'ELITE';

    default:
      return false;
  }
}

/**
 * Get achievement by ID
 */
export function getAchievement(id: string): Achievement | undefined {
  return ACHIEVEMENTS.find(a => a.id === id) as Achievement | undefined;
}

/**
 * Get all achievements with unlock status
 */
export function getAllAchievements(unlockedAchievements: Achievement[]): Achievement[] {
  const unlockedIds = new Set(unlockedAchievements.map(a => a.id));

  return ACHIEVEMENTS.map(a => {
    const unlocked = unlockedAchievements.find(u => u.id === a.id);
    return unlocked || { ...a, unlockedAt: undefined };
  });
}
