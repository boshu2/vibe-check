# RPI Session Capture - Research

**Type:** Research
**Created:** 2025-12-02
**Goal:** Capture meta-learnings from Research→Plan→Implement sessions

---

## Problem Statement

The current learning system captures **code-level** patterns:
- Spiral patterns (SSL_TLS, API_MISMATCH)
- Interventions that break spirals
- Time wasted per pattern

But it doesn't capture **process-level** learnings from RPI sessions:
- Was the plan accurate?
- How many build errors during implementation?
- How many test failures?
- What deviations from the plan?
- What would make the next RPI better?

## Use Cases

### 1. Plan Accuracy Tracking
```
Plan said: Create 6 files, modify 4
Reality: Created 8 files, modified 5, deleted 1
Lesson: Plans underestimate scope by ~25%
```

### 2. Implementation Friction
```
Build errors: 3 (TypeScript type mismatches)
Test failures: 2 (missing mocks)
Lesson: Check type signatures before implementing
```

### 3. Spec Quality
```
Spec gaps found during implementation:
- Didn't specify error handling
- Missing edge case for empty input
Lesson: Always include error cases in spec
```

### 4. Cross-Session Patterns
```
Last 5 RPI sessions:
- 4/5 had TypeScript errors on new files
- 3/5 required test fixes
- Average plan deviation: +30% files
```

---

## Data Model

### RPISession

```typescript
interface RPISession {
  // Identity
  id: string;                    // "rpi-2025-12-02-001"
  startedAt: string;             // ISO datetime
  endedAt: string;
  durationMinutes: number;

  // Context
  repository: string;            // Repo name
  feature: string;               // What was being built
  vibeLevel: number;             // 0-5

  // The Plan
  plan: {
    bundlePath: string;          // Path to plan bundle
    plannedFiles: PlannedFile[];
    plannedSteps: number;
    estimatedComplexity: 'simple' | 'medium' | 'complex';
  };

  // Execution
  execution: {
    actualFiles: ActualFile[];
    stepsCompleted: number;
    stepsSkipped: number;
    stepsAdded: number;          // Not in original plan
  };

  // Friction Points
  friction: {
    buildErrors: BuildError[];
    testFailures: TestFailure[];
    planDeviations: PlanDeviation[];
    blockers: string[];
  };

  // Outcomes
  outcome: {
    status: 'completed' | 'partial' | 'abandoned';
    commits: string[];
    linesAdded: number;
    linesRemoved: number;
    testsAdded: number;
    testsPassing: boolean;
  };

  // Retrospective (user or AI generated)
  retro: {
    whatWorked: string[];
    whatDidntWork: string[];
    surprises: string[];         // Unexpected things
    lessonsLearned: string[];
    suggestionsForNextTime: string[];
  };
}

interface PlannedFile {
  path: string;
  action: 'create' | 'modify' | 'delete';
  description: string;
}

interface ActualFile {
  path: string;
  action: 'create' | 'modify' | 'delete';
  wasPlanned: boolean;           // Was this in the plan?
  linesChanged: number;
}

interface BuildError {
  timestamp: string;
  file: string;
  error: string;                 // Truncated error message
  resolution: string;            // How it was fixed
}

interface TestFailure {
  timestamp: string;
  testFile: string;
  failureCount: number;
  resolution: string;
}

interface PlanDeviation {
  type: 'added_file' | 'skipped_file' | 'changed_approach' | 'scope_change';
  description: string;
  reason: string;
}
```

### RPILearning (Synthesized from Sessions)

```typescript
interface RPILearning {
  id: string;
  createdAt: string;
  updatedAt: string;

  // The pattern
  pattern: string;               // "typescript-type-errors", "test-mock-missing"
  description: string;

  // Evidence
  occurrences: number;
  sessionIds: string[];

  // Prevention
  prevention: string[];          // How to avoid this
  detection: string[];           // How to catch early

  // Impact
  avgTimeWasted: number;         // Minutes
  frequency: number;             // Per session

  // Confidence
  confidence: number;            // 0-100
}
```

---

## Storage

```
~/.vibe-check/
├── rpi-sessions.json           # All RPI session records
├── rpi-learnings.json          # Synthesized learnings
└── lessons.json                # Existing code-level lessons
```

Or integrate into existing:
```
~/.vibe-check/
├── learning-state.json         # Add rpiSessions array
└── lessons.json                # Add rpiLearnings alongside code lessons
```

---

## Capture Points

### 1. Session Start (Manual or Auto)
- `/implement` command starts RPI session
- Reads plan bundle, extracts planned files/steps
- Records start time, vibe level

### 2. During Implementation (Auto)
- Hook into build commands → capture errors
- Hook into test commands → capture failures
- Track file creates/modifies (git status)

### 3. Session End (Manual or Auto)
- Commit triggers end
- Or explicit `/session-end`
- Calculates deviations from plan
- Prompts for retro input

### 4. Synthesis (Auto)
- After N sessions, synthesize patterns
- "You always have TypeScript errors on step 3"
- "Plans underestimate by 30% on average"

---

## Integration Points

### With Existing Systems

1. **Plan bundles** (.agents/bundles/*.md)
   - Parse to extract planned files/steps
   - Compare against actual execution

2. **Git history**
   - Track commits during session
   - Calculate lines changed
   - Detect file operations

3. **Build/test output**
   - Capture npm run build errors
   - Capture npm test failures

4. **Learning system**
   - RPI learnings alongside code lessons
   - Surface during next RPI session

### CLI Integration

```bash
# Start RPI session explicitly
vibe-check rpi start --plan bundles/my-plan.md

# End session with retro
vibe-check rpi end

# View RPI history
vibe-check rpi history

# View RPI learnings
vibe-check rpi learnings

# Or integrate with existing commands
vibe-check learn --rpi           # Show RPI learnings
vibe-check lesson --rpi          # Show RPI-specific lessons
```

---

## Minimum Viable Implementation

### Phase 1: Manual Capture
1. New `rpi` command with `start`, `end`, `history`
2. User manually marks session start/end
3. Auto-capture: git commits, file changes
4. Manual retro input at end

### Phase 2: Auto-Detection
1. Detect plan execution (file patterns match plan)
2. Hook build/test commands (wrapper or shell integration)
3. Auto-generate retro suggestions

### Phase 3: Synthesis
1. Pattern detection across sessions
2. Learning generation from patterns
3. Surface learnings during next RPI

---

## Example Session Capture

```json
{
  "id": "rpi-2025-12-02-001",
  "startedAt": "2025-12-02T12:00:00Z",
  "endedAt": "2025-12-02T13:30:00Z",
  "durationMinutes": 90,
  "repository": "vibe-check",
  "feature": "Automatic Learning Cadence",
  "vibeLevel": 3,

  "plan": {
    "bundlePath": ".agents/bundles/automatic-learning-cadence-plan.md",
    "plannedFiles": [
      { "path": "src/learning/types.ts", "action": "create" },
      { "path": "src/learning/storage.ts", "action": "create" },
      { "path": "src/learning/cadence.ts", "action": "create" },
      { "path": "src/learning/nudges.ts", "action": "create" },
      { "path": "src/learning/retrospective.ts", "action": "create" },
      { "path": "src/learning/index.ts", "action": "create" }
    ],
    "plannedSteps": 13,
    "estimatedComplexity": "medium"
  },

  "execution": {
    "actualFiles": [
      { "path": "src/learning/types.ts", "action": "create", "wasPlanned": true },
      { "path": "src/learning/storage.ts", "action": "create", "wasPlanned": true },
      // ... etc
      { "path": "src/gamification/pattern-memory.ts", "action": "modify", "wasPlanned": false }
    ],
    "stepsCompleted": 13,
    "stepsSkipped": 0,
    "stepsAdded": 1
  },

  "friction": {
    "buildErrors": [
      {
        "timestamp": "2025-12-02T12:30:00Z",
        "file": "src/learning/cadence.ts",
        "error": "Type 'PatternMemory | undefined' not assignable to 'PatternMemory'",
        "resolution": "Updated formatPatternMemory signature to accept undefined"
      }
    ],
    "testFailures": [],
    "planDeviations": [
      {
        "type": "added_file",
        "description": "Modified pattern-memory.ts type signature",
        "reason": "Function didn't handle undefined, but callers pass undefined"
      }
    ],
    "blockers": []
  },

  "outcome": {
    "status": "completed",
    "commits": ["bd3e7df", "87a1c09"],
    "linesAdded": 910,
    "linesRemoved": 4,
    "testsAdded": 0,
    "testsPassing": true
  },

  "retro": {
    "whatWorked": [
      "Detailed plan with exact file contents",
      "Step-by-step implementation order",
      "Validation commands after each step"
    ],
    "whatDidntWork": [
      "Plan didn't account for type signature mismatches"
    ],
    "surprises": [
      "formatPatternMemory already handled undefined internally but type said otherwise"
    ],
    "lessonsLearned": [
      "Check existing function signatures before writing callers",
      "TypeScript strictness catches real bugs"
    ],
    "suggestionsForNextTime": [
      "Include type signature verification in plan",
      "Run build after each file, not just at checkpoints"
    ]
  }
}
```

---

## Synthesized Learning Example

After 5 sessions with TypeScript errors:

```json
{
  "id": "rpi-learning-typescript-signatures",
  "pattern": "typescript-signature-mismatch",
  "description": "Functions called with arguments that don't match existing signatures",
  "occurrences": 4,
  "sessionIds": ["rpi-001", "rpi-003", "rpi-004", "rpi-007"],
  "prevention": [
    "Read existing function signatures before writing callers",
    "Run `npm run build` after each new file, not just checkpoints",
    "Include type verification step in plan"
  ],
  "detection": [
    "First build error after writing caller code",
    "Error message contains 'not assignable to'"
  ],
  "avgTimeWasted": 5,
  "frequency": 0.8,
  "confidence": 85
}
```

---

## Questions to Resolve

1. **Capture granularity**: Every build error, or just summary?
2. **Retro input**: AI-generated suggestions, user confirms?
3. **Storage**: Separate file or integrate with learning-state.json?
4. **Plan parsing**: How to extract files/steps from markdown plan?
5. **Session boundaries**: Manual start/end or auto-detect?

---

## Recommendation

Start with **Phase 1: Manual Capture** because:
- Lowest friction to implement
- Gets data flowing immediately
- User feedback shapes automation

MVP scope:
- `vibe-check rpi start --plan <path>` - start session
- `vibe-check rpi end` - end session with git-based metrics + manual retro
- `vibe-check rpi history` - view past sessions
- Store in `~/.vibe-check/rpi-sessions.json`

Then iterate based on real usage.
