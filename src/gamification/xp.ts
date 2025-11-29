import { XPState, LEVELS, XP_REWARDS, SessionRecord, StreakState } from './types';

/**
 * Create initial XP state
 */
export function createInitialXP(): XPState {
  return {
    total: 0,
    level: 1,
    levelName: LEVELS[0].name,
    currentLevelXP: 0,
    nextLevelXP: LEVELS[0].maxXP,
    lastSessionXP: 0,
  };
}

/**
 * Calculate XP earned from a session
 */
export function calculateSessionXP(
  session: SessionRecord,
  streak: StreakState,
  achievementsUnlocked: number
): number {
  let xp = 0;

  // Base XP from rating
  switch (session.overall) {
    case 'ELITE':
      xp += XP_REWARDS.eliteSession;
      break;
    case 'HIGH':
      xp += XP_REWARDS.highSession;
      break;
    case 'MEDIUM':
      xp += XP_REWARDS.mediumSession;
      break;
    case 'LOW':
      xp += XP_REWARDS.lowSession;
      break;
  }

  // Daily check-in bonus
  xp += XP_REWARDS.dailyCheckIn;

  // Streak bonus
  xp += XP_REWARDS.streakBonus * Math.min(streak.current, 30);  // Cap at 30 days

  // Bonus for no spirals
  if (session.spirals === 0 && session.commits >= 10) {
    xp += XP_REWARDS.noSpirals;
  }

  // Achievement bonuses
  xp += achievementsUnlocked * XP_REWARDS.achievementBase;

  return xp;
}

/**
 * Add XP and handle level ups
 */
export function addXP(currentXP: XPState, earnedXP: number): { xp: XPState; leveledUp: boolean; newLevel?: typeof LEVELS[number] } {
  const newTotal = currentXP.total + earnedXP;
  const { level, levelInfo } = getLevelForXP(newTotal);

  const leveledUp = level > currentXP.level;

  const newXP: XPState = {
    total: newTotal,
    level,
    levelName: levelInfo.name,
    currentLevelXP: newTotal - levelInfo.minXP,
    nextLevelXP: levelInfo.maxXP - levelInfo.minXP,
    lastSessionXP: earnedXP,
  };

  return {
    xp: newXP,
    leveledUp,
    newLevel: leveledUp ? levelInfo : undefined,
  };
}

/**
 * Get level for given XP amount
 */
export function getLevelForXP(xp: number): { level: number; levelInfo: typeof LEVELS[number] } {
  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (xp >= LEVELS[i].minXP) {
      return { level: LEVELS[i].level, levelInfo: LEVELS[i] };
    }
  }
  return { level: 1, levelInfo: LEVELS[0] };
}

/**
 * Format XP progress for display
 */
export function formatXPProgress(xp: XPState): string {
  const levelInfo = LEVELS.find(l => l.level === xp.level)!;
  const progress = xp.currentLevelXP / xp.nextLevelXP;
  const barLength = 20;
  const filled = Math.round(progress * barLength);
  const empty = barLength - filled;

  const bar = '█'.repeat(filled) + '░'.repeat(empty);

  return `Level ${xp.level} ${levelInfo.name} ${levelInfo.icon}\n${bar} ${xp.currentLevelXP}/${xp.nextLevelXP} XP`;
}

/**
 * Format level for compact display
 */
export function formatLevel(xp: XPState): string {
  const levelInfo = LEVELS.find(l => l.level === xp.level)!;
  return `Level ${xp.level} ${levelInfo.name} ${levelInfo.icon}`;
}

/**
 * Get progress percentage to next level
 */
export function getLevelProgress(xp: XPState): number {
  if (xp.nextLevelXP === Infinity) return 100;
  return Math.round((xp.currentLevelXP / xp.nextLevelXP) * 100);
}
