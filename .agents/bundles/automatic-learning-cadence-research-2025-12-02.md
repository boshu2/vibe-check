# Automatic Learning & Retrospective Cadence Research

**Type:** Research
**Created:** 2025-12-02
**Loop:** Outer (architecture decision)
**Tags:** learning-loop, retrospective, cadence, spaced-repetition, behavioral-nudges

---

## Executive Summary

vibe-check currently has rich learning infrastructure (pattern memory, intervention tracking, insights) but relies entirely on **manual triggers**. The opportunity is to implement **automatic cadence-based learning** inspired by spaced repetition and behavioral nudge systems, transforming passive data collection into active system improvement.

**Key insight:** The data is already being collected. What's missing is the **trigger mechanism** to surface learnings and force the system to learn from accumulated patterns.

---

## Problem Statement

**Current state:**
- Pattern memory accumulates spiral data → requires manual review via `profile --stats`
- Intervention memory tracks what works → never surfaces recommendations automatically
- Insights generate on dashboard export → stale unless manually refreshed
- ML calibration (planned in ml-learning-loop bundle) → requires explicit `--calibrate` flag
- No periodic retrospective forcing function

**Gap:** The system learns passively but never **acts** on learnings without user intervention.

**Goal:** Implement automatic learning cadence that:
1. Triggers learning at natural breakpoints (session boundaries, time-based)
2. Surfaces insights proactively (nudges)
3. Retrains models without explicit user action
4. Forces periodic retrospectives to prevent staleness

---

## Current Learning Mechanisms Inventory

### Data Collection (Passive - Working)

| Mechanism | Location | Data Collected | Current Trigger |
|-----------|----------|----------------|-----------------|
| **Pattern Memory** | `profile.patternMemory` | Spiral patterns, components, durations | `recordSession()` via analyze |
| **Intervention Memory** | `profile.interventionMemory` | What breaks spirals | `vibe-check intervene` (manual) |
| **Session History** | `profile.sessions` | 100 most recent sessions | `recordSession()` |
| **Timeline Store** | `.vibe-check/timeline.json` | Sessions, insights, trends | `vibe-check timeline` |
| **Commit Log** | `.vibe-check/commits.ndjson` | Append-only commit history | `vibe-check timeline` |
| **Calibration** | `.vibe-check/calibration.json` | Level prediction samples | `--calibrate N` flag |

### Learning/Insight Generation (Partially Active)

| Mechanism | Location | What It Does | Current Trigger |
|-----------|----------|--------------|-----------------|
| **Insight Generators** | `src/insights/generators.ts` | 9 insight types | Dashboard data export |
| **Trend Calculation** | `timeline-store.ts` | Weekly/monthly trends | Timeline command |
| **Compounding Insights** | `timeline-store.ts` | Pattern-based insights | Timeline command |
| **Baseline Comparison** | `sessions/index.ts` | Compare to personal baseline | Analyze command |

### Model Training (Planned - Not Implemented)

| Mechanism | Bundle | What It Does | Current State |
|-----------|--------|--------------|---------------|
| **partialFit** | ml-learning-loop | Incremental model updates | Not implemented |
| **retrain** | ml-learning-loop | Full model retraining | Not implemented |
| **ECE threshold** | ml-learning-loop | Trigger retraining | Not implemented |

---

## Natural Trigger Points (Already In Code)

### 1. Session Boundary (analyze.ts:248-311)
**When:** Every `vibe-check` with `--score` or sufficient commits
**Current behavior:** Records session, updates profile, shows gamification
**Opportunity:** Perfect point for post-session micro-learning

### 2. Streak Update (streaks.ts)
**When:** First session of the day
**Current behavior:** Increments streak, shows fire emoji
**Opportunity:** Daily check-in for retrospective prompt

### 3. Timeline Analysis (timeline.ts)
**When:** `vibe-check timeline` command
**Current behavior:** Detects patterns, updates store
**Opportunity:** Already computes insights - just need to surface them

### 4. Dashboard Export (dashboard.ts)
**When:** `vibe-check dashboard` command
**Current behavior:** Generates JSON data file
**Opportunity:** Trigger learning before export to ensure fresh data

---

## External Research: Cadence Patterns

### Spaced Repetition (FSRS Algorithm)
- [FSRS](https://domenic.me/fsrs/) reduces reviews 20% while maintaining retention
- Key insight: **Test just before forgetting** = review when probability drops to 90%
- **Application:** Surface learnings when patterns start to decay (e.g., 7 days since last spiral)

### Behavioral Nudges
- [AI behavioral nudging](https://aicompetence.org/ai-in-behavioral-nudging-apps-that-change-habits/) uses **micro nudges** that feel like intuition
- Adaptive reminders track patterns to time cues perfectly
- [Habit tracking apps](https://emizentech.com/blog/habit-tracking-app.html) use cue-routine-reward loop

### Team Retrospective Tools
- [Sprint retrospectives](https://www.atlassian.com/agile/scrum/retrospectives) recommend 45 min per week of iteration
- [RetroCadence](https://www.scrumexpert.com/tools/retrocadence-the-best-retrospective-tool-for-agile-teams/) emphasizes regular cadence is key
- [CodeAnt AI](https://www.codeant.ai/blogs/developer-productivity-platform) sets weekly summaries by default

### Key Cadence Patterns from Research

| Cadence | Purpose | Example |
|---------|---------|---------|
| **Per-session** | Immediate feedback | Post-analyze micro-learning |
| **Daily** | Streak maintenance | First-of-day nudge |
| **Weekly** | Pattern review | Sunday retrospective prompt |
| **N-sample** | Model improvement | Retrain every 10 calibration samples |
| **Threshold** | Quality maintenance | Retrain when ECE > 0.15 |

---

## Proposed Architecture: Learning Cadence System

### Core Components

```
┌─────────────────────────────────────────────────────────────┐
│                  AUTOMATIC LEARNING SYSTEM                   │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              CADENCE SCHEDULER                        │   │
│  │                                                        │   │
│  │  Time-based triggers:                                 │   │
│  │    • Daily (first session)                            │   │
│  │    • Weekly (7 days since last retro)                 │   │
│  │    • Monthly (trend analysis)                         │   │
│  │                                                        │   │
│  │  Event-based triggers:                                │   │
│  │    • Post-session (every analyze --score)             │   │
│  │    • Threshold (ECE > 0.15, samples >= 10)           │   │
│  │    • Pattern (same spiral pattern 3x)                 │   │
│  │                                                        │   │
│  └──────────────────────────────────────────────────────┘   │
│                          │                                   │
│                          ▼                                   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              LEARNING EXECUTOR                        │   │
│  │                                                        │   │
│  │  Actions:                                             │   │
│  │    • updatePatternAggregates()                        │   │
│  │    • retrainModel() if threshold met                  │   │
│  │    • generateInsights()                               │   │
│  │    • surfaceNudge() if actionable                     │   │
│  │    • promptRetrospective() if due                     │   │
│  │                                                        │   │
│  └──────────────────────────────────────────────────────┘   │
│                          │                                   │
│                          ▼                                   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              NUDGE SYSTEM                             │   │
│  │                                                        │   │
│  │  Output channels:                                     │   │
│  │    • CLI hint after analyze                           │   │
│  │    • Dashboard notification                           │   │
│  │    • Profile summary section                          │   │
│  │                                                        │   │
│  │  Nudge types:                                         │   │
│  │    • Pattern warning (e.g., "SSL issues 3x this week")│   │
│  │    • Intervention suggestion (e.g., "Try tracer test")│   │
│  │    • Retrospective due (e.g., "Weekly review time")   │   │
│  │    • Achievement close (e.g., "2 more for streak 7")  │   │
│  │                                                        │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Storage: Learning State

**New file:** `~/.vibe-check/learning-state.json`

```typescript
interface LearningState {
  version: string;

  // Cadence tracking
  lastDailyCheck: string;        // ISO date
  lastWeeklyRetro: string;       // ISO date
  lastMonthlyReview: string;     // ISO date
  lastModelRetrain: string;      // ISO datetime

  // Threshold tracking
  calibrationSamplesSinceRetrain: number;
  currentECE: number;

  // Nudge queue (FIFO, max 5)
  pendingNudges: Nudge[];

  // Retrospective state
  retroDue: boolean;
  retroDueReason: string;
  lastRetroSummary?: RetroSummary;
}

interface Nudge {
  id: string;
  type: 'pattern' | 'intervention' | 'retro' | 'achievement' | 'learning';
  message: string;
  action?: string;
  priority: number;
  createdAt: string;
  expiresAt?: string;
  dismissed?: boolean;
}

interface RetroSummary {
  date: string;
  topPattern: string;
  topIntervention: string;
  keyInsight: string;
  actionTaken?: string;
}
```

---

## Implementation Approaches

### Approach A: Hook into `recordSession()` (Recommended)

**Where:** `src/gamification/profile.ts:148-269`

**Advantages:**
- Single integration point - already called by `analyze --score`
- Has access to all relevant data (fix chains, metrics, session record)
- Already performs learning (pattern memory, XP, achievements)
- Natural post-session moment for nudges

**Implementation:**
```typescript
// At end of recordSession(), add:
const learningResult = runLearningCadence(profile, sessionRecord, fixChains);
if (learningResult.nudge) {
  // Store nudge for display
}
if (learningResult.shouldRetrain) {
  // Trigger model retraining
}
if (learningResult.retroDue) {
  // Mark retrospective as due
}
```

**Risk:** Adds latency to every analyze command
**Mitigation:** Keep learning checks lightweight, defer heavy operations

### Approach B: Separate `learn` Command

**Where:** New `src/commands/learn.ts`

**Advantages:**
- Explicit user control
- Can be run independently
- No latency impact on analyze

**Disadvantages:**
- Still manual trigger
- Won't be run unless reminded

**Implementation:**
```bash
vibe-check learn           # Run all learning operations
vibe-check learn --retro   # Force retrospective
vibe-check learn --retrain # Force model retraining
```

### Approach C: Background Learning (Advanced)

**Where:** Filesystem watcher or git hook

**Advantages:**
- Truly automatic
- No CLI latency impact

**Disadvantages:**
- Complex implementation
- Platform-dependent (macOS launchd, cron, etc.)
- May feel intrusive

**Not recommended for v1.**

---

## Recommended Approach: Hybrid A+B

1. **Automatic triggers in `recordSession()`** for lightweight operations:
   - Check if daily nudge due → queue nudge
   - Check if weekly retro due → queue retro prompt
   - Check if pattern threshold met → queue warning
   - Check if model retrain needed → trigger retrain (async)

2. **Explicit `learn` command** for heavy operations:
   - Force retrospective with summary
   - Force model retraining
   - Export learnings to bundle
   - Generate learning report

3. **Nudge display in CLI output** (analyze.ts):
   - After gamification section, show pending nudges
   - "💡 TIP: Your top spiral trigger is SSL_TLS - consider adding cert checks"
   - "📅 Weekly retro due - run `vibe-check learn --retro`"

---

## Cadence Rules (Default Configuration)

| Trigger | Condition | Action |
|---------|-----------|--------|
| **Post-session** | Every `analyze --score` | Queue pattern warnings, achievement hints |
| **Daily** | First session of day | Show streak status, yesterday's summary |
| **Weekly** | 7+ days since last retro | Queue retro prompt, show top patterns |
| **Threshold: ECE** | ECE > 0.15 | Queue retrain prompt |
| **Threshold: Samples** | 10+ samples since retrain | Auto-retrain model |
| **Pattern: Repeat** | Same spiral pattern 3x in 7 days | Queue intervention suggestion |
| **Achievement: Close** | <20% XP to level or achievement | Queue motivation nudge |

---

## New Files to Create

### 1. `src/learning/cadence.ts`
Core cadence scheduler and learning executor

### 2. `src/learning/nudges.ts`
Nudge generation, queuing, and display

### 3. `src/learning/retrospective.ts`
Weekly/monthly retrospective logic

### 4. `src/learning/types.ts`
LearningState, Nudge, RetroSummary types

### 5. `src/commands/learn.ts`
Explicit learn command

---

## Files to Modify

### 1. `src/gamification/profile.ts`
- Add learning cadence check at end of `recordSession()`
- Import and call `runLearningCadence()`

### 2. `src/commands/analyze.ts`
- Display pending nudges after gamification section
- Mark nudges as seen

### 3. `src/cli.ts`
- Add `learn` command

### 4. `src/commands/index.ts`
- Export `createLearnCommand`

---

## Example User Experience

### Session with Pending Nudge

```
$ vibe-check --score --since "4 hours ago"

═══════════════════════════════════════════════════════════════════
  VIBE-CHECK ANALYSIS
═══════════════════════════════════════════════════════════════════

  Period: 4 hours ago to now
  Commits: 23
  ...

──────────────────────────────────────────────────────────────────
  🔥🔥 2-day streak
  🏔️ Level 6 Grandmaster (380/3000 XP) +85 XP
──────────────────────────────────────────────────────────────────

  💡 LEARNING INSIGHT:
     SSL/TLS issues caused 3 spirals this week (45 min total)
     Your top intervention for this pattern: Read Docs 📚
     Run `vibe-check learn --pattern SSL_TLS` for details

  📅 Weekly retro due in 2 days
     Run `vibe-check learn --retro` to review your week

```

### Weekly Retrospective

```
$ vibe-check learn --retro

═══════════════════════════════════════════════════════════════════
  WEEKLY RETROSPECTIVE
  Nov 25 - Dec 2, 2025
═══════════════════════════════════════════════════════════════════

  SESSIONS: 12 sessions | 156 commits | 4.2h active time

  TOP PATTERNS THIS WEEK:
    1. SSL_TLS (3 spirals, 45 min) - Consider cert validation
    2. API_MISMATCH (2 spirals, 28 min) - Schema validation helps

  WHAT WORKED:
    • Read Docs broke 60% of your spirals
    • Peak productivity: 11am-1pm
    • Tuesday was your best day

  PROGRESS:
    • Trust Pass Rate: 87% → 91% (+4%)
    • Spiral Rate: 0.5 → 0.3 (-40%) 🎯

  SUGGESTED ACTION:
    Add SSL certificate validation to your CI pipeline

  Save this retrospective? [Y/n] _
```

---

## Success Metrics

| Metric | Current | Target | How to Measure |
|--------|---------|--------|----------------|
| **Learning staleness** | No limit | <7 days | Days since last insight refresh |
| **Pattern recurrence** | Unknown | -50% | Same pattern 3+ times in 7 days |
| **Model accuracy** | ~60% | >80% | ECE after 30 samples |
| **User engagement** | Manual only | 80% see nudges | Nudges displayed / sessions |
| **Retro completion** | 0% | 50%+ | Retros completed / retros due |

---

## Open Questions

1. **Nudge persistence:** Should nudges persist across sessions or be ephemeral?
   - Recommendation: Persist with 7-day TTL

2. **Retro enforcement:** Force retro or just prompt?
   - Recommendation: Prompt only (non-blocking)

3. **Model retraining:** Sync or async?
   - Recommendation: Async with progress indicator

4. **Learning state location:** Global or per-repo?
   - Recommendation: Global (cross-repo patterns are valuable)

---

## Dependencies

- **ml-learning-loop-complete-plan**: Required for model retraining
- **dashboard-data-quality-plan**: Ensures insights are meaningful
- **Current profile.ts**: Integration point

---

## Next Steps

1. **Approve this research** or request clarification
2. **Run `/plan`** to create implementation spec
3. **Prioritize:** Start with post-session nudges (lowest risk, highest value)

---

## Sources

- [FSRS Algorithm - Spaced Repetition](https://domenic.me/fsrs/)
- [AI Behavioral Nudging](https://aicompetence.org/ai-in-behavioral-nudging-apps-that-change-habits/)
- [Habit Tracking App Guide](https://emizentech.com/blog/habit-tracking-app.html)
- [Agile Retrospectives - Atlassian](https://www.atlassian.com/agile/scrum/retrospectives)
- [RetroCadence Tool](https://www.scrumexpert.com/tools/retrocadence-the-best-retrospective-tool-for-agile-teams/)
- [CodeAnt Developer Productivity](https://www.codeant.ai/blogs/developer-productivity-platform)
