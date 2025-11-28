# vibe-check

Measure vibe coding effectiveness with git commit analysis.

## What is Vibe Coding?

Vibe coding is AI-assisted development where you collaborate with an AI coding assistant. This tool measures how effectively that collaboration is working by analyzing your git commit patterns.

## Installation

```bash
npm install -g @boshu2/vibe-check
```

Or run directly with npx:

```bash
npx @boshu2/vibe-check
```

## Usage

```bash
# Analyze current repository
vibe-check

# Analyze last week
vibe-check --since "1 week ago"

# JSON output for CI/automation
vibe-check --format json

# Markdown report
vibe-check --format markdown

# Analyze specific repo
vibe-check --repo /path/to/repo
```

## The 5 Core Metrics (FAAFO)

| Metric | What It Measures | Target |
|--------|------------------|--------|
| **Iteration Velocity** | Commits per hour | >5/hr = Elite |
| **Rework Ratio** | % commits that are fixes | <30% = Elite |
| **Trust Pass Rate** | % commits that stick (no immediate fix) | >95% = Elite |
| **Debug Spiral Duration** | Time spent in fix chains | <15m = Elite |
| **Flow Efficiency** | % time in productive work vs debugging | >90% = Elite |

## Output Ratings

| Rating | Meaning |
|--------|---------|
| **ELITE** | Vibe coding working excellently |
| **HIGH** | Good effectiveness, minor improvements possible |
| **MEDIUM** | Room for improvement |
| **LOW** | Process issues, reassess approach |

## Example Output

```
╔════════════════════════════════════════════════════════════╗
║                    VIBE CHECK RESULTS                       ║
╠════════════════════════════════════════════════════════════╣
║  Period: Nov 21 - Nov 28, 2025                             ║
║  Commits Analyzed: 47                                       ║
╠════════════════════════════════════════════════════════════╣
║                                                             ║
║  Iteration Velocity    ████████████░░░░  4.2/hr    HIGH    ║
║  Rework Ratio          ██████░░░░░░░░░░  35%       MEDIUM  ║
║  Trust Pass Rate       ████████████████  92%       HIGH    ║
║  Debug Spiral Duration ██████████████░░  18min     HIGH    ║
║  Flow Efficiency       ██████████████░░  85%       HIGH    ║
║                                                             ║
╠════════════════════════════════════════════════════════════╣
║  Overall Rating: HIGH                                       ║
╚════════════════════════════════════════════════════════════╝
```

## Debug Spiral Detection

When the tool detects fix chains (multiple fix commits in a row), it identifies:
- Which component had issues
- Pattern category (e.g., `API_MISMATCH`, `SSL_TLS`, `VOLUME_CONFIG`)
- Duration of the spiral
- Suggested tracer test to prevent recurrence

## Integration with Claude Code

This tool is designed to work with the RPI (Research-Plan-Implement) workflow:

1. **Before implementation**: Run `vibe-check` to establish baseline
2. **After implementation**: Run `vibe-check --since "<start-time>"` to measure session
3. **Weekly review**: Run `vibe-check --since "1 week ago" --format markdown`

## Options

```
-V, --version        Output version number
--since <date>       Start date for analysis (e.g., "1 week ago", "2025-11-01")
--until <date>       End date for analysis (default: now)
-f, --format <type>  Output format: terminal, json, markdown (default: terminal)
-r, --repo <path>    Repository path (default: current directory)
-v, --verbose        Show verbose output
-h, --help           Display help
```

## Requirements

- Node.js >= 18.0.0
- Git repository with commit history

## License

MIT
