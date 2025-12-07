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
  Detects the <a href="#the-12-failure-patterns">12 failure patterns</a> from <a href="https://itrevolution.com/product/vibe-coding-book/"><em>Vibe Coding</em></a> (Gene Kim & Steve Yegge, 2025).
</p>

---

```bash
npx @boshu2/vibe-check
```

<p align="center">
  <img src="https://raw.githubusercontent.com/boshu2/vibe-check/main/assets/demo.gif" alt="vibe-check demo" width="600">
</p>

---

## Focus: The Inner Developer Loop

vibe-check focuses on detecting the **4 Inner Loop Disasters** — the immediate, developer-facing failures that happen during a coding session:

| Pattern | What Goes Wrong | How vibe-check Detects It |
|---------|-----------------|---------------------------|
| **"Tests Passing" Lie** | AI claims "fixed" but code doesn't work | Commits claiming success followed by immediate fixes |
| **Context Amnesia** | AI forgets instructions from 5 minutes ago | Reverts, reimplementations, repeated similar fixes |
| **Instruction Drift** | AI "improves" things you didn't ask for | Unrequested refactors, scope explosion |
| **Debug Loop Spiral** | AI adds logging instead of fixing root cause | 3+ consecutive debugging commits |

These are the patterns you can catch and fix **right now**, in your current session.

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

---

## The 12 Failure Patterns

*Vibe Coding* identifies 12 failure modes across three developer loops. vibe-check focuses on the **inner loop** (where spirals form) while providing awareness of all 12.

### Inner Loop (Minutes) — **Primary Focus**

| # | Pattern | Severity | vibe-check Detection |
|---|---------|----------|----------------------|
| 1 | **Tests Passing Lie** | 🔴 HIGH | Trust pass rate drops, fix commits follow "working" code |
| 2 | **Context Amnesia** | 🟡 MEDIUM | Repeated fixes on same component, circular patterns |
| 3 | **Instruction Drift** | 🟡 MEDIUM | Scope creep visible in commit message patterns |
| 4 | **Debug Loop Spiral** | 🔴 HIGH | ✅ **Core detection**: 3+ fix commits on same component |

### Middle Loop (Hours-Days) — *Monitored*

| # | Pattern | Severity | vibe-check Detection |
|---|---------|----------|----------------------|
| 5 | **Eldritch Code Horror** | 🔴 CRITICAL | High file churn, repeated touches to same files |
| 6 | **Workspace Collision** | 🔴 HIGH | — (multi-agent, future) |
| 7 | **Memory Decay** | 🟡 MEDIUM | Session baseline comparison shows degradation |
| 8 | **Multi-Agent Deadlock** | 🔴 HIGH | — (multi-agent, future) |

### Outer Loop (Weeks-Months) — *Awareness*

| # | Pattern | Severity | vibe-check Detection |
|---|---------|----------|----------------------|
| 9 | **Bridge Torching** | 🔴 CRITICAL | — (API tracking, future) |
| 10 | **Repository Deletion** | 🔴 CRITICAL | — (git safety, future) |
| 11 | **Process Gridlock** | 🔴 HIGH | — (CI/CD analysis, future) |
| 12 | **Stewnami** | 🔴 HIGH | — (cross-repo, future) |

> **Inner loop mastery prevents middle/outer loop disasters.** Catch the spiral at 3 commits, not 30.

See the [full 12 Failure Patterns catalog](https://github.com/boshu2/12-factor-agentops/blob/main/docs/reference/failure-patterns.md) for prevention strategies and AgentOps integration.

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
  },
  "inner_loop": {
    "health": "healthy",
    "issues_detected": 0,
    "tests_passing_lies": 0,
    "context_amnesia_incidents": 0,
    "instruction_drift_commits": 0,
    "debug_loop_detected": false
  }
}
```

When inner loop issues are detected:

```
⚠️ Inner Loop Health: WARNING

  🤥 2 "tests passing" lies detected
  🎯 Instruction drift: 3 commits went outside scope

  → STOP: AI claimed success but code needed fixes. Verify builds/tests pass.
```

---

## For Autonomous Agents

vibe-check measures **human-AI collaboration sessions**—the inner loop where you're working with an AI assistant.

For **autonomous agents** that run without a human in the loop, see [12-Factor AgentOps](https://12factoragentops.com)—DevOps and SRE patterns adapted for AI systems.

| Use Case | Tool |
|----------|------|
| Working *with* AI (pair programming) | vibe-check |
| Running AI *autonomously* (agents) | [12-Factor AgentOps](https://12factoragentops.com) |

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

- [Vibe Coding Book](https://itrevolution.com/product/vibe-coding-book/) — Gene Kim & Steve Yegge (2025)
- [12-Factor AgentOps](https://12factoragentops.com) — Reliability patterns for autonomous agents
- [12 Failure Patterns](https://github.com/boshu2/12-factor-agentops/blob/main/docs/reference/failure-patterns.md) — Complete catalog with prevention strategies
- [vibe-check on bofuller.com](https://bofuller.com/builds/vibe-check) — Trust calibration, 40% rule, and results

---

## License

MIT

---

<p align="center">
  <em>Built for developers who work with AI.</em>
</p>
