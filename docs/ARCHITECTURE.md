# vibe-check Architecture

**Technical guide to the vibe-check codebase**

---

## Overview

vibe-check is a TypeScript CLI tool that analyzes git history to measure AI-assisted development effectiveness. It uses semantic-free signals from commit patterns to compute metrics without reading code content.

```
┌─────────────────────────────────────────────────────────────┐
│                         CLI Layer                           │
│  cli.ts → Commander.js commands → User interface            │
├─────────────────────────────────────────────────────────────┤
│                       Commands Layer                        │
│  analyze │ watch │ profile │ start │ intervene │ init-hook  │
├─────────────────────────────────────────────────────────────┤
│                        Core Layer                           │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │   Metrics   │  │   Scoring   │  │  Sessions   │        │
│  │  Engine     │  │   Engine    │  │  Manager    │        │
│  └─────────────┘  └─────────────┘  └─────────────┘        │
├─────────────────────────────────────────────────────────────┤
│                    Gamification Layer                       │
│  XP │ Streaks │ Achievements │ Challenges │ Leaderboards   │
├─────────────────────────────────────────────────────────────┤
│                       Output Layer                          │
│  Terminal (chalk) │ JSON │ Markdown                         │
├─────────────────────────────────────────────────────────────┤
│                      Data Layer                             │
│  Git (simple-git) │ Profile (.vibe-check/) │ Leaderboards  │
└─────────────────────────────────────────────────────────────┘
```

---

## Directory Structure

```
src/
├── cli.ts                 # Entry point, Commander.js setup
├── git.ts                 # Git operations (simple-git wrapper)
├── types.ts               # Core TypeScript interfaces
│
├── commands/              # CLI command implementations
│   ├── index.ts           # Command exports
│   ├── analyze.ts         # Main analysis command
│   ├── watch.ts           # Real-time monitoring
│   ├── profile.ts         # Gamification profile
│   ├── start.ts           # Session workflow
│   ├── intervene.ts       # Intervention tracking
│   └── init-hook.ts       # Git hook installation
│
├── metrics/               # Metric calculations
│   ├── index.ts           # Orchestrates all metrics
│   ├── velocity.ts        # Iteration velocity
│   ├── rework.ts          # Rework ratio
│   ├── trust.ts           # Trust pass rate
│   ├── spirals.ts         # Debug spiral detection
│   ├── flow.ts            # Flow efficiency
│   ├── file-churn.ts      # File churn patterns
│   ├── time-spiral.ts     # Time-based spirals
│   ├── velocity-anomaly.ts # Velocity deviation
│   └── code-stability.ts  # Code survival rate
│
├── score/                 # VibeScore computation
│   ├── index.ts           # Score orchestration
│   └── weights.ts         # Metric weights
│
├── sessions/              # Session management
│   └── index.ts           # Session detection, baseline
│
├── gamification/          # Gamification system
│   ├── index.ts           # Exports
│   ├── types.ts           # Gamification interfaces
│   ├── xp.ts              # XP calculation, levels
│   ├── streaks.ts         # Streak tracking
│   ├── achievements.ts    # Achievement definitions
│   ├── challenges.ts      # Weekly challenges
│   ├── leaderboards.ts    # Personal high scores
│   ├── hall-of-fame.ts    # Personal records
│   ├── stats.ts           # Weekly stats, sparklines
│   ├── badges.ts          # Rank badges
│   ├── share.ts           # Shareable profiles
│   ├── profile.ts         # Profile persistence
│   ├── pattern-memory.ts  # Spiral trigger tracking
│   └── intervention-memory.ts # What breaks spirals
│
└── output/                # Output formatters
    ├── index.ts           # Format router
    ├── terminal.ts        # Colored terminal output
    ├── json.ts            # JSON output
    └── markdown.ts        # Markdown output
```

---

## Core Data Flow

### Analysis Pipeline

```
Git History → Parse Commits → Calculate Metrics → Compute Score → Format Output
     │              │                │                  │              │
simple-git     git.ts          metrics/*           score/*       output/*
```

### Detailed Flow

1. **Git Extraction** (`git.ts`)
   - Uses `simple-git` to query commit history
   - Parses commit messages for type (feat/fix/docs/etc.) and scope
   - Returns array of `Commit` objects

2. **Metric Calculation** (`metrics/index.ts`)
   - Each metric module receives commits array
   - Calculates value, assigns rating (elite/high/medium/low)
   - Returns `MetricResult` with value, unit, rating, description

3. **Score Computation** (`score/index.ts`)
   - Combines semantic-free metrics with weights
   - Produces 0-100 VibeScore

4. **Gamification Update** (`gamification/`)
   - Records session to profile
   - Updates XP, streaks, achievements
   - Checks challenge progress

5. **Output Formatting** (`output/`)
   - Routes to terminal/JSON/markdown formatter
   - Applies colors, tables, structure

---

## Key Interfaces

### Core Types (`types.ts`)

```typescript
// Commit from git history
interface Commit {
  hash: string;
  date: Date;
  message: string;
  type: 'feat' | 'fix' | 'docs' | 'chore' | 'refactor' | 'test' | 'style' | 'other';
  scope: string | null;
  author: string;
}

// Result from a metric calculation
interface MetricResult {
  value: number;
  unit: string;
  rating: Rating;  // 'elite' | 'high' | 'medium' | 'low'
  description: string;
}

// Debug spiral (fix chain)
interface FixChain {
  component: string;
  commits: number;
  duration: number;  // minutes
  isSpiral: boolean;
  pattern: string | null;  // SECRETS_AUTH, VOLUME_CONFIG, etc.
  firstCommit: Date;
  lastCommit: Date;
}

// Complete analysis result
interface VibeCheckResult {
  period: { from: Date; to: Date; activeHours: number };
  commits: { total: number; feat: number; fix: number; docs: number; other: number };
  metrics: {
    iterationVelocity: MetricResult;
    reworkRatio: MetricResult;
    trustPassRate: MetricResult;
    debugSpiralDuration: MetricResult;
    flowEfficiency: MetricResult;
  };
  fixChains: FixChain[];
  patterns: PatternSummary;
  overall: OverallRating;  // 'ELITE' | 'HIGH' | 'MEDIUM' | 'LOW'
}
```

### Gamification Types (`gamification/types.ts`)

```typescript
// User profile stored in .vibe-check/profile.json
interface UserProfile {
  version: string;
  createdAt: string;
  updatedAt: string;
  streak: StreakState;
  xp: XPState;
  achievements: Achievement[];
  sessions: SessionRecord[];
  patternMemory?: PatternMemory;
  interventionMemory?: InterventionMemory;
  challenges?: Challenge[];
  preferences: { weeklyGoal: number; showNotifications: boolean; publicProfile: boolean };
  stats: { totalSessions: number; totalCommitsAnalyzed: number; avgVibeScore: number; ... };
}

// XP and level state
interface XPState {
  total: number;
  level: number;           // 1-6
  levelName: string;       // "Novice" to "Grandmaster"
  currentLevelXP: number;
  nextLevelXP: number;
  lastSessionXP: number;
  prestigeTier?: number;   // 1-5 for prestige levels
  prestigeName?: string;
}

// Streak tracking
interface StreakState {
  current: number;
  longest: number;
  lastActiveDate: string;
  weeklyGoal: number;
  weeklyProgress: number;
  freezesRemaining: number;
}
```

---

## Metric Calculations

### The 5 Core Metrics

| Metric | File | Formula | Elite Threshold |
|--------|------|---------|-----------------|
| Iteration Velocity | `velocity.ts` | `commits / activeHours` | >5/hr |
| Rework Ratio | `rework.ts` | `fixCommits / totalCommits` | <30% |
| Trust Pass Rate | `trust.ts` | `(1 - immediateFixRate)` | >95% |
| Debug Spiral Duration | `spirals.ts` | `avgSpiralMinutes` | <15m |
| Flow Efficiency | `flow.ts` | `buildTime / totalTime` | >90% |

### Semantic-Free Metrics (Advanced)

| Metric | File | What It Measures |
|--------|------|------------------|
| File Churn | `file-churn.ts` | % files touched multiple times |
| Time Spiral | `time-spiral.ts` | Rapid-fire commits on same files |
| Velocity Anomaly | `velocity-anomaly.ts` | Z-score vs personal baseline |
| Code Stability | `code-stability.ts` | % of added lines that survive |

### VibeScore Computation

```typescript
// score/weights.ts
const DEFAULT_WEIGHTS = {
  fileChurn: 0.30,       // Strongest signal
  timeSpiral: 0.25,      // Frustrated iteration
  velocityAnomaly: 0.20, // Unusual patterns
  codeStability: 0.25,   // Long-term quality
};

// VibeScore = weighted sum of normalized metrics
vibeScore = (fileChurn * 0.30) + (timeSpiral * 0.25) +
            (velocityAnomaly * 0.20) + (codeStability * 0.25)
```

---

## Debug Spiral Detection

### Algorithm (`spirals.ts`)

1. Group commits by scope/component
2. Find consecutive fix commits (type='fix')
3. If 3+ fixes within 30 minutes → spiral detected
4. Classify pattern based on keywords:

```typescript
const SPIRAL_PATTERNS = {
  SECRETS_AUTH: ['oauth', 'token', 'secret', 'credential', 'auth'],
  API_MISMATCH: ['api', 'version', 'schema', 'endpoint'],
  VOLUME_CONFIG: ['volume', 'mount', 'pvc', 'permission'],
  SSL_TLS: ['ssl', 'tls', 'cert', 'https'],
  IMAGE_REGISTRY: ['image', 'pull', 'registry', 'container'],
  GITOPS_DRIFT: ['sync', 'reconcile', 'drift', 'argocd'],
};
```

---

## Gamification System

### XP Rewards

```typescript
// gamification/types.ts
const XP_REWARDS = {
  dailyCheckIn: 10,
  eliteSession: 50,
  highSession: 25,
  mediumSession: 10,
  lowSession: 5,
  streakBonus: 5,        // Per day of streak
  achievementBase: 25,
  noSpirals: 15,
  perfectTrust: 20,
};
```

### Level Progression

| Level | Name | XP Required | Icon |
|-------|------|-------------|------|
| 1 | Novice | 0-100 | 🌱 |
| 2 | Apprentice | 100-300 | 🌿 |
| 3 | Practitioner | 300-600 | 🌳 |
| 4 | Expert | 600-1000 | 🌲 |
| 5 | Master | 1000-2000 | 🎋 |
| 6 | Grandmaster | 2000-5000 | 🏔️ |

### Prestige Tiers (After Grandmaster)

| Tier | Name | XP Required | Icon |
|------|------|-------------|------|
| 1 | Archmage | 5000-10000 | 🔮 |
| 2 | Sage | 10000-20000 | 📿 |
| 3 | Zenmester | 20000-40000 | ☯️ |
| 4 | Transcendent | 40000-80000 | 🌟 |
| 5 | Legendary | 80000+ | 💫 |

### Achievements (`achievements.ts`)

19 achievements across categories:
- **Streak**: First Blood, Week Warrior, Streak Master, etc.
- **Score**: Elite Vibes, Trust Builder, Zen Master, etc.
- **Sessions**: Getting Started, Centurion, Marathon Coder
- **Special**: Night Owl, Early Bird, Weekend Warrior, Comeback Kid

---

## Data Persistence

### Profile Storage

```
~/.vibe-check/           # Global (cross-repo)
├── profile.json         # User profile
└── leaderboards.json    # Personal high scores

.vibe-check/             # Per-repo (optional)
└── profile.json         # Repo-specific profile
```

### Profile Migration

Profiles auto-migrate when schema changes:
- Version stored in `profile.version`
- New fields added with defaults
- Old data preserved

---

## Dependencies

| Package | Purpose | Version |
|---------|---------|---------|
| `commander` | CLI framework | ^14.0.0 |
| `simple-git` | Git operations | ^3.30.0 |
| `chalk` | Terminal colors | ^4.1.2 |
| `date-fns` | Date manipulation | ^4.1.0 |
| `enquirer` | Interactive prompts | ^2.4.1 |

### Dev Dependencies

| Package | Purpose |
|---------|---------|
| `typescript` | Type checking |
| `vitest` | Testing |
| `ts-node` | Dev execution |

---

## Testing

```bash
npm test              # Run all tests
npm run test:coverage # With coverage
```

### Test Structure

```
tests/
├── metrics/          # Metric calculation tests
├── gamification/     # XP, streaks, achievements tests
├── score/            # VibeScore tests
└── integration/      # End-to-end tests
```

---

## Build & Publish

```bash
npm run build         # Compile TypeScript
npm run dev           # Run with ts-node
npm test              # Run tests
npm publish           # Publish to npm (runs prepublishOnly)
```

### prepublishOnly Hook

```json
"prepublishOnly": "npm run build && npm test"
```

Ensures code compiles and tests pass before every publish.

---

## Extension Points

### Adding a New Metric

1. Create `src/metrics/new-metric.ts`
2. Implement function returning `MetricResult`
3. Export from `src/metrics/index.ts`
4. Add to `VibeCheckResult` type
5. Update `output/terminal.ts` to display

### Adding an Achievement

1. Add to `ACHIEVEMENTS` array in `achievements.ts`
2. Define condition function
3. Add test case

### Adding a Command

1. Create `src/commands/new-command.ts`
2. Export from `src/commands/index.ts`
3. Register in `src/cli.ts`

---

## Design Principles

1. **Semantic-Free** - Analyze patterns, not code content
2. **Privacy-First** - Never read actual source code
3. **Git-Native** - All data from git history
4. **Zero Dependencies Runtime** - No external services
5. **Offline-First** - Works without network
6. **Gamification for Engagement** - Make improvement fun

---

**Version:** 1.5.0
**Last Updated:** 2025-11-29
