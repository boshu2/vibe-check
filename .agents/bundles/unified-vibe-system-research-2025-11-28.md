# Unified Vibe System: Scientific Framework

**Type:** Research (Merged)
**Created:** 2025-11-28
**Loop:** Outer (foundational architecture)
**Tags:** vibe-coding, vibe-levels, scoring-algorithm, machine-learning, scientific-validation, feedback-loop
**Sources:**
- `vibe-level-scoring-algorithm-research-2025-11-28.md`
- `vibe-score-scientific-framework-2025-11-28.md`

---

## Executive Summary

A complete, scientifically rigorous system for vibe-coding that:

1. **Recommends** appropriate trust level (0-5) before work starts
2. **Measures** actual coding health from git history (0.0-1.0 score)
3. **Calibrates** both models via feedback loop
4. **Works universally** - no semantic commits required

**Key innovation:** Two complementary algorithms that feed each other, creating a self-improving system.

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      UNIFIED VIBE SYSTEM                                 │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌───────────────────────────────────────────────────────────────────┐ │
│  │                    PHASE 1: PRE-SESSION                           │ │
│  │                                                                   │ │
│  │   User Input                    Level Recommender                 │ │
│  │   ──────────                    ─────────────────                 │ │
│  │   5 Questions:                  Algorithm: Ordered Logistic       │ │
│  │   • Reversibility               Inputs: Questions + History       │ │
│  │   • Blast radius                Output: Level 0-5 + Confidence    │ │
│  │   • Verification cost                                             │ │
│  │   • Domain complexity           "Recommend Level 3 (82% conf)"    │ │
│  │   • AI track record                                               │ │
│  │                                                                   │ │
│  └───────────────────────────────────────────────────────────────────┘ │
│                              │                                          │
│                              ▼                                          │
│  ┌───────────────────────────────────────────────────────────────────┐ │
│  │                    PHASE 2: WORK SESSION                          │ │
│  │                                                                   │ │
│  │   Developer/AI works at recommended trust level                   │ │
│  │   Git commits accumulate with natural patterns                    │ │
│  │                                                                   │ │
│  └───────────────────────────────────────────────────────────────────┘ │
│                              │                                          │
│                              ▼                                          │
│  ┌───────────────────────────────────────────────────────────────────┐ │
│  │                    PHASE 3: POST-SESSION                          │ │
│  │                                                                   │ │
│  │   Git History                   Vibe Score Calculator             │ │
│  │   ───────────                   ─────────────────────             │ │
│  │   • File changes                Algorithm: Weighted Composite     │ │
│  │   • Timestamps                  Inputs: Pure git signals          │ │
│  │   • Patterns                    Output: Score 0.0-1.0             │ │
│  │                                                                   │ │
│  │   NO SEMANTIC COMMITS NEEDED    "Session score: 0.72"             │ │
│  │                                                                   │ │
│  └───────────────────────────────────────────────────────────────────┘ │
│                              │                                          │
│                              ▼                                          │
│  ┌───────────────────────────────────────────────────────────────────┐ │
│  │                    PHASE 4: CALIBRATION                           │ │
│  │                                                                   │ │
│  │   Calibration Engine                                              │ │
│  │   ──────────────────                                              │ │
│  │   Compare: Score vs Expected for Level                            │ │
│  │   • Level 3 expected: 0.65-0.80                                   │ │
│  │   • Actual score: 0.72                                            │ │
│  │   • Assessment: CORRECT ✓                                         │ │
│  │                                                                   │ │
│  │   Update both models:                                             │ │
│  │   • Level Recommender weights (Bayesian posterior)                │ │
│  │   • Vibe Score weights (ECE optimization)                         │ │
│  │                                                                   │ │
│  └───────────────────────────────────────────────────────────────────┘ │
│                              │                                          │
│                              ▼                                          │
│                    IMPROVED MODELS FOR NEXT SESSION                     │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Component 1: Level Recommender

### Purpose
Recommend appropriate trust level (0-5) **before** work begins.

### Algorithm: Ordered Logistic Regression

**Why ordered (not multinomial):**
- Respects ordinal structure: 0 < 1 < 2 < 3 < 4 < 5
- Level 2 is "between" 1 and 3 (not just a different category)
- Fewer parameters, more stable with small data
- Gold standard in statistics for rating scales

**Mathematical Model:**
```
P(Y ≤ k) = σ(θₖ - Xβ)

Where:
  σ = sigmoid function
  θₖ = threshold for level k (5 thresholds learned)
  X = input features (14 total)
  β = feature weights (14 weights learned)
```

### Input Features (14 total)

**5 Questions (user-provided):**
| Question | Range | Meaning |
|----------|-------|---------|
| Q1: Reversibility | -2 to +1 | Can we undo mistakes? |
| Q2: Blast radius | -2 to +1 | How much breaks if wrong? |
| Q3: Verification cost | -2 to +1 | How hard to check correctness? |
| Q4: Domain complexity | -2 to +1 | How novel is this domain? |
| Q5: AI track record | -2 to +1 | Historical success in this area? |

**5 Current Metrics (from existing vibe-check):**
| Metric | Range | Source |
|--------|-------|--------|
| Trust Pass Rate | 0-100% | Semantic commits |
| Rework Ratio | 0-100% | Semantic commits |
| Debug Spiral Duration | 0-∞ min | Semantic commits |
| Flow Efficiency | 0-100% | Derived |
| Iteration Velocity | 0-∞ commits/hr | Timestamps |

**4 New Metrics (semantic-commit-free):**
| Metric | Range | Source |
|--------|-------|--------|
| File Churn Score | 0-1 | File touch patterns |
| Time Spiral Score | 0-1 | Commit timing clusters |
| Velocity Anomaly Score | 0-1 | Z-score vs baseline |
| Code Stability Score | 0-1 | Line survival analysis |

### Output
```typescript
interface LevelRecommendation {
  level: 0 | 1 | 2 | 3 | 4 | 5;
  confidence: number;           // 0-1, max probability
  probabilities: number[];      // [p0, p1, p2, p3, p4, p5]
  credibleInterval: [number, number];  // 95% CI
}

// Example output:
{
  level: 3,
  confidence: 0.82,
  probabilities: [0.01, 0.03, 0.08, 0.82, 0.05, 0.01],
  credibleInterval: [2.4, 3.6]
}
```

### Implementation

```typescript
import { Matrix } from 'ml-matrix';

interface OrderedLogisticModel {
  weights: number[];      // 14 feature weights
  thresholds: number[];   // 5 level thresholds
  priorMeans: number[];   // Bayesian prior means
  priorVariances: number[]; // Bayesian prior variances
}

function recommendLevel(
  questions: number[],      // 5 values
  currentMetrics: number[], // 5 values
  newMetrics: number[],     // 4 values
  model: OrderedLogisticModel
): LevelRecommendation {
  // Combine all features
  const features = [...questions, ...currentMetrics, ...newMetrics];

  // Compute linear predictor
  const eta = dotProduct(features, model.weights);

  // Compute cumulative probabilities
  const cumProbs = model.thresholds.map(t => sigmoid(t - eta));

  // Convert to level probabilities
  const probs = [
    cumProbs[0],
    cumProbs[1] - cumProbs[0],
    cumProbs[2] - cumProbs[1],
    cumProbs[3] - cumProbs[2],
    cumProbs[4] - cumProbs[3],
    1 - cumProbs[4]
  ];

  // Find most likely level
  const level = probs.indexOf(Math.max(...probs)) as 0|1|2|3|4|5;
  const confidence = Math.max(...probs);

  // Compute credible interval from probability distribution
  const mean = probs.reduce((sum, p, i) => sum + p * i, 0);
  const variance = probs.reduce((sum, p, i) => sum + p * (i - mean) ** 2, 0);
  const ci: [number, number] = [
    Math.max(0, mean - 1.96 * Math.sqrt(variance)),
    Math.min(5, mean + 1.96 * Math.sqrt(variance))
  ];

  return { level, confidence, probabilities: probs, credibleInterval: ci };
}
```

---

## Component 2: Vibe Score Calculator

### Purpose
Measure actual coding health **after** work session, using pure git signals (no semantic commits needed).

### Algorithm: Weighted Composite Score

**Core Formula:**
```
VibeScore = w₁×FileChurn + w₂×TimeSpiral + w₃×VelocityAnomaly + w₄×CodeStability

Where all component scores are 0-1 (higher = better)
Initial weights: w₁=0.30, w₂=0.25, w₃=0.20, w₄=0.25
Weights update via ECE optimization
```

### Component Metrics

#### 1. File Churn Score (0-1)

**What it measures:** Did code stick on first touch?

**Algorithm:**
```typescript
function calculateFileChurnScore(commits: CommitWithFiles[]): number {
  const fileTimestamps = new Map<string, Date[]>();

  // Collect all touch timestamps per file
  for (const commit of commits) {
    for (const file of commit.files) {
      const times = fileTimestamps.get(file) || [];
      times.push(commit.date);
      fileTimestamps.set(file, times);
    }
  }

  let churnedFiles = 0;
  const ONE_HOUR = 60 * 60 * 1000;

  for (const [file, times] of fileTimestamps) {
    const sorted = times.sort((a, b) => a.getTime() - b.getTime());

    // Detect 3+ touches within 1 hour (spiral indicator)
    for (let i = 0; i < sorted.length - 2; i++) {
      const span = sorted[i + 2].getTime() - sorted[i].getTime();
      if (span < ONE_HOUR) {
        churnedFiles++;
        break;
      }
    }
  }

  const churnRatio = fileTimestamps.size > 0
    ? churnedFiles / fileTimestamps.size
    : 0;

  return 1 - churnRatio;  // Invert: high score = low churn = good
}
```

**Thresholds:**
| Churn Ratio | Score | Interpretation |
|-------------|-------|----------------|
| <10% | 0.90-1.0 | Elite - code sticks |
| 10-25% | 0.75-0.90 | High - minor iteration |
| 25-40% | 0.60-0.75 | Medium - notable thrashing |
| >40% | <0.60 | Low - significant spiral |

#### 2. Time Spiral Score (0-1)

**What it measures:** Are commits clustered in frustrated bursts?

**Algorithm:**
```typescript
function calculateTimeSpiralScore(commits: Commit[]): number {
  if (commits.length < 2) return 1.0;

  const sorted = [...commits].sort((a, b) =>
    a.date.getTime() - b.date.getTime()
  );

  let spiralCommits = 0;
  const FIVE_MINUTES = 5 * 60 * 1000;

  for (let i = 1; i < sorted.length; i++) {
    const gap = sorted[i].date.getTime() - sorted[i - 1].date.getTime();
    if (gap < FIVE_MINUTES) {
      spiralCommits++;
    }
  }

  const spiralRatio = spiralCommits / (commits.length - 1);
  return 1 - spiralRatio;  // Invert: high score = few spirals = good
}
```

**Why 5 minutes?** Research shows productive commits average 15-30 min apart. <5 min typically indicates trial-and-error debugging.

#### 3. Velocity Anomaly Score (0-1)

**What it measures:** Is this pattern abnormal for this developer?

**Algorithm:**
```typescript
interface Baseline {
  mean: number;    // commits/hour historical average
  stdDev: number;  // historical standard deviation
}

function calculateVelocityAnomalyScore(
  commits: Commit[],
  baseline: Baseline
): number {
  const hours = calculateActiveHours(commits);
  const currentVelocity = hours > 0 ? commits.length / hours : 0;

  // Z-score: how many std devs from personal mean
  const zScore = baseline.stdDev > 0
    ? Math.abs((currentVelocity - baseline.mean) / baseline.stdDev)
    : 0;

  // Sigmoid transform: z=0 → 1.0, z=2 → 0.12, z=3 → 0.05
  return 1 / (1 + Math.exp(zScore - 1.5));
}
```

**Why personal baseline?** Developers have different natural velocities. Anomaly detection catches *relative* changes, not arbitrary thresholds.

#### 4. Code Stability Score (0-1)

**What it measures:** How long do added lines survive?

**Algorithm:**
```typescript
async function calculateCodeStabilityScore(
  commits: Commit[],
  repo: Repository
): Promise<number> {
  // Only analyze commits from last 7 days with 24h+ age
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  const eligibleCommits = commits.filter(c =>
    c.date.getTime() < cutoff
  );

  if (eligibleCommits.length === 0) return 1.0;

  let totalAdded = 0;
  let totalSurviving = 0;

  for (const commit of eligibleCommits) {
    const stats = await getCommitStats(repo, commit.hash);
    totalAdded += stats.additions;

    // Check how many lines from this commit still exist in HEAD
    const surviving = await countSurvivingLines(repo, commit.hash);
    totalSurviving += surviving;
  }

  return totalAdded > 0 ? totalSurviving / totalAdded : 1.0;
}
```

**Note:** This metric requires git blame analysis, which is more compute-intensive. It can be made optional or async.

### Composite Score

```typescript
interface VibeScoreResult {
  score: number;              // 0.0-1.0 composite
  components: {
    fileChurn: number;
    timeSpiral: number;
    velocityAnomaly: number;
    codeStability: number;
  };
  weights: number[];          // Current weights
  interpretation: 'elite' | 'high' | 'medium' | 'low';
}

function calculateVibeScore(
  commits: CommitWithFiles[],
  baseline: Baseline,
  repo: Repository,
  weights: number[] = [0.30, 0.25, 0.20, 0.25]
): VibeScoreResult {
  const components = {
    fileChurn: calculateFileChurnScore(commits),
    timeSpiral: calculateTimeSpiralScore(commits),
    velocityAnomaly: calculateVelocityAnomalyScore(commits, baseline),
    codeStability: await calculateCodeStabilityScore(commits, repo)
  };

  const score =
    weights[0] * components.fileChurn +
    weights[1] * components.timeSpiral +
    weights[2] * components.velocityAnomaly +
    weights[3] * components.codeStability;

  const interpretation =
    score >= 0.85 ? 'elite' :
    score >= 0.70 ? 'high' :
    score >= 0.50 ? 'medium' : 'low';

  return { score, components, weights, interpretation };
}
```

---

## Component 3: Calibration Engine

### Purpose
Compare predicted level against actual score, update both models.

### Expected Score Ranges by Level

| Vibe Level | Trust | Expected Score | Interpretation |
|------------|-------|----------------|----------------|
| 5 | 95% | 0.90-1.00 | Near-perfect flow |
| 4 | 80% | 0.80-0.92 | Occasional minor fixes |
| 3 | 60% | 0.65-0.82 | Some iteration normal |
| 2 | 40% | 0.50-0.70 | Expect rework cycles |
| 1 | 20% | 0.30-0.55 | Heavy iteration expected |
| 0 | 0% | 0.00-0.40 | Exploration/research mode |

### Outcome Assessment

```typescript
type Outcome = 'correct' | 'too_high' | 'too_low';

interface ExpectedRange {
  min: number;
  max: number;
}

const EXPECTED_RANGES: Record<number, ExpectedRange> = {
  5: { min: 0.90, max: 1.00 },
  4: { min: 0.80, max: 0.92 },
  3: { min: 0.65, max: 0.82 },
  2: { min: 0.50, max: 0.70 },
  1: { min: 0.30, max: 0.55 },
  0: { min: 0.00, max: 0.40 },
};

function assessOutcome(
  recommendedLevel: number,
  actualScore: number
): Outcome {
  const expected = EXPECTED_RANGES[recommendedLevel];

  if (actualScore >= expected.min && actualScore <= expected.max) {
    return 'correct';
  } else if (actualScore > expected.max) {
    // Score higher than expected = level was too conservative
    return 'too_low';
  } else {
    // Score lower than expected = level was too aggressive
    return 'too_high';
  }
}
```

### Model Updates

#### Level Recommender Update (Bayesian)

```typescript
function updateLevelRecommender(
  model: OrderedLogisticModel,
  features: number[],
  recommendedLevel: number,
  outcome: Outcome,
  learningRate: number = 0.05
): OrderedLogisticModel {
  // Determine "true" level based on outcome
  const trueLevel =
    outcome === 'correct' ? recommendedLevel :
    outcome === 'too_high' ? recommendedLevel - 1 :
    recommendedLevel + 1;

  // Clamp to valid range
  const clampedTrue = Math.max(0, Math.min(5, trueLevel));

  // Compute gradient of ordinal cross-entropy loss
  const predicted = predictProbabilities(model, features);
  const gradient = computeOrdinalGradient(predicted, clampedTrue, features);

  // Update weights with Bayesian regularization toward prior
  const newWeights = model.weights.map((w, i) => {
    const priorPull = (model.priorMeans[i] - w) * 0.01;  // Regularization
    return w - learningRate * gradient.weights[i] + priorPull;
  });

  // Update thresholds
  const newThresholds = model.thresholds.map((t, i) =>
    t - learningRate * gradient.thresholds[i]
  );

  return {
    ...model,
    weights: newWeights,
    thresholds: newThresholds
  };
}
```

#### Vibe Score Update (ECE Optimization)

```typescript
interface CalibrationSample {
  level: number;
  score: number;
  timestamp: Date;
}

function updateVibeScoreWeights(
  currentWeights: number[],
  history: CalibrationSample[],
  learningRate: number = 0.1
): number[] {
  // Group by level
  const bins = new Map<number, number[]>();
  for (const sample of history) {
    const scores = bins.get(sample.level) || [];
    scores.push(sample.score);
    bins.set(sample.level, scores);
  }

  // Calculate Expected Calibration Error
  let ece = 0;
  let totalSamples = 0;

  for (const [level, scores] of bins) {
    const expected = EXPECTED_RANGES[level];
    const expectedCenter = (expected.min + expected.max) / 2;
    const actualMean = scores.reduce((a, b) => a + b, 0) / scores.length;

    ece += scores.length * Math.abs(actualMean - expectedCenter);
    totalSamples += scores.length;
  }
  ece /= totalSamples;

  // If ECE > 0.10, adjust weights
  if (ece > 0.10) {
    // Simplified: increase weight of most predictive component
    // Full version: compute gradient of ECE w.r.t. weights
    const adjustments = computeECEGradient(history, currentWeights);

    return currentWeights.map((w, i) => {
      const newW = w - learningRate * adjustments[i];
      return Math.max(0.1, Math.min(0.5, newW));  // Clamp to reasonable range
    });
  }

  return currentWeights;
}
```

### Calibration Monitoring

**Target:** Expected Calibration Error (ECE) < 0.10

```typescript
function calculateECE(history: CalibrationSample[]): number {
  const bins = groupByLevel(history);
  let ece = 0;
  let total = 0;

  for (const [level, scores] of bins) {
    const expected = (EXPECTED_RANGES[level].min + EXPECTED_RANGES[level].max) / 2;
    const actual = mean(scores);
    ece += scores.length * Math.abs(actual - expected);
    total += scores.length;
  }

  return total > 0 ? ece / total : 0;
}

function generateReliabilityDiagram(history: CalibrationSample[]): void {
  // For each level, plot expected vs actual score
  // Perfect calibration = diagonal line
  console.log('Level | Expected | Actual | Gap');
  console.log('------|----------|--------|----');

  for (let level = 0; level <= 5; level++) {
    const samples = history.filter(s => s.level === level);
    if (samples.length === 0) continue;

    const expected = (EXPECTED_RANGES[level].min + EXPECTED_RANGES[level].max) / 2;
    const actual = mean(samples.map(s => s.score));
    const gap = Math.abs(expected - actual);

    console.log(`  ${level}   |  ${expected.toFixed(2)}   | ${actual.toFixed(2)}  | ${gap.toFixed(2)}`);
  }
}
```

---

## Data Schema

### Session Record

```typescript
interface SessionRecord {
  // Identity
  sessionId: string;
  timestamp: Date;
  developerId: string;        // Anonymized hash

  // Pre-session input
  questions: {
    reversibility: number;    // -2 to +1
    blastRadius: number;      // -2 to +1
    verificationCost: number; // -2 to +1
    domainComplexity: number; // -2 to +1
    aiTrackRecord: number;    // -2 to +1
  };

  // Recommendation
  recommendedLevel: number;
  levelConfidence: number;
  actualLevelUsed: number;

  // Post-session metrics (semantic-based)
  semanticMetrics: {
    trustPassRate: number;
    reworkRatio: number;
    debugSpiralDuration: number;
    flowEfficiency: number;
    iterationVelocity: number;
  };

  // Post-session metrics (semantic-free)
  gitMetrics: {
    fileChurnScore: number;
    timeSpiralScore: number;
    velocityAnomalyScore: number;
    codeStabilityScore: number;
  };

  // Computed outcomes
  vibeScore: number;
  outcome: 'correct' | 'too_high' | 'too_low';

  // Model state
  modelVersion: string;
  recommenderWeights: number[];
  scoreWeights: number[];
}
```

### Storage

```typescript
// Option A: JSONL file (simple, portable)
// .vibe-check/sessions.jsonl

// Option B: SQLite (queryable, efficient)
// .vibe-check/vibe.db

// Schema for SQLite:
const SCHEMA = `
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  timestamp TEXT,
  developer_id TEXT,
  recommended_level INTEGER,
  vibe_score REAL,
  outcome TEXT,
  model_version TEXT,
  data JSON
);

CREATE INDEX idx_developer ON sessions(developer_id);
CREATE INDEX idx_timestamp ON sessions(timestamp);
CREATE INDEX idx_outcome ON sessions(outcome);
`;
```

---

## Validation Protocol

### Anthropic-Grade Standards

1. **Report SEM (Standard Error of Mean)**
   ```
   Accuracy: 82% ± 3.2% (n=64)
   ```

2. **Use Paired-Difference Analysis**
   - Compare model vs baseline on SAME sessions
   - Reduces variance in estimates

3. **Clustered Standard Errors**
   - Sessions from same developer are correlated
   - Naive SE underestimates true uncertainty by ~3x

4. **Power Analysis Before Experiment**
   - For d=0.5 effect, α=0.05, power=0.80: n≈64 per group

5. **95% Confidence Intervals**
   - `CI = mean ± 1.96 × SEM`

### Validation Metrics

| Metric | Target | How to Measure |
|--------|--------|----------------|
| Level Accuracy | >80% | Correct level / total |
| Cohen's Kappa | >0.60 | Agreement with expert |
| Mean Absolute Error | <0.8 levels | Avg distance from true |
| Calibration (ECE) | <0.10 | Predicted vs actual |
| Brier Score | <0.15 | Probability calibration |
| Domain Consistency | <10% gap | Performance across domains |

### Study Phases

```
PHASE 1: Bootstrap (Weeks 1-4)
├── Collect 50+ sessions without ML recommendations
├── Use simple formula for level (current approach)
├── Compute all metrics for each session
└── Establish baseline accuracy

PHASE 2: Learned Weights (Weeks 5-8)
├── Train Ordered Logistic on collected data
├── Split 70/20/10 (train/val/test)
├── Measure improvement over baseline
└── Report accuracy ± SEM

PHASE 3: A/B Test (Weeks 9-16)
├── Control: Simple formula recommendations
├── Treatment: ML-based recommendations
├── Measure: Does ML improve Trust Pass Rate?
└── Statistical test: Paired t-test, report Cohen's d

PHASE 4: Feedback Loop (Weeks 17-24)
├── Enable continuous learning
├── Monitor ECE weekly
├── Detect concept drift (>5% accuracy drop)
└── Publish findings
```

### Sample Size Requirements

| Phase | Samples | Purpose |
|-------|---------|---------|
| Bootstrap | 50 | Establish baseline weights |
| Validation | 100 | Compute accuracy with CI |
| A/B Test | 64 per group | Detect medium effect (d=0.5) |
| Production | 200+ | Enable full ensemble |

---

## Ground Truth Sources

### Three-Source Triangulation

To validate scientifically, we need independent ground truth:

#### Source 1: DORA Metrics (Objective)

| DORA Metric | Vibe Score Correlation |
|-------------|------------------------|
| Deployment Frequency | Higher → Higher Score |
| Lead Time for Changes | Shorter → Higher Score |
| Change Failure Rate | Lower → Higher Score |
| Mean Time to Restore | Shorter → Higher Score |

#### Source 2: Developer Self-Report (Subjective)

```typescript
interface WeeklySurvey {
  // NASA-TLX (validated scale)
  mentalDemand: 1-10;
  frustration: 1-10;
  effort: 1-10;

  // Flow State
  concentration: 1-5;
  timeAwareness: 1-5;

  // Custom
  codeStickiness: 1-5;
}
```

#### Source 3: Expert Coding (Behavioral)

Train 2-3 human coders to rate git history:
- Spiral severity (0-3)
- Frustration signals
- Code quality indicators

**Inter-rater reliability target:** Cohen's κ ≥ 0.70

### Triangulation Matrix

```
                 DORA    | Survey  | Expert  | Vibe Score
                (obj)    | (subj)  | (behav) | (computed)
─────────────────────────────────────────────────────────
High Score      Fast     | Low     | Clean   | 0.85+
                deploys  | stress  | history |
─────────────────────────────────────────────────────────
Low Score       Slow/    | High    | Spiral  | <0.50
                failures | stress  | detected|
```

---

## Implementation Roadmap

### Phase 1: Core Metrics (Week 1-2)

```
[ ] Implement FileChurnScore
    - Parse git log --name-only --format
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

[ ] Implement composite VibeScore
    - Weighted combination
    - Normalize to 0-1
    - Add to CLI output
```

### Phase 2: Level Recommender (Week 3-4)

```
[ ] Add --recommend flag to CLI
    vibe-check --recommend

[ ] Implement question prompts
    - Interactive mode for 5 questions
    - Or accept as flags

[ ] Implement simple formula (baseline)
    Level = 3 + Q1 + Q2 + Q3 + Q4 + Q5

[ ] Store session data for future training
    .vibe-check/sessions.jsonl
```

### Phase 3: Calibration Loop (Week 5-6)

```
[ ] Implement outcome assessment
    - Compare score vs expected range
    - Classify as correct/too_high/too_low

[ ] Implement ECE calculation
    - Group by level
    - Calculate mean score per level
    - Compare to expected centers

[ ] Add calibration report to CLI
    vibe-check --calibration-report
```

### Phase 4: ML Models (Week 7-8)

```
[ ] Implement Ordered Logistic Regression
    - Use mord or custom implementation
    - Train on collected sessions
    - Compare to simple formula

[ ] Implement online updates
    - partial_fit after each session
    - Bayesian regularization

[ ] Implement weight updates for VibeScore
    - ECE optimization
    - Gradient descent on weights
```

### Phase 5: Validation (Week 9-12)

```
[ ] Collect 100+ sessions
[ ] Run A/B test (formula vs ML)
[ ] Calculate all validation metrics
[ ] Generate reliability diagrams
[ ] Write validation report
```

---

## CLI Interface

```bash
# Current functionality (enhanced)
vibe-check --since "1 week ago"
# Output now includes VibeScore (0-1) in addition to existing metrics

# New: Get level recommendation before starting work
vibe-check --recommend
# Interactive prompts for 5 questions
# Output: Recommended Level 3 (82% confidence)

# New: Record session with recommendation
vibe-check --start-session --level 3
# Records session start time and recommended level

# New: End session and record outcome
vibe-check --end-session
# Computes all metrics, VibeScore, assesses outcome, updates models

# New: View calibration status
vibe-check --calibration
# Shows ECE, reliability diagram, model health

# New: Export training data
vibe-check --export-sessions > sessions.json
```

---

## Academic References

### Algorithm Sources
- **Ordered Logistic:** Agresti (2010), *Categorical Data Analysis*
- **Bayesian Methods:** Gelman et al., *Bayesian Data Analysis*
- **Online Learning:** Shalev-Shwartz, *Online Learning and Online Convex Optimization*
- **ECE:** Nixon et al. (2019), "Measuring Calibration in Deep Learning", CVPR

### Validation Methodology
- **DORA Metrics:** Forsgren, Humble, Kim, *Accelerate* (2018)
- **SPACE Framework:** Forsgren et al. (2021), ACM Queue
- **Cohen's Kappa:** Cohen (1960), *Educational and Psychological Measurement*
- **Power Analysis:** Cohen (1988), *Statistical Power Analysis*

### Anthropic Standards
- [Statistical Approach to Model Evals](https://www.anthropic.com/research/statistical-approach-to-model-evals)
- [Challenges in Evaluating AI Systems](https://www.anthropic.com/research/evaluating-ai-systems)

---

## Open Questions

1. **Cold start:** How many commits needed for reliable VibeScore?
   - Hypothesis: 10+ commits minimum
   - Need validation

2. **Team vs individual:** Should metrics be per-developer or per-repo?
   - DORA warns against individual metrics
   - Consider: aggregate for team, awareness for individual

3. **Code stability performance:** Git blame is slow for large repos
   - Option A: Make optional
   - Option B: Sample recent commits only
   - Option C: Async background calculation

4. **Semantic vs non-semantic:** What if both are available?
   - Current plan: Use both as features
   - Non-semantic provides fallback when semantic unavailable

---

## Bundle Stats

- Combined research tokens: ~90k
- Unified bundle tokens: ~12k
- Compression ratio: ~7.5:1

---

## Next Steps

Ready for `/plan` to create implementation tasks?

**Recommended starting point:** Phase 1 (Core Metrics) - adds VibeScore to existing tool without breaking changes.
