# vibe-check Enhancement Plan

**Date:** 2025-12-11
**Status:** Proposal
**Source:** Houston project learnings

---

## Problem Statement

vibe-check measures **git activity**, not **wall-clock reality**. This creates blind spots:

| What Happened | What vibe-check Sees |
|---------------|---------------------|
| 30 min investigating bug, then 5 min fix | One `fix:` commit |
| Fired tracer bullet, validated assumption | Nothing (or unmarked commit) |
| Changed 5 files across 3 domains | One commit touching many paths |
| Ran tests before committing | Nothing |

**Real example from Houston:**
- Ghost missions bug: investigation took 30+ min, fix took 5-10 min
- vibe-check showed: 8% rework ratio, 0 min debug spiral
- Reality: significant investigation time hidden from metrics

---

## Proposed Enhancements

### 1. Investigation Gap Detection

**Problem:** Long gaps between commits indicate investigation/debugging, not breaks.

**Solution:** Analyze commit timestamp gaps and flag likely investigation periods.

```typescript
// New metric: investigation_time_estimate
interface InvestigationGap {
  startCommit: string
  endCommit: string
  gapMinutes: number
  followedByFix: boolean  // If next commit is fix: → likely debugging
  component: string       // What was being worked on
}

// Detection logic:
// - Gap > 15 min AND < 2 hours (not a break)
// - Next commit is fix: type
// - Same component/directory as previous commit
```

**Output:**
```
INVESTIGATION TIME DETECTED
  3 gaps totaling ~45 min (estimate)
  Longest: 22 min before fix(fleet-api)

  💡 Tracer bullets could have caught these earlier
```

**Implementation:** New file `src/metrics/investigation.ts`

---

### 2. Tracer Bullet Tracking

**Problem:** No visibility into whether assumptions were validated before building.

**Solution:** Recognize tracer commits via convention and track as positive signal.

```typescript
// Convention: commits starting with "tracer:" or "tb:"
// Examples:
//   tracer: validate Redis connection
//   tb: mission directory creation flow
//   tracer(fleet): test SSE streaming

interface TracerMetrics {
  tracerCount: number
  tracerBeforeFeature: number  // Tracers followed by feat: commits
  tracerBeforeFix: number      // Tracers followed by fix: commits (too late!)
  tracerRatio: number          // tracers / (feat + fix) commits
}
```

**Output:**
```
TRACER BULLETS
  Fired: 3 tracers
  Before features: 2 (good!)
  Before fixes: 1 (too late - was debugging)
  Tracer ratio: 12%

  Target: Fire tracers BEFORE building, not while debugging
```

**Rating:**
| Tracer Ratio | Rating | Interpretation |
|--------------|--------|----------------|
| > 20% | ELITE | Proactive validation |
| > 10% | HIGH | Good habit forming |
| > 5% | MEDIUM | Some validation |
| < 5% | LOW | Mostly reactive |

**Implementation:** New file `src/metrics/tracers.ts`

---

### 3. Domain Cohesion Score

**Problem:** Vertical slices keep changes isolated. Scattered changes indicate coupling.

**Solution:** Measure how many top-level directories each commit touches.

```typescript
interface CohesionMetrics {
  avgDomainsPerCommit: number
  scatteredCommits: number     // Commits touching 3+ domains
  cohesiveCommits: number      // Commits touching 1 domain
  cohesionScore: number        // 0-100%
}

// Calculation:
// cohesionScore = (cohesiveCommits / totalCommits) * 100

// Domain detection:
// - Top-level directories under src/, server/, client/
// - Or configurable via .vibe-check/config.json
```

**Output:**
```
DOMAIN COHESION
  Avg domains/commit: 1.3
  Cohesive (1 domain): 85%
  Scattered (3+ domains): 5%

  Cohesion Score: 85% ELITE

  Scattered commits:
    abc123 fix(auth): touched server/, client/, shared/
```

**Rating:**
| Cohesion | Rating | Interpretation |
|----------|--------|----------------|
| > 80% | ELITE | Well-isolated changes |
| > 60% | HIGH | Mostly contained |
| > 40% | MEDIUM | Some coupling |
| < 40% | LOW | High coupling, consider refactoring |

**Implementation:** New file `src/metrics/cohesion.ts`

---

### 4. Session Markers (Wall-Clock Tracking)

**Problem:** Git timestamps don't capture actual session duration.

**Solution:** Explicit session start/end commands that track wall-clock time.

```bash
# Start session with context
vibe-check session start "P30 Redis integration" --level 2

# During session - check status
vibe-check session status

# End session - get wall-clock metrics
vibe-check session end --summary "completed connection module"
```

**Tracked data:**
```typescript
interface Session {
  id: string
  description: string
  level: number
  startTime: Date
  endTime?: Date
  wallClockMinutes?: number
  commits: string[]

  // Derived
  commitMinutes: number       // Time between first and last commit
  investigationMinutes: number // wallClock - commitMinutes
  efficiency: number          // commitMinutes / wallClockMinutes
}
```

**Output:**
```
SESSION COMPLETE: P30 Redis integration
  Wall clock: 2h 15m
  Commit span: 1h 45m
  Investigation: ~30m (estimated gaps)

  Efficiency: 78%
  Level declared: 2 (Careful)
  Metrics achieved: HIGH

  ✓ Level calibration accurate
```

**Storage:** `.vibe-check/sessions.json`

**Implementation:** Extend `src/sessions/index.ts`

---

### 5. Pre-Commit Verification Tracking

**Problem:** No visibility into whether tests ran before committing.

**Solution:** Git hook that logs test runs, vibe-check reads the log.

```bash
# Install hook
vibe-check init-hook --track-tests

# Hook logs to .vibe-check/pre-commit.log:
# 2025-12-11T10:15:00Z tests_passed abc123
# 2025-12-11T10:18:00Z tests_failed def456
# 2025-12-11T10:20:00Z tests_passed def456
```

**Metrics:**
```typescript
interface VerificationMetrics {
  commitsWithTests: number
  commitsWithoutTests: number
  testPassRate: number
  verificationRatio: number  // commitsWithTests / total
}
```

**Output:**
```
PRE-COMMIT VERIFICATION
  Commits with test run: 45/50 (90%)
  Test pass rate: 98%

  Commits without verification:
    abc123 feat(quick-fix): no tests run
```

**Implementation:**
- Extend `src/commands/init-hook.ts`
- New file `src/metrics/verification.ts`

---

## Implementation Priority

| Priority | Enhancement | Effort | Value |
|----------|-------------|--------|-------|
| P1 | Investigation Gap Detection | 2-3h | High - surfaces hidden cost |
| P2 | Tracer Bullet Tracking | 2h | High - encourages good practice |
| P3 | Domain Cohesion Score | 3-4h | Medium - architecture signal |
| P4 | Session Markers | 4-5h | Medium - wall-clock accuracy |
| P5 | Pre-Commit Verification | 2-3h | Low - requires hook setup |

**Recommended order:** P1 → P2 → P3 → (P4, P5 optional)

---

## New Output Format

```
================================================================
                    VIBE-CHECK RESULTS
================================================================

  Period: Dec 10, 2025 - Dec 11, 2025 (35.2h active)
  Commits: 211 total (162 feat, 17 fix, 10 docs, 3 tracer)

  CODE HEALTH                VALUE      RATING
  --------------------------------------------------
  Iteration Velocity         6/hour     ELITE
  Rework Ratio               8%         ELITE
  Trust Pass Rate            100%       ELITE
  Debug Spiral Duration      0min       ELITE
  Flow Efficiency            100%       ELITE

  NEW METRICS                VALUE      RATING
  --------------------------------------------------
  Investigation Gaps         ~45min     MEDIUM
  Tracer Bullet Ratio        1.4%       LOW
  Domain Cohesion            85%        ELITE

----------------------------------------------------------------
  OVERALL: HIGH (was ELITE, investigation gaps detected)
----------------------------------------------------------------

  💡 INSIGHTS
  - 3 investigation gaps detected totaling ~45 min
  - Longest gap: 22 min before fix(fleet-api): skip empty telemetry
  - Only 3 tracer commits - consider firing more before features
  - Domain cohesion excellent - changes well-isolated

================================================================
```

---

## Configuration

```json
// .vibe-check/config.json
{
  "domains": {
    "paths": ["server/domains/*", "client/features/*"],
    "ignore": ["shared", "infrastructure"]
  },
  "tracers": {
    "prefixes": ["tracer:", "tb:", "spike:"]
  },
  "investigation": {
    "minGapMinutes": 15,
    "maxGapMinutes": 120
  },
  "sessions": {
    "autoStart": false,
    "defaultLevel": 3
  }
}
```

---

## Migration

All enhancements are **additive**:
- Existing metrics unchanged
- New metrics shown in separate section
- Overall rating considers new signals but doesn't break existing flows
- Config is optional - sensible defaults work out of box

---

## Success Metrics

After implementation, we should see:

1. **Investigation time surfaced** - No more hidden debugging sessions
2. **Tracer adoption** - Teams start using `tracer:` commits
3. **Cohesion awareness** - Scattered commits get noticed
4. **Calibration accuracy** - Session level predictions improve

---

## Next Steps

1. Review this plan
2. Create feature branch
3. Implement P1 (Investigation Gaps) first
4. Test on Houston repo
5. Iterate based on findings

---

*"The fix is quick; investigation burns time. Make investigation visible."*
