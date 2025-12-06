<p align="center">
  <img src="https://raw.githubusercontent.com/boshu2/vibe-check/main/assets/logo.svg" alt="vibe-check" width="400">
</p>

<p align="center">
  <strong>Catch the debug spiral before it catches you.</strong>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@boshu2/vibe-check"><img src="https://img.shields.io/npm/v/@boshu2/vibe-check.svg?style=flat-square" alt="npm version"></a>
  <a href="https://www.npmjs.com/package/@boshu2/vibe-check"><img src="https://img.shields.io/npm/dm/@boshu2/vibe-check.svg?style=flat-square" alt="downloads"></a>
  <a href="https://opensource.org/licenses/MIT"><img src="https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square" alt="license"></a>
</p>

<p align="center">
  Git-powered metrics for AI-assisted development.<br>
  Detects the failure patterns from <a href="https://itrevolution.com/product/vibe-coding-book/"><em>Vibe Coding</em></a> (Gene Kim & Steve Yegge, 2025).
</p>

---

```bash
npx @boshu2/vibe-check
```

<p align="center">
  <img src="https://raw.githubusercontent.com/boshu2/vibe-check/main/assets/demo.gif" alt="vibe-check demo" width="600">
</p>

---

## The Problem

> "AI can destroy months of work in minutes." — Gene Kim & Steve Yegge

AI-assisted coding creates a new failure mode: **the debug spiral**.

You ask AI for a fix. It breaks something else. You ask for another fix. It breaks more. Three commits later, you've lost 30 minutes and made negative progress.

**vibe-check detects these spirals by analyzing your git history.**

---

## Quick Start

```bash
# Analyze recent work
npx @boshu2/vibe-check --since "1 week ago"

# Real-time spiral detection
npx @boshu2/vibe-check watch

# Visual dashboard
npx @boshu2/vibe-check dashboard
```

---

## What It Measures

| Metric | Question | Target |
|--------|----------|--------|
| **Trust Pass Rate** | Does the code stick? | >95% |
| **Rework Ratio** | Building or debugging? | <30% |
| **Debug Spirals** | Are you stuck? | 0 active |

### Detection Patterns

| Pattern | Severity | What It Means |
|---------|----------|---------------|
| **Tests Passing Lie** | HIGH | AI claims tests pass, but they don't |
| **Instruction Drift** | MEDIUM | AI gradually moves off-target |
| **Debug Loop Spiral** | HIGH | 3+ fix commits on same component |
| **Context Amnesia** | MEDIUM | Repeated fixes, forgotten solutions |

---

## Watch Mode

Catches spirals **as they form** with personalized coaching:

```
VIBE-CHECK WATCH MODE
────────────────────────────────────────────────

  09:15  fix(auth): handle token refresh
  09:18  fix(auth): add retry logic
  09:22  fix(auth): increase timeout

  ⚠️  SPIRAL FORMING
      auth component, 3 fixes, 7 min

      Your history: 4 auth spirals, avg 18 min
      What worked: wrote a test (3x), took a break (1x)

      → Write a test before your next fix attempt.

────────────────────────────────────────────────
```

Watch mode learns from your history and suggests what's worked before.

---

## Install

```bash
npm install -g @boshu2/vibe-check
```

Or use directly with `npx`:

```bash
npx @boshu2/vibe-check --since "2 hours ago"
```

---

## Commands

### Core Analysis

```bash
vibe-check                      # Analyze git history
vibe-check watch                # Real-time spiral monitoring
vibe-check dashboard            # Visual dashboard
vibe-check timeline             # View coding journey
vibe-check forensics            # Deep pattern analysis
```

### Sessions

```bash
vibe-check start --level 3      # Quick session start
vibe-check session start        # Interactive session start
vibe-check session end          # End with metrics
vibe-check session status       # Check active session
```

### Profile & Insights

```bash
vibe-check profile              # XP and achievements
vibe-check insights             # Your spiral patterns
```

### Tools

```bash
vibe-check cache status         # Cache statistics
vibe-check cache clear          # Clear cache
vibe-check init-hook            # Install pre-push hook
vibe-check pipeline             # Audit CI/CD safety
```

---

## Session Integration

Integrate with Claude Code or other AI dev tools:

```bash
# Start session
vibe-check session start --level 3

# End session - get JSON for logging
vibe-check session end --format json
```

```json
{
  "metrics": { "trust_pass_rate": 92, "rework_ratio": 18 },
  "retro": {
    "failure_patterns_hit": [],
    "failure_patterns_avoided": ["Debug Spiral", "Context Amnesia"]
  }
}
```

---

## The Ecosystem

vibe-check implements **Factor V (Measurement)** from [12-Factor AgentOps](https://github.com/boshu2/12-factor-agentops):

```text
BUILD              →     WORK          →     RUN
12-Factor Agents        Vibe Coding         12-Factor AgentOps
(HumanLayer)           (Gene & Steve)       (Operations)
                                                  ↓
                                             vibe-check
                                            (Measurement)
```

| Factor | What vibe-check Provides |
|--------|-------------------------|
| **IV: Validation Gates** | Pre-commit hooks, CI integration |
| **V: Measurement** | Quantified feedback loop |
| **VII: Smart Routing** | Spiral detection triggers intervention |
| **XI: Fail-Safe Checks** | Pattern detection for all 12 failures |

---

## Philosophy

vibe-check is a mirror, not a judge.

It answers one question: *are you building, or are you spiraling?*

Use it for self-reflection. Catch your own patterns. Improve your own flow.

It's not a productivity metric. It's not for performance reviews.

---

## Requirements

- Node.js >= 20.0.0
- Git repository with commits

---

## Learn More

- [Vibe-Coding Ecosystem](docs/VIBE-ECOSYSTEM.md) — Full methodology, all features
- [Vibe Coding Book](https://itrevolution.com/product/vibe-coding-book/) — Gene Kim & Steve Yegge (2025)
- [12-Factor AgentOps](https://github.com/boshu2/12-factor-agentops) — Operational framework
- [12-Factor Agents](https://github.com/humanlayer/12-factor-agents) — Engineering patterns (HumanLayer)

---

## License

MIT

---

<p align="center">
  <em>Built for developers who work with AI.</em>
</p>
