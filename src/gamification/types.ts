// Gamification Types for Vibe-Check

export interface StreakState {
  current: number;           // Current consecutive days
  longest: number;           // Personal best
  lastActiveDate: string;    // ISO date (YYYY-MM-DD)
  weeklyGoal: number;        // Days per week target (default: 5)
  weeklyProgress: number;    // Days active this week
  freezesRemaining: number;  // Streak freezes available
  lastFreezeUsed?: string;   // ISO date of last freeze
}

export interface XPState {
  total: number;             // Lifetime XP
  level: number;             // Current level (1-6)
  levelName: string;         // "Novice", "Apprentice", etc.
  currentLevelXP: number;    // XP in current level
  nextLevelXP: number;       // XP needed for next level
  lastSessionXP: number;     // XP earned in last session
}

export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: 'streak' | 'score' | 'sessions' | 'special';
  condition: string;         // Human-readable condition
  unlockedAt?: string;       // ISO date when unlocked
  progress?: number;         // 0-100 for progressive achievements
  hidden?: boolean;          // Secret achievements
}

export interface SessionRecord {
  date: string;              // ISO date
  timestamp: string;         // ISO datetime
  vibeScore: number;         // 0-100
  overall: 'ELITE' | 'HIGH' | 'MEDIUM' | 'LOW';
  commits: number;
  spirals: number;
  xpEarned: number;
  achievementsUnlocked: string[];  // Achievement IDs
  periodFrom?: string;       // ISO datetime of analyzed period start
  periodTo?: string;         // ISO datetime of analyzed period end
}

export interface UserProfile {
  version: string;           // Profile schema version
  createdAt: string;         // ISO datetime
  updatedAt: string;         // ISO datetime

  streak: StreakState;
  xp: XPState;
  achievements: Achievement[];
  sessions: SessionRecord[];

  // Pattern memory - tracks spiral triggers over time
  patternMemory?: PatternMemory;

  // Preferences
  preferences: {
    weeklyGoal: number;
    showNotifications: boolean;
    publicProfile: boolean;
  };

  // Stats
  stats: {
    totalSessions: number;
    totalCommitsAnalyzed: number;
    avgVibeScore: number;
    bestVibeScore: number;
    totalSpiralsDetected: number;
    spiralsAvoided: number;    // Sessions with 0 spirals
  };
}

// ============================================
// PATTERN MEMORY (v1.4.0)
// ============================================

// Individual spiral occurrence
export interface SpiralPatternRecord {
  pattern: string;           // SECRETS_AUTH, VOLUME_CONFIG, etc. or "OTHER"
  component: string;         // scope/component that triggered it
  duration: number;          // minutes spent in this spiral
  commits: number;           // number of fix commits
  date: string;              // ISO date when this occurred
}

// Aggregated pattern memory
export interface PatternMemory {
  version: string;           // Schema version
  records: SpiralPatternRecord[];  // Historical records (last 100)

  // Aggregated statistics (computed from records)
  patternCounts: Record<string, number>;     // pattern -> occurrences
  componentCounts: Record<string, number>;   // component -> occurrences
  patternDurations: Record<string, number>;  // pattern -> total minutes spent

  // Computed insights
  topPatterns: string[];       // top 3 patterns by frequency
  topComponents: string[];     // top 3 components by frequency
  avgRecoveryTime: number;     // average spiral duration in minutes
  totalSpirals: number;        // total spirals ever recorded
}

// Level progression
export const LEVELS = [
  { level: 1, name: 'Novice', icon: '🌱', minXP: 0, maxXP: 100 },
  { level: 2, name: 'Apprentice', icon: '🌿', minXP: 100, maxXP: 300 },
  { level: 3, name: 'Practitioner', icon: '🌳', minXP: 300, maxXP: 600 },
  { level: 4, name: 'Expert', icon: '🌲', minXP: 600, maxXP: 1000 },
  { level: 5, name: 'Master', icon: '🎋', minXP: 1000, maxXP: 2000 },
  { level: 6, name: 'Grandmaster', icon: '🏔️', minXP: 2000, maxXP: Infinity },
] as const;

// XP rewards
export const XP_REWARDS = {
  dailyCheckIn: 10,
  eliteSession: 50,
  highSession: 25,
  mediumSession: 10,
  lowSession: 5,
  streakBonus: 5,           // Per day of streak
  achievementBase: 25,      // Base for achievements
  noSpirals: 15,            // Bonus for 0 spirals
  perfectTrust: 20,         // 100% trust pass rate
} as const;
