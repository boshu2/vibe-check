# Vibe-Check Ecosystem: Full Product Vision

**Type:** Plan
**Created:** 2025-11-29
**Loop:** Outer → Middle (strategic vision + phased execution)
**Tags:** vibe-check, showcase, gamification, FAAFO, github-action, dashboard, vscode

---

## Vision: FAAFO-Enabled Development

**The Goal:** Make developers WANT to improve their vibe score.

Not another metrics dashboard you ignore. A system that:
- **Fast**: Instant feedback on every session
- **Ambitious**: Streaks, achievements, leaderboards
- **Autonomous**: Self-tracking, auto-insights
- **Fun**: Satisfying progress, dopamine hits
- **Optionality**: Try approaches, see what works

---

## Product Ecosystem

```
┌─────────────────────────────────────────────────────────────┐
│                    VIBE-CHECK ECOSYSTEM                      │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│   ┌──────────────┐    ┌──────────────┐    ┌──────────────┐ │
│   │   CLI Tool   │───▶│   API/Core   │◀───│  Dashboard   │ │
│   │  (existing)  │    │   (shared)   │    │    (web)     │ │
│   └──────────────┘    └──────────────┘    └──────────────┘ │
│          │                   │                    │         │
│          ▼                   ▼                    ▼         │
│   ┌──────────────┐    ┌──────────────┐    ┌──────────────┐ │
│   │GitHub Action │    │  Badge API   │    │VS Code Ext.  │ │
│   │  (CI/CD)     │    │   (shield)   │    │  (live)      │ │
│   └──────────────┘    └──────────────┘    └──────────────┘ │
│                                                              │
│   ┌────────────────────────────────────────────────────────┐│
│   │                  GAMIFICATION LAYER                     ││
│   │  Streaks • Achievements • Levels • Leaderboards         ││
│   └────────────────────────────────────────────────────────┘│
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Phase 0: Foundation (Current State ✅)

**Already Done:**
- [x] CLI with semantic-free metrics
- [x] VibeScore (0-1) computation
- [x] Ordered Logistic Regression for level recommendation
- [x] ECE calibration loop
- [x] 51 unit tests passing
- [x] npm published as @boshu2/vibe-check

---

## Phase 1: Gamification Core 🎮

**Goal:** Make the CLI itself addictive

### 1.1 Streak Tracking

**File:** `src/gamification/streaks.ts`

```typescript
interface StreakState {
  current: number;           // Current consecutive days
  longest: number;           // Personal best
  lastActiveDate: string;    // ISO date
  weeklyGoal: number;        // Days per week target
  weeklyProgress: number;    // Days this week
}

// Stored in ~/.vibe-check/profile.json
```

**Features:**
- "🔥 5-day streak! Personal best: 12 days"
- Streak freeze: miss 1 day, don't break streak
- Weekly goals: "3/5 days this week"

### 1.2 Achievement System

**File:** `src/gamification/achievements.ts`

```typescript
interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  condition: (history: SessionHistory[]) => boolean;
  unlockedAt?: Date;
}

const ACHIEVEMENTS: Achievement[] = [
  { id: 'first_blood', name: 'First Blood', icon: '🩸',
    description: 'Run your first vibe-check', condition: h => h.length >= 1 },
  { id: 'week_warrior', name: 'Week Warrior', icon: '⚔️',
    description: '7-day streak', condition: h => getStreak(h) >= 7 },
  { id: 'elite_session', name: 'Elite Vibes', icon: '👑',
    description: 'Achieve ELITE rating in a session', condition: h => h.some(s => s.overall === 'ELITE') },
  { id: 'no_spirals', name: 'Zen Master', icon: '🧘',
    description: '0 debug spirals in a 50+ commit week', condition: ... },
  { id: 'trust_builder', name: 'Trust Builder', icon: '🏗️',
    description: 'Maintain >90% Trust Pass Rate for 30 days', condition: ... },
  { id: 'comeback_kid', name: 'Comeback Kid', icon: '🔄',
    description: 'Go from LOW to ELITE in same week', condition: ... },
  // 20+ more achievements
];
```

### 1.3 Level Progression

**Concept:** Your overall "Vibe Level" increases over time

```
Level 1: Novice       (0-100 XP)      🌱
Level 2: Apprentice   (100-300 XP)    🌿
Level 3: Practitioner (300-600 XP)    🌳
Level 4: Expert       (600-1000 XP)   🌲
Level 5: Master       (1000-2000 XP)  🎋
Level 6: Grandmaster  (2000+ XP)      🏔️

XP earned from:
- Daily check-in: 10 XP
- ELITE session: 50 XP
- HIGH session: 25 XP
- Streak bonus: 5 XP × streak_length
- Achievement unlock: varies
```

### 1.4 Enhanced CLI Output

**Before (boring):**
```
OVERALL: ELITE
```

**After (gamified):**
```
================================================================
  OVERALL: ELITE 👑

  🔥 Streak: 5 days (Personal best!)
  ⭐ Level 3 Practitioner (456/600 XP)
  🏆 +50 XP earned this session

  🎉 ACHIEVEMENT UNLOCKED: "Zen Master" 🧘
     0 debug spirals in a 50+ commit week!
================================================================
```

### 1.5 Profile Command

```bash
$ vibe-check profile

╭─────────────────────────────────────────────╮
│           @bodefuller's Vibe Profile        │
├─────────────────────────────────────────────┤
│  Level 4 Expert 🌲                          │
│  ████████████░░░░░░░░  756/1000 XP          │
│                                              │
│  🔥 Current Streak: 12 days                 │
│  📅 Weekly Goal: 4/5 days ████░             │
│  🏆 Achievements: 8/24 unlocked             │
│                                              │
│  📊 30-Day Stats                            │
│  ├─ Avg Vibe Score: 82%                     │
│  ├─ Sessions: 23                            │
│  ├─ Total Commits Analyzed: 847             │
│  └─ Spirals Avoided: 15                     │
│                                              │
│  Recent Achievements:                       │
│  🧘 Zen Master (Nov 28)                     │
│  ⚔️ Week Warrior (Nov 25)                   │
│  👑 Elite Vibes (Nov 22)                    │
╰─────────────────────────────────────────────╯
```

---

## Phase 2: GitHub Action 🤖

**Goal:** Automated PR feedback with vibe metrics

### 2.1 Action Definition

**File:** `action.yml`

```yaml
name: 'Vibe Check'
description: 'Analyze commit patterns for AI-assisted coding effectiveness'
branding:
  icon: 'activity'
  color: 'purple'

inputs:
  github-token:
    description: 'GitHub token for PR comments'
    required: true
  threshold:
    description: 'Minimum vibe score (0-100) to pass'
    default: '60'
  comment:
    description: 'Post results as PR comment'
    default: 'true'

outputs:
  score:
    description: 'Vibe score (0-100)'
  rating:
    description: 'Overall rating (ELITE/HIGH/MEDIUM/LOW)'
  passed:
    description: 'Whether threshold was met'

runs:
  using: 'node20'
  main: 'dist/action/index.js'
```

### 2.2 PR Comment Output

```markdown
## 🎯 Vibe Check Results

| Metric | Value | Rating |
|--------|-------|--------|
| Vibe Score | **87%** | 🟢 ELITE |
| Trust Pass Rate | 94% | 🟢 |
| Debug Spirals | 1 (12min) | 🟡 |
| File Churn | 8% | 🟢 |

### 📈 Compared to `main`
- Vibe Score: +5% ↑
- Spiral time: -8min ↓

### 💡 Insight
This PR shows excellent iteration patterns. The single spiral
was on OAuth integration—consider a tracer test next time.

---
<sub>Powered by [vibe-check](https://github.com/boshu2/vibe-check)</sub>
```

### 2.3 Usage in Workflows

```yaml
# .github/workflows/vibe-check.yml
name: Vibe Check
on: [pull_request]

jobs:
  vibe:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0  # Full history for analysis

      - uses: boshu2/vibe-check-action@v1
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          threshold: 70
```

---

## Phase 3: Web Dashboard 📊

**Goal:** Beautiful visualization of vibe trends

### 3.1 Tech Stack

- **Framework:** Next.js 14 (App Router)
- **Styling:** Tailwind CSS + shadcn/ui
- **Charts:** Recharts
- **Auth:** GitHub OAuth (optional, for sync)
- **Hosting:** Vercel

### 3.2 Dashboard Pages

```
/                     # Landing page + demo
/dashboard            # Main dashboard (auth required)
/dashboard/history    # Session history timeline
/dashboard/compare    # Branch/period comparison
/dashboard/team       # Team leaderboard (opt-in)
/profile/[username]   # Public profile page
/badge/[user]/[repo]  # SVG badge endpoint
```

### 3.3 Key Visualizations

**1. Vibe Score Trend (Line Chart)**
```
Score
100│     ╭──╮      ╭───╮
 80│╭───╯  ╰──╮  ╭╯   ╰──╮
 60│           ╰╯         ╰──
 40│
   └────────────────────────▶ Time
     Mon  Tue  Wed  Thu  Fri
```

**2. Contribution Heatmap (GitHub-style)**
```
     Mon ▪▪▫▪▪▫▪▪▪▪▫▫
     Tue ▪▪▪▪▫▫▪▪▪▪▪▫
     Wed ▫▪▪▪▪▪▫▫▪▪▪▪
     Thu ▪▫▫▪▪▪▪▪▫▫▪▪
     Fri ▪▪▪▫▫▪▪▪▪▪▫▪
```

**3. Metric Radar Chart**
```
        Trust Pass
            ╱╲
           ╱  ╲
    Flow ─╱    ╲─ Velocity
          ╲    ╱
           ╲  ╱
        Stability
```

**4. Spiral Timeline**
```
  ┌──────────────────────────────────────┐
  │ 🔴 OAuth spiral (25min)              │
  │ └─ fix(auth): token refresh          │
  │ └─ fix(auth): token storage          │
  │ └─ fix(auth): token validation       │
  │ └─ fix(auth): FINALLY WORKS          │
  └──────────────────────────────────────┘
```

### 3.4 Badge API

**Endpoint:** `GET /api/badge/[owner]/[repo]`

**Response:** Dynamic SVG

```
┌─────────────────────────────┐
│ vibe score │ 87% │ ELITE   │
└─────────────────────────────┘
```

**Usage in README:**
```markdown
![Vibe Score](https://vibe-check.dev/api/badge/boshu2/my-project)
```

---

## Phase 4: VS Code Extension 🔌

**Goal:** Real-time vibe monitoring while coding

### 4.1 Features

1. **Status Bar Item**
   ```
   🎯 Vibe: 85% (12-day streak 🔥)
   ```

2. **Spiral Alert Notification**
   ```
   ⚠️ Debug spiral detected on auth.ts
   You've made 4 rapid-fire commits in 15 minutes.
   Consider: Take a break? Write a test first?

   [Dismiss] [Pause Tracking] [Add Tracer Test]
   ```

3. **Session Summary on Git Push**
   ```
   📊 Session Summary
   ─────────────────
   Duration: 2.5 hours
   Commits: 12
   Vibe Score: 78%

   🏆 +25 XP earned
   🔥 Streak: 13 days
   ```

4. **Command Palette**
   - `Vibe Check: Show Dashboard`
   - `Vibe Check: Current Session Stats`
   - `Vibe Check: Classify Next Task Level`
   - `Vibe Check: View Achievements`

### 4.2 Extension Tech

```json
{
  "name": "vibe-check-vscode",
  "publisher": "boshu2",
  "engines": { "vscode": "^1.80.0" },
  "activationEvents": ["workspaceContains:.git"],
  "contributes": {
    "commands": [...],
    "configuration": {
      "vibe-check.enableNotifications": true,
      "vibe-check.spiralThresholdMinutes": 15,
      "vibe-check.showStatusBar": true
    }
  }
}
```

---

## Phase 5: Team Features 👥

**Goal:** Collaborative improvement, not surveillance

### 5.1 Leaderboard (Opt-In)

```
╭───────────────────────────────────────────╮
│         🏆 Team Vibe Leaderboard          │
├───────────────────────────────────────────┤
│  1. @alice      Level 5 Master    92% 🔥  │
│  2. @bob        Level 4 Expert    88%     │
│  3. @charlie    Level 4 Expert    85%     │
│  ─────────────────────────────────────────│
│  7. @you        Level 3 Pract.    78% ←   │
╰───────────────────────────────────────────╯
```

### 5.2 Team Insights

- "Team average vibe score this week: 82% (+3% vs last week)"
- "Most common spiral trigger: API integrations"
- "Suggested: Team tracer test session for OAuth patterns"

### 5.3 Weekly Digest Email

```
Subject: 📊 Your Weekly Vibe Report

Hey @bodefuller,

Your week in vibes:
━━━━━━━━━━━━━━━━━━━━━
🎯 Average Score: 84% (↑ 6% from last week)
🔥 Streak: 8 days
🏆 XP Earned: 245
📈 Level Progress: 756 → 1001 XP (LEVEL UP! 🎉)

Achievement Unlocked:
🌲 Expert Status - Reached Level 4!

This Week's Insight:
Your Trust Pass Rate jumped from 78% to 91% after you
started using tracer tests. Keep it up!

Next Week's Challenge:
Can you maintain 0 spirals for 5 consecutive days?
Current best: 3 days

[View Full Dashboard →]
```

---

## Phase 6: Scientific Credibility 📚

**Goal:** Establish legitimacy, not just vibes

### 6.1 Methodology Documentation

**Create:** `METHODOLOGY.md`

Contents:
- Metric definitions with formulas
- Statistical validation approach
- Limitations and caveats
- Comparison to DORA metrics
- Academic references (if any)

### 6.2 "How We Built This" Blog Post

**URL:** Medium / dev.to / personal blog

Sections:
1. The Problem: AI-Assisted Coding Blindspots
2. Why Existing Metrics Don't Work
3. Designing Semantic-Free Signals
4. The ML Behind Level Classification
5. Calibration: Learning from Your Patterns
6. What's Next: Validating Against Outcomes

### 6.3 Jupyter Notebook

**File:** `notebooks/methodology-walkthrough.ipynb`

- Interactive explanation of the math
- Real data visualization
- Correlation analysis
- Model training demo

---

## Implementation Order

**Dependencies visualized:**

```
Phase 1 (Gamification)
    │
    ├──▶ Phase 2 (GitHub Action) [parallel]
    │
    ├──▶ Phase 3 (Dashboard) [parallel]
    │        │
    │        ▼
    │    Phase 4 (VS Code) [needs dashboard for sync]
    │
    └──▶ Phase 5 (Team) [needs dashboard]

Phase 6 (Docs) [can start anytime, finish last]
```

**Suggested Sprint Plan:**

| Sprint | Focus | Deliverables |
|--------|-------|--------------|
| 1 | Gamification Core | Streaks, achievements, XP in CLI |
| 2 | GitHub Action | Action + PR comments working |
| 3 | Dashboard MVP | Landing + basic charts |
| 4 | Dashboard Polish | Full viz, badges, profiles |
| 5 | VS Code Extension | Status bar + notifications |
| 6 | Team + Docs | Leaderboards, methodology |

---

## Tech Stack Summary

| Component | Stack |
|-----------|-------|
| CLI | TypeScript, Commander, simple-git |
| GitHub Action | TypeScript, @actions/core |
| Dashboard | Next.js 14, Tailwind, shadcn/ui, Recharts |
| VS Code Ext | TypeScript, VS Code API |
| Badge API | Next.js API routes, @vercel/og |
| Auth | NextAuth.js + GitHub OAuth |
| Storage | Local JSON (CLI), Vercel KV (cloud) |

---

## Repository Structure

```
vibe-check/
├── packages/
│   ├── cli/                 # Existing CLI (move here)
│   ├── core/                # Shared metrics engine
│   ├── action/              # GitHub Action
│   ├── dashboard/           # Next.js app
│   └── vscode/              # VS Code extension
├── docs/
│   ├── METHODOLOGY.md
│   └── notebooks/
├── .github/
│   └── workflows/
└── turbo.json               # Monorepo management
```

---

## Success Metrics

| Metric | Target | Why |
|--------|--------|-----|
| npm downloads | 1000/month | Adoption |
| GitHub stars | 500 | Social proof |
| VS Code installs | 200 | Engagement |
| Avg streak length | 5+ days | Stickiness |
| Achievement unlock rate | 40%+ | Fun factor |

---

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| Scope creep | Phase boundaries, MVP each sprint |
| Dashboard complexity | Start with static, add interactivity |
| VS Code API learning | Prototype early in Phase 1 |
| Team adoption | Make solo mode compelling first |

---

## FAAFO Enablement Check

| FAAFO | How This Delivers |
|-------|-------------------|
| **Fast** | Real-time VS Code feedback, instant CLI results |
| **Ambitious** | Full ecosystem, not just a script |
| **Autonomous** | Self-tracking, no manual logging needed |
| **Fun** | Achievements, streaks, dopamine hits |
| **Optionality** | Try different coding styles, measure impact |

---

## Approval Checklist

- [ ] Vision clear and aligned with FAAFO?
- [ ] Phase order makes sense?
- [ ] Tech stack appropriate?
- [ ] Scope realistic for showcase?
- [ ] Ready to start Phase 1?

---

## Next Step

**Approve this plan, then:**

1. `/implement` Phase 1 (Gamification Core)
2. Test CLI gamification locally
3. Proceed to parallel phases

---

**Ready to make developers WANT to improve?** 🎮
