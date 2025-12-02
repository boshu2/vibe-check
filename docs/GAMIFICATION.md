# vibe-check Gamification System

**XP, levels, streaks, and achievements for self-improvement**

---

## Overview

vibe-check includes a gamification layer to make self-improvement engaging. This isn't productivity surveillance—it's a personal game you play with yourself.

```
┌─────────────────────────────────────────────────────────────┐
│                    GAMIFICATION SYSTEM                       │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │    XP    │  │  Streaks │  │ Achieve- │  │  Weekly  │   │
│  │ & Levels │  │          │  │  ments   │  │  Stats   │   │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘   │
│       │             │             │             │          │
│       └─────────────┴──────┬──────┴─────────────┘          │
│                            │                               │
│                     ┌──────┴──────┐                        │
│                     │   Profile   │                        │
│                     │   Storage   │                        │
│                     └─────────────┘                        │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## XP System

### How XP Is Earned

| Action | XP Reward | Notes |
|--------|-----------|-------|
| Daily check-in | +10 | Once per day |
| ELITE session | +50 | Vibe rating |
| HIGH session | +25 | Vibe rating |
| MEDIUM session | +10 | Vibe rating |
| LOW session | +5 | Still shows up! |
| Streak bonus | +5 × days | Per day of current streak |
| No spirals | +15 | Bonus for 0 spirals |
| Perfect trust | +20 | 100% trust pass rate |
| Achievement unlock | +25-100 | Varies by achievement |

### XP Calculation Example

```
Session results:
- Rating: ELITE (+50)
- Trust: 100% (+20)
- Spirals: 0 (+15)
- Streak: 5 days (+25)
- Daily check-in (+10)

Total: 50 + 20 + 15 + 25 + 10 = 120 XP
```

### Anti-Gaming: Period Deduplication

XP is deduplicated by analysis period to prevent gaming:

```typescript
// Can't earn XP twice for same commits
if (previousSession.periodFrom === currentPeriodFrom &&
    previousSession.periodTo === currentPeriodTo) {
  return 0; // No duplicate XP
}
```

---

## Level Progression

### Standard Levels (1-6)

| Level | Name | XP Range | Icon | Unlock |
|-------|------|----------|------|--------|
| 1 | Novice | 0-99 | 🌱 | Start |
| 2 | Apprentice | 100-299 | 🌿 | ~2-3 sessions |
| 3 | Practitioner | 300-599 | 🌳 | ~1 week |
| 4 | Expert | 600-999 | 🌲 | ~2 weeks |
| 5 | Master | 1000-1999 | 🎋 | ~1 month |
| 6 | Grandmaster | 2000-4999 | 🏔️ | ~2 months |

### Prestige Tiers (Post-Grandmaster)

After reaching Grandmaster, prestige tiers unlock:

| Tier | Name | XP Range | Icon |
|------|------|----------|------|
| 1 | Archmage | 5000-9999 | 🔮 |
| 2 | Sage | 10000-19999 | 📿 |
| 3 | Zenmester | 20000-39999 | ☯️ |
| 4 | Transcendent | 40000-79999 | 🌟 |
| 5 | Legendary | 80000+ | 💫 |

### Level Display

```
🎋 Level 5 Master (635/1000 XP)
████████████░░░░░░░░  63.5%

Next: 🏔️ Grandmaster at 2000 XP
```

---

## Streak System

### How Streaks Work

- **Daily check-in**: Run `vibe-check` at least once per day
- **Streak increments**: Each consecutive day with activity
- **Streak breaks**: Miss a day without freeze → reset to 0

### Streak Display

Visual progression based on streak length:

| Streak | Icon | Display |
|--------|------|---------|
| 1-5 days | 🔥 | `🔥 5-day streak` |
| 6-14 days | 🌟 | `🌟🌟 12-day streak` |
| 15+ days | 👑 | `👑👑👑 18-day streak 🏆` |

Personal best indicator:
```
👑👑👑 18-day streak 🏆 (Personal Best!)
```

### Streak Freezes

- **Initial freezes**: 2 per week
- **Freeze use**: Automatic when you miss a day
- **Freeze recovery**: 1 freeze regenerates per week (up to 2)

```
❄️ 2 freezes available
```

### Streak at Risk Warning

```
⚠️  Streak at risk! Check in today to keep it alive
```

---

## Achievements

### Categories

#### Streak Achievements

| Icon | Name | Requirement |
|------|------|-------------|
| 🩸 | First Blood | Run your first vibe-check |
| ⚔️ | Week Warrior | 7-day streak |
| 🏃 | Streak Master | 30-day streak |
| 💎 | Diamond Streak | 100-day streak |

#### Score Achievements

| Icon | Name | Requirement |
|------|------|-------------|
| 👑 | Elite Vibes | Get ELITE rating |
| 🏗️ | Trust Builder | >90% trust for 30 days |
| 🧘 | Zen Master | 0 spirals in 50+ commit week |
| 💯 | The Ninety Club | 90%+ vibe score |

#### Session Achievements

| Icon | Name | Requirement |
|------|------|-------------|
| 📊 | Getting Started | Complete 10 sessions |
| 🏛️ | Centurion | Complete 100 sessions |
| 🎖️ | Marathon Coder | Complete 500 sessions |

#### Special Achievements

| Icon | Name | Requirement |
|------|------|-------------|
| 🌙 | Night Owl | Session after midnight |
| 🌅 | Early Bird | Session before 6am |
| 🎉 | Weekend Warrior | Session on weekend |
| 🔄 | Comeback Kid | LOW → ELITE same week |
| 🔥 | On Fire | 3 ELITE sessions in a row |

### Secret Achievements

Some achievements are hidden until unlocked:
- 🥚 **Easter Egg** - ???
- 🎯 **Perfectionist** - ???

### Achievement Display

```
🏆 Achievements: 8/19 unlocked

Recent:
🧘 Zen Master (Nov 28)
⚔️ Week Warrior (Nov 25)
👑 Elite Vibes (Nov 22)
```

---

## Weekly Stats

### Sparklines

Visual trend of your scores this week:

```
📅 THIS WEEK

   Avg Score: 87% ↑
   Sessions: 5
   XP Earned: 320

   Trend: ▂▄▃▆▅██
```

### Trend Indicators

| Symbol | Meaning |
|--------|---------|
| ↑ | Improving (>5% vs previous) |
| → | Stable |
| ↓ | Declining (<5% vs previous) |

---

## Profile Storage

### Location

```
~/.vibe-check/
└── profile.json       # Main profile
```

### Profile Schema

```typescript
interface UserProfile {
  version: string;
  createdAt: string;
  updatedAt: string;
  streak: StreakState;
  xp: XPState;
  achievements: Achievement[];
  sessions: SessionRecord[];
  preferences: {
    weeklyGoal: number;
    showNotifications: boolean;
    publicProfile: boolean;
  };
  stats: {
    totalSessions: number;
    totalCommitsAnalyzed: number;
    avgVibeScore: number;
    bestVibeScore: number;
    totalSpiralsDetected: number;
    spiralsAvoided: number;
  };
}
```

---

## Commands

```bash
# View full profile
vibe-check profile

# View specific sections
vibe-check profile --achievements
vibe-check profile --stats
vibe-check profile --weekly

# JSON output
vibe-check profile --json
```

---

## Design Philosophy

### Why Gamification?

1. **Self-improvement is hard** - External motivation helps
2. **Feedback loops matter** - XP provides immediate reward
3. **Streaks create habits** - Daily engagement compounds
4. **Achievements mark progress** - Milestones feel good
5. **Competition is optional** - Personal bests, not team rankings

### What This Is NOT

- **Not surveillance** - Your data, your machine
- **Not productivity tracking** - No manager dashboards
- **Not competition** - No public leaderboards
- **Not judgment** - LOW sessions still earn XP

### The Goal

Make you WANT to improve your vibe score—not because someone's watching, but because the game is fun.

---

**Version:** 1.7.0
**Last Updated:** 2025-12-02
