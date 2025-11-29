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

# Simple one-liner for hooks
vibe-check --simple
```

## Example Output

```
VIBE-CHECK Nov 21 - Nov 28

  Rating: HIGH
  Trust: 92% HIGH
  Rework: 35% MEDIUM

  Run without --simple for full details
```

## Session Workflow

Declare your trust level before starting, then check if reality matched:

```bash
# Before work: declare your expectation
vibe-check start --level 3

# ... do your work ...

# After work: compare reality vs expectation
vibe-check --since "1 hour ago"
```

Output:

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

## License

MIT
