# vibe-check

[![npm version](https://img.shields.io/npm/v/@boshu2/vibe-check.svg)](https://www.npmjs.com/package/@boshu2/vibe-check)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**Git-powered metrics for AI-assisted development.** Detects the failure patterns that Gene Kim & Steve Yegge identified in *[Vibe Coding](https://itrevolution.com/product/vibe-coding-book/)* (2025).

```bash
npx @boshu2/vibe-check --since "2 hours ago"
```

## The Problem

> "AI can destroy months of work in minutes." — Gene Kim & Steve Yegge

AI-assisted coding creates a new failure mode: **the debug spiral**. You ask AI for a fix, it breaks something else, you ask for another fix, it breaks more. Three commits later, you've lost 30 minutes and made negative progress.

vibe-check detects these spirals by analyzing your git history.

## What It Measures

| Metric | What It Detects | Failure Pattern |
|--------|-----------------|-----------------|
| **Trust Pass Rate** | % commits without immediate fix | Pattern 1: Tests Passing Lie |
| **Rework Ratio** | % commits that are fixes | Pattern 3: Instruction Drift |
| **Debug Spirals** | 3+ fix commits on same component | Pattern 4: Debug Loop Spiral |

### Why These Metrics

**Trust Pass Rate** answers: *Does the code stick?*

When AI claims "all tests pass" but they don't, you commit broken code. The immediate fix commit reveals the lie. A high trust pass rate (>95%) means your verification process is working.

**Rework Ratio** answers: *Are you building or debugging?*

AI gradually drifts from requirements. Each iteration moves slightly off-target. A low rework ratio (<30%) means you're building new things, not fixing AI mistakes.

**Debug Spirals** answer: *Are you stuck?*

The classic pattern: AI adds logging instead of fixing, fills context with debug output, makes no progress on root cause. vibe-check detects when 3+ consecutive fix commits target the same component and alerts you to break the cycle.

## Quick Start

```bash
# Analyze recent work
npx @boshu2/vibe-check --since "1 week ago"

# Real-time spiral detection
vibe-check watch

# Visual dashboard
vibe-check dashboard
```

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

## Install

```bash
npm install -g @boshu2/vibe-check
```

## Commands

```bash
# Core Analysis
vibe-check [--since "1 week"]   # Analyze git history
vibe-check analyze              # Explicit analyze command
vibe-check watch                # Real-time spiral monitoring
vibe-check timeline             # View coding journey with sessions

# Session Tracking
vibe-check start --level 3      # Quick session start
vibe-check session start        # Start tracked session (interactive)
vibe-check session end          # End session with metrics
vibe-check session status       # Check active session

# Profile & Insights
vibe-check profile              # XP and achievements
vibe-check insights             # Your spiral patterns
vibe-check dashboard            # Visual dashboard

# Tools
vibe-check cache status         # Show cache statistics
vibe-check cache clear          # Clear cached data
vibe-check init-hook            # Install git pre-push hook
vibe-check pipeline             # Audit CI/CD pipeline safety
```

## How It Prevents Failure Patterns

vibe-check implements **Factor V (Measurement)** and **Factor XI (Fail-Safe Checks)** from the [12-Factor AgentOps](https://github.com/boshu2/12-factor-agentops) framework:

| Pattern | Severity | Detection | Prevention |
|---------|----------|-----------|------------|
| **1: Tests Passing Lie** | HIGH | Low trust pass rate | Verify before commit |
| **3: Instruction Drift** | MEDIUM | High rework ratio | Smaller tasks, explicit constraints |
| **4: Debug Loop Spiral** | HIGH | 3+ fix chain detected | Take manual control, write a test |
| **2: Context Amnesia** | MEDIUM | Repeated fixes on same component | Save context, use bundles |

### The Ecosystem

```
BUILD           →    WORK         →    RUN
12-Factor Agents     Vibe Coding       12-Factor AgentOps
(HumanLayer)         (Gene & Steve)    (Operations)
                                            ↓
                                       vibe-check
                                       (Measurement)
```

vibe-check is the **measurement tool** that operationalizes vibe-coding methodology. It provides the feedback loop that makes the 12 Factors work:

| 12-Factor | What vibe-check Provides |
|-----------|-------------------------|
| **IV: Validation Gates** | Pre-commit hooks, CI integration |
| **V: Measurement** | FAAFO metrics, quantified feedback |
| **VII: Smart Routing** | Spiral detection triggers intervention |
| **XI: Fail-Safe Checks** | Pattern detection across all 12 failures |

## Session Integration

Integrate with Claude Code or other AI dev tools:

```bash
# At session start
vibe-check session start --level 3

# At session end - get metrics for logging
vibe-check session end --format json
```

Output includes failure pattern detection:
```json
{
  "metrics": { "trust_pass_rate": 92, "rework_ratio": 18 },
  "retro": {
    "failure_patterns_hit": [],
    "failure_patterns_avoided": ["Debug Spiral", "Context Amnesia"]
  }
}
```

## Philosophy

vibe-check is a mirror, not a judge.

It answers one question: *are you building, or are you spiraling?*

Use it for self-reflection. Catch your own patterns. Improve your own flow. It's not a productivity metric. It's not for performance reviews.

## Requirements

- Node.js >= 20.0.0
- Git repository with commits

## Learn More

- **[Vibe-Coding Ecosystem](docs/VIBE-ECOSYSTEM.md)** - Full methodology, all features, gamification
- **[Vibe Coding Book](https://itrevolution.com/product/vibe-coding-book/)** - Gene Kim & Steve Yegge (IT Revolution, 2025)
- **[12-Factor AgentOps](https://github.com/boshu2/12-factor-agentops)** - Operational framework
- **[12-Factor Agents](https://github.com/humanlayer/12-factor-agents)** - Engineering patterns (HumanLayer)

## License

MIT

---

*Built for developers who work with AI.*
