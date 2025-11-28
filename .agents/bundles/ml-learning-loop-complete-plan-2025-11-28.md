# ML Learning Loop: Complete Implementation Plan

**Type:** Plan
**Created:** 2025-11-28
**Depends On:** Gap analysis from current session
**Loop:** Middle (bridges research to implementation)
**Tags:** vibe-check, ml-learning, calibration, ordered-logistic, partial-fit

---

## Overview

Implement the **complete ML learning loop** for vibe-check. This plan addresses ALL 6 identified gaps to make the model actually learn from experience.

**What changes:**
1. Add `partialFit()` to ordered-logistic.ts for incremental learning
2. Add `retrain()` trigger to storage.ts based on ECE threshold or sample count
3. Modify `level` command to use ML model + actual metrics (not additive formula)
4. Wire `--calibrate` to trigger learning after adding sample
5. Add outcome inference from vibe score to "true" level
6. Update model weights in calibration.json after learning

**What doesn't change:**
- Existing 4 semantic-free metrics
- CLI interface
- ECE calculation formula
- Storage file format (adds fields, backward compatible)

---

## The 6 Gaps Addressed

| Gap | Solution | Files Modified |
|-----|----------|----------------|
| Model Learning | Add `partialFit()` | `ordered-logistic.ts` |
| Feedback Loop | Add `retrain()` trigger | `storage.ts` |
| Level Uses ML | Replace `calculateBaseLevel` with `predict` | `level.ts` |
| Metrics Integration | Fetch recent git metrics in `level` | `level.ts` |
| Outcome-Based Updates | Infer "true" level from score | `ece.ts`, `storage.ts` |
| Calibration Triggers Learning | Call `retrain()` after `addSample` | `storage.ts` |

---

## PDC Strategy

### Prevent
- [x] Read all existing code (completed above)
- [ ] Run `npm test` before starting
- [ ] Commit after each file modification

### Detect
- [ ] `npm run build` after each TypeScript change
- [ ] `npm test` after completing each gap
- [ ] Manual test: `vibe-check level --quick` should use ML

### Correct
- [ ] Git revert individual commits if issues found
- [ ] Each function is independent - can revert selectively

---

## Files to Modify

### 1. `src/recommend/ordered-logistic.ts` (ADD `partialFit`)

**Purpose:** Enable incremental learning from calibration samples

**Current:** Lines 1-113 (prediction only, no learning)

**Add after line 112 (before closing):**

```typescript
/**
 * Single-step stochastic gradient descent update.
 * Updates weights based on one sample's prediction error.
 *
 * For ordered logistic regression:
 * - We minimize negative log-likelihood
 * - Gradient for weight[j] = (p_k - y_k) * x_j summed over cutpoints
 *
 * Learning rate decays: lr = initialLr / (1 + decay * n)
 */
export function partialFit(
  model: ModelState,
  features: number[],
  trueLevel: number,
  learningRate: number = 0.01,
  sampleCount: number = 1
): ModelState {
  const effectiveLr = learningRate / (1 + 0.001 * sampleCount);

  // Get current predictions
  const probs = predictProba(features, model);

  // Create one-hot target
  const target = new Array(N_LEVELS).fill(0);
  target[Math.min(Math.max(0, Math.round(trueLevel)), N_LEVELS - 1)] = 1;

  // Gradient for weights: dL/dw_j = sum_k (p_k - y_k) * x_j
  const newWeights = [...model.weights];
  for (let j = 0; j < features.length && j < newWeights.length; j++) {
    let gradient = 0;
    for (let k = 0; k < N_LEVELS; k++) {
      gradient += (probs[k] - target[k]) * features[j];
    }
    newWeights[j] -= effectiveLr * gradient;
  }

  // Gradient for thresholds: dL/dt_k = p_k - cumTarget_k
  const newThresholds = [...model.thresholds];
  let cumTarget = 0;
  for (let k = 0; k < model.thresholds.length; k++) {
    cumTarget += target[k];
    const cumProb = probs.slice(0, k + 1).reduce((a, b) => a + b, 0);
    const gradient = cumProb - cumTarget;
    newThresholds[k] -= effectiveLr * gradient;
  }

  // Ensure thresholds remain ordered
  for (let i = 1; i < newThresholds.length; i++) {
    if (newThresholds[i] <= newThresholds[i - 1]) {
      newThresholds[i] = newThresholds[i - 1] + 0.1;
    }
  }

  return {
    weights: newWeights,
    thresholds: newThresholds,
  };
}

/**
 * Batch partial fit - applies partialFit to multiple samples.
 * Processes samples in order, accumulating updates.
 */
export function batchPartialFit(
  model: ModelState,
  samples: Array<{ features: number[]; trueLevel: number }>,
  learningRate: number = 0.01
): ModelState {
  let current = model;
  for (let i = 0; i < samples.length; i++) {
    current = partialFit(
      current,
      samples[i].features,
      samples[i].trueLevel,
      learningRate,
      i + 1
    );
  }
  return current;
}
```

**Validation:** `npm run build`

---

### 2. `src/calibration/ece.ts` (ADD `inferTrueLevel`)

**Purpose:** Infer the "true" level based on actual vibe score outcome

**Add after line 72:**

```typescript
/**
 * Infer the "true" vibe level from an actual vibe score.
 * This is used to generate training labels for the model.
 *
 * Maps score ranges to levels:
 * - 0.90-1.00 → 5 (Elite flow)
 * - 0.80-0.90 → 4 (High flow)
 * - 0.65-0.80 → 3 (Balanced)
 * - 0.50-0.65 → 2 (AI-Augmented)
 * - 0.30-0.50 → 1 (Human-Led)
 * - 0.00-0.30 → 0 (Manual)
 */
export function inferTrueLevel(vibeScore: number): 0 | 1 | 2 | 3 | 4 | 5 {
  if (vibeScore >= 0.90) return 5;
  if (vibeScore >= 0.80) return 4;
  if (vibeScore >= 0.65) return 3;
  if (vibeScore >= 0.50) return 2;
  if (vibeScore >= 0.30) return 1;
  return 0;
}
```

**Update exports in `src/calibration/index.ts`:**

```typescript
export { loadCalibration, saveCalibration, addSample, getCalibrationPath } from './storage';
export { calculateECE, assessOutcome, inferTrueLevel } from './ece';
```

**Validation:** `npm run build`

---

### 3. `src/calibration/storage.ts` (ADD learning loop)

**Purpose:** Trigger retraining when samples accumulate or ECE degrades

**Replace entire file (lines 1-71):**

```typescript
import * as fs from 'fs';
import * as path from 'path';
import { CalibrationState, CalibrationSample } from '../types';
import { DEFAULT_MODEL, partialFit, batchPartialFit, ModelState } from '../recommend/ordered-logistic';
import { calculateECE, inferTrueLevel } from './ece';

const CALIBRATION_DIR = '.vibe-check';
const CALIBRATION_FILE = 'calibration.json';

// Retraining triggers
const RETRAIN_SAMPLE_INTERVAL = 10;  // Retrain every N samples
const RETRAIN_ECE_THRESHOLD = 0.15;  // Retrain if ECE exceeds this

/**
 * Get calibration file path for a repository.
 */
export function getCalibrationPath(repoPath: string): string {
  return path.join(repoPath, CALIBRATION_DIR, CALIBRATION_FILE);
}

/**
 * Load calibration state from disk.
 */
export function loadCalibration(repoPath: string): CalibrationState {
  const filePath = getCalibrationPath(repoPath);

  if (fs.existsSync(filePath)) {
    try {
      const data = fs.readFileSync(filePath, 'utf-8');
      const state = JSON.parse(data);
      // Ensure dates are Date objects
      state.lastUpdated = new Date(state.lastUpdated);
      state.samples = state.samples.map((s: CalibrationSample) => ({
        ...s,
        timestamp: new Date(s.timestamp),
      }));
      return state;
    } catch {
      return defaultCalibrationState();
    }
  }

  return defaultCalibrationState();
}

/**
 * Save calibration state to disk.
 */
export function saveCalibration(repoPath: string, state: CalibrationState): void {
  const dirPath = path.join(repoPath, CALIBRATION_DIR);
  const filePath = getCalibrationPath(repoPath);

  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }

  fs.writeFileSync(filePath, JSON.stringify(state, null, 2));
}

/**
 * Add a calibration sample and potentially trigger retraining.
 *
 * Retraining is triggered when:
 * 1. Sample count is a multiple of RETRAIN_SAMPLE_INTERVAL, OR
 * 2. ECE exceeds RETRAIN_ECE_THRESHOLD
 *
 * Returns updated state with potentially new weights.
 */
export function addSample(
  repoPath: string,
  sample: CalibrationSample
): CalibrationState {
  const state = loadCalibration(repoPath);
  state.samples.push(sample);
  state.lastUpdated = new Date();

  // Check if retraining is needed
  const shouldRetrain =
    state.samples.length % RETRAIN_SAMPLE_INTERVAL === 0 ||
    state.ece > RETRAIN_ECE_THRESHOLD;

  if (shouldRetrain && state.samples.length >= 5) {
    const updatedState = retrain(state);
    saveCalibration(repoPath, updatedState);
    return updatedState;
  }

  // Just save without retraining
  saveCalibration(repoPath, state);
  return state;
}

/**
 * Retrain the model using all accumulated samples.
 *
 * Uses batch partial fit with inferred true levels from vibe scores.
 */
export function retrain(state: CalibrationState): CalibrationState {
  if (state.samples.length < 5) {
    return state; // Not enough data
  }

  // Prepare training data: use vibeScore to infer "true" level
  const trainingData = state.samples.map((sample) => ({
    features: sample.features,
    trueLevel: inferTrueLevel(sample.vibeScore),
  }));

  // Start from default model (or could start from current weights)
  const initialModel: ModelState = {
    weights: [...DEFAULT_MODEL.weights],
    thresholds: [...DEFAULT_MODEL.thresholds],
  };

  // Train with multiple epochs for better convergence
  let model = initialModel;
  const epochs = Math.min(10, Math.ceil(50 / state.samples.length));
  for (let epoch = 0; epoch < epochs; epoch++) {
    model = batchPartialFit(model, trainingData, 0.05);
  }

  // Calculate new ECE
  const newEce = calculateECE(state.samples);

  return {
    ...state,
    weights: model.weights,
    thresholds: model.thresholds,
    ece: newEce,
    lastUpdated: new Date(),
    version: '2.1.0', // Bump version to indicate ML-learned weights
  };
}

/**
 * Force retraining (manual trigger).
 */
export function forceRetrain(repoPath: string): CalibrationState {
  const state = loadCalibration(repoPath);
  if (state.samples.length < 5) {
    return state;
  }
  const updatedState = retrain(state);
  saveCalibration(repoPath, updatedState);
  return updatedState;
}

function defaultCalibrationState(): CalibrationState {
  return {
    samples: [],
    weights: DEFAULT_MODEL.weights,
    thresholds: DEFAULT_MODEL.thresholds,
    ece: 0,
    lastUpdated: new Date(),
    version: '2.0.0',
  };
}
```

**Update exports in `src/calibration/index.ts`:**

```typescript
export { loadCalibration, saveCalibration, addSample, getCalibrationPath, retrain, forceRetrain } from './storage';
export { calculateECE, assessOutcome, inferTrueLevel } from './ece';
```

**Validation:** `npm run build`

---

### 4. `src/recommend/index.ts` (ADD export for partialFit)

**Purpose:** Export new learning functions

**Replace lines 1-2:**

```typescript
export { predictProba, predict, predictWithConfidence, DEFAULT_MODEL, ModelState, partialFit, batchPartialFit } from './ordered-logistic';
export { VIBE_QUESTIONS, calculateBaseLevel, Question } from './questions';
```

**Validation:** `npm run build`

---

### 5. `src/commands/level.ts` (USE ML model + real metrics)

**Purpose:** Replace additive formula with ML prediction using learned weights + actual metrics

**Replace entire file (lines 1-178):**

```typescript
import { Command } from 'commander';
import chalk from 'chalk';
import { QuestionResponses } from '../types';
import { VIBE_QUESTIONS, calculateBaseLevel } from '../recommend/questions';
import { predictWithConfidence, ModelState } from '../recommend';
import { loadCalibration } from '../calibration';
import { getCommits, isGitRepo, getFileStats } from '../git';
import { calculateFileChurn } from '../metrics/file-churn';
import { calculateTimeSpiral } from '../metrics/time-spiral';
import { calculateVelocityAnomaly } from '../metrics/velocity-anomaly';
import { calculateCodeStability } from '../metrics/code-stability';

interface LevelResult {
  level: number;
  confidence: number;
  responses: QuestionResponses;
  reasoning: string[];
  source: 'ml' | 'fallback';
  ece?: number;
  sampleCount?: number;
}

export function createLevelCommand(): Command {
  const cmd = new Command('level')
    .description('Classify vibe level for upcoming work (interactive)')
    .option('--quick', 'Non-interactive mode with neutral defaults', false)
    .option('--json', 'Output as JSON', false)
    .option('-r, --repo <path>', 'Repository path for metrics', process.cwd())
    .option('--since <date>', 'Git history start for metrics (default: 30 days ago)', '30 days ago')
    .option(
      '--answers <responses>',
      'Pre-filled answers as JSON (e.g., \'{"reversibility":1,"blastRadius":0}\')'
    )
    .action(async (options) => {
      await runLevel(options);
    });

  return cmd;
}

async function runLevel(options: {
  quick: boolean;
  json: boolean;
  repo: string;
  since: string;
  answers?: string;
}): Promise<void> {
  let responses: QuestionResponses;

  if (options.quick) {
    // Non-interactive: use defaults or provided answers
    responses = {
      reversibility: 0,
      blastRadius: 0,
      verificationCost: 0,
      domainComplexity: 0,
      aiTrackRecord: 0,
    };

    if (options.answers) {
      try {
        const provided = JSON.parse(options.answers);
        responses = { ...responses, ...provided };
      } catch {
        console.error(chalk.red('Invalid --answers JSON'));
        process.exit(1);
      }
    }
  } else {
    // Interactive mode
    if (!process.stdin.isTTY) {
      console.error(chalk.yellow('Non-interactive terminal detected. Use --quick for non-interactive mode.'));
      process.exit(1);
    }
    responses = await askQuestions();
  }

  const result = await classifyLevel(responses, options.repo, options.since);

  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    displayResult(result);
  }
}

async function askQuestions(): Promise<QuestionResponses> {
  // Dynamic import for enquirer
  const Enquirer = (await import('enquirer')).default;

  const responses: Partial<QuestionResponses> = {};

  console.log('');
  console.log(chalk.bold.cyan('═'.repeat(60)));
  console.log(chalk.bold.cyan('           VIBE LEVEL CLASSIFICATION'));
  console.log(chalk.bold.cyan('═'.repeat(60)));
  console.log('');
  console.log(chalk.gray('Answer 5 questions to determine the appropriate vibe level.'));
  console.log(chalk.gray('Use ↑/↓ arrows to select, Enter to confirm.'));
  console.log('');

  for (const question of VIBE_QUESTIONS) {
    const answer = await Enquirer.prompt<{ answer: string }>({
      type: 'select',
      name: 'answer',
      message: question.text,
      choices: question.options.map((opt) => ({
        name: opt.label,
        message: `${opt.label} ${chalk.gray('- ' + opt.description)}`,
        value: String(opt.value),
      })),
    });

    const selected = question.options.find((o) => o.label === answer.answer);
    responses[question.id] = (selected?.value ?? 0) as -2 | -1 | 0 | 1;
    console.log('');
  }

  return responses as QuestionResponses;
}

async function classifyLevel(
  responses: QuestionResponses,
  repoPath: string,
  since: string
): Promise<LevelResult> {
  // Try to get real metrics from git history
  let metricsFeatures = [0.7, 0.7, 0.7, 0.7]; // Defaults if no git history
  let source: 'ml' | 'fallback' = 'fallback';

  try {
    if (await isGitRepo(repoPath)) {
      const commits = await getCommits(repoPath, since);

      if (commits.length >= 3) {
        const fileStats = await getFileStats(repoPath, since);

        const fileChurn = calculateFileChurn(commits, fileStats.filesPerCommit);
        const timeSpiral = calculateTimeSpiral(commits);
        const velocityAnomaly = calculateVelocityAnomaly(commits);
        const codeStability = calculateCodeStability(commits, fileStats.lineStats);

        metricsFeatures = [
          fileChurn.value / 100,
          timeSpiral.value / 100,
          velocityAnomaly.value / 100,
          codeStability.value / 100,
        ];
        source = 'ml';
      }
    }
  } catch {
    // Fall back to defaults if git fails
  }

  // Load calibration state (contains learned weights)
  const calibration = loadCalibration(repoPath);

  // Build full feature vector: 5 questions + 4 metrics
  const features = [
    responses.reversibility,
    responses.blastRadius,
    responses.verificationCost,
    responses.domainComplexity,
    responses.aiTrackRecord,
    ...metricsFeatures,
  ];

  // Use ML model with learned weights
  const model: ModelState = {
    weights: calibration.weights,
    thresholds: calibration.thresholds,
  };

  const prediction = predictWithConfidence(features, model);

  // Use ML prediction (NOT additive formula)
  const level = prediction.level;
  const confidence = prediction.confidence;

  // Build reasoning
  const reasoning: string[] = [];

  if (source === 'ml') {
    reasoning.push(`Based on ${since} git history + your answers`);
    if (metricsFeatures[0] < 0.7) reasoning.push('File churn detected - code needed rework');
    if (metricsFeatures[1] < 0.7) reasoning.push('Time spirals detected - rapid fix commits');
  } else {
    reasoning.push('No git history available - using question answers only');
  }

  if (responses.reversibility <= -1) reasoning.push('Low reversibility requires careful review');
  if (responses.blastRadius <= -1) reasoning.push('Wide blast radius increases risk');
  if (responses.verificationCost <= -1) reasoning.push('High verification cost needs extra attention');
  if (responses.domainComplexity <= -1) reasoning.push('Domain complexity may cause AI errors');
  if (responses.aiTrackRecord <= -1) reasoning.push('AI track record suggests caution');

  if (reasoning.length === 0) {
    reasoning.push('Standard risk profile - proceed with appropriate level');
  }

  return {
    level,
    confidence,
    responses,
    reasoning,
    source,
    ece: calibration.ece,
    sampleCount: calibration.samples.length,
  };
}

function displayResult(result: LevelResult): void {
  const levelDescriptions: Record<number, { name: string; trust: string; verify: string }> = {
    5: { name: 'Full Automation', trust: '95%', verify: 'Final review only' },
    4: { name: 'High Trust', trust: '80%', verify: 'Spot check' },
    3: { name: 'Balanced', trust: '60%', verify: 'Review key outputs' },
    2: { name: 'AI-Augmented', trust: '40%', verify: 'Review every change' },
    1: { name: 'Human-Led', trust: '20%', verify: 'Review every line' },
    0: { name: 'Manual Only', trust: '0%', verify: 'No AI assistance' },
  };

  const desc = levelDescriptions[result.level];

  console.log('');
  console.log(chalk.bold.cyan('═'.repeat(60)));
  console.log('');

  // Level display with color coding
  const levelColor = result.level >= 4 ? chalk.green : result.level >= 2 ? chalk.yellow : chalk.red;
  console.log(`  ${chalk.bold('RECOMMENDED LEVEL:')} ${levelColor.bold(`${result.level} - ${desc.name}`)}`);
  console.log('');
  console.log(`  ${chalk.gray('Trust:')}  ${desc.trust}`);
  console.log(`  ${chalk.gray('Verify:')} ${desc.verify}`);
  console.log(`  ${chalk.gray('Confidence:')} ${(result.confidence * 100).toFixed(0)}%`);
  console.log('');

  // Model info
  if (result.source === 'ml') {
    console.log(chalk.green(`  ✓ Using ML model with ${result.sampleCount || 0} calibration samples`));
    if (result.ece !== undefined && result.ece > 0) {
      console.log(chalk.gray(`    ECE: ${(result.ece * 100).toFixed(1)}%`));
    }
  } else {
    console.log(chalk.yellow(`  ⚠ Fallback mode (no git history available)`));
  }

  console.log('');
  console.log(chalk.bold.yellow('  REASONING:'));
  for (const reason of result.reasoning) {
    console.log(chalk.yellow(`  • ${reason}`));
  }

  console.log('');
  console.log(chalk.bold.cyan('═'.repeat(60)));
  console.log('');
  console.log(chalk.gray(`  After your work, run:`));
  console.log(chalk.white(`  vibe-check --score --calibrate ${result.level}`));
  console.log('');
}
```

**Validation:** `npm run build && npm run dev level --quick --json`

---

## Implementation Order

**CRITICAL: Sequence matters. Do not reorder.**

| Step | Action | Validation | Rollback |
|------|--------|------------|----------|
| 0 | Run baseline tests | `npm test` passes | N/A |
| 1 | Add `partialFit` to ordered-logistic.ts | `npm run build` | `git checkout src/recommend/ordered-logistic.ts` |
| 2 | Add `inferTrueLevel` to ece.ts | `npm run build` | `git checkout src/calibration/ece.ts` |
| 3 | Replace storage.ts with learning loop | `npm run build` | `git checkout src/calibration/storage.ts` |
| 4 | Update calibration/index.ts exports | `npm run build` | `git checkout src/calibration/index.ts` |
| 5 | Update recommend/index.ts exports | `npm run build` | `git checkout src/recommend/index.ts` |
| 6 | Replace level.ts with ML version | `npm run build` | `git checkout src/commands/level.ts` |
| 7 | Full integration test | `npm test && npm run dev level --quick` | Revert all |
| 8 | Commit | `git commit` | N/A |

---

## Validation Strategy

### Syntax Validation
```bash
npm run build
# Expected: No TypeScript errors
```

### Unit Test Validation
```bash
npm test
# Expected: All existing tests pass
```

### Integration Validation
```bash
# Test ML model is used
npm run dev level --quick --json
# Expected: Output includes "source": "ml" if in git repo

# Test calibration triggers learning
npm run dev analyze --score --calibrate 3 --since "1 week ago"
# Check .vibe-check/calibration.json has updated weights after 10 samples

# Verify ECE is calculated
cat .vibe-check/calibration.json | grep '"ece"'
# Expected: ece value present
```

### Manual Validation: Learning Loop
```bash
# Simulate 10 calibration samples
for i in {1..10}; do
  npm run dev analyze --score --calibrate 3 --since "1 week ago" > /dev/null
done

# Check weights have changed from defaults
cat .vibe-check/calibration.json
# Expected: weights array differs from DEFAULT_MODEL.weights
# Expected: version is "2.1.0" (indicating ML-learned)
```

---

## Rollback Procedure

**Time to rollback:** ~3 minutes

### Full Rollback
```bash
# Step 1: Reset all changed files
git checkout \
  src/recommend/ordered-logistic.ts \
  src/recommend/index.ts \
  src/calibration/ece.ts \
  src/calibration/storage.ts \
  src/calibration/index.ts \
  src/commands/level.ts

# Step 2: Rebuild
npm run build

# Step 3: Verify
npm test
```

### Partial Rollback (keep learning, revert level command)
```bash
git checkout src/commands/level.ts
npm run build
```

---

## Risk Assessment

### Medium Risk: Learning Instability
- **What:** Weights could diverge with bad samples
- **Mitigation:** Start from DEFAULT_MODEL each retrain, multiple epochs, ordered thresholds enforcement
- **Detection:** Check weights are reasonable numbers (-10 to 10)
- **Recovery:** Delete .vibe-check/calibration.json to reset

### Low Risk: Git Performance in Level Command
- **What:** Reading 30 days of history could be slow
- **Mitigation:** Only fetch if isGitRepo() and has commits
- **Detection:** `time npm run dev level --quick`
- **Recovery:** Reduce `--since` default or skip metrics

### Low Risk: Backward Compatibility
- **What:** Old calibration.json files
- **Mitigation:** All fields are optional, defaults provided
- **Detection:** Load old file, check it works
- **Recovery:** Version field allows migration if needed

---

## Approval Checklist

**Human must verify before /implement:**

- [ ] Every file specified precisely (full content provided)
- [ ] All code complete (no placeholders)
- [ ] Validation commands provided
- [ ] Rollback procedure complete
- [ ] Implementation order is correct
- [ ] Risks identified and mitigated
- [ ] No breaking changes to existing functionality
- [ ] All 6 gaps addressed

---

## Progress Files

### `feature-list.json`

```json
{
  "project": "vibe-check",
  "version": "2.1.0",
  "features": [
    {
      "id": "ml-learning-loop",
      "name": "ML Learning Loop",
      "description": "Complete implementation of model learning from calibration samples",
      "status": "pending",
      "passes": false,
      "files": [
        "src/recommend/ordered-logistic.ts",
        "src/recommend/index.ts",
        "src/calibration/ece.ts",
        "src/calibration/storage.ts",
        "src/calibration/index.ts",
        "src/commands/level.ts"
      ],
      "validation": "npm run build && npm test && npm run dev level --quick --json",
      "gaps_addressed": [
        "Model Learning (partial_fit)",
        "Feedback Loop (retrain trigger)",
        "Level Uses ML",
        "Metrics Integration",
        "Outcome-Based Updates",
        "Calibration Triggers Learning"
      ]
    }
  ]
}
```

### `claude-progress.json`

```json
{
  "project": "vibe-check",
  "current_state": {
    "phase": "planning",
    "working_on": "ML Learning Loop - Complete Implementation",
    "next_steps": [
      "Approve implementation plan",
      "Run /implement",
      "Verify learning loop works with 10 samples"
    ],
    "blockers": []
  },
  "sessions": [
    {
      "date": "2025-11-28",
      "summary": "Created complete plan addressing all 6 ML learning gaps"
    }
  ]
}
```

---

## Summary: Before vs After

### Before (Current State)

```
vibe-check level --quick
  ↓
calculateBaseLevel(responses)  // Simple: 3 + Q1 + Q2 + Q3 + Q4 + Q5
  ↓
return level (no ML, no metrics, no learning)
```

```
vibe-check --calibrate 3
  ↓
addSample(sample)  // Store passively
  ↓
// No learning ever happens
```

### After (This Plan)

```
vibe-check level --quick
  ↓
loadCalibration(repo)           // Get learned weights
getCommits + getFileStats       // Get actual git metrics
features = [questions..., metrics...]
predictWithConfidence(features, model)  // Use ML
  ↓
return level (ML-based, uses real metrics)
```

```
vibe-check --calibrate 3
  ↓
addSample(sample)
  ↓
if (samples % 10 === 0 || ece > 0.15):
  retrain():
    - inferTrueLevel from vibeScore
    - batchPartialFit(model, samples)
    - calculateECE()
    - save updated weights
  ↓
// Model learns and improves
```

---

## Next Step

Once approved: `/implement ml-learning-loop-complete-plan-2025-11-28.md`
