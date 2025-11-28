# Unified Vibe System: Phase 1 Implementation Plan

**Type:** Plan
**Created:** 2025-11-28
**Depends On:** `unified-vibe-system-research-2025-11-28.md`
**Loop:** Middle (bridges research to implementation)
**Tags:** vibe-check, vibe-score, semantic-free-metrics, phase-1

---

## Overview

Add **4 semantic-commit-free metrics** to vibe-check, producing a composite **Vibe Score (0-1)**. This extends the existing tool without breaking changes.

**What changes:**
- New types for commit files and vibe score
- Enhanced git log parsing to include files changed
- 4 new metric calculators (file churn, time spiral, velocity anomaly, code stability)
- Vibe Score composite calculator
- Enhanced output to display Vibe Score

**What doesn't change:**
- Existing 5 metrics continue to work
- CLI interface unchanged (Vibe Score auto-displayed)
- All existing tests should pass

---

## Approach Selected

From research: **Weighted Composite Score** with 4 components

```
VibeScore = 0.30×FileChurn + 0.25×TimeSpiral + 0.20×VelocityAnomaly + 0.25×CodeStability
```

All components normalized to 0-1, higher = better.

---

## PDC Strategy

### Prevent
- [x] Read all existing code before modifications
- [ ] Run `npm test` before starting to establish baseline
- [ ] Commit after each file creation/modification

### Detect
- [ ] `npm run build` after each TypeScript change
- [ ] `npm test` after completing each metric
- [ ] Manual test with `npm run dev -- --since "1 week ago"`

### Correct
- [ ] Git revert individual commits if issues found
- [ ] Each new file can be deleted independently

---

## Files to Create

### 1. `src/types.ts` (MODIFY - lines 5-12)

**Purpose:** Add CommitWithFiles interface and VibeScore types

**Current (lines 5-12):**
```typescript
export interface Commit {
  hash: string;
  date: Date;
  message: string;
  type: 'feat' | 'fix' | 'docs' | 'chore' | 'refactor' | 'test' | 'style' | 'other';
  scope: string | null;
  author: string;
}
```

**After (replace lines 5-28):**
```typescript
export interface Commit {
  hash: string;
  date: Date;
  message: string;
  type: 'feat' | 'fix' | 'docs' | 'chore' | 'refactor' | 'test' | 'style' | 'other';
  scope: string | null;
  author: string;
}

export interface CommitWithFiles extends Commit {
  files: string[];
}

export interface VibeScoreComponents {
  fileChurn: number;
  timeSpiral: number;
  velocityAnomaly: number;
  codeStability: number;
}

export interface VibeScoreResult {
  score: number;
  components: VibeScoreComponents;
  weights: number[];
  interpretation: 'elite' | 'high' | 'medium' | 'low';
}
```

**Validation:** `npm run build` should compile without errors

---

### 2. `src/types.ts` (MODIFY - add to VibeCheckResult)

**Purpose:** Add vibeScore to the result interface

**Current (lines 37-60):**
```typescript
export interface VibeCheckResult {
  period: {
    from: Date;
    to: Date;
    activeHours: number;
  };
  commits: {
    total: number;
    feat: number;
    fix: number;
    docs: number;
    other: number;
  };
  metrics: {
    iterationVelocity: MetricResult;
    reworkRatio: MetricResult;
    trustPassRate: MetricResult;
    debugSpiralDuration: MetricResult;
    flowEfficiency: MetricResult;
  };
  fixChains: FixChain[];
  patterns: PatternSummary;
  overall: OverallRating;
}
```

**After (replace lines 37-61):**
```typescript
export interface VibeCheckResult {
  period: {
    from: Date;
    to: Date;
    activeHours: number;
  };
  commits: {
    total: number;
    feat: number;
    fix: number;
    docs: number;
    other: number;
  };
  metrics: {
    iterationVelocity: MetricResult;
    reworkRatio: MetricResult;
    trustPassRate: MetricResult;
    debugSpiralDuration: MetricResult;
    flowEfficiency: MetricResult;
  };
  fixChains: FixChain[];
  patterns: PatternSummary;
  overall: OverallRating;
  vibeScore: VibeScoreResult;
}
```

**Validation:** `npm run build`

---

### 3. `src/git.ts` (MODIFY - enhanced parsing)

**Purpose:** Fetch files changed per commit for file churn analysis

**Current function `getCommits` (lines 6-33):**
```typescript
export async function getCommits(
  repoPath: string,
  since?: string,
  until?: string
): Promise<Commit[]> {
  const git: SimpleGit = simpleGit(repoPath);

  // Build options for git log
  const options: Record<string, string | number | boolean> = {};

  if (since) {
    options['--since'] = since;
  }
  if (until) {
    options['--until'] = until;
  }

  try {
    const log: LogResult<DefaultLogFields> = await git.log(options);

    return log.all.map((entry) => parseCommit(entry));
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to read git log: ${error.message}`);
    }
    throw error;
  }
}
```

**After (replace lines 1-73 entirely):**
```typescript
import simpleGit, { SimpleGit, LogResult, DefaultLogFields } from 'simple-git';
import { Commit, CommitWithFiles } from './types';

const COMMIT_TYPES = ['feat', 'fix', 'docs', 'chore', 'refactor', 'test', 'style'] as const;

export async function getCommits(
  repoPath: string,
  since?: string,
  until?: string
): Promise<Commit[]> {
  const commits = await getCommitsWithFiles(repoPath, since, until);
  return commits;
}

export async function getCommitsWithFiles(
  repoPath: string,
  since?: string,
  until?: string
): Promise<CommitWithFiles[]> {
  const git: SimpleGit = simpleGit(repoPath);

  // Build options for git log with file stats
  const options: string[] = ['--name-only'];

  if (since) {
    options.push(`--since=${since}`);
  }
  if (until) {
    options.push(`--until=${until}`);
  }

  try {
    const log: LogResult<DefaultLogFields> = await git.log(options);

    // Parse each commit and extract files
    const commits: CommitWithFiles[] = [];

    for (const entry of log.all) {
      const baseCommit = parseCommit(entry);
      const files = await getFilesForCommit(git, entry.hash);
      commits.push({ ...baseCommit, files });
    }

    return commits;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to read git log: ${error.message}`);
    }
    throw error;
  }
}

async function getFilesForCommit(git: SimpleGit, hash: string): Promise<string[]> {
  try {
    const result = await git.show([hash, '--name-only', '--format=']);
    return result
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);
  } catch {
    return [];
  }
}

function parseCommit(entry: DefaultLogFields): Commit {
  const { hash, date, message, author_name } = entry;

  // Parse conventional commit format: type(scope): description
  const conventionalMatch = message.match(/^(\w+)(?:\(([^)]+)\))?:\s*(.+)/);

  let type: Commit['type'] = 'other';
  let scope: string | null = null;

  if (conventionalMatch) {
    const [, rawType, rawScope] = conventionalMatch;
    const normalizedType = rawType.toLowerCase();

    if (COMMIT_TYPES.includes(normalizedType as typeof COMMIT_TYPES[number])) {
      type = normalizedType as Commit['type'];
    }
    scope = rawScope || null;
  }

  return {
    hash: hash.substring(0, 7),
    date: new Date(date),
    message: message.split('\n')[0], // First line only
    type,
    scope,
    author: author_name,
  };
}

export async function isGitRepo(repoPath: string): Promise<boolean> {
  const git: SimpleGit = simpleGit(repoPath);
  try {
    await git.status();
    return true;
  } catch {
    return false;
  }
}
```

**Validation:** `npm run build && npm run dev -- --since "1 week ago"`

---

### 4. `src/metrics/vibeScore.ts` (CREATE)

**Purpose:** Calculate the 4 semantic-free metrics and composite Vibe Score

```typescript
import { CommitWithFiles, VibeScoreResult, VibeScoreComponents } from '../types';
import { calculateActiveHours } from './velocity';

// Default weights (will be calibrated over time)
const DEFAULT_WEIGHTS = [0.30, 0.25, 0.20, 0.25];

// Thresholds
const ONE_HOUR_MS = 60 * 60 * 1000;
const FIVE_MINUTES_MS = 5 * 60 * 1000;

interface Baseline {
  mean: number;
  stdDev: number;
}

/**
 * Calculate composite Vibe Score from 4 semantic-free metrics
 */
export function calculateVibeScore(
  commits: CommitWithFiles[],
  baseline?: Baseline,
  weights: number[] = DEFAULT_WEIGHTS
): VibeScoreResult {
  if (commits.length === 0) {
    return {
      score: 1.0,
      components: {
        fileChurn: 1.0,
        timeSpiral: 1.0,
        velocityAnomaly: 1.0,
        codeStability: 1.0,
      },
      weights,
      interpretation: 'elite',
    };
  }

  const components: VibeScoreComponents = {
    fileChurn: calculateFileChurnScore(commits),
    timeSpiral: calculateTimeSpiralScore(commits),
    velocityAnomaly: calculateVelocityAnomalyScore(commits, baseline),
    codeStability: 1.0, // Placeholder - requires git blame (Phase 2)
  };

  const score =
    weights[0] * components.fileChurn +
    weights[1] * components.timeSpiral +
    weights[2] * components.velocityAnomaly +
    weights[3] * components.codeStability;

  const interpretation = getInterpretation(score);

  return {
    score: Math.round(score * 100) / 100,
    components,
    weights,
    interpretation,
  };
}

/**
 * File Churn Score: Did code stick on first touch?
 * Detects files touched 3+ times within 1 hour
 */
export function calculateFileChurnScore(commits: CommitWithFiles[]): number {
  if (commits.length < 3) return 1.0;

  const fileTimestamps = new Map<string, Date[]>();

  // Collect all touch timestamps per file
  for (const commit of commits) {
    for (const file of commit.files) {
      const times = fileTimestamps.get(file) || [];
      times.push(commit.date);
      fileTimestamps.set(file, times);
    }
  }

  if (fileTimestamps.size === 0) return 1.0;

  let churnedFiles = 0;

  for (const [, times] of fileTimestamps) {
    if (times.length < 3) continue;

    const sorted = [...times].sort((a, b) => a.getTime() - b.getTime());

    // Detect 3+ touches within 1 hour (spiral indicator)
    for (let i = 0; i < sorted.length - 2; i++) {
      const span = sorted[i + 2].getTime() - sorted[i].getTime();
      if (span < ONE_HOUR_MS) {
        churnedFiles++;
        break;
      }
    }
  }

  const churnRatio = churnedFiles / fileTimestamps.size;
  return Math.round((1 - churnRatio) * 100) / 100;
}

/**
 * Time Spiral Score: Are commits clustered in frustrated bursts?
 * Detects commits less than 5 minutes apart
 */
export function calculateTimeSpiralScore(commits: CommitWithFiles[]): number {
  if (commits.length < 2) return 1.0;

  const sorted = [...commits].sort((a, b) => a.date.getTime() - b.date.getTime());

  let spiralCommits = 0;

  for (let i = 1; i < sorted.length; i++) {
    const gap = sorted[i].date.getTime() - sorted[i - 1].date.getTime();
    if (gap < FIVE_MINUTES_MS) {
      spiralCommits++;
    }
  }

  const spiralRatio = spiralCommits / (commits.length - 1);
  return Math.round((1 - spiralRatio) * 100) / 100;
}

/**
 * Velocity Anomaly Score: Is this pattern abnormal?
 * Uses z-score from personal baseline (if available)
 */
export function calculateVelocityAnomalyScore(
  commits: CommitWithFiles[],
  baseline?: Baseline
): number {
  if (!baseline || baseline.stdDev === 0) {
    // No baseline available, return neutral score
    return 0.75;
  }

  const hours = calculateActiveHours(commits);
  const currentVelocity = hours > 0 ? commits.length / hours : 0;

  // Z-score: how many std devs from personal mean
  const zScore = Math.abs((currentVelocity - baseline.mean) / baseline.stdDev);

  // Sigmoid transform: z=0 → 1.0, z=2 → ~0.38, z=3 → ~0.18
  const score = 1 / (1 + Math.exp(zScore - 1.5));
  return Math.round(score * 100) / 100;
}

/**
 * Get interpretation from composite score
 */
function getInterpretation(score: number): 'elite' | 'high' | 'medium' | 'low' {
  if (score >= 0.85) return 'elite';
  if (score >= 0.70) return 'high';
  if (score >= 0.50) return 'medium';
  return 'low';
}

/**
 * Calculate baseline from historical commits
 * Call this with 30 days of history to establish personal baseline
 */
export function calculateBaseline(commits: CommitWithFiles[]): Baseline {
  if (commits.length < 10) {
    return { mean: 3, stdDev: 1.5 }; // Default baseline
  }

  // Group commits by day and calculate daily velocities
  const dailyVelocities: number[] = [];
  const byDay = new Map<string, CommitWithFiles[]>();

  for (const commit of commits) {
    const day = commit.date.toISOString().split('T')[0];
    const dayCommits = byDay.get(day) || [];
    dayCommits.push(commit);
    byDay.set(day, dayCommits);
  }

  for (const dayCommits of byDay.values()) {
    const hours = calculateActiveHours(dayCommits);
    if (hours > 0) {
      dailyVelocities.push(dayCommits.length / hours);
    }
  }

  if (dailyVelocities.length === 0) {
    return { mean: 3, stdDev: 1.5 };
  }

  const mean = dailyVelocities.reduce((a, b) => a + b, 0) / dailyVelocities.length;
  const variance =
    dailyVelocities.reduce((sum, v) => sum + (v - mean) ** 2, 0) / dailyVelocities.length;
  const stdDev = Math.sqrt(variance);

  return {
    mean: Math.round(mean * 100) / 100,
    stdDev: Math.round(stdDev * 100) / 100 || 1,
  };
}
```

**Validation:** `npm run build`

---

### 5. `src/metrics/index.ts` (MODIFY - integrate Vibe Score)

**Purpose:** Add vibeScore calculation to analyzeCommits

**Current (lines 1-10):**
```typescript
import { Commit, VibeCheckResult, OverallRating, Rating } from '../types';
import { calculateIterationVelocity, calculateActiveHours } from './velocity';
import { calculateReworkRatio } from './rework';
import { calculateTrustPassRate } from './trust';
import {
  detectFixChains,
  calculateDebugSpiralDuration,
  calculatePatternSummary,
} from './spirals';
import { calculateFlowEfficiency } from './flow';
```

**After (lines 1-12):**
```typescript
import { Commit, CommitWithFiles, VibeCheckResult, OverallRating, Rating } from '../types';
import { calculateIterationVelocity, calculateActiveHours } from './velocity';
import { calculateReworkRatio } from './rework';
import { calculateTrustPassRate } from './trust';
import {
  detectFixChains,
  calculateDebugSpiralDuration,
  calculatePatternSummary,
} from './spirals';
import { calculateFlowEfficiency } from './flow';
import { calculateVibeScore } from './vibeScore';
```

**Current `analyzeCommits` function (lines 12-66):**
```typescript
export function analyzeCommits(commits: Commit[]): VibeCheckResult {
  if (commits.length === 0) {
    return emptyResult();
  }

  // Sort commits by date
  const sorted = [...commits].sort((a, b) => a.date.getTime() - b.date.getTime());
  const from = sorted[0].date;
  const to = sorted[sorted.length - 1].date;
  const activeHours = calculateActiveHours(sorted);

  // Count commit types
  const commitCounts = countCommitTypes(sorted);

  // Detect fix chains
  const fixChains = detectFixChains(sorted);

  // Calculate all metrics
  const iterationVelocity = calculateIterationVelocity(sorted);
  const reworkRatio = calculateReworkRatio(sorted);
  const trustPassRate = calculateTrustPassRate(sorted);
  const debugSpiralDuration = calculateDebugSpiralDuration(fixChains);
  const flowEfficiency = calculateFlowEfficiency(activeHours * 60, fixChains);

  // Calculate pattern summary
  const patterns = calculatePatternSummary(fixChains);

  // Determine overall rating
  const overall = calculateOverallRating([
    iterationVelocity.rating,
    reworkRatio.rating,
    trustPassRate.rating,
    debugSpiralDuration.rating,
    flowEfficiency.rating,
  ]);

  return {
    period: {
      from,
      to,
      activeHours: Math.round(activeHours * 10) / 10,
    },
    commits: commitCounts,
    metrics: {
      iterationVelocity,
      reworkRatio,
      trustPassRate,
      debugSpiralDuration,
      flowEfficiency,
    },
    fixChains,
    patterns,
    overall,
  };
}
```

**After (lines 12-70):**
```typescript
export function analyzeCommits(commits: Commit[] | CommitWithFiles[]): VibeCheckResult {
  if (commits.length === 0) {
    return emptyResult();
  }

  // Sort commits by date
  const sorted = [...commits].sort((a, b) => a.date.getTime() - b.date.getTime());
  const from = sorted[0].date;
  const to = sorted[sorted.length - 1].date;
  const activeHours = calculateActiveHours(sorted);

  // Count commit types
  const commitCounts = countCommitTypes(sorted);

  // Detect fix chains
  const fixChains = detectFixChains(sorted);

  // Calculate all metrics
  const iterationVelocity = calculateIterationVelocity(sorted);
  const reworkRatio = calculateReworkRatio(sorted);
  const trustPassRate = calculateTrustPassRate(sorted);
  const debugSpiralDuration = calculateDebugSpiralDuration(fixChains);
  const flowEfficiency = calculateFlowEfficiency(activeHours * 60, fixChains);

  // Calculate pattern summary
  const patterns = calculatePatternSummary(fixChains);

  // Calculate Vibe Score (semantic-free metrics)
  const commitsWithFiles = commits as CommitWithFiles[];
  const hasFiles = commitsWithFiles.length > 0 && 'files' in commitsWithFiles[0];
  const vibeScore = hasFiles
    ? calculateVibeScore(commitsWithFiles)
    : calculateVibeScore(commitsWithFiles.map(c => ({ ...c, files: [] })));

  // Determine overall rating
  const overall = calculateOverallRating([
    iterationVelocity.rating,
    reworkRatio.rating,
    trustPassRate.rating,
    debugSpiralDuration.rating,
    flowEfficiency.rating,
  ]);

  return {
    period: {
      from,
      to,
      activeHours: Math.round(activeHours * 10) / 10,
    },
    commits: commitCounts,
    metrics: {
      iterationVelocity,
      reworkRatio,
      trustPassRate,
      debugSpiralDuration,
      flowEfficiency,
    },
    fixChains,
    patterns,
    overall,
    vibeScore,
  };
}
```

**Also update `emptyResult` function (add vibeScore):**

**Current (lines 113-166):**
Find `function emptyResult()` and add vibeScore to the return.

**After (add before final closing brace):**
```typescript
    vibeScore: {
      score: 1.0,
      components: {
        fileChurn: 1.0,
        timeSpiral: 1.0,
        velocityAnomaly: 1.0,
        codeStability: 1.0,
      },
      weights: [0.30, 0.25, 0.20, 0.25],
      interpretation: 'elite',
    },
```

**Validation:** `npm run build && npm test`

---

### 6. `src/output/terminal.ts` (MODIFY - display Vibe Score)

**Purpose:** Add Vibe Score display to terminal output

**After line 50 (after overall rating display), insert:**
```typescript
  // Vibe Score (semantic-free)
  lines.push('');
  lines.push(chalk.bold.cyan('-'.repeat(64)));
  lines.push(`  ${chalk.bold('VIBE SCORE:')} ${formatVibeScore(result.vibeScore.score)} ${formatVibeScoreRating(result.vibeScore.interpretation)}`);
  lines.push(chalk.gray(`    Components: File Churn ${(result.vibeScore.components.fileChurn * 100).toFixed(0)}% | Time Flow ${(result.vibeScore.components.timeSpiral * 100).toFixed(0)}% | Velocity ${(result.vibeScore.components.velocityAnomaly * 100).toFixed(0)}%`));
  lines.push(chalk.bold.cyan('-'.repeat(64)));
```

**Add helper functions after `formatOverallRating`:**
```typescript
function formatVibeScore(score: number): string {
  const percentage = (score * 100).toFixed(0);
  if (score >= 0.85) return chalk.green.bold(`${percentage}%`);
  if (score >= 0.70) return chalk.blue.bold(`${percentage}%`);
  if (score >= 0.50) return chalk.yellow.bold(`${percentage}%`);
  return chalk.red.bold(`${percentage}%`);
}

function formatVibeScoreRating(rating: 'elite' | 'high' | 'medium' | 'low'): string {
  switch (rating) {
    case 'elite':
      return chalk.green('(Elite Flow)');
    case 'high':
      return chalk.blue('(High Flow)');
    case 'medium':
      return chalk.yellow('(Moderate)');
    case 'low':
      return chalk.red('(Struggling)');
  }
}
```

**Validation:** `npm run dev -- --since "1 week ago"` - should show Vibe Score

---

### 7. `src/output/json.ts` (MODIFY - include Vibe Score)

**Purpose:** Ensure vibeScore is in JSON output

The existing `formatJson` function likely just does `JSON.stringify(result)`. Since we added `vibeScore` to `VibeCheckResult`, it should automatically be included.

**Validation:** `npm run dev -- --since "1 week ago" -f json | jq .vibeScore`

---

### 8. `src/output/markdown.ts` (MODIFY - include Vibe Score)

**Purpose:** Add Vibe Score section to markdown output

**Add after overall rating section:**
```typescript
  // Vibe Score
  lines.push('');
  lines.push('## Vibe Score (Semantic-Free)');
  lines.push('');
  lines.push(`**Score:** ${(result.vibeScore.score * 100).toFixed(0)}% (${result.vibeScore.interpretation})`);
  lines.push('');
  lines.push('| Component | Score |');
  lines.push('|-----------|-------|');
  lines.push(`| File Churn | ${(result.vibeScore.components.fileChurn * 100).toFixed(0)}% |`);
  lines.push(`| Time Flow | ${(result.vibeScore.components.timeSpiral * 100).toFixed(0)}% |`);
  lines.push(`| Velocity | ${(result.vibeScore.components.velocityAnomaly * 100).toFixed(0)}% |`);
  lines.push(`| Code Stability | ${(result.vibeScore.components.codeStability * 100).toFixed(0)}% |`);
```

**Validation:** `npm run dev -- --since "1 week ago" -f markdown`

---

## Implementation Order

**CRITICAL: Sequence matters. Do not reorder.**

| Step | Action | Validation | Rollback |
|------|--------|------------|----------|
| 0 | Run baseline tests | `npm test` passes | N/A |
| 1 | Modify `src/types.ts` - add interfaces | `npm run build` | `git checkout src/types.ts` |
| 2 | Create `src/metrics/vibeScore.ts` | `npm run build` | Delete file |
| 3 | Modify `src/git.ts` - add files parsing | `npm run build` | `git checkout src/git.ts` |
| 4 | Modify `src/metrics/index.ts` - integrate | `npm run build` | `git checkout src/metrics/index.ts` |
| 5 | Modify `src/output/terminal.ts` | `npm run dev` | `git checkout src/output/terminal.ts` |
| 6 | Modify `src/output/markdown.ts` | `npm run dev -f markdown` | `git checkout src/output/markdown.ts` |
| 7 | Full integration test | `npm test && npm run dev` | Revert all |
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
# Test on vibe-check repo itself
npm run dev -- --since "1 week ago"
# Expected: Output includes Vibe Score section

# Test JSON output
npm run dev -- --since "1 week ago" -f json | grep vibeScore
# Expected: vibeScore object present

# Test markdown output
npm run dev -- --since "1 week ago" -f markdown | grep "Vibe Score"
# Expected: Vibe Score section present
```

### Manual Validation
```bash
# Test on a repo with known debug spiral
cd /path/to/repo-with-churn
npx vibe-check --since "1 week ago"
# Expected: File Churn score < 100% if files were touched repeatedly
```

---

## Rollback Procedure

**Time to rollback:** ~2 minutes

### Full Rollback
```bash
# Step 1: Reset all changes
git checkout src/types.ts src/git.ts src/metrics/index.ts src/output/terminal.ts src/output/markdown.ts

# Step 2: Remove new file
rm src/metrics/vibeScore.ts

# Step 3: Rebuild
npm run build

# Step 4: Verify
npm test
```

### Partial Rollback (keep specific changes)
```bash
# Only revert output changes
git checkout src/output/terminal.ts src/output/markdown.ts
npm run build
```

---

## Risk Assessment

### Medium Risk: Git Performance
- **What:** `git show` per commit may be slow for large histories
- **Mitigation:** Batch file fetching, limit to recent commits
- **Detection:** `time npm run dev` on large repo
- **Recovery:** Add `--no-files` flag to skip file analysis

### Low Risk: Existing Tests
- **What:** Changes to types might break tests
- **Mitigation:** Types are additive, not changing existing
- **Detection:** `npm test` after each change
- **Recovery:** Revert specific file

---

## Approval Checklist

**Human must verify before /implement:**

- [ ] Every file specified precisely (file:line)
- [ ] All templates complete (no placeholders)
- [ ] Validation commands provided
- [ ] Rollback procedure complete
- [ ] Implementation order is correct
- [ ] Risks identified and mitigated
- [ ] No breaking changes to existing functionality

---

## Progress Files

### `feature-list.json`

```json
{
  "project": "vibe-check",
  "version": "1.1.0",
  "features": [
    {
      "id": "vibe-score-core",
      "name": "Vibe Score (Semantic-Free Metrics)",
      "description": "Add 4 semantic-commit-free metrics producing composite 0-1 score",
      "status": "pending",
      "passes": false,
      "files": [
        "src/types.ts",
        "src/git.ts",
        "src/metrics/vibeScore.ts",
        "src/metrics/index.ts",
        "src/output/terminal.ts",
        "src/output/markdown.ts"
      ],
      "validation": "npm run build && npm test && npm run dev -- --since '1 week ago'"
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
    "working_on": "Phase 1: Core Metrics",
    "next_steps": [
      "Approve implementation plan",
      "Run /implement",
      "Validate output includes Vibe Score"
    ],
    "blockers": []
  },
  "sessions": [
    {
      "date": "2025-11-28",
      "summary": "Completed unified research and implementation plan for semantic-free Vibe Score"
    }
  ]
}
```

---

## Next Step

Once approved: `/implement unified-vibe-system-plan-phase1-2025-11-28.md`
