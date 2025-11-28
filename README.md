# vibe-check

**Stop guessing if AI coding is working. Start measuring.**

## The Problem

You're using AI to write code, but how do you know if it's actually helping?

Are you shipping features faster, or just generating more commits? Building new features, or debugging AI mistakes? Moving forward, or stuck in fix-fix-fix loops?

Without data, you're guessing.

## The Insight

vibe-check analyzes your git history and tells you:

| What You'll Learn | Why It Matters |
|-------------------|----------------|
| **Trust Pass Rate** | Are you accepting AI code that works, or code that breaks immediately? |
| **Debug Spirals** | Are you stuck in fix loops on the same component? |
| **Rework Ratio** | What percentage of your work is building vs. cleaning up? |
| **Pattern Detection** | What types of problems keep recurring? (auth, config, APIs...) |

## Quick Demo

```bash
$ npx @boshu2/vibe-check --since "1 week ago"

================================================================
                    VIBE-CHECK RESULTS
================================================================
  Period: Nov 21 - Nov 28, 2025 (12.5h active)
  Commits: 47 total (28 feat, 15 fix, 4 docs)

  METRIC                      VALUE      RATING
  --------------------------------------------------
  Iteration Velocity          4.2/hr     HIGH
  Rework Ratio                35%        MEDIUM
  Trust Pass Rate             92%        HIGH
  Debug Spiral Duration       18min      HIGH
  Flow Efficiency             85%        HIGH

  DEBUG SPIRALS (2 detected):
  - auth: 4 commits, 25m (SECRETS_AUTH)
  - api: 3 commits, 12m (API_MISMATCH)

  OVERALL: HIGH
================================================================
```

**What this tells you:** You're productive (4.2 commits/hour, 92% trust pass rate), but 35% of your work is fixing things—room to improve. OAuth caused a 25-minute spiral. Next time: validate auth flows with a tracer test before full implementation.

## Installation

```bash
npm install -g @boshu2/vibe-check
```

Or run directly:

```bash
npx @boshu2/vibe-check
```

## Usage

```bash
# Analyze current repository (all history)
vibe-check

# Analyze specific time period
vibe-check --since "1 week ago"
vibe-check --since "2025-11-01"

# Different output formats
vibe-check --format json      # For CI/automation
vibe-check --format markdown  # For reports

# Analyze a different repo
vibe-check --repo /path/to/repo
```

## The 5 Metrics

| Metric | What It Measures | Elite | Good | Needs Work |
|--------|------------------|-------|------|------------|
| **Iteration Velocity** | Commits per hour | >5/hr | 3-5/hr | <3/hr |
| **Rework Ratio** | % of commits that are fixes | <30% | 30-50% | >50% |
| **Trust Pass Rate** | % of commits without immediate fix | >95% | 80-95% | <80% |
| **Debug Spiral Duration** | Avg time stuck in fix chains | <15m | 15-30m | >30m |
| **Flow Efficiency** | % time building vs debugging | >90% | 75-90% | <75% |

### What the ratings mean

- **ELITE**: Your AI collaboration is working excellently
- **HIGH**: Good effectiveness, minor improvements possible
- **MEDIUM**: Room for improvement—check which metrics are lagging
- **LOW**: Process issues—you're debugging more than building

## Debug Spiral Detection

When vibe-check detects 3+ consecutive fix commits on the same component, it flags a "debug spiral" and categorizes the pattern:

| Pattern | What It Means | Prevention |
|---------|---------------|------------|
| `SECRETS_AUTH` | Auth/OAuth/credentials issues | Validate auth flow before implementation |
| `API_MISMATCH` | API version or schema problems | Check API docs, deploy minimal test first |
| `VOLUME_CONFIG` | Mount/path/permission issues | Test volume config in isolation |
| `SSL_TLS` | Certificate/HTTPS problems | Verify certs before deploying |
| `IMAGE_REGISTRY` | Container pull/tag issues | Test image pull separately |

## When to Run

- **Before starting work**: Establish your baseline
- **After a session**: Measure what just happened
- **Weekly**: Track trends over time
- **After frustrating sessions**: Identify what went wrong

## CLI Options

```
-V, --version        Output version number
--since <date>       Start date (e.g., "1 week ago", "2025-11-01")
--until <date>       End date (default: now)
-f, --format <type>  Output: terminal, json, markdown
-r, --repo <path>    Repository path (default: current directory)
-v, --verbose        Show detailed output
-h, --help           Display help
```

## Requirements

- Node.js >= 18.0.0
- Git repository with commit history
- Conventional commits recommended (but not required)

## License

MIT
