# The Vibe-Coding Ecosystem

**A complete guide to conscious AI-assisted development**

---

## What is Vibe-Coding?

Vibe-coding is a methodology for AI-assisted software development that emphasizes:

1. **Conscious calibration** - Knowing when to trust AI output and when to verify
2. **Metric-driven feedback** - Measuring patterns, not productivity
3. **Self-awareness** - Recognizing spirals before they consume hours
4. **Progressive mastery** - Building trust through demonstrated accuracy

The core insight: **AI assistance varies in reliability by task type.** Formatting code? Nearly 100% trustworthy. Designing authentication architecture? Maybe 20%. Vibe-coding gives you a framework to calibrate your verification effort appropriately.

---

## The Five Core Metrics

| Metric | Question | Elite | Needs Work |
|--------|----------|-------|------------|
| **Trust Pass Rate** | What % of commits don't need immediate fixes? | >95% | <80% |
| **Rework Ratio** | What % of commits are fixes vs. new work? | <30% | >50% |
| **Debug Spiral Count** | How many fix-chain spirals detected? | 0 | 3+ |
| **Debug Spiral Duration** | How long stuck in fix loops? | <15min | >45min |
| **Flow Efficiency** | What % of time is productive building? | >90% | <70% |

These metrics are **semantic-free** - they measure git patterns, not code content. This prevents gaming and ensures honest signal.

---

## Vibe Levels

Before starting work, classify the task:

| Level | Name | Trust AI | Verification | Example Tasks |
|-------|------|----------|--------------|---------------|
| **5** | Full Automation | 95% | Final only | Formatting, linting, boilerplate |
| **4** | High Trust | 80% | Spot check | CRUD, simple features |
| **3** | Balanced | 60% | Key outputs | Standard features, tests |
| **2** | Careful | 40% | Every change | API integrations, complex logic |
| **1** | Skeptical | 20% | Every line | Architecture, security, auth |
| **0** | Manual | 0% | N/A | Novel research, exploration |

**The insight:** Declaring a level upfront forces conscious calibration. After the session, compare actual metrics to expected - this builds intuition over time.

---

## vibe-check: The Tool

`vibe-check` is a CLI tool that analyzes git history and provides immediate feedback on your coding patterns.

### Installation

```bash
npm install -g @boshu2/vibe-check
```

Or run directly:

```bash
npx @boshu2/vibe-check
```

### Core Commands

```bash
# Basic analysis
vibe-check --since "1 week ago"

# Real-time monitoring
vibe-check watch

# Your profile (gamification)
vibe-check profile

# Start a tracked session
vibe-check start --level 3
```

---

## Feature Overview (v1.5.0)

### 1. Metrics Engine

The core analysis engine examines git history to compute:

- **Trust Pass Rate**: Commits without immediate fix follow-ups
- **Rework Ratio**: Proportion of fix/revert commits
- **Debug Spirals**: Consecutive fix commits on same component
- **VibeScore**: Weighted composite (0-100%)

Output example:
```
VIBE-CHECK Nov 21 - Nov 28

  Rating: ELITE
  Trust: 94% ELITE
  Rework: 18% ELITE
  Spirals: 1 detected (12 min)

  VibeScore: 87%
```

### 2. Watch Mode

Real-time spiral detection while you work:

```bash
vibe-check watch
```

Monitors commits and alerts when patterns indicate a spiral forming:

```
  09:15 fix(auth) handle token refresh
  09:18 fix(auth) add retry logic
  09:22 fix(auth) increase timeout

  SPIRAL DETECTED
      Component: auth
      Fixes: 3 commits, 7 min
```

### 3. Automatic Baseline Comparison

After 5+ sessions, vibe-check learns your patterns and provides contextual feedback:

```
VS YOUR BASELINE

  Trust:  92% (+7% vs avg 85%)
  Rework: 18% (-4% vs avg 22%)

  Better than your usual - nice flow!
```

### 4. Pattern Memory

Tracks what triggers YOUR spirals over time:

```bash
vibe-check profile --patterns
```

```
YOUR SPIRAL TRIGGERS

  Component    Times   Pattern
  auth         5       OAuth/token/refresh issues
  database     3       Connection pooling
  api          2       External API timeouts
```

### 5. Intervention Tracking

Records what breaks your spirals:

```
WHAT WORKS FOR YOU

  Take a break      4 times (avg 12 min)
  Write test first  3 times
  Read docs         2 times
```

---

## Gamification System

vibe-check includes a complete gamification layer to make improvement engaging:

### XP & Levels

```
Level 1: Novice       (0-100 XP)      🌱
Level 2: Apprentice   (100-300 XP)    🌿
Level 3: Practitioner (300-600 XP)    🌳
Level 4: Expert       (600-1000 XP)   🌲
Level 5: Master       (1000-2000 XP)  🎋
Level 6: Grandmaster  (2000-5000 XP)  🏔️
```

**Prestige tiers** (beyond Grandmaster):
- Archmage (5000+ XP) 🔮
- Sage (10000+ XP) 📿
- Zenmester (20000+ XP) ☯️
- Transcendent (40000+ XP) 🌟
- Legendary (80000+ XP) 💫

### Streaks

Daily check-ins build streaks with visual progression:

```
🔥 5-day streak (1-5 days)
🌟🌟 12-day streak (6-14 days)
👑👑👑 18-day streak 🏆 (15+ days, Personal Best!)
```

Streak freezes protect against occasional missed days.

### Weekly Challenges

Auto-generated based on your weak metrics:

```
WEEKLY CHALLENGES

🎯 Trust Gauntlet:  ████████░░  4/5 (90%+ trust in 5 sessions)
🧘 Zen Mode:        ██████████  ✓ COMPLETE (+100 XP)
🔥 Streak Builder:  ██░░░░░░░░  1/5 (extend streak by 5 days)
```

### Achievements (19 total)

Categories:
- **Consistency**: First Blood, Week Warrior, Streak Master
- **Quality**: Elite Vibes, Trust Builder, Zen Master
- **Volume**: Centurion, Marathon Coder
- **Improvement**: Comeback Kid, On Fire
- **Special**: Night Owl, Early Bird, Weekend Warrior

### Rank Badges

```
🥉 Bronze    (10+ sessions)
🥈 Silver    (50+ sessions)
🥇 Gold      (100+ sessions)
💎 Platinum  (14+ day streak)
🔷 Diamond   (5000+ XP)
```

### Local Leaderboards & Hall of Fame

Track your personal bests across all repos:

```
🏛️  HALL OF FAME

🏆 Best Score: 96% (Nov 15, my-project)
🔥 Longest Streak: 15 days
⚡ Best Week: 847 XP
📊 Most Commits: 127 (Nov 10, big-refactor)
```

---

## Integration Points

### Git Hook

Automatic vibe-check on every push:

```bash
vibe-check init-hook           # Install hook
vibe-check init-hook --block-low  # Block LOW pushes
```

### GitHub Action

Automated PR feedback:

```yaml
name: Vibe Check
on: [pull_request]

jobs:
  vibe-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: boshu2/vibe-check@v1
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
```

### JSON Output

Machine-readable for dashboards/CI:

```bash
vibe-check --format json --output vibe-results.json
```

---

## The Workflow

### Daily Practice

```
Morning:
1. vibe-check profile         # Check streak, challenges
2. Plan tasks, estimate levels

During work:
3. vibe-check watch           # Real-time monitoring
4. Notice spiral alerts, intervene early

End of session:
5. vibe-check --since "today" # Review session
6. XP/achievements auto-update
```

### Session Workflow (Optional)

For explicit tracking:

```bash
# Before: declare expectation
vibe-check start --level 3

# ... work ...

# After: compare reality
vibe-check --since "1 hour ago"
```

The tool will show whether your level classification was accurate.

---

## Philosophy

### What vibe-check IS

- A self-reflection tool
- A pattern detector
- A gamified improvement system
- A calibration feedback loop

### What vibe-check IS NOT

- A productivity metric
- A performance review tool
- A surveillance system
- A judgment of AI effectiveness

**Use it for yourself, not for measuring others.**

---

## The Science

vibe-check uses **semantic-free signals** - patterns in git history that indicate workflow health without reading code content. This approach:

1. **Can't be gamed** - You can't fake commit timestamps
2. **Respects privacy** - Never reads actual code
3. **Is universal** - Works for any language/framework
4. **Provides honest signal** - Measures behavior, not intention

The VibeScore combines metrics using validated weights derived from empirical analysis of productive vs. struggling sessions.

---

## Future Roadmap

| Phase | Status | Description |
|-------|--------|-------------|
| CLI Core | ✅ Complete | Metrics, scoring, analysis |
| Gamification | ✅ Complete | XP, streaks, achievements, challenges |
| Watch Mode | ✅ Complete | Real-time spiral detection |
| GitHub Action | ✅ Complete | Automated PR feedback |
| Pattern Memory | ✅ Complete | Track your spiral triggers |
| Web Dashboard | 🔮 Planned | Visualizations, trends |
| VS Code Extension | 🔮 Planned | Status bar, live alerts |
| Team Features | 🔮 Planned | Opt-in leaderboards |

---

## Getting Started

```bash
# Install
npm install -g @boshu2/vibe-check

# Run your first check
vibe-check --since "1 week ago"

# See your profile
vibe-check profile

# Start watching
vibe-check watch
```

---

## Resources

- **npm**: [@boshu2/vibe-check](https://www.npmjs.com/package/@boshu2/vibe-check)
- **GitHub**: [boshu2/vibe-check](https://github.com/boshu2/vibe-check)
- **Issues**: [Report bugs or request features](https://github.com/boshu2/vibe-check/issues)

---

*"The goal isn't perfect metrics. It's conscious awareness of your patterns."*

**Version:** 1.5.0
**Last Updated:** 2025-11-29
