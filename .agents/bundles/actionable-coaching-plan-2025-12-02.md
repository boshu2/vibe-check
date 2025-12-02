# Actionable Coaching Enhancement Plan

**Goal:** Make vibe-check actively coach you to become a better vibe coder, not just display metrics.

**Created:** 2025-12-02
**Status:** Planning

---

## Problem Statement

Current vibe-check:
- Shows metrics (trust rate, rework ratio, spirals)
- Detects spirals in real-time (watch mode)
- Gives **generic** advice ("write a test", "take a break")

What's missing:
- **No memory** of what worked for YOU before
- **No personalization** based on YOUR patterns
- **No actionable next step** - just information

---

## Design Principles

1. **Lean** - ~200 lines, not 1700 (like the cut learning system)
2. **Actionable** - Tell user what to DO, not just what happened
3. **Personalized** - Based on YOUR history, not generic
4. **At decision time** - Surface advice when it matters (spiral detected, session end)

---

## Architecture

### Data Model (append-only log)

```typescript
// ~/.vibe-check/spiral-history.ndjson
interface SpiralRecord {
  date: string;           // ISO date
  pattern: string;        // SECRETS_AUTH, VOLUME_CONFIG, etc.
  component: string;      // auth, database, api
  duration: number;       // minutes in spiral
  resolution?: string;    // What broke the spiral: TEST, BREAK, DOCS, HELP, ROLLBACK
}
```

**Why NDJSON:** Append-only, git-friendly diffs, easy to query last N records.

### Storage Location

```
~/.vibe-check/
├── profile.json          # Existing - XP, streaks
└── spiral-history.ndjson # New - spiral log with resolutions
```

### Core Functions

```typescript
// Record a spiral (called from analyze/session end)
appendSpiral(pattern, component, duration): void

// Record what broke the spiral (user input or inferred)
resolveSpiral(resolution): void

// Get personalized advice for a pattern
getAdvice(pattern, component): {
  yourHistory: { times: number, avgDuration: number },
  whatWorked: { resolution: string, times: number }[],
  suggestion: string
}
```

---

## Features

### Feature 1: Spiral History Tracking

**Automatic tracking** when spirals are detected:
- Pattern (SECRETS_AUTH, etc.)
- Component (auth, api, etc.)
- Duration (minutes)
- Timestamp

No user action required - happens during `analyze` and `session end`.

### Feature 2: Resolution Recording

After spiral detected, prompt for what broke it:

```
Spiral resolved. What worked?
  [T] Wrote a test
  [B] Took a break
  [D] Read docs
  [H] Asked for help
  [R] Rolled back
  [Enter] Skip
```

Or infer from commit patterns:
- Test commit after fix commits → TEST
- >15 min gap → BREAK
- Revert commit → ROLLBACK

### Feature 3: Personalized Watch Alerts

When spiral detected in watch mode:

```
⚠️  SPIRAL FORMING - auth component (SECRETS_AUTH pattern)

   Your history: 4 auth spirals, avg 18 min
   What worked: tracer test (3x), break (1x)

   → Write a test that validates your auth assumption
```

### Feature 4: Session End Coaching

At `vibe-check session end`:

```
SESSION COMPLETE

   Rating: HIGH (not ELITE because of 1 spiral)

   🔄 You hit SECRETS_AUTH again (5th time)
      Your go-to fix: tracer test
      Consider: Add auth integration test to prevent recurrence
```

### Feature 5: Pattern Insights Command

New command or flag: `vibe-check insights`

```
YOUR SPIRAL PATTERNS (last 30 days)

   Pattern         Times   Avg Duration   Best Fix
   SECRETS_AUTH      5        18 min      tracer test
   VOLUME_CONFIG     3        12 min      docs
   API_MISMATCH      2        25 min      help

   Top trigger: OAuth/token issues in auth component

   Recommendation: Add tracer tests for auth flows before starting
```

---

## Implementation Order

| # | Feature | Effort | Files |
|---|---------|--------|-------|
| 1 | Spiral history storage | 1 hr | `src/storage/spiral-history.ts` |
| 2 | Auto-record spirals | 30 min | `src/commands/analyze.ts`, `session.ts` |
| 3 | Enhanced watch alerts | 1 hr | `src/commands/watch.ts` |
| 4 | Session end coaching | 1 hr | `src/commands/session.ts` |
| 5 | Insights command | 1 hr | `src/commands/insights.ts` |

**Total:** ~5 hours, ~300-400 lines of new code

---

## Success Criteria

1. After 5+ spirals, advice is personalized to user's history
2. Watch mode shows "what worked before" when spiral detected
3. Session end gives actionable coaching, not just metrics
4. User can see their patterns with `vibe-check insights`

---

## What This Is NOT

- Not the bloated learning system (10 files, 1755 lines)
- Not ML/AI predictions
- Not nudges/cadences/synthesis
- Just: **record what happened, show what worked**

---

## Files to Create/Modify

### New Files
- `src/storage/spiral-history.ts` - NDJSON append/query
- `src/commands/insights.ts` - Pattern insights command

### Modified Files
- `src/commands/watch.ts` - Personalized alerts
- `src/commands/session.ts` - Session end coaching
- `src/commands/analyze.ts` - Record spirals to history
- `src/cli.ts` - Register insights command

---

## Open Questions

1. **Resolution input:** Interactive prompt vs infer from commits?
   - Recommendation: Infer first, prompt as fallback

2. **History retention:** How many records to keep?
   - Recommendation: Last 100 spirals (~3-6 months typical usage)

3. **Pattern display names:** Use technical (SECRETS_AUTH) or friendly (OAuth/Token Issues)?
   - Recommendation: Friendly in output, technical internally
