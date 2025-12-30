<p align="center">
  <img src="https://raw.githubusercontent.com/boshu2/vibe-check/main/assets/logo.svg" alt="vibe-check" width="400">
</p>

<p align="center">
  <strong>Git-powered metrics for AI-assisted development.</strong>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@boshu2/vibe-check"><img src="https://img.shields.io/npm/v/@boshu2/vibe-check.svg" alt="npm version"></a>
  <a href="https://www.npmjs.com/package/@boshu2/vibe-check"><img src="https://img.shields.io/npm/dm/@boshu2/vibe-check.svg" alt="downloads"></a>
  <a href="https://opensource.org/licenses/Apache-2.0"><img src="https://img.shields.io/badge/License-Apache%202.0-blue.svg" alt="license"></a>
</p>

vibe-check detects **debug spirals** and the [12 failure patterns](https://github.com/boshu2/12-factor-agentops/blob/main/docs/reference/failure-patterns.md) from [*Vibe Coding*](https://itrevolution.com/product/vibe-coding-book/) (Gene Kim & Steve Yegge, 2025) by analyzing your git history.

## ⚡ Quick Start

```bash
# Install
npm install -g @boshu2/vibe-check

# Analyze (or just run in any git repo)
npx @boshu2/vibe-check

# With options
vc --since "1 week ago" --score
```

## 🛠 Features

* **Debug Spiral Detection:** Catches 3+ consecutive fixes to the same component before you lose an hour.
* **Inner Loop Health:** Detects "tests passing" lies, context amnesia, instruction drift, and debug loops.
* **Git-Based Metrics:** Trust pass rate, rework ratio, iteration velocity, flow efficiency, and more.
* **Flexible Output:** Terminal (colored), JSON, or Markdown—use in pipelines or dashboards.
* **Zero Config:** Works with any git repository out of the box.

## 📖 Command Reference

```bash
vc [options]
```

### Options

| Option | Description | Example |
|--------|-------------|---------|
| `--json` | Output JSON | `vc --json` |
| `--timeout <seconds>` | Git timeout (default: 120) | `vc --timeout 60` |
| `--max-commits <number>` | Max commits to analyze | `vc --max-commits 100` |
| `--since <date>` | Start date | `vc --since "1 week ago"` |
| `--until <date>` | End date (default: now) | `vc --until "2025-01-01"` |
| `-f, --format <type>` | Output format: terminal, json, markdown | `vc -f markdown` |
| `-r, --repo <path>` | Repository path | `vc -r /path/to/repo` |
| `-v, --verbose` | Verbose output | `vc -v` |
| `-q, --quiet` | Quiet output | `vc -q` |
| `--debug` | Debug logging | `vc --debug` |
| `--score` | Include VibeScore metrics | `vc --score` |
| `-o, --output <file>` | Write to file | `vc -o report.json` |
| `-s, --simple` | Simple output | `vc -s` |
| `--scope <scope>` | Filter by scope | `vc --scope api` |

## 📊 What It Measures

| Metric | Question | Target |
|--------|----------|--------|
| **Trust Pass Rate** | Does code stick? | >95% |
| **Rework Ratio** | Building or debugging? | <30% |
| **Debug Spirals** | Are you stuck? | 0 active |
| **Iteration Velocity** | How fast are feedback loops? | >3/hour |
| **Flow Efficiency** | What % time is productive? | >75% |
| **Tracer Bullet Ratio** | Validating assumptions? | >20% |

## 🔴 The 4 Inner Loop Disasters

| Pattern | What Goes Wrong | Detection |
|---------|-----------------|-----------|
| **"Tests Passing" Lie** | AI claims "fixed" but it's not | Success commits followed by fixes |
| **Context Amnesia** | AI forgets instructions | Reverts, reimplementations |
| **Instruction Drift** | AI "improves" things you didn't ask for | Scope explosion |
| **Debug Loop Spiral** | AI adds logging instead of fixing | 3+ consecutive debug commits |

## 📦 Installation

```bash
# npm (recommended)
npm install -g @boshu2/vibe-check

# Or use directly
npx @boshu2/vibe-check
```

**Requirements:** Node.js >= 20.0.0, Git repository with commits.

## 🚀 CI/CD Integration

### GitHub Actions Example

```yaml
- name: Vibe Check
  run: |
    npx @boshu2/vibe-check --json --score > vibe.json
    SCORE=$(jq '.vibeScore' vibe.json)
    if [ "$SCORE" -lt 60 ]; then
      echo "❌ Vibe score too low: $SCORE"
      exit 1
    fi
```

### GitLab CI Example

```yaml
vibe-check:
  script:
    - npm install -g @boshu2/vibe-check
    - vc --json --score > vibe.json
    - |
      SCORE=$(jq '.vibeScore' vibe.json)
      if [ "$SCORE" -lt 60 ]; then
        echo "❌ Vibe score too low: $SCORE"
        exit 1
      fi
  artifacts:
    reports:
      vibe: vibe.json
```

### Quality Gates

```bash
# Basic check
vc --score --json | jq '.vibeScore >= 60'

# Filter by scope
vc --scope api --json > api-vibe.json

# Save to file
vc --format markdown --output VIBE_REPORT.md
```

## 📝 Documentation

* [Reference Guide](docs/REFERENCE.md) — Full feature documentation
* [CLAUDE.md](CLAUDE.md) — Development guide and architecture
* [Failure Patterns](https://github.com/boshu2/12-factor-agentops/blob/main/docs/reference/failure-patterns.md) — Complete catalog with prevention strategies
* [12-Factor AgentOps](https://12factoragentops.com) — Reliability patterns for autonomous agents
* [Vibe Coding Book](https://itrevolution.com/product/vibe-coding-book/) — Gene Kim & Steve Yegge (2025)

## 🤝 Philosophy

vibe-check is a mirror, not a judge.

It answers one question: *are you building, or are you spiraling?*

Use it for self-reflection. Catch your own patterns. Improve your own flow. It's not a productivity metric—it's not for performance reviews.

---

<p align="center">
  <em>Built for developers who work with AI.</em>
</p>

## License

Apache-2.0
