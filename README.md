# vibe-check

**Git-powered metrics for AI-assisted coding.** Catch debug spirals before they catch you.

```bash
npx @boshu2/vibe-check --since "2 hours ago"
```

```
╭──────────────────────────────────────────────────────────────╮
│  VIBE-CHECK                                    Dec 04, 2025  │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  Rating: ELITE                                               │
│                                                              │
│  Trust Pass Rate   ████████████████████  95%  ELITE          │
│  Rework Ratio      ████░░░░░░░░░░░░░░░░  18%  ELITE          │
│  Debug Spirals     None detected              ELITE          │
│                                                              │
│  You're in the zone. Ship it.                                │
│                                                              │
╰──────────────────────────────────────────────────────────────╯
```

---

## What It Does

Analyzes your git history to measure three things:

| Metric | Question |
|--------|----------|
| **Trust Pass Rate** | What % of commits don't need immediate fixes? |
| **Rework Ratio** | What % of commits are fixes vs. new work? |
| **Debug Spirals** | Are you stuck in fix loops? |

These are semantic-free signals - patterns in git, not code content.

---

## Quick Start

```bash
npm install -g @boshu2/vibe-check

vibe-check --since "1 week ago"   # Analyze recent work
vibe-check watch                   # Real-time spiral detection
vibe-check dashboard               # Visual dashboard
vibe-check profile                 # XP, streaks, achievements
```

---

## Learn More

- [Full write-up](https://www.bodenfuller.com/builds/vibe-check) - Why this exists
- [Vibe-Coding Ecosystem](docs/VIBE-ECOSYSTEM.md) - Complete methodology and features

---

## License

MIT
