# Vibe-Check Metrics Reference

> API-style documentation for all vibe-check metrics. Understand exactly what's measured, how it's calculated, and why it matters.

## Overview

Vibe-check uses **two scoring systems** that measure different aspects of your coding workflow:

| System | Output | Measures | Best For |
|--------|--------|----------|----------|
| **Code Health** | ELITE/HIGH/MEDIUM/LOW | Quality outcomes | Grading your work |
| **Pattern Score** | 0-100% | Workflow patterns | Early warning signals |

**Recommendation:** Use Code Health as your primary "grade" and Pattern Score as a trend indicator.

---

## Code Health Rating (Semantic Metrics)

The Code Health rating grades your **actual coding outcomes**. It's calculated from 5 semantic metrics that require conventional commit messages (`feat:`, `fix:`, etc.).

### How Code Health is Calculated

```
Code Health = weightedAverage(
  iterationVelocity.rating,    // elite=4, high=3, medium=2, low=1
  reworkRatio.rating,
  trustPassRate.rating,
  debugSpiralDuration.rating,
  flowEfficiency.rating
)

If average >= 3.5 → ELITE
If average >= 2.5 → HIGH
If average >= 1.5 → MEDIUM
Else → LOW
```

---

### Iteration Velocity

**What it measures:** How fast you're committing code.

**Why it matters:** Tight feedback loops correlate with faster problem-solving. Frequent small commits catch issues early.

#### Calculation

```typescript
velocity = totalCommits / activeHours

// Active hours excludes gaps > 2 hours (session breaks)
// Minimum 10 min/commit assumed for work between commits
```

#### Rating Thresholds

| Rating | Threshold | Interpretation |
|--------|-----------|----------------|
| ELITE | > 5 commits/hr | Excellent iteration, tight feedback loops |
| HIGH | >= 3 commits/hr | Good iteration speed |
| MEDIUM | >= 1 commit/hr | Normal pace |
| LOW | < 1 commit/hr | Slow iteration, consider smaller commits |

#### Example

```
10 commits over 2 active hours
velocity = 10 / 2 = 5.0 commits/hr → ELITE
```

#### When Low is OK

- Deep architectural work requiring extended thinking
- Documentation or research-heavy tasks
- Pair programming where one person drives

---

### Rework Ratio

**What it measures:** Percentage of commits that are fixes vs. new features.

**Why it matters:** High fix ratios suggest building on unstable foundations. You want to spend time building, not debugging.

#### Calculation

```typescript
reworkRatio = (fixCommits / totalCommits) * 100

// fixCommits = commits with type 'fix'
```

#### Rating Thresholds

| Rating | Threshold | Interpretation |
|--------|-----------|----------------|
| ELITE | < 30% fixes | Mostly forward progress |
| HIGH | < 50% fixes | Normal for complex work |
| MEDIUM | < 70% fixes | Consider validating assumptions first |
| LOW | >= 70% fixes | High rework - stop and reassess |

#### Example

```
8 total commits: 2 fix, 6 feat
reworkRatio = (2/8) * 100 = 25% → ELITE
```

#### When High is OK

- Refactoring legacy code (expected to find issues)
- Bugfix-focused sprints
- Fixing known tech debt

---

### Trust Pass Rate

**What it measures:** Percentage of commits that "stick" without needing immediate fixes.

**Why it matters:** High trust rate means your code works on first try. Low trust suggests you're coding without sufficient understanding.

#### Calculation

```typescript
// A commit "fails trust" if:
// - Next commit is a fix
// - To the same component (scope match)
// - Within 30 minutes

trustPassRate = (trustedCommits / totalCommits) * 100
```

#### Rating Thresholds

| Rating | Threshold | Interpretation |
|--------|-----------|----------------|
| ELITE | > 95% | Code sticks on first try |
| HIGH | >= 80% | Occasional fixes, mostly autonomous |
| MEDIUM | >= 60% | Regular intervention required |
| LOW | < 60% | Heavy oversight needed - run tracer tests |

#### Example

```
10 commits, 1 needed immediate fix
trustPassRate = (9/10) * 100 = 90% → HIGH
```

#### When Low is OK

- Exploring unfamiliar APIs
- First time working in a new codebase
- Intentional "spike and fix" approach

---

### Debug Spiral Duration

**What it measures:** Average time spent in consecutive fix chains (3+ fixes to same component).

**Why it matters:** Long spirals indicate you're stuck. Recognizing and breaking spirals early saves hours.

#### Calculation

```typescript
// A "spiral" = 3+ consecutive fix commits to same component
spiralDuration = totalSpiralMinutes / spiralCount

// Time = first spiral commit to last spiral commit
```

#### Rating Thresholds

| Rating | Threshold | Interpretation |
|--------|-----------|----------------|
| ELITE | < 15 min avg | Spirals resolved quickly |
| HIGH | < 30 min avg | Normal debugging time |
| MEDIUM | < 60 min avg | Consider using tracer tests |
| LOW | >= 60 min avg | Extended debugging - use tracers |

#### Spiral Pattern Detection

Vibe-check detects common spiral causes:

| Pattern | Keywords | Prevention |
|---------|----------|------------|
| VOLUME_CONFIG | volume, mount, permission, pvc | Test mount paths first |
| SECRETS_AUTH | secret, oauth, token, credential | Validate auth flow early |
| API_MISMATCH | api, version, field, spec, crd | Check API schema first |
| SSL_TLS | ssl, tls, cert, fips | Verify cert chain early |
| IMAGE_REGISTRY | image, pull, registry, tag | Test pull access first |
| GITOPS_DRIFT | drift, sync, argocd, reconcil | Verify sync status |

#### Example

```
2 spirals detected:
- Spiral 1: 4 fixes over 20 minutes
- Spiral 2: 3 fixes over 10 minutes
avgDuration = (20 + 10) / 2 = 15 min → ELITE
```

---

### Flow Efficiency

**What it measures:** Percentage of active time spent building vs. debugging.

**Why it matters:** Time in spirals is time not building features. High efficiency = productive flow state.

#### Calculation

```typescript
spiralMinutes = sum(spiral.duration for each spiral)
flowEfficiency = ((activeMinutes - spiralMinutes) / activeMinutes) * 100
```

#### Rating Thresholds

| Rating | Threshold | Interpretation |
|--------|-----------|----------------|
| ELITE | > 90% | Excellent productive flow |
| HIGH | >= 75% | Good balance |
| MEDIUM | >= 50% | Significant debugging overhead |
| LOW | < 50% | More debugging than building |

#### Example

```
120 minutes active, 15 minutes in spirals
flowEfficiency = ((120-15)/120) * 100 = 87.5% → HIGH
```

---

## Pattern Score (Semantic-Free Metrics)

The Pattern Score detects **workflow patterns** that might indicate trouble, even without conventional commits. It's a 0-100% score calculated from 4 metrics.

### How Pattern Score is Calculated

```typescript
patternScore = (
  fileChurn * 0.30 +        // 30% weight - strongest signal
  timeSpiral * 0.25 +       // 25% weight
  velocityAnomaly * 0.20 +  // 20% weight
  codeStability * 0.25      // 25% weight
)
```

---

### File Churn

**What it measures:** Files touched 3+ times within 1 hour.

**Why it matters:** Returning to the same file repeatedly suggests incomplete understanding, unexpected dependencies, or debugging loops.

#### Calculation

```typescript
// Count files with 3+ touches in any 1-hour window
churnRatio = churnedFiles / totalFiles
fileChurnScore = (1 - churnRatio) * 100  // Inverted: high = good
```

#### Rating Thresholds

| Rating | Churn Ratio | Score | Interpretation |
|--------|-------------|-------|----------------|
| ELITE | < 10% | > 90% | Minimal thrashing |
| HIGH | < 25% | 75-90% | Normal iteration |
| MEDIUM | < 40% | 60-75% | Some thrashing |
| LOW | >= 40% | < 60% | Significant thrashing |

#### Example

```
20 files touched, 3 churned (3+ times in 1hr)
churnRatio = 3/20 = 15%
fileChurnScore = (1 - 0.15) * 100 = 85% → HIGH
```

---

### Time Spiral

**What it measures:** Commits made less than 5 minutes apart.

**Why it matters:** Rapid commits suggest frustrated iteration - "oops forgot", quick fixes, debugging loops.

#### Calculation

```typescript
// Count commits < 5 minutes after previous commit
spiralRatio = spiralCommits / totalCommits
timeSpiralScore = (1 - spiralRatio) * 100  // Inverted: high = good
```

#### Rating Thresholds

| Rating | Spiral Ratio | Score | Interpretation |
|--------|--------------|-------|----------------|
| ELITE | < 15% | > 85% | Deliberate commits |
| HIGH | < 30% | 70-85% | Some quick fixes |
| MEDIUM | < 50% | 50-70% | Frequent iteration |
| LOW | >= 50% | < 50% | Frustrated iteration |

#### Example

```
10 commits, 2 were < 5min after previous
spiralRatio = 2/10 = 20%
timeSpiralScore = (1 - 0.20) * 100 = 80% → HIGH
```

---

### Velocity Anomaly

**What it measures:** How far your current velocity is from your personal baseline.

**Why it matters:** Unusual velocity (too fast or too slow) can indicate problems - rushing, confusion, or blockers.

#### Calculation

```typescript
// Z-score: standard deviations from your mean velocity
zScore = |currentVelocity - baselineMean| / baselineStdDev

// Sigmoid transform: z=0 → 100%, z=2 → 12%, z=3 → 5%
velocityAnomalyScore = (1 / (1 + exp(zScore - 1.5))) * 100
```

#### Default Baseline

```typescript
// Used until you build personal history
defaultBaseline = { mean: 3.0 commits/hr, stdDev: 1.5 }
```

#### Rating Thresholds

| Rating | Z-Score | Score | Interpretation |
|--------|---------|-------|----------------|
| ELITE | < 1.0σ | > 75% | Near your baseline |
| HIGH | < 1.5σ | 50-75% | Slightly unusual |
| MEDIUM | < 2.0σ | 25-50% | Notably different |
| LOW | >= 2.0σ | < 25% | Very unusual pattern |

#### Example

```
Baseline: 3.0 commits/hr (stdDev 1.5)
Current: 4.2 commits/hr
zScore = |4.2 - 3.0| / 1.5 = 0.8σ → ELITE
```

---

### Code Stability

**What it measures:** What percentage of added code survives (isn't deleted in subsequent commits).

**Why it matters:** High churn (adding then deleting) suggests building on wrong assumptions.

#### Calculation

```typescript
// Simplified: uses add/delete ratio as proxy
churnRate = min(deletions / additions, 1.0)
codeStabilityScore = (1 - churnRate * 0.5) * 100

// Partial penalty: deletions aren't always bad (refactoring)
```

#### Rating Thresholds

| Rating | Score | Interpretation |
|--------|-------|----------------|
| ELITE | >= 85% | Code survives well |
| HIGH | >= 70% | Normal stability |
| MEDIUM | >= 50% | Some instability |
| LOW | < 50% | High code churn |

#### Fallback (No Line Stats)

```typescript
// When git stats unavailable, estimate from commit patterns
fixRatio = fixKeywordCommits / totalCommits
codeStabilityScore = (1 - fixRatio) * 100
```

---

## Interpreting Dual Scores

| Scenario | Code Health | Pattern Score | Interpretation |
|----------|-------------|---------------|----------------|
| Excellent session | ELITE | 85%+ | Everything working well |
| Quality but struggling | ELITE | 60-70% | Code works but workflow rough |
| Smooth but issues | HIGH/MEDIUM | 85%+ | Workflow fine but code needs fixes |
| Trouble | LOW | < 60% | Both outcomes and workflow suffering |

### When They Disagree

**High Code Health, Low Pattern Score:**
- Your code works, but you're thrashing to get there
- Consider: More upfront planning, tracer tests

**Low Code Health, High Pattern Score:**
- Smooth workflow but code isn't sticking
- Consider: Better validation before committing

---

## Limitations

### Not Empirically Validated

These thresholds are based on practitioner experience, not academic research. Your mileage may vary.

### Requires Conventional Commits

Code Health metrics (semantic) need `feat:`, `fix:`, etc. prefixes. Pattern Score works with any commits.

### Session Detection is Approximate

"Active hours" calculation assumes 2-hour gaps mean new sessions. Adjust if your workflow differs.

### Personal Baseline Cold Start

Velocity anomaly starts with default baseline until you have enough history.

---

## Calibration

Over time, vibe-check learns your personal patterns:

```bash
vibe-check level --calibrate 3
# Record that this session felt like a Level 3 (60% trust)
```

This improves velocity anomaly baseline and helps tune thresholds to your workflow.

---

## API Reference

### Types

```typescript
type Rating = 'elite' | 'high' | 'medium' | 'low';
type OverallRating = 'ELITE' | 'HIGH' | 'MEDIUM' | 'LOW';

interface MetricResult {
  value: number;
  unit: string;
  rating: Rating;
  description: string;
}
```

### Metric Functions

```typescript
// Code Health (Semantic)
calculateIterationVelocity(commits: Commit[]): MetricResult
calculateReworkRatio(commits: Commit[]): MetricResult
calculateTrustPassRate(commits: Commit[]): MetricResult
calculateDebugSpiralDuration(chains: FixChain[]): MetricResult
calculateFlowEfficiency(activeMinutes: number, spirals: FixChain[]): MetricResult

// Pattern Score (Semantic-Free)
calculateFileChurn(commits: Commit[], filesPerCommit: Map): FileChurnResult
calculateTimeSpiral(commits: Commit[]): TimeSpiralResult
calculateVelocityAnomaly(commits: Commit[], baseline?: Baseline): VelocityAnomalyResult
calculateCodeStability(commits: Commit[], stats?: LineStats[]): CodeStabilityResult
```

### Score Calculation

```typescript
calculateVibeScore(inputs: {
  fileChurn: FileChurnResult;
  timeSpiral: TimeSpiralResult;
  velocityAnomaly: VelocityAnomalyResult;
  codeStability: CodeStabilityResult;
}): VibeScore

interface VibeScore {
  value: number;           // 0.0 - 1.0
  components: {
    fileChurn: number;
    timeSpiral: number;
    velocityAnomaly: number;
    codeStability: number;
  };
  weights: ScoreWeights;
}
```

---

## Quick Reference Card

### Code Health (The Grade)

| Metric | ELITE | HIGH | MEDIUM | LOW |
|--------|-------|------|--------|-----|
| Velocity | >5/hr | >=3/hr | >=1/hr | <1/hr |
| Rework | <30% | <50% | <70% | >=70% |
| Trust | >95% | >=80% | >=60% | <60% |
| Spiral | <15m | <30m | <60m | >=60m |
| Flow | >90% | >=75% | >=50% | <50% |

### Pattern Score (The Warning System)

| Metric | Weight | ELITE | HIGH | MEDIUM | LOW |
|--------|--------|-------|------|--------|-----|
| File Churn | 30% | >90% | 75-90% | 60-75% | <60% |
| Time Spiral | 25% | >85% | 70-85% | 50-70% | <50% |
| Velocity Anomaly | 20% | >75% | 50-75% | 25-50% | <25% |
| Code Stability | 25% | >=85% | >=70% | >=50% | <50% |
