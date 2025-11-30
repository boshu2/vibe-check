# vibe-check

**Quick check: are you building or spiraling?**

Analyzes your git history to tell you if you're making progress or stuck in fix loops.

## Install

```bash
npm install -g @boshu2/vibe-check
```

Or run directly:

```bash
npx @boshu2/vibe-check
```

## Quick Start

```bash
# Check your recent work
vibe-check --since "1 week ago"

# Watch mode - catch spirals in real-time
vibe-check watch
```

## Watch Mode (Real-Time Detection)

Catch spirals as they happen, not after:

```bash
vibe-check watch
```

```
VIBE-CHECK WATCH MODE
Monitoring /path/to/repo
Polling every 5s - Ctrl+C to stop

────────────────────────────────────────────────────────────
  09:15 fix(auth) handle token refresh
  09:18 fix(auth) add retry logic
  09:22 fix(auth) increase timeout

  ⚠️  SPIRAL DETECTED
      Component: auth
      Fixes: 3 commits, 7 min

      Consider:
      • Step back and write a test
      • Check the docs or ask for help
      • Take a 5-minute break
────────────────────────────────────────────────────────────
```

Options:
- `--quiet` - Only show warnings, not all commits
- `--interval <ms>` - Poll frequency (default: 5000ms)

## Example Output

```
VIBE-CHECK Nov 21 - Nov 28

  Rating: HIGH
  Trust: 92% HIGH
  Rework: 35% MEDIUM

  Run without --simple for full details
```

## Automatic Baseline Comparison

vibe-check learns YOUR patterns and compares each session to your baseline:

```bash
vibe-check --since "1 hour ago"
```

```
VS YOUR BASELINE

  Trust:  92% (+7% vs avg 85%)
  Rework: 18% (-4% vs avg 22%)

  Better than your usual - nice flow!
```

After 5+ sessions, you get automatic feedback without declaring anything.

## Manual Session Workflow (Optional)

For explicit level tracking, declare before starting:

```bash
# Before work: declare your expectation
vibe-check start --level 3

# ... do your work ...

# After work: compare reality vs expectation
vibe-check --since "1 hour ago"
```

```
SESSION COMPLETE

  Declared: Level 3 - Balanced (60% trust)
  Duration: 45 min, 12 commits

  Trust Pass:  85% (expected >65%) ✓
  Rework:      20% (expected <30%) ✓

  ✓ Level 3 was appropriate for this work
```

### Vibe Levels

| Level | Name | Trust | When to Use |
|-------|------|-------|-------------|
| 5 | Full Automation | 95% | Formatting, linting |
| 4 | High Trust | 80% | Boilerplate, CRUD |
| 3 | Balanced | 60% | Features, tests |
| 2 | Careful | 40% | Integrations, APIs |
| 1 | Skeptical | 20% | Architecture, security |
| 0 | Manual | 0% | Novel research |

## The Core Metrics

| Metric | What It Measures | Elite | Needs Work |
|--------|------------------|-------|------------|
| **Trust Pass Rate** | % commits without immediate fix | >95% | <80% |
| **Rework Ratio** | % commits that are fixes | <30% | >50% |
| **Debug Spiral** | Stuck in fix loops? | 0 detected | 3+ detected |

## Git Hook

Run automatically before every push:

```bash
vibe-check init-hook
```

Block pushes on LOW rating:

```bash
vibe-check init-hook --block-low
```

## Gamification

Track progress with XP, streaks, and achievements:

```bash
vibe-check profile
```

```
╭─────────────────────────────────────────────╮
│           Your Vibe Profile                 │
├─────────────────────────────────────────────┤
│  🌲 Level 4 Expert                          │
│  ████████████████░░░░  320/400 XP           │
│                                             │
│  🔥 Current Streak: 5 days                  │
│  🏆 Achievements: 8/19 unlocked             │
╰─────────────────────────────────────────────╯
```

## CLI Options

```
vibe-check [options]

Options:
  --since <date>       Start date (e.g., "1 week ago")
  --until <date>       End date (default: now)
  -f, --format <type>  Output: terminal, json, markdown
  -r, --repo <path>    Repository path
  -o, --output <file>  Write JSON to file
  -s, --simple         Simplified output
  --score              Include VibeScore
  -v, --verbose        Verbose output

Commands:
  watch                Real-time spiral detection
  start --level <n>    Start session with declared level (0-5)
  profile              View your gamification profile
  init-hook            Install pre-push git hook
```

## GitHub Action

```yaml
name: Vibe Check
on:
  pull_request:
    branches: [main]

jobs:
  vibe-check:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pull-requests: write
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - name: Run Vibe Check
        uses: boshu2/vibe-check@v1
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
```

## Requirements

- Node.js >= 20.0.0
- Git repository

## What This Is (and Isn't)

**Is:** A quick feedback tool to catch debug spirals early

**Isn't:** A productivity metric, performance review tool, or AI effectiveness measure

Use it for self-reflection, not external judgment.

## Learn More

- **[The Vibe-Coding Ecosystem](docs/VIBE-ECOSYSTEM.md)** - Complete methodology guide
- **[Unified Ecosystem](docs/UNIFIED-ECOSYSTEM.md)** - How vibe-check connects to AgentOps, Knowledge OS
- **[Architecture](docs/ARCHITECTURE.md)** - Codebase structure and extension points
- **[Gamification](docs/GAMIFICATION.md)** - XP, levels, achievements, challenges deep dive
- **[Metrics Explained](docs/METRICS-EXPLAINED.md)** - How each metric is calculated
- **[Contributing](CONTRIBUTING.md)** - Development setup and guidelines
- **[Changelog](CHANGELOG.md)** - Version history

## License

MIT
