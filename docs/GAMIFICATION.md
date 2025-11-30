# vibe-check Gamification System

**Deep dive into XP, levels, achievements, challenges, and more**

---

## Overview

vibe-check includes a complete gamification layer to make self-improvement engaging. This isn't productivity surveillance—it's a personal game you play with yourself.

```
┌─────────────────────────────────────────────────────────────┐
│                    GAMIFICATION SYSTEM                       │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │    XP    │  │  Streaks │  │ Achieve- │  │Challenge │   │
│  │ & Levels │  │          │  │  ments   │  │    s     │   │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘   │
│       │             │             │             │          │
│       └─────────────┴──────┬──────┴─────────────┘          │
│                            │                               │
│                     ┌──────┴──────┐                        │
│                     │   Profile   │                        │
│                     │   Storage   │                        │
│                     └──────┬──────┘                        │
│                            │                               │
│  ┌──────────┐  ┌──────────┴──────────┐  ┌──────────┐     │
│  │ Leader-  │  │     Hall of Fame    │  │  Badges  │     │
│  │  boards  │  │                     │  │          │     │
│  └──────────┘  └─────────────────────┘  └──────────┘     │
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
| Challenge complete | +30-150 | Based on difficulty |

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

| Tier | Name | XP Range | Icon | Time Estimate |
|------|------|----------|------|---------------|
| 1 | Archmage | 5000-9999 | 🔮 | ~3 months |
| 2 | Sage | 10000-19999 | 📿 | ~6 months |
| 3 | Zenmester | 20000-39999 | ☯️ | ~1 year |
| 4 | Transcendent | 40000-79999 | 🌟 | ~2 years |
| 5 | Legendary | 80000+ | 💫 | Long-term mastery |

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

## Weekly Challenges

### How Challenges Work

- **Generated weekly**: Based on your weak metrics
- **3 challenges per week**: 1 targeted + 2 random
- **Progress tracked**: Updates after each session
- **XP rewards**: 30-150 XP per challenge

### Challenge Types

| Type | Name | Description | Targets |
|------|------|-------------|---------|
| `TRUST_STREAK` | Trust Gauntlet | Get 90%+ trust N times | 3, 5, 7 |
| `ZERO_SPIRALS` | Zen Mode | N sessions with 0 spirals | 3, 5, 7 |
| `ELITE_COUNT` | Elite Streak | Get N ELITE ratings | 2, 4, 6 |
| `COMMIT_VOLUME` | Commit Champion | Analyze N+ commits | 50, 100, 200 |
| `STREAK_EXTEND` | Streak Builder | Extend streak by N days | 3, 5, 7 |

### Challenge Display

```
WEEKLY CHALLENGES

🎯 Trust Gauntlet:  ████████░░  4/5 (+100 XP)
🧘 Zen Mode:        ██████████  ✓ COMPLETE
🔥 Streak Builder:  ██░░░░░░░░  1/5 (+40 XP)
```

### Challenge Selection Algorithm

1. Analyze recent session metrics
2. Identify weak areas (low trust? many spirals?)
3. Generate 1 challenge targeting weakness (medium difficulty)
4. Generate 2 random challenges (easy difficulty)

---

## Leaderboards

### Personal Leaderboards

Track your high scores across all repos:

```
🏆 All-Time Top Scores

🥇 96% ELITE  my-project (Nov 15)
🥈 94% ELITE  vibe-check (Nov 28)
🥉 91% ELITE  other-repo (Nov 20)
4. 89% HIGH   work-app (Nov 18)
5. 87% HIGH   side-project (Nov 10)
```

### Per-Repo Leaderboards

```
📊 Top Scores - vibe-check

🥇 94% ELITE  Nov 28
🥈 91% ELITE  Nov 27
🥉 88% HIGH   Nov 26
```

### Data Stored

```typescript
interface LeaderboardEntry {
  date: string;
  repoPath: string;
  repoName: string;
  vibeScore: number;
  overall: string;
  commits: number;
  xpEarned: number;
}
```

---

## Hall of Fame

Personal bests and records:

```
🏛️  HALL OF FAME

🏆 Best Score: 96% (Nov 15)
   my-project - ELITE rating

🔥 Longest Streak: 15 days
   Consecutive daily check-ins

⚡ Best Week: 847 XP
   Week of Nov 11

📊 Most Commits: 127 (Nov 10)
   big-refactor - single session
```

---

## Rank Badges

Tier badges based on cumulative progress:

| Badge | Icon | Requirement |
|-------|------|-------------|
| Bronze | 🥉 | 10+ sessions |
| Silver | 🥈 | 50+ sessions |
| Gold | 🥇 | 100+ sessions |
| Platinum | 💎 | 14+ day streak |
| Diamond | 🔷 | 5000+ XP |

### Badge Display

```
Current: 💎 Platinum Tier

Next: 🔷 Diamond (need 5000 XP, have 3200)
Progress: ████████████░░░░  64%
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
   ELITE: 3 | Spirals: 2

   Trend: ▂▄▃▆▅██
```

### Trend Indicators

| Symbol | Meaning |
|--------|---------|
| ↑ | Improving (>5% vs previous) |
| → | Stable |
| ↓ | Declining (<5% vs previous) |

---

## Pattern Memory

Tracks YOUR spiral triggers over time:

```
YOUR SPIRAL TRIGGERS

  Pattern      Times   Avg Duration
  SECRETS_AUTH   5     18 min
  VOLUME_CONFIG  3     12 min
  API_MISMATCH   2     25 min

Your kryptonite: OAuth/token issues
Consider: Tracer tests for auth flows
```

---

## Intervention Tracking

Records what breaks YOUR spirals:

```
WHAT WORKS FOR YOU

  Intervention   Times   Success Rate
  Take a break     4     75%
  Write test       3     100%
  Read docs        2     50%
  Ask for help     1     100%

Recommendation: Write a test first!
```

### Intervention Types

| Type | Description |
|------|-------------|
| `TRACER_TEST` | Wrote a test to validate |
| `BREAK` | Took a break |
| `DOCS` | Consulted documentation |
| `REFACTOR` | Changed approach |
| `HELP` | Asked for help |
| `ROLLBACK` | Reverted to known state |
| `OTHER` | Custom intervention |

---

## Share Feature

### Shareable Text

```bash
vibe-check profile --share
```

Output:
```
🎮 bodefuller's Vibe-Check Profile

Level 5 Master (Archmage I) 💎 Platinum
1,250 Total XP

🔥 12-day streak (Best: 15)
📊 45 sessions | Avg: 87% | Best: 96%
🏆 12 achievements unlocked

Track your coding vibes: npx @boshu2/vibe-check
```

### Shareable JSON

```bash
vibe-check profile --share-json
```

Machine-readable profile for integrations.

---

## Near-Miss Psychology

Motivational messages when you're close to achievements:

```
🎯 SO CLOSE!

Just 1-2 metrics away from ELITE overall!
88% vibe score - just 2% from the Ninety Club!
```

Triggers when:
- HIGH rating with 3+ ELITE metrics
- Score 85-89% (close to 90)
- Trust 90-99% (close to 100)
- 1 spiral (close to Zen Master)

---

## Profile Storage

### Location

```
~/.vibe-check/
├── profile.json       # Main profile
└── leaderboards.json  # High scores
```

### Profile Schema

```typescript
interface UserProfile {
  version: string;           // "1.5.0"
  createdAt: string;
  updatedAt: string;
  streak: StreakState;
  xp: XPState;
  achievements: Achievement[];
  sessions: SessionRecord[];
  patternMemory?: PatternMemory;
  interventionMemory?: InterventionMemory;
  challenges?: Challenge[];
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
vibe-check profile --challenges
vibe-check profile --leaderboard
vibe-check profile --hall-of-fame
vibe-check profile --weekly
vibe-check profile --patterns
vibe-check profile --interventions

# Share
vibe-check profile --share
vibe-check profile --share-json

# Record intervention
vibe-check intervene TRACER_TEST
vibe-check intervene BREAK
vibe-check intervene --list
vibe-check intervene --stats
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

**Version:** 1.5.0
**Last Updated:** 2025-11-29
