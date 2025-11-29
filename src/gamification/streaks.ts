import { StreakState } from './types';

/**
 * Create initial streak state
 */
export function createInitialStreak(): StreakState {
  return {
    current: 0,
    longest: 0,
    lastActiveDate: '',
    weeklyGoal: 5,
    weeklyProgress: 0,
    freezesRemaining: 1,
  };
}

/**
 * Update streak based on new session
 */
export function updateStreak(streak: StreakState, sessionDate: Date): StreakState {
  const today = formatDate(sessionDate);
  const yesterday = formatDate(new Date(sessionDate.getTime() - 24 * 60 * 60 * 1000));
  const twoDaysAgo = formatDate(new Date(sessionDate.getTime() - 2 * 24 * 60 * 60 * 1000));

  // Already checked in today
  if (streak.lastActiveDate === today) {
    return streak;
  }

  let newCurrent = streak.current;
  let freezesRemaining = streak.freezesRemaining;
  let lastFreezeUsed = streak.lastFreezeUsed;

  if (streak.lastActiveDate === yesterday) {
    // Consecutive day - extend streak
    newCurrent = streak.current + 1;
  } else if (streak.lastActiveDate === twoDaysAgo && freezesRemaining > 0) {
    // Missed one day but have freeze
    newCurrent = streak.current + 1;
    freezesRemaining -= 1;
    lastFreezeUsed = yesterday;
  } else if (streak.lastActiveDate === '') {
    // First ever session
    newCurrent = 1;
  } else {
    // Streak broken
    newCurrent = 1;
  }

  // Update weekly progress
  const weekStart = getWeekStart(sessionDate);
  const lastActiveWeekStart = streak.lastActiveDate
    ? getWeekStart(new Date(streak.lastActiveDate))
    : '';

  const weeklyProgress = weekStart === lastActiveWeekStart
    ? streak.weeklyProgress + (streak.lastActiveDate === today ? 0 : 1)
    : 1;

  return {
    current: newCurrent,
    longest: Math.max(streak.longest, newCurrent),
    lastActiveDate: today,
    weeklyGoal: streak.weeklyGoal,
    weeklyProgress,
    freezesRemaining,
    lastFreezeUsed,
  };
}

/**
 * Check if streak is at risk (not checked in today)
 */
export function isStreakAtRisk(streak: StreakState): boolean {
  if (streak.current === 0) return false;

  const today = formatDate(new Date());
  return streak.lastActiveDate !== today;
}

/**
 * Get days until streak expires
 */
export function getDaysUntilExpiry(streak: StreakState): number {
  if (streak.current === 0) return 0;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const lastActive = new Date(streak.lastActiveDate);
  lastActive.setHours(0, 0, 0, 0);

  const diffDays = Math.floor((today.getTime() - lastActive.getTime()) / (24 * 60 * 60 * 1000));

  if (diffDays === 0) return 2;  // Checked in today, expires day after tomorrow
  if (diffDays === 1) return 1;  // Checked in yesterday, expires tomorrow
  return 0;  // Already expired or will expire today
}

/**
 * Format streak for display
 */
export function formatStreak(streak: StreakState): string {
  if (streak.current === 0) {
    return 'No active streak';
  }

  const isPersonalBest = streak.current === streak.longest && streak.current > 1;
  const fire = '🔥'.repeat(Math.min(streak.current, 5));

  let text = `${fire} ${streak.current}-day streak`;

  if (isPersonalBest && streak.current > 7) {
    text += ' (Personal best!)';
  }

  return text;
}

/**
 * Format weekly progress for display
 */
export function formatWeeklyProgress(streak: StreakState): string {
  const filled = '█'.repeat(streak.weeklyProgress);
  const empty = '░'.repeat(Math.max(0, streak.weeklyGoal - streak.weeklyProgress));

  return `${streak.weeklyProgress}/${streak.weeklyGoal} days ${filled}${empty}`;
}

// Helper functions
function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

function getWeekStart(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);  // Monday start
  d.setDate(diff);
  return formatDate(d);
}
