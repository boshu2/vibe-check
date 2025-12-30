# vibe-check Development Guide

## npm Publishing Standards

### When to Publish

| Change Type | Version Bump | Publish? |
|-------------|--------------|----------|
| **Breaking changes** | MAJOR (1.0.0 → 2.0.0) | Yes |
| **New features** (backward compatible) | MINOR (1.0.0 → 1.1.0) | Yes |
| **Bug fixes** | PATCH (1.0.0 → 1.0.1) | Yes |
| **Docs only (README, CHANGELOG)** | None | **No** |
| **Tests only** | None | **No** |
| **CI/tooling only** | None | **No** |

### GitHub README vs npm README

- **GitHub README**: Always shows latest from repo
- **npm README**: Snapshot from last publish - only updates when you `npm publish`

**Docs-only changes don't need a publish.** Just commit and push to GitHub.

### Version Commands

```bash
# Check current version
npm version

# Bump and publish (creates git tag automatically)
npm version patch   # 1.0.1 → 1.0.2 (bug fixes)
npm version minor   # 1.0.1 → 1.1.0 (new features)
npm version major   # 1.0.1 → 2.0.0 (breaking changes)

# Then publish
npm publish --access=public
```

### How Users Consume Versions

```bash
npm install @boshu2/vibe-check        # Gets "latest"
npm install @boshu2/vibe-check@1.0.2  # Exact version
npm install @boshu2/vibe-check@^1.0.0 # Any 1.x.x (common default)
npm install @boshu2/vibe-check@~1.0.0 # Any 1.0.x only
```

Most users have `^` (caret) in their package.json, meaning they'll auto-update to latest minor/patch.

## Development Workflow

### Running Locally (npm)

```bash
npm run dev           # Run with ts-node
npm run build         # Compile TypeScript
npm test              # Run Vitest tests
npm run test:coverage # Tests with coverage
```

### Testing the CLI

```bash
# Run against a repo
node dist/cli.js --repo /path/to/repo --since "1 week ago"

# Test different output formats
node dist/cli.js --format json
node dist/cli.js --format markdown
```

### Before Publishing

1. Ensure tests pass: `npm test`
2. Update CHANGELOG.md with changes
3. Bump version appropriately (see table above)
4. Commit version bump
5. `npm publish --access=public`

## Architecture

```
src/
├── cli.ts              # CLI entry point (Commander.js)
├── git.ts              # Git operations (simple-git)
├── types.ts            # TypeScript interfaces
├── errors.ts           # Custom error hierarchy
├── commands/           # CLI command implementations
│   ├── index.ts        # Command exports
│   ├── analyze.ts      # Main analyze command
│   └── analyze-helpers.ts  # Data loading, metrics, output
├── internal/           # Shared utilities
│   ├── context/        # Global context (output mode, repo path)
│   │   ├── index.ts    # Context creation, getContext()
│   │   └── types.ts    # CLIContext interface
│   └── output/         # Output formatting utilities
├── metrics/
│   ├── index.ts        # Orchestrates all metrics
│   ├── velocity.ts     # Iteration velocity
│   ├── rework.ts       # Rework ratio
│   ├── trust.ts        # Trust pass rate
│   ├── spirals.ts      # Debug spiral detection
│   └── flow.ts         # Flow efficiency
├── inner-loop/
│   ├── index.ts           # Inner loop failure detection aggregator
│   ├── types.ts           # Types and configuration
│   ├── tests-passing-lie.ts    # "Tests Passing" Lie detector
│   ├── context-amnesia.ts      # Context Amnesia detector
│   ├── instruction-drift.ts    # Instruction Drift detector
│   └── logging-only.ts         # Debug Loop Spiral detector
└── output/
    ├── index.ts        # Output format router
    ├── terminal.ts     # Colored terminal output
    ├── json.ts         # JSON output
    └── markdown.ts     # Markdown output
```

## CLI Reference

```bash
vc [options]

Options:
  --json                  Output JSON
  --timeout <seconds>     Git timeout (default: 120)
  --max-commits <number>  Max commits to analyze
  --since <date>          Start date (e.g., "1 week ago")
  --until <date>          End date (default: now)
  -f, --format <type>     Output: terminal, json, markdown
  -r, --repo <path>       Repository path
  -v, --verbose           Verbose output
  -q, --quiet             Quiet output
  --debug                 Debug logging
  --score                 Include VibeScore metrics
  -o, --output <file>     Write to file
  -s, --simple            Simple output
  --scope <scope>         Filter by scope
```

## The 5 Metrics

| Metric | Measures | Threshold |
|--------|----------|-----------|
| Iteration Velocity | Commits/hour | >5 = Elite |
| Rework Ratio | % fix commits | <30% = Elite |
| Trust Pass Rate | % commits without immediate fix | >95% = Elite |
| Debug Spiral Duration | Avg time in fix chains | <15m = Elite |
| Flow Efficiency | % time building vs debugging | >90% = Elite |

## Debug Spiral Detection

A "debug spiral" is detected when 3+ consecutive fix commits target the same component. Patterns are categorized:

- `SECRETS_AUTH` - OAuth/credentials issues
- `API_MISMATCH` - API version/schema problems
- `VOLUME_CONFIG` - Mount/permission issues
- `SSL_TLS` - Certificate problems
- `IMAGE_REGISTRY` - Container pull issues
- `GITOPS_DRIFT` - Sync/reconciliation issues

## Inner Loop Failure Pattern Detection

vibe-check detects the 4 "Inner Loop Disasters" from vibe coding:

| Pattern | Detects | How |
|---------|---------|-----|
| **"Tests Passing" Lie** | AI claims success but code doesn't work | Commits claiming "fix/done/working" followed by immediate fixes |
| **Context Amnesia** | AI forgets instructions, re-does work | Reverts, reimplementations, repeated similar fixes |
| **Instruction Drift** | AI "improves" things not asked for | Unrequested refactors, scope explosion, file changes outside intent |
| **Debug Loop Spiral** | AI adds logging instead of fixing | Consecutive commits adding console.log/print without fixes |

---

# Vibe-Coding Methodology

---

## The One Rule

> Reality does not match your model? **Update the model.**

Not the code. Not the tests. Not the plan. **The model in your head.**

---

## Opus 4.5 Behavioral Standards

<default_to_action>
When uncertain, act rather than asking for clarification. Make reasonable assumptions, implement, and verify. If wrong, adjust.
</default_to_action>

<use_parallel_tool_calls>
When multiple operations are independent (file reads, searches, API calls), batch them in a single response. Don't serialize what can parallelize.
</use_parallel_tool_calls>

<investigate_before_answering>
When you don't know something, investigate using available tools before saying you can't help. Read files, search code, check documentation.
</investigate_before_answering>

---

## Explicit Reasoning Protocol (L1-L3 Only)

For uncertain work, externalize predictions:

```
DOING: [current action]
EXPECT: [predicted outcome]
IF WRONG: [planned adjustment]

RESULT: [actual outcome]
MATCHES: [yes/no]
THEREFORE: [continue/stop/pivot]
```

---

## On Failure

When something fails, surface it immediately. Don't hide errors or pretend success:
- Show the actual error
- State what you expected
- Suggest the most likely cause
- Propose a fix or investigation path

---

## Vibe Levels (Trust Calibration)

| Level | Trust | Verify | Use For | Example |
|-------|-------|--------|---------|---------|
| **5** | 95% | Final only | Format, lint | Fix typo |
| **4** | 80% | Spot check | Boilerplate | Add CRUD endpoint |
| **3** | 60% | Key outputs | CRUD, tests | New feature |
| **2** | 40% | Every change | Features | Integration |
| **1** | 20% | Every line | Architecture | New system |
| **0** | 0% | N/A | Research | Exploration |

---

## The 5 Core Metrics

| Metric | Question | Target | Red Flag |
|--------|----------|--------|----------|
| **Iteration Velocity** | How tight are feedback loops? | >3/hour | <1/hour |
| **Rework Ratio** | Building or debugging? | <50% | >70% |
| **Trust Pass Rate** | Does code stick? | >80% | <60% |
| **Debug Spiral Duration** | How long stuck? | <30min | >60min |
| **Flow Efficiency** | What % productive? | >75% | <50% |

---

## The 12 Failure Patterns

### Inner Loop (Seconds-Minutes)
1. **Tests Passing Lie** - Tests pass but don't validate
2. **Premature Abstraction** - Solving problems you don't have
3. **Debug Loop Spiral** - Same fix failing repeatedly

### Middle Loop (Hours-Days)
4. **Plan-Reality Gap** - Plan doesn't match implementation
5. **Scope Creep** - Features growing beyond plan
6. **Bridge Torching** - Breaking backwards compatibility
7. **Eldritch Horror Merge** - Massive PRs nobody can review

### Outer Loop (Days-Weeks)
8. **Context Amnesia** - Forgetting session insights
9. **Instruction Drift** - Wandering from user intent
10. **Memory Tattoo Decay** - Knowledge not persisted
11. **Trust Erosion** - Repeated failures lower trust
12. **Requirement Telephone** - Requirements mutating through layers

---

## The 10 Laws of an Agent

1. **Reality First** - Reality != model? Update model.
2. **Explicit Predictions** - State expected outcomes before acting.
3. **Git Discipline** - Add files individually, semantic commits.
4. **TDD with Tracers** - Validate assumptions before building.
5. **Guide with Workflows** - Use /research, /plan, /implement.
6. **Classify Vibe Level** - L0-L5 before each task.
7. **Measure and Calibrate** - Track 5 metrics, adjust.
8. **Session Protocol** - One feature focus per session.
9. **Protect Feature Definitions** - Features are contracts.
10. **Explicit Reasoning** - For L1-L3, externalize thinking.

---

## Autonomy Boundaries

**Proceed autonomously:**
- Implementing approved plans
- Running tests and fixing failures
- Reading files to understand context
- Making git commits with proper messages

**Punt to user:**
- Deleting user data
- Pushing to main/master
- Changing architectural decisions
- Spending money (API calls, services)
- Security-sensitive changes

---

## Context Window Discipline

**The 40% Rule:** Start planning handoff at 40% context usage.

| Context % | Action |
|-----------|--------|
| 0-20% | Deep work mode |
| 20-40% | Normal operation |
| 40-60% | Plan handoff, save state |
| 60-80% | Emergency save only |
| 80%+ | Stop, save, new session |

---

## Slash Commands (Reference)

| Command | Purpose | Token Budget |
|---------|---------|--------------|
| `/research` | Deep exploration | 40-60k |
| `/plan` | Precise specifications | 40-60k |
| `/implement` | Execute approved plan | 60-80k |
| `/bundle-save` | Compress findings | 500-1k output |
| `/bundle-load` | Resume context | Load bundle |
| `/retro` | Session retrospective | 5-10k |
| `/learn` | Extract patterns | 5-10k |

---

## Communication Standards

- **Direct:** State facts, skip hedging
- **Objective:** Focus on technical accuracy
- **Brief:** Context is expensive

---

**Last Updated:** 2025-12-30
