# vibe-check Reference Guide

Detailed documentation for vibe-check features and configuration.

## CLI Usage

```
vc [options]

Options:
  -V, --version           output the version number
  --json                  Output JSON
  --timeout <seconds>     Git timeout in seconds (default: "120")
  --max-commits <number>  Max commits to analyze
  --since <date>          Start date (e.g., "1 week ago")
  --until <date>          End date (default: now)
  -f, --format <type>     Output format: terminal, json, markdown
  -r, --repo <path>       Repository path
  -v, --verbose           Verbose output
  -q, --quiet             Quiet output
  --debug                 Debug logging
  --score                 Include VibeScore metrics
  -o, --output <file>     Write JSON to file
  -s, --simple            Simple output
  --scope <scope>         Filter by scope
```

### Examples

```bash
# Analyze current repo, last week
vc --since "1 week ago"

# Analyze specific repo
vc -r /path/to/repo --since "2 weeks ago"

# JSON output to file
vc --json -o metrics.json

# Include VibeScore
vc --score --since "1 month ago"

# Filter by scope
vc --scope auth --since "1 week ago"

# Markdown output
vc --format markdown --since "1 week ago"
```

---

## The 5 Core Metrics

| Metric | Measures | Threshold |
|--------|----------|-----------|
| Iteration Velocity | Commits/hour | >5 = Elite |
| Rework Ratio | % fix commits | <30% = Elite |
| Trust Pass Rate | % commits without immediate fix | >95% = Elite |
| Debug Spiral Duration | Avg time in fix chains | <15m = Elite |
| Flow Efficiency | % time building vs debugging | >90% = Elite |

---

## The 12 Failure Patterns

*Vibe Coding* identifies 12 failure modes across three developer loops. vibe-check focuses on the **inner loop** while providing awareness of all 12.

### Inner Loop (Minutes) — Primary Focus

| # | Pattern | Severity | Detection |
|---|---------|----------|-----------|
| 1 | **Tests Passing Lie** | HIGH | Trust pass rate drops, fix commits follow "working" code |
| 2 | **Context Amnesia** | MEDIUM | Repeated fixes on same component, circular patterns |
| 3 | **Instruction Drift** | MEDIUM | Scope creep visible in commit message patterns |
| 4 | **Debug Loop Spiral** | HIGH | Core detection: 3+ fix commits on same component |

### Middle Loop (Hours-Days) — Monitored

| # | Pattern | Severity | Detection |
|---|---------|----------|-----------|
| 5 | **Eldritch Code Horror** | CRITICAL | High file churn, repeated touches to same files |
| 6 | **Workspace Collision** | HIGH | — (multi-agent, future) |
| 7 | **Memory Decay** | MEDIUM | Session baseline comparison shows degradation |
| 8 | **Multi-Agent Deadlock** | HIGH | — (multi-agent, future) |

### Outer Loop (Weeks-Months) — Awareness

| # | Pattern | Severity | Detection |
|---|---------|----------|-----------|
| 9 | **Bridge Torching** | CRITICAL | — (API tracking, future) |
| 10 | **Repository Deletion** | CRITICAL | — (git safety, future) |
| 11 | **Process Gridlock** | HIGH | — (CI/CD analysis, future) |
| 12 | **Stewnami** | HIGH | — (cross-repo, future) |

> **Inner loop mastery prevents middle/outer loop disasters.** Catch the spiral at 3 commits, not 30.

---

## Inner Loop Detection

vibe-check detects the 4 "Inner Loop Disasters" from vibe coding:

| Pattern | Detects | How |
|---------|---------|-----|
| **"Tests Passing" Lie** | AI claims success but code doesn't work | Commits claiming "fix/done/working" followed by immediate fixes |
| **Context Amnesia** | AI forgets instructions, re-does work | Reverts, reimplementations, repeated similar fixes |
| **Instruction Drift** | AI "improves" things not asked for | Unrequested refactors, scope explosion, file changes outside intent |
| **Debug Loop Spiral** | AI adds logging instead of fixing | Consecutive commits adding console.log/print without fixes |

---

## JSON Output Format

Use `--json` or `--format json` to get machine-readable output:

```json
{
  "metrics": {
    "iteration_velocity": 4.2,
    "rework_ratio": 22,
    "trust_pass_rate": 92,
    "debug_spiral_duration": 12,
    "flow_efficiency": 85
  },
  "inner_loop": {
    "health": "healthy",
    "issues_detected": 0,
    "tests_passing_lies": 0,
    "context_amnesia_incidents": 0,
    "instruction_drift_commits": 0,
    "debug_loop_detected": false,
    "recommendations": []
  },
  "spirals": [
    {
      "component": "auth",
      "commits": 4,
      "duration_minutes": 18,
      "pattern": "SECRETS_AUTH"
    }
  ],
  "summary": {
    "total_commits": 47,
    "fix_commits": 10,
    "feature_commits": 37,
    "time_range": {
      "since": "2025-01-01T00:00:00Z",
      "until": "2025-01-07T23:59:59Z"
    }
  }
}
```

### Inner Loop Health Values

| Health | Meaning |
|--------|---------|
| `healthy` | No inner loop issues detected |
| `warning` | Minor issues detected (1-2 incidents) |
| `critical` | Multiple issues detected, intervention needed |

---

## Debug Spiral Detection

A "debug spiral" is detected when 3+ consecutive fix commits target the same component. Patterns are categorized:

| Pattern | Description |
|---------|-------------|
| `SECRETS_AUTH` | OAuth/credentials issues |
| `API_MISMATCH` | API version/schema problems |
| `VOLUME_CONFIG` | Mount/permission issues |
| `SSL_TLS` | Certificate problems |
| `IMAGE_REGISTRY` | Container pull issues |
| `GITOPS_DRIFT` | Sync/reconciliation issues |

---

## Filtering Options

### Time Range

```bash
# Last week
vc --since "1 week ago"

# Specific date range
vc --since "2025-01-01" --until "2025-01-15"

# Last 30 days
vc --since "30 days ago"
```

### Commit Limits

```bash
# Analyze last 100 commits
vc --max-commits 100
```

### Scope Filtering

```bash
# Only analyze commits touching 'auth' scope
vc --scope auth

# Scope is extracted from commit messages like:
# feat(auth): add OAuth support
# fix(auth): handle token refresh
```

---

## Output Formats

| Format | Flag | Use Case |
|--------|------|----------|
| Terminal | `--format terminal` (default) | Human-readable colored output |
| JSON | `--format json` or `--json` | Machine parsing, CI integration |
| Markdown | `--format markdown` | Documentation, reports |

### Output to File

```bash
# Write JSON to file
vc --json -o report.json

# Equivalent
vc --format json --output report.json
```
