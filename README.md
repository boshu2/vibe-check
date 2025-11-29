# vibe-check

> ⚠️ **Experimental** - Metrics correlations with actual productivity outcomes have not been independently validated. Use as a directional signal, not ground truth.

**Track patterns in your AI-assisted coding workflow.**

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

### What the ratings suggest

- **ELITE**: Commit patterns suggest smooth workflow
- **HIGH**: Generally healthy patterns, some areas to watch
- **MEDIUM**: Mixed signals—review individual metrics
- **LOW**: Commit patterns suggest friction—investigate causes

*Note: These ratings reflect commit patterns, not actual code quality or productivity.*

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
-o, --output <file>  Write JSON results to file
-v, --verbose        Show detailed output
--score              Include VibeScore (semantic-free metrics)
--recommend          Include level recommendation
-h, --help           Display help
```

### Save Results to JSON

```bash
# Write JSON to file while showing terminal output
vibe-check --since "1 week ago" --score -o results.json

# Combine with other formats
vibe-check --format markdown -o results.json  # Terminal gets markdown, file gets JSON
```

## GitHub Action

Add automated vibe-check to your PRs:

```yaml
# .github/workflows/vibe-check.yml
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

### Action Inputs

| Input | Description | Default |
|-------|-------------|---------|
| `github-token` | GitHub token for PR comments | `${{ github.token }}` |
| `since` | Start date for analysis | PR base commit |
| `threshold` | Minimum rating to pass (elite, solid, needs-work) | none |
| `include-score` | Include VibeScore | `true` |
| `include-recommendation` | Include level recommendation | `true` |
| `output-file` | Path to write JSON results | none |
| `comment-on-pr` | Post results as PR comment | `true` |

### Action Outputs

| Output | Description |
|--------|-------------|
| `overall` | Overall rating (elite, solid, needs-work, struggling) |
| `vibe-score` | Numeric score (0-100) |
| `json` | Full JSON results |

### Example: Fail PR if Below Threshold

```yaml
- uses: boshu2/vibe-check@v1
  with:
    github-token: ${{ secrets.GITHUB_TOKEN }}
    threshold: 'solid'  # Fails if below solid
```

### Example: Save Results to File

```yaml
- uses: boshu2/vibe-check@v1
  with:
    github-token: ${{ secrets.GITHUB_TOKEN }}
    output-file: 'vibe-check-results.json'

- name: Upload results
  uses: actions/upload-artifact@v4
  with:
    name: vibe-check-results
    path: vibe-check-results.json
```

## Requirements

- Node.js >= 20.0.0
- Git repository with commit history
- Conventional commits recommended (but not required)

## Limitations & Caveats

### What This Tool Does NOT Measure

| Claim | Reality |
|-------|---------|
| Code quality | Measures commit patterns, not code correctness |
| Actual productivity | Measures velocity signals, not shipped value |
| AI effectiveness | Measures workflow patterns, not AI contribution |

### Known Limitations

1. **No ground truth validation**: The correlation between these metrics and actual productivity outcomes has not been independently validated.

2. **Threshold sensitivity**: Magic numbers (5 min spiral threshold, 3-file churn) are based on practitioner intuition, not empirical studies.

3. **Goodhart's Law risk**: Once you know the metrics, you may unconsciously optimize for them rather than actual outcomes.

4. **Cold start**: New repositories have no calibration data. Default model weights are educated guesses.

5. **Sample size**: The ML model requires 20+ calibration samples for meaningful learning. Results with fewer samples are unreliable.

### When NOT to Use

- As a performance review metric (easily gamed)
- To compare across teams or developers (different baselines)
- As the sole indicator of AI tool effectiveness
- Without understanding what each metric actually measures

### Recommended Use

Use vibe-check as **one signal among many**:
- Combine with code review feedback
- Track alongside deployment success rates
- Use for self-reflection, not external judgment
- Treat as directional, not precise

## License

MIT
