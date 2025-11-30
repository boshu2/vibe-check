# Insight Mining & Dashboard Research

**Type:** Research
**Created:** 2025-11-30
**Loop:** Middle (dashboard implementation) / Outer (insight system design)
**Tags:** dashboard, insights, visualization, chart.js

---

## Executive Summary

vibe-check has rich data across 5 storage files with 20+ metrics. A static HTML dashboard exists but uses mock data. The opportunity is to: (1) create an insight generation engine that surfaces actionable patterns, and (2) connect the existing dashboard to real data with real-time updates.

## Problem Statement

**Current state:**
- Rich data in `.vibe-check/` (profile, sessions, timeline, commits, calibration)
- Global profile at `~/.vibe-check/profile.json`
- Static dashboard shell exists with Chart.js integration
- Insights are scattered across commands (timeline --insights, profile, analyze --all-time)

**Gap:**
- No unified insight engine
- Dashboard shows mock data, not real data
- No insight prioritization or severity
- No progressive disclosure (surface → deep)

## Data Inventory

### Storage Files (per-repo: `.vibe-check/`)

| File | Format | Contents | Size |
|------|--------|----------|------|
| `timeline.json` | JSON | Sessions, trends, patterns, insights | ~8KB |
| `commits.ndjson` | NDJSON | All analyzed commits | ~8KB (55 commits) |
| `sessions.json` | JSON | Session history with baseline | ~2KB |
| `calibration.json` | JSON | Vibe level calibration samples | ~0.5KB |
| `latest.json` | JSON | Last analysis result | ~2KB |

### Global Storage (`~/.vibe-check/`)

| File | Contents |
|------|----------|
| `profile.json` | XP, level, streak, achievements, sessions, patterns, interventions |

### Available Metrics (20+)

**Core 5 Metrics:**
1. Iteration Velocity (commits/hour)
2. Rework Ratio (% fix commits)
3. Trust Pass Rate (% commits without immediate fix)
4. Debug Spiral Duration (avg time in fix chains)
5. Flow Efficiency (% time building vs debugging)

**Semantic-Free Metrics:**
6. File Churn Score
7. Time Spiral Score
8. Velocity Anomaly Score
9. Code Stability Score

**Session Metrics:**
10. VibeScore (0-100)
11. Overall Rating (ELITE/HIGH/MEDIUM/LOW)
12. Spiral Count
13. Flow State Detection
14. Session Duration
15. Feature Count

**Trend Metrics:**
16. Week-over-week improvements
17. Regression alerts
18. Recovery time trends
19. Pattern frequency
20. Intervention effectiveness

## Option Space Explored

### Approach A: Insight Engine Module

Create `src/insights/` module that generates prioritized insights from all data sources.

**Pros:**
- Clean separation of concerns
- Reusable across commands and dashboard
- Can run headless (CLI) or serve dashboard
- Testable insight generation logic

**Cons:**
- New module to maintain
- Need to define insight schema
- Requires aggregation logic

**Effort:** Medium (2-3 sessions)

### Approach B: Dashboard API Server

Add express/fastify server that serves insight API endpoints.

**Pros:**
- Real-time updates via polling or WebSocket
- Dashboard fully decoupled from CLI
- Could support multiple dashboards

**Cons:**
- Requires running server process
- More complex deployment
- Overkill for local-first tool

**Effort:** High (4-5 sessions)

### Approach C: Static JSON Export + Dashboard

CLI exports `dashboard-data.json` → static dashboard reads it.

**Pros:**
- Simplest architecture
- No server needed
- Works offline
- Dashboard is just HTML/CSS/JS

**Cons:**
- Manual refresh (run CLI to update)
- No real-time
- Two-step workflow

**Effort:** Low (1-2 sessions)

### Approach D: Hybrid (Recommended)

Insight engine module + `vibe-check dashboard` command that:
1. Exports data to JSON
2. Opens browser to static dashboard
3. Optional: watches for changes and auto-refreshes

**Pros:**
- Best of A and C
- Single command UX
- No server complexity
- Can evolve to server later

**Cons:**
- File-based refresh
- Limited real-time capability

**Effort:** Medium (2-3 sessions)

## Recommended Approach: Hybrid (D)

### Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    CLI Commands                          │
│  analyze, timeline, profile, dashboard                   │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│               Insight Engine                             │
│  src/insights/                                           │
│  ├── generator.ts    (generate insights from data)       │
│  ├── prioritizer.ts  (rank by severity/actionability)    │
│  ├── types.ts        (Insight, InsightCategory)          │
│  └── index.ts                                            │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│               Dashboard Data Export                      │
│  src/commands/dashboard.ts                               │
│  - Aggregates all data sources                           │
│  - Generates prioritized insights                        │
│  - Exports dashboard-data.json                           │
│  - Opens browser to dashboard/index.html                 │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│               Static Dashboard                           │
│  dashboard/                                              │
│  ├── index.html     (existing, needs data binding)       │
│  ├── app.js         (load dashboard-data.json)           │
│  └── styles.css     (existing)                           │
└─────────────────────────────────────────────────────────┘
```

### Insight Schema

```typescript
interface Insight {
  id: string;
  category: 'productivity' | 'patterns' | 'growth' | 'warning' | 'celebration';
  severity: 'info' | 'warning' | 'critical' | 'success';
  title: string;
  message: string;
  metric?: string;
  value?: number;
  comparison?: {
    type: 'baseline' | 'previous' | 'goal';
    value: number;
    change: number;
  };
  action?: string;        // Recommended action
  source: string;         // Where insight came from
  timestamp: string;
}
```

### Insight Categories

| Category | Examples |
|----------|----------|
| **Productivity** | "Peak hours are 9-11am", "Best day is Thursday" |
| **Patterns** | "Auth scope has 60% fix ratio", "Flow states cluster in mornings" |
| **Growth** | "2-week improvement streak", "Trust rate up 15%" |
| **Warning** | "Spiral regression detected", "Late night sessions increasing" |
| **Celebration** | "New personal best!", "Achievement unlocked" |

### Insight Generation Rules

```typescript
// Example insight generators
const insightGenerators = [
  // Productivity
  { name: 'peakHours', source: 'commits', fn: analyzePeakHours },
  { name: 'bestDay', source: 'sessions', fn: findBestDayOfWeek },
  { name: 'flowTiming', source: 'timeline', fn: analyzeFlowTiming },

  // Patterns
  { name: 'problematicScopes', source: 'commits', fn: findProblematicScopes },
  { name: 'spiralPatterns', source: 'profile.patternMemory', fn: analyzePatterns },
  { name: 'thrashingFiles', source: 'timeline', fn: findThrashingFiles },

  // Growth
  { name: 'improvementStreak', source: 'timeline.trends', fn: detectImprovementStreak },
  { name: 'metricTrends', source: 'sessions', fn: calculateTrends },
  { name: 'levelProgress', source: 'profile', fn: showLevelProgress },

  // Warnings
  { name: 'regressionAlert', source: 'timeline.trends', fn: detectRegressions },
  { name: 'lateNightWarning', source: 'commits', fn: detectLateNightPattern },
  { name: 'streakAtRisk', source: 'profile', fn: checkStreakRisk },

  // Celebrations
  { name: 'personalBest', source: 'sessions', fn: checkPersonalBest },
  { name: 'newAchievement', source: 'profile', fn: getRecentAchievements },
  { name: 'milestone', source: 'profile', fn: checkMilestones },
];
```

### Dashboard Data Export Format

```typescript
interface DashboardData {
  version: string;
  generatedAt: string;

  // Profile summary
  profile: {
    level: number;
    levelName: string;
    xp: { current: number; next: number; total: number };
    streak: { current: number; longest: number };
    achievements: Achievement[];
  };

  // Stats
  stats: {
    current: { vibeScore: number; rating: string };
    averages: { day7: number; day30: number; day90: number };
    totals: { sessions: number; commits: number; spirals: number };
  };

  // Charts data
  charts: {
    scoreTrend: Array<{ date: string; score: number }>;
    ratingDistribution: Record<string, number>;
    metricsRadar: Record<string, number>;
    hourlyActivity: Record<number, number>;
    scopeHealth: Array<{ scope: string; commits: number; fixRatio: number }>;
  };

  // Prioritized insights
  insights: Insight[];

  // Sessions history
  sessions: SessionRecord[];
}
```

### Dashboard Features (Priority Order)

**P0 - Core (v1.6.0):**
1. Connect to real data (read dashboard-data.json)
2. Show prioritized insights
3. Update existing charts with real data
4. `vibe-check dashboard` command

**P1 - Enhanced (v1.7.0):**
5. Auto-refresh on file change (fswatch or similar)
6. Dark/light theme toggle
7. Time range selector (7d, 30d, 90d, all-time)
8. Export/share functionality

**P2 - Advanced (v2.0.0):**
9. Real-time via WebSocket server
10. Multi-repo aggregation
11. Goal setting and tracking
12. Custom insight rules

## Tracer Tests Required

| Assumption | Tracer Test | Time | Validates |
|------------|-------------|------|-----------|
| Dashboard can read local JSON | Create test JSON, load in browser | 10m | File:// protocol works |
| Chart.js handles our data shape | Mock data in current format | 15m | No schema issues |
| `open` command works cross-platform | Test on macOS | 5m | Browser opening |

**Total tracer investment:** 30 minutes
**Risk if skipped:** Dashboard may not load data correctly

## Failure Pattern Risks

| Pattern | Risk Level | Mitigation |
|---------|------------|------------|
| Context Amnesia | Low | Bundle captures full design |
| Scope Creep | Medium | Strict P0/P1/P2 prioritization |
| Over-engineering | Medium | Start with static JSON, evolve |

## PDC Strategy

- **Prevent:** Clear scope definition, phased approach
- **Detect:** Manual testing after each phase
- **Correct:** Revert to simpler approach if complexity grows

## Implementation Plan (Phase 1: P0)

### Step 1: Create Insight Engine (40m)
```
src/insights/
├── types.ts         - Insight interface, categories
├── generator.ts     - Insight generation functions
├── prioritizer.ts   - Sort by severity, recency
└── index.ts         - Main export
```

### Step 2: Create Dashboard Command (30m)
```
src/commands/dashboard.ts
- Load all data sources
- Generate insights via engine
- Export dashboard-data.json to dashboard/
- Open browser to dashboard/index.html
```

### Step 3: Update Dashboard App (45m)
```
dashboard/app.js
- Replace getMockProfile() with fetch('dashboard-data.json')
- Map data to existing UI components
- Add insights section
- Handle loading states
```

### Step 4: Add Insights UI (30m)
```
dashboard/index.html
- Add insights panel/section
- Style insight cards by severity
- Add insight icons by category
```

### Step 5: Test & Polish (25m)
- Test full flow: CLI → JSON → Dashboard
- Fix any data mapping issues
- Ensure charts render correctly

**Total estimated time:** ~3 hours

## Open Questions

- [ ] Should dashboard auto-open on every `timeline` run? (Probably no)
- [ ] Support custom dashboard port for local server mode? (Future)
- [ ] Include raw data export option? (Maybe --export-data flag)

## Token Stats

- Research tokens: ~25k
- Bundle tokens: ~4k
- Compression ratio: 6:1

---

## Sources

- [Jellyfish Developer Productivity Dashboard](https://jellyfish.co/library/developer-productivity/dashboard/)
- [Tinybird Real-Time Dashboard Guide](https://www.tinybird.co/blog-posts/real-time-dashboard-step-by-step)
- [Building Real-Time Dashboards with JavaScript](https://softwarehouse.au/blog/building-real-time-dashboards-with-javascript-frameworks-a-practical-tutorial/)
- [Luzmo Data Visualization Trends](https://www.luzmo.com/blog/data-visualization-trends)
- [Dashboard UI/UX Design Guidelines 2024](https://www.qdexitechnology.com/blog/the-top-10-essential-dashboard-ui-ux-design-guidelines-for-2024)
