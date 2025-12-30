# vibe-check Architecture

**Technical guide to the vibe-check codebase**

---

## Table of Contents

1. [Overview](#overview)
2. [System Architecture](#system-architecture)
3. [Module Boundaries](#module-boundaries)
4. [Data Flow](#data-flow)
5. [Key Design Decisions](#key-design-decisions)
6. [Directory Structure](#directory-structure)
7. [Error Handling](#error-handling-architecture)
8. [Core Modules](#key-modules)
9. [Testing Strategy](#testing-strategy)
10. [Design Principles](#design-principles)

---

## Overview

vibe-check is a TypeScript CLI tool that analyzes git history to measure AI-assisted development effectiveness. It uses **semantic-free signals** from commit patterns to compute metrics without reading code content.

### Core Philosophy

- **Privacy-First**: Never reads actual source code, only commit metadata
- **Git-Native**: All data derived from git history (commits, timestamps, file lists)
- **Semantic-Free**: Metrics based on patterns, not code semantics

### Technology Stack

| Component | Technology | Purpose |
|-----------|------------|---------|
| Runtime | Node.js 20+ | ES Modules, native fetch |
| Language | TypeScript 5.x | Type safety, maintainability |
| CLI Framework | Commander.js | Command parsing, options |
| Git Integration | simple-git | Git log, diff-tree operations |
| Output | chalk | Terminal formatting |
| Testing | Vitest | Unit and integration tests |

---

## System Architecture

```
+---------------------------------------------------------------------+
|                            CLI Layer                                 |
|  cli.ts -> Commander.js -> Global context -> User I/O               |
|  [Entry point, argument parsing, global hooks, output routing]       |
+---------------------------------------------------------------------+
|                           Core Layer                                 |
|  +------------+ +------------+ +------------+                        |
|  |  Metrics   | |  Inner-    | |  Errors    |                        |
|  |  Engine    | |  Loop      | |  Hierarchy |                        |
|  | (metrics/) | |(inner-loop)| | (errors.ts)|                        |
|  +------------+ +------------+ +------------+                        |
+---------------------------------------------------------------------+
|                          Output Layer                                |
|  Terminal (chalk) | JSON | Markdown                                  |
|  [output/ - format routing, terminal colors, structured output]      |
+---------------------------------------------------------------------+
|                           Data Layer                                 |
|  +-------------+                                                     |
|  | Git Access  |                                                     |
|  |  (git.ts)   |                                                     |
|  | simple-git  |                                                     |
|  +-------------+                                                     |
+---------------------------------------------------------------------+
```

---

## Module Boundaries

### Dependency Rules

Modules follow a strict layered architecture with downward-only dependencies:

```
CLI Layer
    | uses
Core Layer (Metrics + Detection)
    | uses
Output Layer
    | uses
Data Layer
```

**Key Constraints:**
- Core modules don't know about CLI/output formatting
- Data layer has no dependencies on upper layers
- Detection modules are stateless, receive data as parameters

### Module Ownership Matrix

| Module | Owner | Boundary | External API |
|--------|-------|----------|--------------|
| `cli.ts` | CLI | Entry point | `program.parse()` |
| `commands/` | Commands | User features | `runAnalyze()` |
| `metrics/` | Core | Calculations | `analyzeCommits()` |
| `inner-loop/` | Detection | Failure patterns | `analyzeInnerLoop()` |
| `output/` | Presentation | Formatting | `formatOutput()` |

### Interface Contracts

Each module exposes a clean interface through its `index.ts`:

```typescript
// metrics/index.ts - Single entry point
export function analyzeCommits(commits: Commit[]): VibeCheckResult;

// inner-loop/index.ts - Aggregated detection
export function analyzeInnerLoop(
  commits: Commit[],
  config?: InnerLoopConfig
): InnerLoopAnalysis;
```

---

## Data Flow

### Primary Analysis Pipeline

```
+------------+    +------------+    +------------+
| Git History|--->|Parse Commits|--->| Commit[]   |
| (simple-git)|   |  (git.ts)   |   |            |
+------------+    +------------+    +-----+------+
                                          |
                  +-----------------------+-----------------------+
                  |                       v                       |
                  |  +------------+  +------------+  +----------+ |
                  |  |  Velocity  |  |  Rework    |  |  Trust   | |
                  |  |  Metric    |  |  Metric    |  |  Metric  | |
                  |  +-----+------+  +-----+------+  +----+-----+ |
                  |        |               |              |       |
                  |        +-------+-------+------+-------+       |
                  |                |              |               |
                  |                v              v               |
                  |         +------------+  +------------+        |
                  |         | Flow       |  | Spirals    |        |
                  |         | Metric     |  | Detection  |        |
                  |         +-----+------+  +-----+------+        |
                  |               |               |               |
                  |               +-------+-------+               |
                  |                       v                       |
                  |               +------------+                  |
                  |               |MetricResult|                  |
                  |               | (5 core)   |                  |
                  |               +-----+------+                  |
                  |   metrics/          |                         |
                  +---------------------+-------------------------+
                                        |
                  +---------------------+---------------------+
                  |                     v                     |
                  |  +----------+ +----------+ +--------+     |
                  |  | Terminal | |   JSON   | |Markdown|     |
                  |  | Output   | |  Output  | | Output |     |
                  |  +----------+ +----------+ +--------+     |
                  |   output/                                 |
                  +-------------------------------------------+
```

### Detection Pipeline (Inner-Loop)

```
                    Commit[]
                        |
                        v
              +------------------+
              |   Inner-Loop     |
              |   Detection      |
              +------------------+
              | - Tests Lie      |
              | - Amnesia        |
              | - Drift          |
              | - Debug Loop     |
              +--------+---------+
                       |
                       v
              +------------------+
              | Recommendations  |
              +------------------+
```

---

## Key Design Decisions

### 1. Semantic-Free Analysis

**Decision:** Never parse or read source code content.

**Rationale:**
- Privacy: Users trust tool with git metadata, not code
- Performance: No AST parsing, instant analysis
- Language-agnostic: Works for any language
- Focus: Patterns, not implementation details

**Trade-off:** Cannot detect code quality issues, only behavioral patterns.

### 2. Layered Error Handling

**Decision:** Custom error hierarchy with semantic exit codes.

**Rationale:**
- CI/CD integration: Exit codes enable scripted responses
- Debug-friendly: Errors carry full context
- User-friendly: Clear, actionable error messages
- Testable: Commands return exit codes, not `process.exit()`

```typescript
// Commands return ExitCode, CLI layer handles exit
export async function runAnalyze(options): Promise<ExitCode> {
  try { ... }
  catch (error) {
    if (isVibeCheckError(error)) {
      return error.code;  // Semantic exit code
    }
    return ExitCode.GENERAL_ERROR;
  }
}
```

### 3. Global Context Singleton

**Decision:** Single context object for CLI state.

**Rationale:**
- Consistency: All modules see same repo path, output mode
- Simplicity: No context threading through call chains
- Hook-friendly: Set once in preAction, available everywhere

```typescript
// Set in CLI preAction hook
setContext(createContext({ repo: opts.repo, outputMode: 'json' }));

// Access anywhere
const { repo, outputMode } = getContext();
```

### 4. Single Command Design

**Decision:** One main command (`vc`) with options instead of subcommands.

**Rationale:**
- Simplicity: Most common use case is quick analysis
- Fast: No subcommand parsing overhead
- Discoverable: `--help` shows all options at once

---

## Directory Structure

```
src/
+-- cli.ts                 # Entry point, Commander.js setup, global hooks
+-- git.ts                 # Git operations (simple-git wrapper)
+-- types.ts               # Core TypeScript interfaces
+-- errors.ts              # Custom error hierarchy with semantic exit codes
|
+-- internal/              # Shared CLI utilities
|   +-- context/           # Global context (repo path, output mode)
|   |   +-- index.ts       # Context creation and management
|   |   +-- types.ts       # Context type definitions
|   +-- output/            # Output formatting utilities
|       +-- index.ts       # Output helpers
|       +-- contract.ts    # Agent output contract
|
+-- commands/              # CLI command implementations
|   +-- index.ts           # Command exports
|   +-- analyze.ts         # Main analysis command
|   +-- analyze-helpers.ts # Data loading, metrics computation, output formatting
|
+-- metrics/               # Metric calculations
|   +-- index.ts           # Orchestrates all metrics
|   +-- velocity.ts        # Iteration velocity
|   +-- rework.ts          # Rework ratio
|   +-- trust.ts           # Trust pass rate
|   +-- spirals.ts         # Debug spiral detection
|   +-- flow.ts            # Flow efficiency
|
+-- inner-loop/            # Inner Loop Failure Detection
|   +-- index.ts           # Aggregator for all detectors
|   +-- types.ts           # Types and configuration
|   +-- tests-passing-lie.ts    # "Tests Passing" Lie detector
|   +-- context-amnesia.ts      # Context Amnesia detector
|   +-- instruction-drift.ts    # Instruction Drift detector
|   +-- logging-only.ts         # Debug Loop Spiral detector
|
+-- output/                # Output formatters
    +-- index.ts           # Format router
    +-- terminal.ts        # Colored terminal output
    +-- json.ts            # JSON output
    +-- markdown.ts        # Markdown output
```

---

## Error Handling Architecture

### Error Hierarchy

```typescript
VibeCheckError (base)
+-- GitError (exit code 2)
|   +-- notARepo(path)
|   +-- logFailed(reason)
|   +-- commitNotFound(hash)
+-- ValidationError (exit code 3)
|   +-- invalidFormat(format, validFormats)
|   +-- invalidDateRange(since, until)
|   +-- missingRequired(option)
+-- AnalysisError (exit code 6)
    +-- noCommits(since, until)
    +-- insufficientData(required, actual)
```

### Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | General error / LOW rating |
| 2 | Git error |
| 3 | Validation error |
| 6 | Analysis error |

---

## Key Modules

### Internal Context (`internal/context/`)

Global context for CLI operations:

```typescript
interface CLIContext {
  repo: string;          // Repository path
  outputMode: 'terminal' | 'json';
  verbose: boolean;
  quiet: boolean;
  debug?: boolean;
  timeout: number;
  maxCommits?: number;
  version: string;
}
```

Set once at command start, accessed throughout:

```typescript
import { getContext } from './internal/context/index.js';
const ctx = getContext();
```

---

## Inner Loop Failure Detection

Detects the 4 "Inner Loop Disasters" from vibe coding:

| Pattern | Detects | Detection Method |
|---------|---------|------------------|
| **Tests Passing Lie** | AI claims success but fails | Commits with "fix/done/working" followed by immediate fixes |
| **Context Amnesia** | AI forgets instructions | Reverts, reimplementations, repeated similar fixes |
| **Instruction Drift** | AI "improves" unrequested | Unrequested refactors, scope explosion |
| **Debug Loop Spiral** | AI adds logging only | Consecutive console.log commits without fixes |

### Detection Architecture

```
src/inner-loop/
+-- index.ts                 # Aggregates all detectors
+-- types.ts                 # Types, thresholds, config
+-- tests-passing-lie.ts     # Lie detection
+-- context-amnesia.ts       # Memory loss detection
+-- instruction-drift.ts     # Scope creep detection
+-- logging-only.ts          # Debug spam detection
```

---

## Metric Calculations

### Core Metrics (5)

| Metric | Formula | Elite Threshold |
|--------|---------|-----------------|
| Iteration Velocity | `commits / activeHours` | >5/hr |
| Rework Ratio | `fixCommits / totalCommits` | <30% |
| Trust Pass Rate | `1 - immediateFixRate` | >95% |
| Debug Spiral Duration | `avgSpiralMinutes` | <15m |
| Flow Efficiency | `buildTime / totalTime` | >90% |

---

## Testing Strategy

### Test Organization

```
tests/
+-- inner-loop.test.ts          # Inner loop detection
+-- cli.integration.test.ts     # End-to-end CLI tests
+-- ...
```

---

## Design Principles

1. **Semantic-Free** - Analyze patterns, not code content
2. **Privacy-First** - Never read actual source code
3. **Git-Native** - All data from git history
4. **Errors as Values** - Custom error hierarchy with context
5. **Zero External Dependencies** - Works offline
6. **Testable Architecture** - Commands return results, CLI wrapper handles exit

---

## CLI Options Reference

```bash
vc [options]

Options:
  --json                  Output JSON
  --timeout <seconds>     Git timeout in seconds (default: 120)
  --max-commits <number>  Max commits to analyze
  --since <date>          Start date (e.g., "1 week ago")
  --until <date>          End date (default: now)
  -f, --format <type>     Output format: terminal, json, markdown
  -r, --repo <path>       Repository path (default: cwd)
  -v, --verbose           Verbose output
  -q, --quiet             Quiet output
  --debug                 Debug logging
  --score                 Include VibeScore metrics
  -o, --output <file>     Write JSON to file
  -s, --simple            Simple output
  --scope <scope>         Filter by scope
```

---

**Version:** 0.1.0
**Last Updated:** 2025-12-30
