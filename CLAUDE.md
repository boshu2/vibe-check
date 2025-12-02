# vibe-check Development Guide

## Opus 4.5 Behavioral Standards

<default_to_action>
By default, implement changes rather than only suggesting them. If the user's intent is unclear, infer the most useful likely action and proceed, using tools to discover any missing details instead of guessing.
</default_to_action>

<use_parallel_tool_calls>
When performing multiple independent operations (reading multiple files, running multiple checks), execute them in parallel rather than sequentially. Only sequence operations when one depends on another's output.
</use_parallel_tool_calls>

<investigate_before_answering>
Before proposing code changes, read and understand the relevant files. Do not speculate about code you have not opened. Give grounded, hallucination-free answers based on actual code inspection.
</investigate_before_answering>

<avoid_overengineering>
Only make changes that are directly requested or clearly necessary. Keep solutions simple and focused. Do not add features, refactor code, or make "improvements" beyond what was asked. Do not create helpers or abstractions for one-time operations.
</avoid_overengineering>

<communication_style>
After completing tasks involving tool use, provide a brief summary of work done. When making significant changes, explain what was changed and why. Keep summaries concise but informative.
</communication_style>

---

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

### Makefile Commands

All commands are available via `make`. Run `make help` for full list.

```bash
# Build & Run
make build            # Compile TypeScript
make dev              # Run with ts-node
make test             # Run all tests
make test-coverage    # Tests with coverage

# Vibe-Check
make dashboard        # Open visual dashboard
make analyze          # Analyze last week
make profile          # Show XP, streaks, achievements
make watch            # Real-time spiral detection

# Session Integration
make session-start    # Start session (prompts for level)
make session-end      # End session and get metrics
make session-status   # Show active session info

# Publishing
make publish          # Build, test, publish to npm
make version-patch    # Bump patch version
make version-minor    # Bump minor version
```

See [Makefile](./Makefile) for all available targets.

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
├── commands/
│   ├── index.ts        # Command exports
│   ├── analyze.ts      # Main analyze command
│   ├── session.ts      # Session start/end/status + coaching
│   ├── dashboard.ts    # Visual dashboard command
│   ├── watch.ts        # Real-time monitoring + coaching
│   ├── insights.ts     # Spiral patterns + recommendations
│   ├── timeline.ts     # Session history
│   └── profile.ts      # Profile/stats command
├── storage/
│   ├── spiral-history.ts  # Spiral history NDJSON log
│   ├── atomic.ts          # Atomic file operations
│   ├── commit-log.ts      # Commit log storage
│   └── timeline-store.ts  # Timeline cache
├── metrics/
│   ├── index.ts        # Orchestrates all metrics
│   ├── velocity.ts     # Iteration velocity
│   ├── rework.ts       # Rework ratio
│   ├── trust.ts        # Trust pass rate
│   ├── spirals.ts      # Debug spiral detection
│   ├── flow.ts         # Flow efficiency
│   ├── file-churn.ts   # File churn patterns
│   ├── time-spiral.ts  # Time-based spirals
│   ├── velocity-anomaly.ts # Velocity anomaly detection
│   └── code-stability.ts   # Code stability metrics
├── gamification/
│   ├── index.ts        # Gamification exports
│   ├── types.ts        # XP, levels, achievements types
│   ├── xp.ts           # XP calculation and levels
│   ├── streaks.ts      # Daily/weekly streak tracking
│   ├── achievements.ts # Achievement definitions and checks
│   ├── stats.ts        # Weekly statistics
│   └── profile.ts      # Profile persistence (.vibe-check/)
├── sessions/
│   └── index.ts        # Session tracking and baseline comparison
├── calibration/
│   ├── index.ts        # Calibration orchestration
│   ├── ece.ts          # Expected calibration error
│   └── storage.ts      # Calibration data persistence
├── recommend/
│   ├── index.ts        # Recommendation orchestration
│   ├── ordered-logistic.ts # Ordinal logistic regression
│   └── questions.ts    # Assessment questions
├── score/
│   ├── index.ts        # VibeScore calculation
│   └── weights.ts      # Metric weights
└── output/
    ├── index.ts        # Output format router
    ├── terminal.ts     # Colored terminal output
    ├── json.ts         # JSON output
    └── markdown.ts     # Markdown output

dashboard/              # Static HTML dashboard
├── index.html          # Dashboard UI
├── app.js              # Dashboard JavaScript
└── styles.css          # Dashboard styles

~/.vibe-check/          # Global profile data (in home dir)
├── profile.json        # XP, streaks, achievements
├── spiral-history.ndjson  # Spiral log for coaching
└── calibration.json    # Calibration samples

.vibe-check/            # Local data (per-repo)
├── active-session.json # Active session state
└── timeline.json       # Timeline cache
```

## Commands

### Main Command (analyze)
```bash
vibe-check [options]           # Analyze git history
vibe-check --since "1 week"    # Time-bounded analysis
vibe-check --score --recommend # Full analysis with recommendations
```

### Profile Command
```bash
vibe-check profile             # View your profile
vibe-check profile --achievements  # List all achievements
vibe-check profile --stats     # Detailed statistics
vibe-check profile --json      # Machine-readable output
```

### Level Command
```bash
vibe-check level               # Get level recommendation
vibe-check level --calibrate 3 # Record calibration sample
```

### Session Commands (AgentOps Integration)
```bash
vibe-check session start --level 3   # Start session, capture baseline
vibe-check session status            # Show active session
vibe-check session end --format json # End session, get metrics + coaching
```

Output includes failure pattern detection and personalized coaching:
```json
{
  "metrics": { "trust_pass_rate": 92, "rework_ratio": 11, ... },
  "retro": {
    "failure_patterns_hit": [],
    "failure_patterns_avoided": ["Debug Spiral", "Context Amnesia"]
  }
}
```

### Insights Command (Coaching)
```bash
vibe-check insights              # Your spiral patterns + what works
vibe-check insights --days 90    # Longer history
vibe-check insights --format json  # Export for analysis
```

Shows your spiral history, patterns by frequency, what resolutions worked, and personalized recommendations.

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

**Coaching Integration:** Spirals are automatically recorded to `~/.vibe-check/spiral-history.ndjson`. Watch mode and session end show personalized advice based on what's worked before for you.
