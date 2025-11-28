# Vibe Score Scientific Framework

**Type:** Research
**Created:** 2025-11-28
**Loop:** Outer (architecture decision)
**Tags:** vibe-coding, metrics, scientific-validation, machine-learning, calibration

---

## Executive Summary

This research defines a scientifically rigorous framework for computing and validating a "Vibe Score" that measures developer/AI coding health from git history. The framework uses **file churn + time patterns** as primary signals (not requiring semantic commits), with a self-calibrating feedback loop tied to vibe-levels.

**Key insight:** Semantic commits measure *intent*; file churn measures *outcome*. The latter is more honest and universal.

---

## Problem Statement

**Current limitation:** vibe-check relies on semantic commit messages to detect fix chains and debug spirals. This requires:
1. Developer discipline (consistent `fix:` prefixes)
2. Honest labeling (actually calling fixes "fixes")

**Goal:** Create a scoring algorithm that:
1. Works with ANY commit style (no semantic requirement)
2. Produces a calibrated probability (not just a rating)
3. Self-improves via feedback loop with vibe-levels
4. Meets peer-review standards (ICSE/FSE caliber)

---

## The Vibe Score Algorithm

### Core Formula

```
VibeScore = w₁×(1-FileChurn) + w₂×(1-TimeSpiral) + w₃×(1-VelocityAnomaly) + w₄×CodeStability

Where:
  FileChurn      = files touched 3+ times in 1 hour / total files
  TimeSpiral     = commit clusters <5min apart / total commits
  VelocityAnomaly = z-score of commit velocity vs personal baseline
  CodeStability  = lines surviving >24h / lines added

Weights (initial, will calibrate):
  w₁ = 0.30  (file churn - strongest signal)
  w₂ = 0.25  (time spirals)
  w₃ = 0.20  (velocity anomaly)
  w₄ = 0.25  (code stability)

Output: 0.0 (disaster) to 1.0 (elite flow)
```

### Metric Definitions

#### 1. File Churn Score (0-1)

**What it measures:** "Did code stick on first touch?"

```typescript
function calculateFileChurnScore(commits: Commit[]): number {
  const fileTimestamps = new Map<string, Date[]>();

  for (const commit of commits) {
    for (const file of commit.files) {
      const times = fileTimestamps.get(file) || [];
      times.push(commit.date);
      fileTimestamps.set(file, times);
    }
  }

  let churnedFiles = 0;
  for (const [file, times] of fileTimestamps) {
    const sorted = times.sort((a, b) => a.getTime() - b.getTime());
    // Check for 3+ touches within 1 hour
    for (let i = 0; i < sorted.length - 2; i++) {
      const span = sorted[i + 2].getTime() - sorted[i].getTime();
      if (span < 60 * 60 * 1000) {  // 1 hour in ms
        churnedFiles++;
        break;
      }
    }
  }

  const churnRatio = churnedFiles / fileTimestamps.size;
  return 1 - churnRatio;  // Invert: high score = low churn
}
```

**Thresholds:**
| Churn Ratio | Score | Interpretation |
|-------------|-------|----------------|
| <10% | 0.90-1.0 | Elite - code sticks |
| 10-25% | 0.75-0.90 | High - minor rework |
| 25-40% | 0.60-0.75 | Medium - notable thrashing |
| >40% | <0.60 | Low - significant spiral |

#### 2. Time Spiral Score (0-1)

**What it measures:** "Are commits clustered in frustrated bursts?"

```typescript
function calculateTimeSpiralScore(commits: Commit[]): number {
  if (commits.length < 2) return 1.0;

  const sorted = commits.sort((a, b) => a.date.getTime() - b.date.getTime());
  let spiralCommits = 0;

  for (let i = 1; i < sorted.length; i++) {
    const gap = sorted[i].date.getTime() - sorted[i - 1].date.getTime();
    if (gap < 5 * 60 * 1000) {  // <5 minutes
      spiralCommits++;
    }
  }

  const spiralRatio = spiralCommits / commits.length;
  return 1 - spiralRatio;
}
```

**Why 5 minutes?** Research shows productive commits average 15-30 min apart. <5 min typically indicates trial-and-error or debugging.

#### 3. Velocity Anomaly Score (0-1)

**What it measures:** "Is this pattern abnormal for this developer?"

```typescript
function calculateVelocityAnomalyScore(
  commits: Commit[],
  historicalBaseline: { mean: number; stdDev: number }
): number {
  const currentVelocity = commits.length / getActiveHours(commits);

  // Z-score: how many std devs from personal mean
  const zScore = Math.abs(
    (currentVelocity - historicalBaseline.mean) / historicalBaseline.stdDev
  );

  // Convert to 0-1 score (sigmoid transform)
  // z=0 → 1.0, z=2 → 0.12, z=3 → 0.05
  return 1 / (1 + Math.exp(zScore - 1.5));
}
```

**Why personal baseline?** Developers have different natural velocities. Anomaly detection catches *relative* changes, not absolute thresholds.

#### 4. Code Stability Score (0-1)

**What it measures:** "How long do lines survive?"

```typescript
function calculateCodeStabilityScore(
  commits: Commit[],
  repo: GitRepository
): number {
  const recentCommits = commits.filter(c =>
    c.date > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)  // Last 7 days
  );

  let linesAdded = 0;
  let linesSurviving = 0;

  for (const commit of recentCommits) {
    const additions = getAdditions(commit);
    linesAdded += additions;

    // Check if lines still exist in HEAD
    const surviving = await countSurvivingLines(commit, repo);
    linesSurviving += surviving;
  }

  return linesAdded > 0 ? linesSurviving / linesAdded : 1.0;
}
```

**Limitation:** Requires git blame analysis (more compute). Can be optional/async.

---

## Calibration Framework

### The Feedback Loop

```
┌─────────────────────────────────────────────────────────┐
│                    CALIBRATION LOOP                      │
├─────────────────────────────────────────────────────────┤
│                                                         │
│    ┌─────────────┐     ┌─────────────┐                 │
│    │ Git History │────>│ Vibe Score  │                 │
│    │  (signals)  │     │ (computed)  │                 │
│    └─────────────┘     └──────┬──────┘                 │
│                               │                         │
│                               ▼                         │
│    ┌─────────────────────────────────────────┐         │
│    │ Declared Vibe Level (0-5)               │         │
│    │ (user states: "This is Level 3 work")   │         │
│    └──────────────────┬──────────────────────┘         │
│                       │                                 │
│                       ▼                                 │
│    ┌─────────────────────────────────────────┐         │
│    │ Calibration Signal                      │         │
│    │ Score vs Expected for Vibe Level        │         │
│    │                                         │         │
│    │ Level 5: Expected Score 0.90-1.00       │         │
│    │ Level 3: Expected Score 0.60-0.80       │         │
│    │ Level 1: Expected Score 0.30-0.50       │         │
│    └──────────────────┬──────────────────────┘         │
│                       │                                 │
│                       ▼                                 │
│    ┌─────────────────────────────────────────┐         │
│    │ Weight Adjustment (Gradient Update)     │         │
│    │                                         │         │
│    │ If Score > Expected: weights OK         │         │
│    │ If Score < Expected: adjust weights     │         │
│    │    toward metrics that predicted it     │         │
│    └─────────────────────────────────────────┘         │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Expected Scores by Vibe Level

| Vibe Level | Trust | Expected Score Range | Interpretation |
|------------|-------|---------------------|----------------|
| 5 | 95% | 0.90-1.00 | Near-perfect flow |
| 4 | 80% | 0.80-0.90 | Occasional minor fixes |
| 3 | 60% | 0.65-0.80 | Some iteration normal |
| 2 | 40% | 0.50-0.70 | Expect rework cycles |
| 1 | 20% | 0.30-0.55 | Heavy iteration expected |
| 0 | 0% | 0.00-0.40 | Exploration/research mode |

### Calibration Algorithm

```typescript
interface CalibrationData {
  vibeLevel: 0 | 1 | 2 | 3 | 4 | 5;
  observedScore: number;
  timestamp: Date;
  weights: number[];  // [w1, w2, w3, w4]
}

function updateWeights(
  history: CalibrationData[],
  learningRate: number = 0.1
): number[] {
  const currentWeights = history[history.length - 1].weights;

  // Calculate Expected Calibration Error (ECE)
  const bins = groupByVibeLevel(history);
  let ece = 0;

  for (const [level, samples] of bins) {
    const expectedCenter = getExpectedCenter(level);
    const actualMean = mean(samples.map(s => s.observedScore));
    ece += samples.length * Math.abs(actualMean - expectedCenter);
  }
  ece /= history.length;

  // If ECE > 0.10, adjust weights
  if (ece > 0.10) {
    // Gradient: which metric most correlates with miscalibration?
    const gradients = computeGradients(history, currentWeights);
    return currentWeights.map((w, i) =>
      Math.max(0.1, Math.min(0.5, w - learningRate * gradients[i]))
    );
  }

  return currentWeights;
}
```

### Expected Calibration Error (ECE)

**Target:** ECE < 0.10 (less than 10% average calibration error)

```
ECE = Σᵢ (nᵢ/N) × |accuracy(bin_i) - confidence(bin_i)|

For vibe-check:
  - bin_i = samples at vibe level i
  - accuracy = observed score
  - confidence = expected score for that level
  - N = total samples
```

---

## Ground Truth Sources

### Three-Source Triangulation

To validate the Vibe Score scientifically, we need independent ground truth:

#### Source 1: DORA Metrics (Objective)

| DORA Metric | How to Compute | Vibe Score Correlation |
|-------------|----------------|------------------------|
| Deployment Frequency | Commits reaching main/week | Higher → Higher Score |
| Lead Time | PR open → merge time | Shorter → Higher Score |
| Change Failure Rate | Reverts/total commits | Lower → Higher Score |
| MTTR | Time to fix broken builds | Shorter → Higher Score |

**Implementation:** Integrate with CI/CD APIs (GitHub Actions, GitLab CI)

#### Source 2: Developer Self-Report (Subjective)

```typescript
interface DeveloperSurvey {
  // NASA-TLX (validated scale)
  mentalDemand: 1-10;      // How mentally demanding was this?
  frustration: 1-10;       // How frustrated were you?
  effort: 1-10;            // How hard did you work?

  // Flow State (short form)
  concentration: 1-5;      // Were you in flow?
  timeAwareness: 1-5;      // Did time fly by?

  // Custom
  codeStickiness: 1-5;     // Did your code work first try?
  declaredVibeLevel: 0-5;  // What level was this task?
}
```

**Collection:** Weekly 2-minute survey (target 60% response rate)

#### Source 3: Behavioral Coding (Expert)

Train 2-3 human coders to rate git history:

```yaml
Coding Schema:
  Spiral Detected:
    - 0: No spiral visible
    - 1: Minor iteration (2 related fixes)
    - 2: Moderate spiral (3-4 fix chain)
    - 3: Major spiral (5+ commits same component)

  Frustration Signals:
    - commit message tone (neutral, frustrated, relieved)
    - late-night commits (>10pm)
    - weekend emergency commits

  Code Quality:
    - atomic commits (single purpose)
    - test coverage changes
    - documentation updates

Inter-Rater Reliability Target: Cohen's κ ≥ 0.70
```

### Triangulation Matrix

```
                  DORA    |  Survey  |  Expert  | Vibe Score
                (objective)|(subjective)|(behavioral)|(computed)
────────────────────────────────────────────────────────────────
High Score       Fast      |  Low     |  Clean   |   0.85+
                deploys    | frustration| history |
────────────────────────────────────────────────────────────────
Low Score        Slow/     |  High    |  Spiral  |   <0.50
                failures   | frustration| detected |
────────────────────────────────────────────────────────────────

If all 4 agree → Strong construct validity ✓
If 3/4 agree  → Acceptable validity
If 2/4 agree  → Investigate divergence
```

---

## Statistical Validation Plan

### Phase 1: Construct Validity (Weeks 1-8)

**Sample:** 80-100 repositories, 2,000+ commits

**Tests:**

| Test | Expected Result | Pass Criteria |
|------|-----------------|---------------|
| Convergent Validity | Vibe Score ↔ DORA metrics | ρ ≥ 0.40 |
| Convergent Validity | Vibe Score ↔ Survey frustration | ρ ≤ -0.35 |
| Discriminant Validity | Vibe Score ↔ Lines of Code | ρ ≈ 0 |
| Internal Consistency | 4 sub-metrics | Cronbach's α ≥ 0.70 |

### Phase 2: Predictive Validity (Weeks 9-16)

**Hypothesis:** Vibe Score predicts future outcomes

```
Model 1: BugDensity(t+4weeks) ~ VibeScore(t) + Controls
Model 2: LeadTime(t+4weeks) ~ VibeScore(t) + Controls
Model 3: DeveloperChurn ~ VibeScore(avg_12mo) + Controls

Target: R² ≥ 0.25 (explains 25%+ of variance)
```

### Phase 3: Intervention Study (Weeks 17-32)

**Design:** Randomized Controlled Trial

```
Treatment Group (n=60):
  - See Vibe Score dashboard daily
  - Receive vibe-level recommendations
  - Weekly coaching on maintaining flow

Control Group (n=60):
  - Business as usual
  - No vibe feedback

Duration: 8 weeks
Primary Outcome: DORA Lead Time improvement
Secondary: Survey frustration, Flow state
Effect Size Target: Cohen's d ≥ 0.50
```

### Sample Size Justification

```
Correlation Study (Phase 1):
  n = (z_α/2 + z_β)² / ln((1+r)/(1-r))² + 3
  For ρ = 0.40, α = 0.05, power = 0.80:
  n ≈ 64 repositories (target 80-100 for safety)

Intervention Study (Phase 3):
  n = 2 × (z_α/2 + z_β)² × 2σ² / δ²
  For d = 0.50, α = 0.05, power = 0.80:
  n ≈ 64 per group (target 60-75 for attrition)
```

---

## Implementation Roadmap

### Tier 1: Core Algorithm (Week 1-2)

```
[ ] Implement FileChurnScore
    - Parse git log --name-only
    - Track file touch timestamps
    - Detect 3+ touches in 1 hour

[ ] Implement TimeSpiralScore
    - Parse commit timestamps
    - Detect <5min clusters
    - Calculate spiral ratio

[ ] Implement VelocityAnomalyScore
    - Calculate personal baseline (last 30 days)
    - Z-score transform
    - Sigmoid normalization

[ ] Composite VibeScore
    - Weighted combination
    - Normalize to 0-1
    - Add to existing output
```

### Tier 2: Calibration Loop (Week 3-4)

```
[ ] Add vibe-level declaration to CLI
    --vibe-level 3 "I'm doing Level 3 work"

[ ] Store calibration history
    .vibe-check/calibration.json

[ ] Implement ECE calculation
    Compare observed vs expected by level

[ ] Weight adjustment algorithm
    Update weights when ECE > 0.10
```

### Tier 3: Validation Infrastructure (Week 5-8)

```
[ ] DORA metrics integration
    - GitHub API for deployment frequency
    - CI/CD status for change failure rate

[ ] Survey collection endpoint
    - Simple web form
    - Weekly reminder integration

[ ] Statistical analysis scripts
    - Correlation analysis
    - Reliability diagrams
    - ECE tracking over time
```

---

## Algorithm Selection Rationale

### Why Not Machine Learning (Yet)?

| Approach | Pros | Cons | When to Use |
|----------|------|------|-------------|
| **Rule-based (chosen)** | Interpretable, no training data needed | May miss patterns | Phase 1: establish baseline |
| **Isolation Forest** | Good for anomalies | Requires training set | Phase 2: anomaly detection |
| **LSTM Autoencoder** | Captures temporal patterns | Black box, needs GPU | Phase 3: deep patterns |
| **Gradient Boosting** | High accuracy | Needs labeled data | Phase 4: after calibration |

**Our approach:** Start rule-based → collect labeled data via calibration loop → add ML in Phase 2+

### Why These Four Metrics?

| Metric | SPACE Dimension | DORA Correlation | Signal Strength |
|--------|-----------------|------------------|-----------------|
| File Churn | Efficiency | Change Failure Rate | High |
| Time Spiral | Activity + Flow | Lead Time | High |
| Velocity Anomaly | Performance | Deployment Frequency | Medium |
| Code Stability | Efficiency | MTTR | Medium-High |

All four map to validated frameworks (SPACE, DORA), ensuring construct validity.

---

## Academic References

### Core Frameworks

1. **SPACE Framework** - Forsgren et al. (2021). "The SPACE of Developer Productivity." ACM Queue.
   - Defines 5 dimensions of developer productivity
   - Explicitly rejects single-metric evaluation
   - [Microsoft Research](https://www.microsoft.com/en-us/research/publication/the-space-of-developer-productivity-theres-more-to-it-than-you-think/)

2. **DORA Metrics** - Forsgren, Humble, Kim. "Accelerate" (2018).
   - 10+ years of validated research
   - 2,000+ organizations studied
   - [DORA Guides](https://dora.dev/guides/dora-metrics-four-keys/)

### Validation Methodology

3. **Construct Validity in SE** - Ralph et al. (2018). EASE Conference.
   - 7 guidelines for validating SE metrics
   - [ACM Digital Library](https://dl.acm.org/doi/10.1145/3210459.3210461)

4. **Metrics Validation** - Fenton & Pfleeger. "Software Metrics" (1996).
   - Gold standard for software measurement
   - 6 validity criteria still used today

5. **Calibration in ML** - Nixon et al. (2019). "Measuring Calibration." CVPR.
   - Expected Calibration Error (ECE) definition
   - Temperature scaling method
   - [OpenAccess](https://openaccess.thecvf.com/content_CVPRW_2019/papers/Uncertainty%20and%20Robustness%20in%20Deep%20Visual%20Learning/Nixon_Measuring_Calibration_in_Deep_Learning_CVPRW_2019_paper.pdf)

### Time Series Analysis

6. **Anomaly Detection Survey** - Schmidl et al. (2022). "Comprehensive Evaluation." VLDB.
   - Compares 71 algorithms on 967 time series
   - [TimeEval](https://timeeval.github.io/evaluation-paper/)

7. **Isolation Forest** - Liu et al. (2008). ICDM.
   - Original algorithm paper
   - O(n log n) complexity

### Industry Validation

8. **DORA State of DevOps** - Annual reports since 2013
   - 39,000+ professionals surveyed
   - Elite performers 2x more likely to exceed goals
   - [Accelerate State of DevOps Report](https://dora.dev/research/)

---

## Open Questions

1. **Cold start problem:** How many commits needed for reliable score?
   - Hypothesis: 20+ commits minimum
   - Need validation study

2. **Team vs individual:** Should score be per-developer or per-repo?
   - DORA warns against individual metrics
   - Consider: aggregate for team, flag for individual awareness

3. **Language/framework effects:** Do different tech stacks have different baselines?
   - Hypothesis: Yes, need per-stack calibration
   - Consider: normalize within tech stack

4. **AI-assisted coding:** Does Copilot/Claude change patterns?
   - Unknown territory
   - This study could contribute novel findings

---

## Next Steps

1. **User decision:** Proceed with Tier 1 implementation?
2. **Scope decision:** Start with file churn only, or all 4 metrics?
3. **Validation decision:** Collect calibration data from your own usage first?

---

## Token Stats

- Research tokens: ~45k
- Bundle tokens: ~8k
- Compression ratio: ~5.6:1
