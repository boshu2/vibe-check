# vibe-check Data Architecture

## Overview

vibe-check transforms **git history** into **developer productivity insights** through a multi-stage data pipeline. This document maps the complete data flow, entity relationships, and storage architecture.

---

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              DATA SOURCES                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐                │
│  │  Git Log     │     │  Git Diff    │     │  Git Status  │                │
│  │  (commits)   │     │  (changes)   │     │  (state)     │                │
│  └──────┬───────┘     └──────┬───────┘     └──────┬───────┘                │
│         │                    │                    │                         │
└─────────┼────────────────────┼────────────────────┼─────────────────────────┘
          │                    │                    │
          ▼                    ▼                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           EXTRACTION LAYER                                   │
│                              (git.ts)                                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ getCommits(repoPath, since?, until?)                                │   │
│  │   → Commit[]                                                         │   │
│  │   Parses: hash, date, message, type, scope, author                  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ getCommitStats(repoPath, since?, until?)                            │   │
│  │   → CommitStats { filesPerCommit, lineStatsPerCommit }              │   │
│  │   Parses: files changed, additions, deletions per commit           │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         TRANSFORMATION LAYER                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────┐                                                   │
│  │  SESSION DETECTION  │  (timeline.ts:detectSessions)                     │
│  │                     │                                                   │
│  │  Commit[] ──────────┼──► TimelineSession[]                              │
│  │                     │                                                   │
│  │  Algorithm:         │                                                   │
│  │  • Sort by date     │                                                   │
│  │  • 60-min gap = new │                                                   │
│  │    session          │                                                   │
│  └─────────────────────┘                                                   │
│              │                                                              │
│              ▼                                                              │
│  ┌─────────────────────┐     ┌─────────────────────────────────────────┐   │
│  │  METRICS ANALYSIS   │     │  PATTERN DETECTION                      │   │
│  │  (metrics/*)        │     │  (patterns/*)                           │   │
│  │                     │     │                                         │   │
│  │  Per session:       │     │  • Flow State (5+ non-fix, <30m gaps)  │   │
│  │  • Trust Pass Rate  │     │  • Debug Spirals (3+ fix same scope)   │   │
│  │  • Rework Ratio     │     │  • Post-Delete Sprint (velocity ↑)     │   │
│  │  • Iteration Vel.   │     │  • Thrashing (5+ touches, low net)     │   │
│  │  • Flow Efficiency  │     │  • Detours (add→delete same scope)     │   │
│  │                     │     │  • Late Night (spiral after 22:00)     │   │
│  └─────────────────────┘     └─────────────────────────────────────────┘   │
│              │                           │                                  │
│              └───────────┬───────────────┘                                  │
│                          ▼                                                  │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  AGGREGATION                                                         │   │
│  │                                                                      │   │
│  │  TimelineSession[] ──► TimelineDay[] ──► TimelineResult             │   │
│  │                                                                      │   │
│  │  Aggregates:                                                         │   │
│  │  • Day grouping (by date)                                           │   │
│  │  • Rating calculation (majority voting)                             │   │
│  │  • XP calculation (quality + commits - spirals)                     │   │
│  │  • Trend sparkline (per-day scores)                                 │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           PERSISTENCE LAYER                                  │
│                         (storage/timeline-store.ts)                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Location: .vibe-check/timeline.json (per-repository)                      │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  TimelineStore                                                       │   │
│  │  ├── version: string                                                │   │
│  │  ├── lastUpdated: ISO timestamp                                     │   │
│  │  ├── lastCommitHash: string (for incremental sync)                  │   │
│  │  │                                                                   │   │
│  │  ├── sessions: StoredSession[] (last 500)                           │   │
│  │  │   └── Deduplicated by 80% commit hash overlap                    │   │
│  │  │                                                                   │   │
│  │  ├── insights: StoredInsight[] (max 20)                             │   │
│  │  │   └── Compounding learnings (3+ occurrences trigger)             │   │
│  │  │                                                                   │   │
│  │  ├── patterns: PatternStats                                         │   │
│  │  │   ├── Flow: total, avgDuration, peakHour                         │   │
│  │  │   ├── Spirals: total, avgDuration, byComponent, byHour           │   │
│  │  │   ├── Late Night: count, avgDuration                             │   │
│  │  │   ├── Detours: total, timeLost                                   │   │
│  │  │   └── Post-Delete: count, avgVelocityIncrease                    │   │
│  │  │                                                                   │   │
│  │  └── trends: TrendData                                              │   │
│  │      ├── weekly: WeekTrend[] (last 12 weeks)                        │   │
│  │      ├── monthly: MonthTrend[] (last 6 months)                      │   │
│  │      └── improvements: week-over-week changes                       │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          PRESENTATION LAYER                                  │
│                            (output/*)                                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │   Terminal   │  │     JSON     │  │   Markdown   │  │     HTML     │    │
│  │  (default)   │  │   (--json)   │  │    (--md)    │  │   (--html)   │    │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘    │
│        │                  │                 │                 │             │
│        ▼                  ▼                 ▼                 ▼             │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                     CONSUMERS                                        │  │
│  │                                                                      │  │
│  │  • CLI (human)     • Dashboard      • Reports         • Sharing     │  │
│  │  • CI pipelines    • IDE plugins    • Documentation   • Embeds      │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Entity Relationship Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           ENTITY RELATIONSHIPS                               │
└─────────────────────────────────────────────────────────────────────────────┘

                              ┌─────────────┐
                              │   Commit    │
                              │  (Source)   │
                              ├─────────────┤
                              │ hash        │
                              │ date        │
                              │ message     │
                              │ type        │
                              │ scope       │
                              │ author      │
                              └──────┬──────┘
                                     │
                         enriched with file stats
                                     │
                                     ▼
                           ┌─────────────────┐
                           │  TimelineEvent  │
                           │   (Enriched)    │
                           ├─────────────────┤
                           │ ...commit fields│
                           │ sessionId       │
                           │ sessionPosition │
                           │ gapMinutes      │
                           │ spiralDepth     │
                           │ isRefactor      │
                           └────────┬────────┘
                                    │
                              belongs to
                                    │
                                    ▼
┌──────────────┐          ┌─────────────────┐          ┌──────────────┐
│   FixChain   │◄─────────│ TimelineSession │─────────►│  FlowState   │
│   (Spiral)   │ detected │    (Session)    │ detected │  (Pattern)   │
├──────────────┤    in    ├─────────────────┤    in    ├──────────────┤
│ component    │          │ id              │          │ detected     │
│ commits      │          │ start           │          │ duration     │
│ duration     │          │ end             │          │ commits      │
│ isSpiral     │          │ duration        │          │ avgGap       │
│ pattern      │          │ commits[]       │          └──────────────┘
└──────────────┘          │ overall         │
                          │ trustPassRate   │
                          │ reworkRatio     │
                          │ flowState       │
                          │ spirals[]       │
                          │ xpEarned        │
                          └────────┬────────┘
                                   │
                             grouped by date
                                   │
                                   ▼
                          ┌─────────────────┐
                          │   TimelineDay   │
                          │     (Day)       │
                          ├─────────────────┤
                          │ date            │
                          │ displayDate     │
                          │ sessions[]      │
                          │ dayScore        │
                          │ dayRating       │
                          │ totalCommits    │
                          │ totalDuration   │
                          │ totalXp         │
                          │ spiralCount     │
                          └────────┬────────┘
                                   │
                            aggregated into
                                   │
                                   ▼
┌──────────────────────────────────────────────────────────────────────┐
│                         TimelineResult                                │
│                      (Analysis Output)                                │
├──────────────────────────────────────────────────────────────────────┤
│ from, to                    │ Date range                             │
│ activeDays, totalDays       │ Coverage                               │
│ days[]                      │ Per-day breakdown                      │
│ sessions[]                  │ All sessions                           │
│ totalCommits                │ Aggregate counts                       │
│ totalActiveMinutes          │                                        │
│ totalFeatures, totalFixes   │                                        │
│ totalSpirals, flowStates    │ Pattern counts                         │
│ postDeleteSprint            │ Phase 2 patterns                       │
│ thrashing                   │                                        │
│ detours                     │ Phase 3 patterns                       │
│ lateNightSpirals            │                                        │
│ totalXp                     │ Gamification                           │
│ trend[]                     │ Sparkline data                         │
└──────────────────────────────────────────────────────────────────────┘
                                   │
                            persisted to
                                   │
                                   ▼
┌──────────────────────────────────────────────────────────────────────┐
│                          TimelineStore                                │
│                    (Persistent Storage)                               │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  sessions[]  ◄────── StoredSession (compressed, deduplicated)        │
│                      • 500 session limit                             │
│                      • 80% hash overlap = duplicate                  │
│                                                                      │
│  insights[]  ◄────── StoredInsight (compounding learnings)           │
│                      • Generated at 3+ occurrences                   │
│                      • 20 insight limit                              │
│                      • Categories: pattern, trend, recommendation    │
│                                                                      │
│  patterns    ◄────── PatternStats (aggregated statistics)            │
│                      • Running averages                              │
│                      • Peak hour tracking                            │
│                      • Component breakdown                           │
│                                                                      │
│  trends      ◄────── TrendData (time-series analysis)                │
│                      • 12 weeks history                              │
│                      • 6 months history                              │
│                      • Week-over-week improvements                   │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Data Schemas

### Source Layer (Git)

```typescript
// Raw git data - read-only, external source
interface GitCommit {
  hash: string;           // Full SHA
  date: string;           // ISO timestamp
  message: string;        // Full commit message
  author_name: string;    // Committer
}

interface GitDiffStat {
  additions: number;      // Lines added
  deletions: number;      // Lines removed
  file: string;           // File path
}
```

### Domain Layer (Core Types)

```typescript
// Parsed commit with semantic meaning
interface Commit {
  hash: string;           // 7-char short SHA
  date: Date;             // Parsed timestamp
  message: string;        // First line only
  type: CommitType;       // feat|fix|docs|chore|refactor|test|style|other
  scope: string | null;   // Conventional commit scope
  author: string;
}

type CommitType = 'feat' | 'fix' | 'docs' | 'chore' | 'refactor' | 'test' | 'style' | 'other';

// Enriched commit with session context
interface TimelineEvent extends Omit<Commit, 'date' | 'message'> {
  timestamp: Date;        // Renamed for clarity
  subject: string;        // Renamed for clarity
  sessionId: string;      // Parent session
  sessionPosition: number; // Order within session
  gapMinutes: number;     // Time since previous commit
  isRefactor: boolean;    // Quick type check
  spiralDepth: number;    // 0 = not in spiral, 1+ = depth in fix chain
}
```

### Analysis Layer (Computed)

```typescript
// Session: Unit of focused work
interface TimelineSession {
  id: string;
  start: Date;
  end: Date;
  duration: number;       // minutes
  commits: TimelineEvent[];

  // Computed metrics
  vibeScore: number | null;
  overall: OverallRating;
  trustPassRate: number;  // 0-100
  reworkRatio: number;    // 0-100

  // Detected patterns
  flowState: boolean;
  spirals: FixChain[];

  // Gamification
  xpEarned: number;
}

// Day: Calendar grouping of sessions
interface TimelineDay {
  date: string;           // YYYY-MM-DD
  displayDate: string;    // "Thu Nov 28"
  sessions: TimelineSession[];
  dayScore: number | null;
  dayRating: OverallRating;

  // Aggregates
  totalCommits: number;
  totalDuration: number;
  totalXp: number;
  spiralCount: number;
}

// Pattern detection results
interface FixChain {
  component: string;      // Scope that's being fixed
  commits: number;        // Fix count
  duration: number;       // minutes
  isSpiral: boolean;      // 3+ commits = spiral
  pattern: string | null; // Classified pattern type
  firstCommit: Date;
  lastCommit: Date;
}
```

### Storage Layer (Persistence)

```typescript
// Compressed session for storage
interface StoredSession {
  id: string;
  date: string;           // YYYY-MM-DD (denormalized for queries)
  start: string;          // ISO timestamp
  end: string;
  duration: number;
  commitCount: number;
  commitHashes: string[]; // For deduplication

  // Key metrics only
  overall: string;
  trustPassRate: number;
  reworkRatio: number;
  xpEarned: number;

  // Pattern flags
  flowState: boolean;
  spiralCount: number;
  spiralComponents: string[];
}

// Compounding insight
interface StoredInsight {
  id: string;
  type: 'pattern' | 'trend' | 'recommendation';
  category: string;
  message: string;
  firstSeen: string;      // ISO timestamp
  lastSeen: string;
  occurrences: number;
  metadata?: Record<string, unknown>;
}

// Aggregated pattern statistics
interface PatternStats {
  // Flow state stats
  totalFlowStates: number;
  avgFlowDuration: number;
  peakFlowHour: number;   // 0-23

  // Spiral stats
  totalSpirals: number;
  avgSpiralDuration: number;
  spiralsByComponent: Record<string, number>;
  spiralsByHour: Record<number, number>;

  // Late night stats
  lateNightSessions: number;
  lateNightAvgDuration: number;

  // Detour stats
  totalDetours: number;
  totalTimeLostToDetours: number;

  // Post-delete sprints
  postDeleteSprints: number;
  avgVelocityIncrease: number;
}
```

---

## Data Flow by Command

### `vibe-check analyze`

```
Git ──► Commits ──► Metrics Analysis ──► VibeCheckResult ──► Output
                         │
                    No persistence
```

### `vibe-check timeline`

```
Git ──► Commits ──► CommitStats ──► Sessions ──► Days ──► TimelineResult
                                       │                        │
                                  Patterns                 ┌────┴────┐
                                  detected                 ▼         ▼
                                       │              Terminal   Storage
                                       ▼                         (cache)
                               TimelineStore ◄─── updateStore()
```

### `vibe-check profile`

```
Storage ──► Profile.json ──► XP/Streaks/Achievements ──► Terminal
     ▲                                │
     │                           Updates
     └───────────────────────────────┘
```

---

## Storage Strategy

### Current: JSON Files

```
.vibe-check/
├── timeline.json    # Session history + insights + trends
├── profile.json     # XP, streaks, achievements (gamification)
└── calibration.json # Level calibration samples
```

**Pros:**
- Zero dependencies
- Git-friendly (diffable)
- Human-readable
- Works offline

**Cons:**
- No cross-repo aggregation
- Limited query capability
- File size grows unbounded (mitigated by 500 session limit)
- No concurrent access handling

### Future: SQLite

```sql
-- Cross-repo aggregation possible
-- Rich queries (WHERE, GROUP BY, etc.)
-- Proper indexing for time-range queries

~/.vibe-check/
├── vibe-check.db    # Central database
└── repos/           # Per-repo caches
```

---

## Enhancement Opportunities

### 1. **Event Sourcing Pattern**
Store raw events, compute views on demand:
```
commits.ndjson  →  Append-only log
sessions/       →  Computed views (regenerable)
```

### 2. **Cross-Repo Aggregation**
Central store for multi-repo insights:
```typescript
interface GlobalStore {
  repos: Map<string, RepoMetadata>;
  globalInsights: StoredInsight[];
  globalTrends: TrendData;
}
```

### 3. **Real-time Streaming**
WebSocket API for live dashboard:
```
Git hooks → vibe-check watch → WebSocket → Dashboard
```

### 4. **Query API**
SQL-like queries for custom analysis:
```bash
vibe-check query "sessions WHERE flowState = true AND date > '2025-11-01'"
```

---

## Key Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Session gap | 60 minutes | Based on analysis: 69% of gaps <30m, 19% >1hr |
| Spiral threshold | 3+ fixes | Industry standard for "debug loop" |
| Storage format | JSON | Zero dependencies, git-friendly |
| Session limit | 500 | ~1 year of daily coding |
| Insight threshold | 3+ occurrences | Reduces noise, surfaces patterns |
| Dedup strategy | 80% hash overlap | Handles partial overlaps |

---

## File Locations

| Component | File | Responsibility |
|-----------|------|----------------|
| Extraction | `src/git.ts` | Git operations |
| Types | `src/types.ts` | All interfaces |
| Session detection | `src/commands/timeline.ts` | Session/day grouping |
| Metrics | `src/metrics/*.ts` | Core 5 metrics |
| Patterns | `src/patterns/*.ts` | 6 pattern detectors |
| Storage | `src/storage/*.ts` | Persistence |
| Output | `src/output/*.ts` | Formatting |
