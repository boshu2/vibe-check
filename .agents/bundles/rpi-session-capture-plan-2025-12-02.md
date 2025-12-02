# RPI Session Capture - Implementation Plan

**Type:** Plan
**Created:** 2025-12-02
**Depends On:** `rpi-session-capture-research-2025-12-02.md`
**Scope:** Enhance slash commands + add RPI learning to vibe-check

---

## Overview

Integrate RPI session capture into the existing workflow:
- `/implement` auto-starts RPI session tracking
- `/session-end` captures RPI retro and metrics
- `vibe-check rpi` command for history and learnings
- Learnings surface during future `/implement` runs

**Files to create:** 5 new files
**Files to modify:** 4 slash commands + 2 vibe-check files

---

## Part 1: Slash Command Enhancements

### 1.1 Enhance `/implement`

**File:** `.claude/commands/implement.md`

**Current behavior:**
- Loads plan bundle
- Executes steps sequentially

**Enhanced behavior:**
- Create RPI session record at start
- Extract planned files/steps from bundle
- Show relevant RPI learnings before starting
- Track progress through steps

**Add to implement.md:**
```markdown
## RPI Session Tracking

Before executing:
1. Create RPI session in vibe-check:
   ```bash
   vibe-check rpi start --plan "[plan-file]" --feature "[feature-name]"
   ```

2. Check for relevant learnings:
   ```bash
   vibe-check rpi learnings --relevant
   ```
   Display any warnings or suggestions from past sessions.

During execution:
- After each build command, if it fails, note the error
- After each test command, if it fails, note the failure
- Track any deviations from the plan (files not in plan)

On completion:
- Prompt: "Ready to end RPI session and capture learnings?"
```

### 1.2 Enhance `/session-end`

**File:** `.claude/commands/session-end.md`

**Current behavior:**
- Warns about uncommitted changes
- Updates progress files
- Offers to save bundle

**Enhanced behavior:**
- Detect if RPI session is active
- Capture git metrics (commits, lines changed)
- Prompt for retro input
- Save RPI session record

**Add to session-end.md:**
```markdown
## RPI Session Capture

If RPI session is active:
1. Gather metrics:
   ```bash
   vibe-check rpi metrics
   ```
   Shows: commits made, files changed, build errors, test failures

2. Prompt for retro:
   - What worked well?
   - What didn't work?
   - Any surprises?
   - Lessons for next time?

3. End session:
   ```bash
   vibe-check rpi end --retro "[retro-json]"
   ```

4. Show synthesized learnings if patterns detected
```

### 1.3 Enhance `/research`

**File:** `.claude/commands/research.md`

**Enhanced behavior:**
- Check for relevant RPI learnings before research
- "Last time you researched X, you missed Y"

**Add to research.md:**
```markdown
## Check Past Learnings

Before deep research:
```bash
vibe-check rpi learnings --phase research
```
Surface any learnings about research quality from past sessions.
```

### 1.4 Enhance `/plan`

**File:** `.claude/commands/plan.md`

**Enhanced behavior:**
- Show plan accuracy stats from past sessions
- Warn about common underestimation patterns

**Add to plan.md:**
```markdown
## Plan Quality Check

Before finalizing plan:
```bash
vibe-check rpi learnings --phase plan
```

Show stats:
- Average plan accuracy: X%
- Common gaps: [list]
- Suggestion: Add 30% buffer to estimates
```

---

## Part 2: vibe-check RPI Module

### 2.1 `src/rpi/types.ts`

```typescript
/**
 * RPI Session Capture Types
 */

export interface RPISession {
  // Identity
  id: string;                    // "rpi-2025-12-02-001"
  startedAt: string;
  endedAt?: string;
  durationMinutes?: number;
  status: 'active' | 'completed' | 'abandoned';

  // Context
  repository: string;
  feature: string;
  planPath?: string;
  vibeLevel?: number;

  // Plan (extracted from bundle)
  plan: {
    plannedFiles: PlannedFile[];
    plannedSteps: number;
    complexity?: 'simple' | 'medium' | 'complex';
  };

  // Execution (tracked during session)
  execution: {
    filesCreated: string[];
    filesModified: string[];
    filesDeleted: string[];
    stepsCompleted: number;
    unplannedFiles: string[];    // Files not in plan
  };

  // Friction (captured during session)
  friction: {
    buildErrors: FrictionEvent[];
    testFailures: FrictionEvent[];
    planDeviations: PlanDeviation[];
  };

  // Outcome (captured at end)
  outcome?: {
    commits: string[];
    linesAdded: number;
    linesRemoved: number;
    testsPassing: boolean;
  };

  // Retro (user input at end)
  retro?: {
    whatWorked: string[];
    whatDidntWork: string[];
    surprises: string[];
    lessonsLearned: string[];
  };
}

export interface PlannedFile {
  path: string;
  action: 'create' | 'modify' | 'delete';
}

export interface FrictionEvent {
  timestamp: string;
  file?: string;
  error: string;
  resolution?: string;
}

export interface PlanDeviation {
  type: 'added_file' | 'skipped_step' | 'changed_approach';
  description: string;
  reason?: string;
}

export interface RPILearning {
  id: string;
  createdAt: string;
  updatedAt: string;

  // Pattern
  pattern: string;               // "build-error-type-mismatch"
  phase: 'research' | 'plan' | 'implement' | 'all';
  description: string;

  // Evidence
  occurrences: number;
  sessionIds: string[];

  // Actionable
  prevention: string[];
  detection: string[];

  // Stats
  avgTimeWasted: number;
  confidence: number;
}

export interface RPIDatabase {
  version: string;
  sessions: RPISession[];
  learnings: RPILearning[];
  activeSessionId?: string;
  stats: {
    totalSessions: number;
    completedSessions: number;
    avgPlanAccuracy: number;      // % of planned files actually created
    avgSessionDuration: number;
    commonFrictionPatterns: string[];
  };
}
```

### 2.2 `src/rpi/storage.ts`

```typescript
/**
 * RPI Session Storage
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { RPIDatabase, RPISession, RPILearning } from './types';

const RPI_FILE = 'rpi-sessions.json';

export function getRPIPath(): string {
  return path.join(os.homedir(), '.vibe-check', RPI_FILE);
}

export function createInitialRPIDatabase(): RPIDatabase {
  return {
    version: '1.0.0',
    sessions: [],
    learnings: [],
    stats: {
      totalSessions: 0,
      completedSessions: 0,
      avgPlanAccuracy: 0,
      avgSessionDuration: 0,
      commonFrictionPatterns: [],
    },
  };
}

export function loadRPIDatabase(): RPIDatabase { ... }
export function saveRPIDatabase(db: RPIDatabase): void { ... }

// Session management
export function startSession(feature: string, planPath?: string): RPISession { ... }
export function getActiveSession(): RPISession | null { ... }
export function endSession(retro: RPISession['retro']): RPISession { ... }
export function abandonSession(): void { ... }

// Friction tracking
export function recordBuildError(error: string, file?: string): void { ... }
export function recordTestFailure(error: string, file?: string): void { ... }
export function recordDeviation(deviation: PlanDeviation): void { ... }

// Metrics
export function captureGitMetrics(since: string): RPISession['outcome'] { ... }
```

### 2.3 `src/rpi/plan-parser.ts`

```typescript
/**
 * Parse plan bundles to extract planned files and steps
 */

import * as fs from 'fs';
import { PlannedFile } from './types';

export function parsePlanBundle(planPath: string): {
  plannedFiles: PlannedFile[];
  plannedSteps: number;
  complexity: 'simple' | 'medium' | 'complex';
} {
  const content = fs.readFileSync(planPath, 'utf-8');

  // Extract files from markdown
  // Look for patterns like:
  // - "Create `src/foo.ts`"
  // - "Modify `src/bar.ts`"
  // - "### 1. `src/foo.ts`"
  // - File paths in code blocks

  const filePatterns = [
    /(?:create|add)\s+`([^`]+)`/gi,
    /(?:modify|update|edit)\s+`([^`]+)`/gi,
    /(?:delete|remove)\s+`([^`]+)`/gi,
    /###\s+\d+\.\s+`([^`]+)`/g,
  ];

  // Extract steps from headers
  // Look for "## Implementation Order" or numbered steps

  const plannedFiles: PlannedFile[] = [];
  let plannedSteps = 0;

  // ... parsing logic

  const complexity = plannedFiles.length > 10 ? 'complex' :
                     plannedFiles.length > 5 ? 'medium' : 'simple';

  return { plannedFiles, plannedSteps, complexity };
}
```

### 2.4 `src/rpi/synthesis.ts`

```typescript
/**
 * Synthesize learnings from RPI sessions
 */

import { RPIDatabase, RPISession, RPILearning } from './types';

export function synthesizeRPILearnings(db: RPIDatabase): RPILearning[] {
  const sessions = db.sessions.filter(s => s.status === 'completed');
  if (sessions.length < 3) return db.learnings; // Need 3+ sessions

  const learnings: RPILearning[] = [];

  // Pattern 1: Build errors
  const buildErrorSessions = sessions.filter(s =>
    s.friction.buildErrors.length > 0
  );
  if (buildErrorSessions.length >= 2) {
    // Analyze common build error patterns
    const errorPatterns = extractErrorPatterns(buildErrorSessions);
    for (const pattern of errorPatterns) {
      learnings.push(createLearning('build-error', pattern, buildErrorSessions));
    }
  }

  // Pattern 2: Plan accuracy
  const avgAccuracy = calculatePlanAccuracy(sessions);
  if (avgAccuracy < 80) {
    learnings.push({
      id: 'rpi-learning-plan-accuracy',
      pattern: 'plan-underestimation',
      phase: 'plan',
      description: `Plans are ${100 - avgAccuracy}% under-scoped on average`,
      prevention: [
        'Add 30% buffer to file estimates',
        'Include "unknown unknowns" section in plan',
      ],
      // ...
    });
  }

  // Pattern 3: Test failures
  // Pattern 4: Common deviations
  // ...

  return learnings;
}

export function getRelevantLearnings(
  db: RPIDatabase,
  phase: 'research' | 'plan' | 'implement'
): RPILearning[] {
  return db.learnings.filter(l =>
    l.phase === phase || l.phase === 'all'
  );
}
```

### 2.5 `src/commands/rpi.ts`

```typescript
/**
 * RPI Command - Manage RPI sessions and learnings
 */

import { Command } from 'commander';
import chalk from 'chalk';
import {
  loadRPIDatabase,
  saveRPIDatabase,
  startSession,
  getActiveSession,
  endSession,
  captureGitMetrics,
} from '../rpi/storage';
import { parsePlanBundle } from '../rpi/plan-parser';
import { synthesizeRPILearnings, getRelevantLearnings } from '../rpi/synthesis';

export function createRPICommand(): Command {
  const cmd = new Command('rpi')
    .description('Manage RPI (Research-Plan-Implement) sessions and learnings');

  cmd
    .command('start')
    .description('Start a new RPI session')
    .option('--plan <path>', 'Path to plan bundle')
    .option('--feature <name>', 'Feature being implemented')
    .action((options) => { ... });

  cmd
    .command('end')
    .description('End current RPI session')
    .option('--retro <json>', 'Retro data as JSON')
    .action((options) => { ... });

  cmd
    .command('status')
    .description('Show current RPI session status')
    .action(() => { ... });

  cmd
    .command('history')
    .description('Show RPI session history')
    .option('--limit <n>', 'Number of sessions to show', '10')
    .action((options) => { ... });

  cmd
    .command('learnings')
    .description('Show synthesized RPI learnings')
    .option('--phase <phase>', 'Filter by phase (research, plan, implement)')
    .option('--relevant', 'Show learnings relevant to current context')
    .action((options) => { ... });

  cmd
    .command('metrics')
    .description('Show metrics for current session')
    .action(() => { ... });

  cmd
    .command('error')
    .description('Record a build/test error')
    .option('--build', 'Build error')
    .option('--test', 'Test failure')
    .option('--file <path>', 'File with error')
    .option('--message <msg>', 'Error message')
    .action((options) => { ... });

  return cmd;
}
```

---

## Part 3: Integration Flow

### Starting an RPI Session

```
User: /implement my-feature-plan.md

Claude:
1. Reads plan bundle
2. Calls: vibe-check rpi start --plan my-feature-plan.md --feature "My Feature"
3. Parses plan → extracts 6 files, 10 steps
4. Calls: vibe-check rpi learnings --phase implement
5. Displays: "⚠️ Past sessions show TypeScript errors on 4/5 implementations.
              Suggestion: Run build after each file."
6. Proceeds with implementation
```

### During Implementation

```
Claude runs: npm run build
Build fails with TypeScript error

Claude:
1. Calls: vibe-check rpi error --build --file src/foo.ts --message "Type X not assignable"
2. Fixes the error
3. Calls: vibe-check rpi error --build --file src/foo.ts --resolution "Updated type signature"
4. Continues
```

### Ending RPI Session

```
User: /session-end

Claude:
1. Calls: vibe-check rpi status
   → Shows: "Active session: my-feature, 45 min, 5/6 files, 2 build errors"

2. Calls: vibe-check rpi metrics
   → Shows: 3 commits, +500 lines, tests passing

3. Prompts user:
   "What worked well in this session?"
   "What didn't work?"
   "Any surprises?"
   "Lessons for next time?"

4. Calls: vibe-check rpi end --retro '{"whatWorked":["..."], ...}'

5. Shows: "Session recorded. 1 new learning synthesized:
           'TypeScript errors occur when modifying existing function signatures'"
```

### Next RPI Session

```
User: /implement another-feature-plan.md

Claude:
1. Starts session
2. Calls: vibe-check rpi learnings --relevant

3. Displays:
   "📚 LEARNINGS FROM PAST SESSIONS:

   ⚠️ Plan Accuracy: Your plans are 25% under-scoped on average
      → Consider adding buffer files

   ⚠️ TypeScript Signatures: 4/5 sessions had type errors
      → Read existing signatures before writing callers
      → Run build after each new file

   💡 What Worked: Detailed specs with exact file contents"

4. Proceeds with implementation, applying learnings
```

---

## Implementation Order

| Step | File | Action | Validation |
|------|------|--------|------------|
| 1 | `src/rpi/types.ts` | Create | `npm run build` |
| 2 | `src/rpi/storage.ts` | Create | `npm run build` |
| 3 | `src/rpi/plan-parser.ts` | Create | `npm run build` |
| 4 | `src/rpi/synthesis.ts` | Create | `npm run build` |
| 5 | `src/rpi/index.ts` | Create (exports) | `npm run build` |
| 6 | `src/commands/rpi.ts` | Create | `npm run build` |
| 7 | `src/commands/index.ts` | Modify (export) | `npm run build` |
| 8 | `src/cli.ts` | Modify (register) | `npm run build` |
| 9 | Test `rpi` command | Manual | `node dist/cli.js rpi --help` |
| 10 | `.claude/commands/implement.md` | Enhance | Manual test |
| 11 | `.claude/commands/session-end.md` | Enhance | Manual test |
| 12 | `.claude/commands/plan.md` | Enhance | Manual test |
| 13 | `.claude/commands/research.md` | Enhance | Manual test |
| 14 | Full integration test | E2E | Run full RPI cycle |
| 15 | Commit | Git | |

---

## Example Output

### `vibe-check rpi status`

```
================================================================
  RPI SESSION: Automatic Learning Cadence
================================================================

  Status: Active
  Started: 15 minutes ago
  Plan: .agents/bundles/automatic-learning-cadence-plan.md

  PROGRESS
    Files: 5/6 created, 2/4 modified
    Steps: 10/13 completed
    Unplanned: 1 file (pattern-memory.ts type fix)

  FRICTION
    Build errors: 1 (resolved)
    Test failures: 0
    Deviations: 1

  Run `vibe-check rpi end` to complete and capture learnings.
================================================================
```

### `vibe-check rpi learnings`

```
================================================================
  RPI LEARNINGS (3 patterns from 5 sessions)
================================================================

  ⚠️ PLAN ACCURACY
     Your plans are 25% under-scoped on average
     Occurrences: 4/5 sessions
     Prevention:
       - Add "buffer" section for unknowns
       - Estimate files × 1.3

  ⚠️ TYPESCRIPT SIGNATURES
     Type errors when calling existing functions
     Occurrences: 4/5 sessions
     Time wasted: ~5 min/session
     Prevention:
       - Read existing function signatures first
       - Run build after each new file

  💡 WHAT WORKS
     Detailed specs with exact file contents
     Occurrences: 5/5 sessions
     Keep doing this!

================================================================
```

### `vibe-check rpi history`

```
================================================================
  RPI SESSION HISTORY
================================================================

  [1] 2025-12-02 Lessons Database (90 min)
      ✓ Completed | 10 files | 2 errors | 1 learning

  [2] 2025-12-02 Learning Cadence (45 min)
      ✓ Completed | 7 files | 1 error | 0 learnings

  [3] 2025-12-01 Timeline Feature (60 min)
      ✓ Completed | 8 files | 0 errors | 1 learning

  Run `vibe-check rpi history --id 1` for details.
================================================================
```

---

## Approval Checklist

- [ ] Data model captures all relevant RPI friction
- [ ] Slash command integration is clear
- [ ] Storage location is appropriate (~/.vibe-check/)
- [ ] Synthesis logic is sound
- [ ] CLI commands are intuitive
- [ ] Integration flow makes sense

---

## Next Step

Once approved: `/implement rpi-session-capture-plan-2025-12-02.md`
