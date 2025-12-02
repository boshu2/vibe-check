# Session Metrics Integration Plan

**Created:** 2025-12-02
**Type:** Plan
**Status:** Ready for implementation
**Repo:** vibe-check
**Parent Plan:** workflow-improvements-plan-2025-12-02.md

---

## Goal

Integrate vibe-check metrics into the session lifecycle so that every session automatically captures:
- Vibe level declared
- Trust pass rate achieved
- Rework ratio
- Spiral occurrences
- Failure patterns hit

---

## Current State

vibe-check already tracks:
- ✅ 5 core metrics (iteration velocity, rework ratio, trust pass rate, debug spiral duration, flow efficiency)
- ✅ Pattern detection (flow state, spirals, late-night work)
- ✅ StoredInsight system (compounding at 3+ occurrences)
- ✅ Profile with historical patterns

Missing:
- ❌ Session start/end hooks
- ❌ Metrics export to claude-progress.json format
- ❌ Automatic baseline comparison per session

---

## Implementation

### Task 1: Session Metrics Schema (30 min)

Add to session record in claude-progress.json:

```json
{
  "session_id": "2025-12-02-001",
  "vibe_level": 3,
  "metrics": {
    "trust_pass_rate": 92,
    "rework_ratio": 11,
    "iteration_velocity": 4.2,
    "debug_spiral_duration_min": 0,
    "flow_efficiency": 85
  },
  "retro": {
    "failure_patterns_hit": [],
    "failure_patterns_avoided": ["Debug Spiral", "Context Amnesia"],
    "learnings": ["Test-first prevented spirals"]
  }
}
```

### Task 2: Session Start Hook (1 hour)

Create `/session-start` integration:

```bash
# At session start, capture baseline
vibe-check --since "1 week" --format json > /tmp/vibe-baseline.json

# Store baseline metrics for comparison
baseline_trust=$(jq '.metrics.trust_pass_rate' /tmp/vibe-baseline.json)
```

### Task 3: Session End Hook (1 hour)

Create `/session-end` integration:

```bash
# At session end, capture session metrics
vibe-check --since "$SESSION_START" --format json > /tmp/vibe-session.json

# Compare to baseline
session_trust=$(jq '.metrics.trust_pass_rate' /tmp/vibe-session.json)
delta=$((session_trust - baseline_trust))

# Add to claude-progress.json
# Update session record with metrics
```

### Task 4: Automatic Retro Generation (30 min)

After vibe-check runs at session end:
- Detect failure patterns from metrics
- Generate retro.failure_patterns_hit array
- Suggest learnings based on patterns avoided

---

## Files to Modify

| File | Change |
|------|--------|
| src/index.ts | Add --session-start and --session-end flags |
| src/metrics.ts | Export metrics in session-compatible format |
| src/patterns.ts | Add failure pattern detection for retro |
| README.md | Document session integration |

---

## Validation

- [ ] `vibe-check --session-start` captures baseline
- [ ] `vibe-check --session-end` outputs session metrics JSON
- [ ] Metrics can be appended to claude-progress.json
- [ ] Failure patterns correctly detected
- [ ] Delta from baseline calculated and displayed

---

## Success Metrics

After implementation:
- Every vibe-check session in workspace captures metrics
- Trust pass rate tracked per session (not just aggregate)
- Failure patterns documented in retro
- Patterns compound via StoredInsight system

---

## Next Steps

1. Implement Task 1 (schema)
2. Implement Task 2 (start hook)
3. Implement Task 3 (end hook)
4. Test with real session
5. Document in README

---

## Resume Command

```bash
/session-resume "session integration"
```
