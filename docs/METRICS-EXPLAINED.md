# vibe-check Metrics Explained

**Detailed breakdown of how each metric is calculated**

---

## Overview

vibe-check analyzes git history to compute metrics. It uses **semantic-free signals**—patterns in commit behavior, not code content. This ensures:

- **Privacy**: Never reads your actual code
- **Universality**: Works for any language/framework
- **Honesty**: Can't be gamed by writing "clean" commit messages

---

## The 5 Core Metrics

### 1. Iteration Velocity

**What it measures:** How fast are your feedback loops?

**Formula:**
```
Iteration Velocity = Total Commits / Active Hours
```

**Active Hours Calculation:**
- Groups commits into sessions (gaps > 2 hours = new session)
- Sums session durations
- Excludes time between sessions

**Example:**
```
Commits: 24
Active hours: 4.5

Velocity = 24 / 4.5 = 5.3 commits/hour
```

**Thresholds:**

| Rating | Commits/Hour |
|--------|--------------|
| ELITE | >5 |
| HIGH | 3-5 |
| MEDIUM | 1-3 |
| LOW | <1 |

**What it means:**
- High velocity = tight feedback loops, iterating quickly
- Low velocity = long gaps between commits, possibly stuck

---

### 2. Rework Ratio

**What it measures:** Are you building or debugging?

**Formula:**
```
Rework Ratio = Fix Commits / Total Commits × 100%
```

**Fix Commit Detection:**
- Commit message starts with `fix:` or `fix(`
- Or contains keywords: "fix", "bug", "patch", "revert"

**Example:**
```
Total commits: 50
Fix commits: 12

Rework = 12 / 50 = 24%
```

**Thresholds:**

| Rating | Rework % |
|--------|----------|
| ELITE | <30% |
| HIGH | 30-40% |
| MEDIUM | 40-50% |
| LOW | >50% |

**What it means:**
- Low rework = building new things, code sticking
- High rework = debugging, fixing issues, thrashing

---

### 3. Trust Pass Rate

**What it measures:** Does your code stick on first try?

**THE most important metric** - directly measures if you vibed at the right level.

**Formula:**
```
Trust Pass Rate = (1 - Immediate Fix Rate) × 100%

Immediate Fix Rate = Fix-within-10min Commits / Total Non-Fix Commits
```

**Immediate Fix Detection:**
- A `fix:` commit within 10 minutes of a `feat:` commit
- Targeting the same scope/component

**Example:**
```
feat(auth): add login
fix(auth): handle edge case  ← 5 min later (immediate fix)
feat(api): add endpoint
feat(ui): add button
fix(api): fix typo  ← 3 hours later (not immediate)

Non-fix commits: 3 (feat: auth, api, ui)
Immediate fixes: 1 (auth fix within 10 min)

Trust Pass Rate = (1 - 1/3) × 100 = 66.7%
```

**Thresholds:**

| Rating | Trust % |
|--------|---------|
| ELITE | >95% |
| HIGH | 85-95% |
| MEDIUM | 70-85% |
| LOW | <70% |

**What it means:**
- High trust = code works first time, appropriate verification level
- Low trust = frequent immediate fixes, possibly trusting AI too much

---

### 4. Debug Spiral Duration

**What it measures:** How long do you get stuck in fix loops?

**Formula:**
```
Debug Spiral Duration = Average minutes spent in spirals
```

**Spiral Detection:**
1. Find consecutive fix commits on same component
2. If 3+ fixes within 30 minutes → spiral
3. Duration = time from first to last fix in chain

**Example:**
```
09:00 fix(auth): try token refresh
09:08 fix(auth): add retry logic
09:15 fix(auth): increase timeout
09:22 fix(auth): finally works!

Spiral detected:
- Component: auth
- Commits: 4
- Duration: 22 minutes
```

**Thresholds:**

| Rating | Avg Duration |
|--------|--------------|
| ELITE | <15 min |
| HIGH | 15-25 min |
| MEDIUM | 25-45 min |
| LOW | >45 min |

**What it means:**
- Short spirals = quick recovery, good debugging skills
- Long spirals = getting stuck, may need tracer tests

---

### 5. Flow Efficiency

**What it measures:** What percentage of time is productive building?

**Formula:**
```
Flow Efficiency = Build Time / Total Active Time × 100%

Build Time = Time spent on feat/docs/refactor commits
Debug Time = Time spent on fix commits
Total Active Time = Build Time + Debug Time
```

**Time Attribution:**
- Each commit gets proportional time based on session duration
- Fix commits count as debug time
- Non-fix commits count as build time

**Example:**
```
Session: 2 hours
Commits: 10 feat, 5 fix

Build time: 10/15 × 2h = 80 min
Debug time: 5/15 × 2h = 40 min

Flow Efficiency = 80 / 120 × 100 = 66.7%
```

**Thresholds:**

| Rating | Efficiency % |
|--------|--------------|
| ELITE | >90% |
| HIGH | 75-90% |
| MEDIUM | 50-75% |
| LOW | <50% |

**What it means:**
- High efficiency = mostly building, little debugging
- Low efficiency = significant time spent fixing issues

---

## Overall Rating

**How overall rating is calculated:**

1. Count ELITE metrics
2. Count LOW metrics
3. Apply rules:

```
If 4+ metrics ELITE → ELITE
If 3 metrics ELITE, 0 LOW → HIGH
If 2+ metrics LOW → LOW
Otherwise → MEDIUM
```

---

## VibeScore (0-100)

**Composite score using semantic-free metrics:**

### Component Metrics

| Metric | Weight | What It Measures |
|--------|--------|------------------|
| File Churn | 30% | % files touched multiple times |
| Time Spiral | 25% | Rapid-fire same-file commits |
| Velocity Anomaly | 20% | Deviation from your baseline |
| Code Stability | 25% | % added lines that survive |

### Formula

```
VibeScore = (fileChurn × 0.30) + (timeSpiral × 0.25) +
            (velocityAnomaly × 0.20) + (codeStability × 0.25)

Each component normalized to 0-1 range
Final score × 100 for percentage
```

### File Churn

```
File Churn Score = 1 - (Files touched 3+ times / Total files)
```

High churn (same files repeatedly) = lower score

### Time Spiral

```
Time Spiral Score = 1 - (Rapid-fire commits / Total commits)

Rapid-fire = 3+ commits on same file within 5 minutes
```

### Velocity Anomaly

```
Z-Score = (Current velocity - Baseline mean) / Baseline std dev

If Z < -2 (much slower): Low score
If Z > 2 (much faster): Caution (may indicate thrashing)
If -1 < Z < 1: Optimal
```

### Code Stability

```
Stability = Lines surviving after 24h / Lines added
```

Requires historical data; estimated from fix ratio if unavailable.

---

## Debug Spiral Patterns

When a spiral is detected, it's classified by pattern:

| Pattern | Keywords | Common Cause |
|---------|----------|--------------|
| `SECRETS_AUTH` | oauth, token, secret, credential, auth | Authentication issues |
| `API_MISMATCH` | api, version, schema, endpoint | API compatibility |
| `VOLUME_CONFIG` | volume, mount, pvc, permission | Storage/mount issues |
| `SSL_TLS` | ssl, tls, cert, https | Certificate problems |
| `IMAGE_REGISTRY` | image, pull, registry, container | Container pull issues |
| `GITOPS_DRIFT` | sync, reconcile, drift, argocd | GitOps sync issues |
| `OTHER` | (no match) | Unclassified |

---

## Rating Thresholds Summary

| Metric | ELITE | HIGH | MEDIUM | LOW |
|--------|-------|------|--------|-----|
| Iteration Velocity | >5/hr | 3-5/hr | 1-3/hr | <1/hr |
| Rework Ratio | <30% | 30-40% | 40-50% | >50% |
| Trust Pass Rate | >95% | 85-95% | 70-85% | <70% |
| Debug Spiral Duration | <15m | 15-25m | 25-45m | >45m |
| Flow Efficiency | >90% | 75-90% | 50-75% | <50% |

---

## Baseline Comparison

After 5+ sessions, vibe-check compares to YOUR baseline:

```
VS YOUR BASELINE

  Trust:  92% (+7% vs avg 85%)
  Rework: 18% (-4% vs avg 22%)

  Better than your usual - nice flow!
```

### Baseline Calculation

```
Baseline mean = Average of last 10 sessions
Baseline std = Standard deviation of last 10 sessions

Current comparison = (Current - Mean) / Std
```

### Feedback Messages

| Comparison | Message |
|------------|---------|
| >1 std better | "Better than your usual - nice flow!" |
| Within 1 std | "Consistent with your baseline" |
| >1 std worse | "Below your average - consider a break?" |

---

## Data Sources

All metrics derived from git:

```bash
git log --format="%H|%ad|%s|%an" --date=iso
```

Fields used:
- **Hash**: Unique commit identifier
- **Date**: Timestamp for velocity/duration calculations
- **Subject**: Message for type detection (feat/fix/etc.)
- **Author**: For filtering (optional)

---

## Limitations

1. **Commit granularity matters** - Squashed commits hide iteration patterns
2. **Commit messages must be parseable** - Relies on conventional commits
3. **Multi-author blind** - Doesn't distinguish pair programming
4. **No code quality signal** - Doesn't know if code is good, just if it sticks

---

## Accuracy Notes

- **Trust Pass Rate** is most reliable when commits are granular
- **Flow Efficiency** assumes fix commits = debugging (may not always be true)
- **VibeScore** is calibrated but evolving based on user feedback

---

**Version:** 1.5.0
**Last Updated:** 2025-11-29
