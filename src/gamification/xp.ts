import { XPState, LEVELS, PRESTIGE_TIERS, XP_REWARDS, SessionRecord, StreakState } from './types';

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
export function addXP(currentXP: XPState, earnedXP: number): {
  xp: XPState;
  leveledUp: boolean;
  newLevel?: typeof LEVELS[number];
  prestigedUp?: boolean;
  newPrestige?: typeof PRESTIGE_TIERS[number];
} {
  const newTotal = currentXP.total + earnedXP;
  const { level, levelInfo, prestigeTier, prestigeInfo } = getLevelForXP(newTotal);

  const leveledUp = level > currentXP.level;
  const prestigedUp = prestigeTier !== undefined &&
    (currentXP.prestigeTier === undefined || prestigeTier > currentXP.prestigeTier);

  const maxXP = prestigeInfo ? prestigeInfo.maxXP : levelInfo.maxXP;
  const minXP = prestigeInfo ? prestigeInfo.minXP : levelInfo.minXP;

  const newXP: XPState = {
    total: newTotal,
    level,
    levelName: prestigeInfo ? prestigeInfo.name : levelInfo.name,
    currentLevelXP: newTotal - minXP,
    nextLevelXP: maxXP === Infinity ? Infinity : maxXP - minXP,
    lastSessionXP: earnedXP,
    prestigeTier,
    prestigeName: prestigeInfo?.name,
  };

  return {
    xp: newXP,
    leveledUp,
    newLevel: leveledUp ? levelInfo : undefined,
    prestigedUp,
    newPrestige: prestigedUp ? prestigeInfo : undefined,
  };
}

/**
 * Get level for given XP amount (including prestige)
 */
export function getLevelForXP(xp: number): {
  level: number;
  levelInfo: typeof LEVELS[number];
  prestigeTier?: number;
  prestigeInfo?: typeof PRESTIGE_TIERS[number];
} {
  // Check prestige tiers first
  if (xp >= 5000) {
    for (let i = PRESTIGE_TIERS.length - 1; i >= 0; i--) {
      if (xp >= PRESTIGE_TIERS[i].minXP) {
        return {
          level: 6,
          levelInfo: LEVELS[5],
          prestigeTier: PRESTIGE_TIERS[i].tier,
          prestigeInfo: PRESTIGE_TIERS[i],
        };
      }
    }
  }

  // Regular levels
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
