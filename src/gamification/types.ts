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
  prestigeTier?: number;     // Prestige tier (0 = none, 1-5 = Archmage to Legendary)
  prestigeName?: string;     // Prestige tier name
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

export interface SessionMetrics {
  iterationVelocity: number;   // commits/hour
  reworkRatio: number;         // % fix commits
  trustPassRate: number;       // % commits without immediate fix
  flowEfficiency: number;      // % time building vs debugging
  debugSpiralDuration: number; // avg minutes in spirals
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
  metrics?: SessionMetrics;  // Detailed metrics for dashboard (v1.7+)
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

  // Intervention memory - tracks what breaks spirals
  interventionMemory?: InterventionMemory;

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

// ============================================
// INTERVENTION TRACKING (v1.4.0)
// ============================================

// Types of interventions that can break spirals
export type InterventionType =
  | 'TRACER_TEST'    // Wrote a test to validate assumptions
  | 'BREAK'          // Took a break (detected via commit gap)
  | 'DOCS'           // Consulted documentation
  | 'REFACTOR'       // Changed approach
  | 'HELP'           // Asked for help (human or AI)
  | 'ROLLBACK'       // Reverted to known good state
  | 'OTHER';         // Custom intervention

// Individual intervention record
export interface InterventionRecord {
  type: InterventionType;
  spiralPattern?: string;     // The pattern that was being debugged
  spiralComponent?: string;   // The component involved
  spiralDuration: number;     // How long the spiral lasted (minutes)
  date: string;               // ISO date
  notes?: string;             // Optional user notes
}

// Aggregated intervention memory
export interface InterventionMemory {
  version: string;
  records: InterventionRecord[];  // Historical records (last 100)

  // Aggregated statistics
  typeCounts: Record<string, number>;           // intervention type -> count
  effectiveByPattern: Record<string, string[]>; // pattern -> [intervention types that worked]

  // Computed insights
  topInterventions: string[];    // top 3 most used intervention types
  avgTimeToIntervene: number;    // average spiral duration before intervention
  totalInterventions: number;
}

// Level progression (including prestige)
export const LEVELS = [
  { level: 1, name: 'Novice', icon: '🌱', minXP: 0, maxXP: 100 },
  { level: 2, name: 'Apprentice', icon: '🌿', minXP: 100, maxXP: 300 },
  { level: 3, name: 'Practitioner', icon: '🌳', minXP: 300, maxXP: 600 },
  { level: 4, name: 'Expert', icon: '🌲', minXP: 600, maxXP: 1000 },
  { level: 5, name: 'Master', icon: '🎋', minXP: 1000, maxXP: 2000 },
  { level: 6, name: 'Grandmaster', icon: '🏔️', minXP: 2000, maxXP: 5000 },
] as const;

// Prestige tiers (after Grandmaster)
export const PRESTIGE_TIERS = [
  { tier: 1, name: 'Archmage', icon: '🔮', minXP: 5000, maxXP: 10000 },
  { tier: 2, name: 'Sage', icon: '📿', minXP: 10000, maxXP: 20000 },
  { tier: 3, name: 'Zenmester', icon: '☯️', minXP: 20000, maxXP: 40000 },
  { tier: 4, name: 'Transcendent', icon: '🌟', minXP: 40000, maxXP: 80000 },
  { tier: 5, name: 'Legendary', icon: '💫', minXP: 80000, maxXP: Infinity },
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
