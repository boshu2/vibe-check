import { UserProfile, SessionRecord, StreakState } from './types';

// Challenge types
export type ChallengeType =
  | 'TRUST_STREAK'      // Get 90%+ trust N times
  | 'ZERO_SPIRALS'      // 0 spirals for N days
  | 'ELITE_COUNT'       // Get N ELITE sessions
  | 'COMMIT_VOLUME'     // Analyze N commits
  | 'STREAK_EXTEND';    // Extend streak by N days

export interface Challenge {
  id: string;
  type: ChallengeType;
  name: string;
  description: string;
  icon: string;
  target: number;           // Goal to reach
  progress: number;         // Current progress
  reward: number;           // XP reward
  weekStart: string;        // ISO date of week start
  completed: boolean;
  completedAt?: string;
}

export const CHALLENGE_DEFINITIONS: Record<ChallengeType, {
  name: string;
  description: (target: number) => string;
  icon: string;
  targets: number[];        // Easy, medium, hard
  rewards: number[];        // Corresponding rewards
}> = {
  TRUST_STREAK: {
    name: 'Trust Gauntlet',
    description: (n) => `Get 90%+ trust in ${n} sessions`,
    icon: '🎯',
    targets: [3, 5, 7],
    rewards: [50, 100, 150],
  },
  ZERO_SPIRALS: {
    name: 'Zen Mode',
    description: (n) => `${n} sessions with 0 spirals`,
    icon: '🧘',
    targets: [3, 5, 7],
    rewards: [50, 100, 150],
  },
  ELITE_COUNT: {
    name: 'Elite Streak',
    description: (n) => `Get ${n} ELITE ratings this week`,
    icon: '✨',
    targets: [2, 4, 6],
    rewards: [50, 100, 150],
  },
  COMMIT_VOLUME: {
    name: 'Commit Champion',
    description: (n) => `Analyze ${n}+ commits this week`,
    icon: '📊',
    targets: [50, 100, 200],
    rewards: [30, 60, 100],
  },
  STREAK_EXTEND: {
    name: 'Streak Builder',
    description: (n) => `Extend your streak by ${n} days`,
    icon: '🔥',
    targets: [3, 5, 7],
    rewards: [40, 80, 120],
  },
};

/**
 * Generate weekly challenges based on user's weak metrics
 */
export function generateWeeklyChallenges(profile: UserProfile): Challenge[] {
  const weekStart = getWeekStartISO(new Date());
  const recentSessions = getSessionsThisWeek(profile.sessions, weekStart);

  // Analyze weak areas
  const avgTrust = recentSessions.length > 0
    ? recentSessions.reduce((sum, s) => sum + (s.vibeScore || 0), 0) / recentSessions.length
    : 50;
  const spiralCount = recentSessions.reduce((sum, s) => sum + s.spirals, 0);
  const eliteCount = recentSessions.filter(s => s.overall === 'ELITE').length;

  // Pick 3 challenges (1 based on weakness, 2 random)
  const challenges: Challenge[] = [];
  const usedTypes = new Set<ChallengeType>();

  // Challenge 1: Based on weakness
  if (avgTrust < 80) {
    challenges.push(createChallenge('TRUST_STREAK', weekStart, 1)); // Medium
    usedTypes.add('TRUST_STREAK');
  } else if (spiralCount > 3) {
    challenges.push(createChallenge('ZERO_SPIRALS', weekStart, 1));
    usedTypes.add('ZERO_SPIRALS');
  } else if (eliteCount < 2) {
    challenges.push(createChallenge('ELITE_COUNT', weekStart, 1));
    usedTypes.add('ELITE_COUNT');
  } else {
    challenges.push(createChallenge('STREAK_EXTEND', weekStart, 1));
    usedTypes.add('STREAK_EXTEND');
  }

  // Challenge 2-3: Random from remaining
  const remainingTypes = (Object.keys(CHALLENGE_DEFINITIONS) as ChallengeType[])
    .filter(t => !usedTypes.has(t));

  for (let i = 0; i < 2 && remainingTypes.length > 0; i++) {
    const idx = Math.floor(Math.random() * remainingTypes.length);
    const type = remainingTypes.splice(idx, 1)[0];
    challenges.push(createChallenge(type, weekStart, 0)); // Easy difficulty
  }

  return challenges;
}

function createChallenge(type: ChallengeType, weekStart: string, difficultyIdx: number): Challenge {
  const def = CHALLENGE_DEFINITIONS[type];
  const target = def.targets[difficultyIdx];
  const reward = def.rewards[difficultyIdx];

  return {
    id: `${type}-${weekStart}`,
    type,
    name: def.name,
    description: def.description(target),
    icon: def.icon,
    target,
    progress: 0,
    reward,
    weekStart,
    completed: false,
  };
}

/**
 * Update challenge progress after a session
 */
export function updateChallengeProgress(
  challenges: Challenge[],
  session: SessionRecord,
  streak: StreakState
): { challenges: Challenge[]; completed: Challenge[] } {
  const completed: Challenge[] = [];

  for (const challenge of challenges) {
    if (challenge.completed) continue;

    switch (challenge.type) {
      case 'TRUST_STREAK':
        if (session.vibeScore >= 90) challenge.progress++;
        break;
      case 'ZERO_SPIRALS':
        if (session.spirals === 0 && session.commits >= 10) challenge.progress++;
        break;
      case 'ELITE_COUNT':
        if (session.overall === 'ELITE') challenge.progress++;
        break;
      case 'COMMIT_VOLUME':
        challenge.progress += session.commits;
        break;
      case 'STREAK_EXTEND':
        challenge.progress = streak.current - (challenge.progress || 0);
        break;
    }

    if (challenge.progress >= challenge.target) {
      challenge.completed = true;
      challenge.completedAt = new Date().toISOString();
      completed.push(challenge);
    }
  }

  return { challenges, completed };
}

/**
 * Get current week's challenges, generating if needed
 */
export function getCurrentChallenges(profile: UserProfile): Challenge[] {
  const weekStart = getWeekStartISO(new Date());
  const existingChallenges = profile.challenges || [];

  // Check if we have challenges for this week
  const thisWeekChallenges = existingChallenges.filter(c => c.weekStart === weekStart);

  if (thisWeekChallenges.length >= 3) {
    return thisWeekChallenges;
  }

  // Generate new challenges
  return generateWeeklyChallenges(profile);
}

/**
 * Format challenges for display
 */
export function formatChallenges(challenges: Challenge[]): string {
  const lines: string[] = [];

  for (const c of challenges) {
    const progressBar = createProgressBar(c.progress, c.target, 10);
    const status = c.completed ? '✓ COMPLETE' : `${c.progress}/${c.target}`;
    lines.push(`${c.icon} ${c.name}: ${progressBar} ${status}`);
  }

  return lines.join('\n');
}

function createProgressBar(current: number, total: number, length: number): string {
  const pct = Math.min(current / total, 1);
  const filled = Math.round(pct * length);
  const empty = length - filled;
  return '█'.repeat(filled) + '░'.repeat(empty);
}

function getWeekStartISO(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d.toISOString().split('T')[0];
}

function getSessionsThisWeek(sessions: SessionRecord[], weekStart: string): SessionRecord[] {
  const start = new Date(weekStart);
  return sessions.filter(s => new Date(s.date) >= start);
}
