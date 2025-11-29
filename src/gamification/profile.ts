import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  UserProfile,
  SessionRecord,
  StreakState,
  XPState,
  Achievement,
} from './types';
import { createInitialStreak, updateStreak } from './streaks';
import { createInitialXP, addXP, calculateSessionXP } from './xp';
import { checkAchievements, ACHIEVEMENTS } from './achievements';

const PROFILE_DIR = '.vibe-check';
const PROFILE_FILE = 'profile.json';

/**
 * Get profile directory path (in user's home directory)
 */
export function getProfileDir(): string {
  return path.join(os.homedir(), PROFILE_DIR);
}

/**
 * Get profile file path
 */
export function getProfilePath(): string {
  return path.join(getProfileDir(), PROFILE_FILE);
}

/**
 * Create initial profile
 */
export function createInitialProfile(): UserProfile {
  const now = new Date().toISOString();

  return {
    version: '1.0.0',
    createdAt: now,
    updatedAt: now,

    streak: createInitialStreak(),
    xp: createInitialXP(),
    achievements: [],
    sessions: [],

    preferences: {
      weeklyGoal: 5,
      showNotifications: true,
      publicProfile: false,
    },

    stats: {
      totalSessions: 0,
      totalCommitsAnalyzed: 0,
      avgVibeScore: 0,
      bestVibeScore: 0,
      totalSpiralsDetected: 0,
      spiralsAvoided: 0,
    },
  };
}

/**
 * Load profile from disk
 */
export function loadProfile(): UserProfile {
  const filePath = getProfilePath();

  if (fs.existsSync(filePath)) {
    try {
      const data = fs.readFileSync(filePath, 'utf-8');
      const profile = JSON.parse(data) as UserProfile;
      return migrateProfile(profile);
    } catch {
      return createInitialProfile();
    }
  }

  return createInitialProfile();
}

/**
 * Save profile to disk
 */
export function saveProfile(profile: UserProfile): void {
  const dirPath = getProfileDir();
  const filePath = getProfilePath();

  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }

  profile.updatedAt = new Date().toISOString();
  fs.writeFileSync(filePath, JSON.stringify(profile, null, 2));
}

/**
 * Record a new session and update all gamification state
 */
export function recordSession(
  vibeScore: number,
  overall: 'ELITE' | 'HIGH' | 'MEDIUM' | 'LOW',
  commits: number,
  spirals: number
): {
  profile: UserProfile;
  xpEarned: number;
  leveledUp: boolean;
  newLevel?: string;
  achievementsUnlocked: Achievement[];
  streakExtended: boolean;
  isPersonalBest: boolean;
} {
  const profile = loadProfile();
  const now = new Date();

  // Update streak
  const oldStreak = profile.streak.current;
  profile.streak = updateStreak(profile.streak, now);
  const streakExtended = profile.streak.current > oldStreak;

  // Check achievements (before recording session)
  const sessionRecord: SessionRecord = {
    date: now.toISOString().split('T')[0],
    timestamp: now.toISOString(),
    vibeScore,
    overall,
    commits,
    spirals,
    xpEarned: 0,  // Will be updated
    achievementsUnlocked: [],
  };

  const newAchievements = checkAchievements(
    profile.sessions,
    profile.streak,
    profile.xp,
    sessionRecord,
    profile.achievements.map(a => a.id)
  );

  // Calculate and add XP
  const xpEarned = calculateSessionXP(sessionRecord, profile.streak, newAchievements.length);
  sessionRecord.xpEarned = xpEarned;
  sessionRecord.achievementsUnlocked = newAchievements.map(a => a.id);

  const { xp: newXP, leveledUp, newLevel } = addXP(profile.xp, xpEarned);
  profile.xp = newXP;

  // Add achievements to profile
  profile.achievements.push(...newAchievements);

  // Add session to history (keep last 100)
  profile.sessions.push(sessionRecord);
  if (profile.sessions.length > 100) {
    profile.sessions = profile.sessions.slice(-100);
  }

  // Update stats
  const isPersonalBest = vibeScore > profile.stats.bestVibeScore;
  profile.stats.totalSessions += 1;
  profile.stats.totalCommitsAnalyzed += commits;
  profile.stats.bestVibeScore = Math.max(profile.stats.bestVibeScore, vibeScore);
  profile.stats.totalSpiralsDetected += spirals;
  if (spirals === 0 && commits >= 10) {
    profile.stats.spiralsAvoided += 1;
  }

  // Recalculate average
  const allScores = profile.sessions.map(s => s.vibeScore);
  profile.stats.avgVibeScore = Math.round(
    allScores.reduce((a, b) => a + b, 0) / allScores.length
  );

  // Save profile
  saveProfile(profile);

  return {
    profile,
    xpEarned,
    leveledUp,
    newLevel: newLevel?.name,
    achievementsUnlocked: newAchievements,
    streakExtended,
    isPersonalBest,
  };
}

/**
 * Migrate old profile versions
 */
function migrateProfile(profile: UserProfile): UserProfile {
  // Add migrations here as schema evolves
  if (!profile.version) {
    profile.version = '1.0.0';
  }

  // Ensure all fields exist
  if (!profile.preferences) {
    profile.preferences = {
      weeklyGoal: 5,
      showNotifications: true,
      publicProfile: false,
    };
  }

  if (!profile.stats) {
    profile.stats = {
      totalSessions: profile.sessions?.length || 0,
      totalCommitsAnalyzed: 0,
      avgVibeScore: 0,
      bestVibeScore: 0,
      totalSpiralsDetected: 0,
      spiralsAvoided: 0,
    };
  }

  return profile;
}

/**
 * Get achievement counts
 */
export function getAchievementCounts(profile: UserProfile): { unlocked: number; total: number } {
  return {
    unlocked: profile.achievements.length,
    total: ACHIEVEMENTS.length,
  };
}

/**
 * Get recent sessions (last N days)
 */
export function getRecentSessions(profile: UserProfile, days: number): SessionRecord[] {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);

  return profile.sessions.filter(s => new Date(s.date) >= cutoff);
}
