import { UserProfile, PRESTIGE_TIERS } from './types';
import { getCurrentBadge } from './badges';

export interface ShareableProfile {
  username?: string;
  level: number;
  levelName: string;
  totalXP: number;
  badge: string | null;
  streak: number;
  longestStreak: number;
  totalSessions: number;
  avgScore: number;
  bestScore: number;
  achievementCount: number;
  prestigeTier?: number;
  generatedAt: string;
}

/**
 * Create shareable profile data
 */
export function createShareableProfile(
  profile: UserProfile,
  username?: string
): ShareableProfile {
  const badge = getCurrentBadge(
    profile.stats.totalSessions,
    profile.streak.longest,
    profile.xp.total
  );

  return {
    username,
    level: profile.xp.level,
    levelName: profile.xp.levelName,
    totalXP: profile.xp.total,
    badge: badge?.name || null,
    streak: profile.streak.current,
    longestStreak: profile.streak.longest,
    totalSessions: profile.stats.totalSessions,
    avgScore: profile.stats.avgVibeScore,
    bestScore: profile.stats.bestVibeScore,
    achievementCount: profile.achievements.length,
    prestigeTier: profile.xp.prestigeTier,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Format profile for sharing (text format)
 */
export function formatShareText(shareable: ShareableProfile): string {
  const lines: string[] = [];

  const name = shareable.username || 'Anonymous Coder';
  const badgeStr = shareable.badge ? ` ${shareable.badge}` : '';
  const prestigeStr = shareable.prestigeTier
    ? ` (${PRESTIGE_TIERS[shareable.prestigeTier - 1].name})`
    : '';

  lines.push(`🎮 ${name}'s Vibe-Check Profile`);
  lines.push('');
  lines.push(`Level ${shareable.level} ${shareable.levelName}${prestigeStr}${badgeStr}`);
  lines.push(`${shareable.totalXP.toLocaleString()} Total XP`);
  lines.push('');
  lines.push(`🔥 ${shareable.streak}-day streak (Best: ${shareable.longestStreak})`);
  lines.push(`📊 ${shareable.totalSessions} sessions | Avg: ${shareable.avgScore}% | Best: ${shareable.bestScore}%`);
  lines.push(`🏆 ${shareable.achievementCount} achievements unlocked`);
  lines.push('');
  lines.push('Track your coding vibes: npx @boshu2/vibe-check');

  return lines.join('\n');
}

/**
 * Format profile as JSON for clipboard
 */
export function formatShareJSON(shareable: ShareableProfile): string {
  return JSON.stringify(shareable, null, 2);
}
