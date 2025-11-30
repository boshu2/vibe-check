# vibe-check Timeline Feature: Git Data Analysis Research

**Repository:** /Users/fullerbt/workspaces/personal/vibe-check
**Analysis Date:** 2025-11-30
**Commit Range:** 43 commits over 3 days (Nov 28-30, 2025)
**Author:** Boden Fuller (single-developer repo)

---

## 1. AVAILABLE GIT METADATA

### Core Fields (Always Available)

| Field | Format Code | Example | Use for Timeline |
|-------|-------------|---------|------------------|
| **Commit Hash** | `%H` | `3f955bf12...` | Unique ID, linking |
| **Short Hash** | `%h` | `3f955bf` | Display, compact ID |
| **Timestamp (Unix)** | `%at` | `1764511499` | Session detection, gaps |
| **Timestamp (ISO)** | `%ai` | `2025-11-30 09:04:59 -0500` | Display, timezone-aware |
| **Author Email** | `%ae` | `boden.fuller@gmail.com` | Multi-dev repos |
| **Author Name** | `%an` | `Boden Fuller` | Display, attribution |
| **Committer Email** | `%ce` | Same as author | CI/bot detection |
| **Committer Name** | `%cn` | Same as author | CI/bot detection |
| **Subject** | `%s` | `feat: add timeline` | Semantic type, display |
| **Body** | `%b` | Multi-line text | Context, AI attribution |
| **Git Notes** | `%N` | (empty in this repo) | Custom metadata |

### Derived Metadata

```bash
# File-level changes
git log --numstat --format="%H|%at|%s"
# Output: hash|timestamp|subject followed by:
# 107    3804    tests/cli.integration.test.ts

# Aggregate stats
git log --shortstat --format="%H|%at|%s"  
# Output: 21 files changed, 107 insertions(+), 3804 deletions(-)

# Per-file with rename detection
git log --stat --format="%H|%at|%s"
# Shows file paths + line changes per file

# Branch/tag references
git log --decorate --format="%H|%D"
# Shows: HEAD -> main, origin/main, tag: v1.1.0
```

### Special Metadata Patterns

**AI Attribution Detection:**
```
Body contains: "🤖 Generated with [Claude Code]"
Body contains: "Co-Authored-By: Claude <noreply@anthropic.com>"
→ 100% of commits in this repo are AI-assisted
```

**Semantic Commit Detection:**
```bash
Subject matches: ^(feat|fix|docs|test|chore|wip|ci|session)(\(.+?\))?:
→ 100% of commits (43/43) use semantic commits
```

---

## 2. SESSION DETECTION PATTERNS

### Timestamp Gap Analysis (43 commits, 42 gaps)

**Gap Distribution:**
```
< 30 minutes:   29 gaps (69.0%)  ← Active coding
30m - 1 hour:    5 gaps (11.9%)  ← Short breaks
1 - 2 hours:     3 gaps ( 7.1%)  ← Meal/break
2 - 4 hours:     3 gaps ( 7.1%)  ← Context switch
> 4 hours:       2 gaps ( 4.8%)  ← End of day
```

### Recommended Session Boundary: **1 hour**

**Why 1 hour?**
- 69% of gaps are <30min (tight feedback loops)
- Only 19% of gaps are >1hr (clear session boundaries)
- Captures 9 distinct sessions over 3 days

### Detected Sessions (1hr threshold)

```
Session 1: Nov 28, 12:09-13:56 (107 min, 7 commits)
  - Initial CLI tool + README + publishing setup
  
Session 2: Nov 28, 17:07-18:04 (57 min, 3 commits)  
  - Research bundles, WIP vibe-score implementation
  
Session 3: Nov 28, 20:58-20:58 (1 commit burst)
  - v2.0.0 release + level subcommand
  
Session 4: Nov 28, 22:25 (1 commit)
  - Unit tests for ML model
  
Session 5: Nov 29, 00:27 (1 commit, late night)
  - Version fix (was incorrectly 2.0.0)
  
Session 6: Nov 29, 10:25 (1 commit)
  - Gamification feature
  
Session 7: Nov 29, 11:55-13:43 (108 min, 12 commits)
  - GitHub Actions, hooks, UX improvements
  
Session 8: Nov 29, 15:35-19:21 (227 min, 13 commits) ← LONGEST
  - Watch mode, sessions, pattern memory, v1.5 gamification
  
Session 9: Nov 30, 08:21-09:04 (43 min, 3 commits)
  - Test coverage, integration tests, retrospective
```

**Insights:**
- **Average session:** ~61 minutes
- **Longest session:** 227 min (3.8 hours) - v1.5 feature
- **Most commits/session:** 13 (Session 8)
- **Single-commit sessions:** 4 (quick fixes, late-night corrections)

---

## 3. COMMIT TYPE DISTRIBUTION

**Semantic Prefix Analysis:**

```
feat         16 commits ( 37.2%) ███████      - New features
docs          9 commits ( 20.9%) ████         - Documentation
chore         6 commits ( 14.0%) ██           - Maintenance
fix           4 commits (  9.3%) █            - Bug fixes
test          4 commits (  9.3%) █            - Test changes
session       2 commits (  4.7%)              - Session metadata
wip           1 commit  (  2.3%)              - Work in progress
ci            1 commit  (  2.3%)              - CI configuration
```

**Type Clustering Within Sessions:**

- **Session 1:** feat → docs → fix → feat (setup phase)
- **Session 7:** feat → ci → fix → chore → fix (rapid iteration)
- **Session 8:** feat → feat → feat (deep feature work)

**Pattern:** Sessions with 5+ commits show **type mixing** (feat + fix + docs), while short sessions are **single-type** (one feat or one fix).

---

## 4. LINES CHANGED PATTERNS

### Average by Commit Type

```
Type         Count  Avg +     Avg -     Avg Net   Total Net
────────────────────────────────────────────────────────────
feat         16     +873      -114      +759      +12,145
docs          9     +632      -7        +625      +5,622
chore         6     +15       -6        +9        +54
fix           4     +14       -6        +9        +36
test          4     +752      -952      -200      -799
session       2     +192      -0        +192      +385
wip           1     +855      -0        +855      +855
ci            1     +56       -0        +56       +56
```

**Key Insights:**
- **feat commits:** Large additions (avg +873 lines)
- **fix commits:** Tiny tweaks (avg +14 lines)
- **test commits:** NET NEGATIVE (avg -200 lines) - refactors!
- **docs commits:** Medium additions (avg +632 lines)

### Major Refactors (net deletions > 100)

```
1. test: replace unit tests with CLI integration tests
   +107 -3804 (net: -3697)
   → Deleted 258 unit tests, replaced with 11 integration tests
   
2. feat(v1.3): replace ML level prediction with session workflow  
   +282 -1563 (net: -1281)
   → Removed entire ML subsystem (ECE, logistic regression)
```

**Pattern:** Both refactors happened LATE (commits 42-43), after realizing earlier approach was wrong.

### Largest Features (net additions > 800)

```
1. feat(gamification): +3301 lines (dashboard, XP, achievements)
2. docs(bundles): +2567 lines (research documentation)
3. test: +2449 lines (comprehensive test suite)
4. feat: +1668 lines (npm standards compliance)
5. docs: +1643 lines (architecture guides)
6. feat: +1591 lines (initial CLI tool)
7. feat(calibration): +1356 lines (ML learning loop)
8. feat(v1.5): +1080 lines (gamification supercharge)
```

**Pattern:** Large features cluster in **Session 6-8** (Nov 29 afternoon/evening).

### Correlation: Type vs Size

```
feat:   avg absolute change = 919 lines  (large, variable)
docs:   avg absolute change = 625 lines  (medium, consistent)
test:   avg absolute change = 1649 lines (HUGE variance - refactors)
fix:    avg absolute change = 9 lines    (tiny, precise)
chore:  avg absolute change = 9 lines    (tiny, mechanical)
```

---

## 5. TIME-OF-DAY PATTERNS

### Hourly Distribution

```
Hour  Commits  Pattern
────────────────────────────
00:00    1     █ (late-night fix)
08:00    2     ██ (morning start)
09:00    1     █
10:00    1     █
11:00    1     █
12:00    8     ████████ (lunch-hour coding!)
13:00   10     ██████████ (peak productivity)
15:00    2     ██
16:00    3     ███
17:00    4     ████
18:00    5     █████ (evening focus)
19:00    2     ██
20:00    2     ██
22:00    1     █ (late work)
```

### Time-of-Day Categories

```
Morning (6am-12pm):      5 commits (11.6%)
Afternoon (12pm-6pm):   27 commits (62.8%) ← PEAK
Evening (6pm-12am):     10 commits (23.3%)
Night (12am-6am):        1 commit  ( 2.3%)
```

**Insights:**
- **Peak hours:** 12pm-2pm (18 commits / 41.9%)
- **Developer preference:** Afternoon coder (62.8%)
- **Late-night commits:** Rare (1 commit at 00:27 - version fix)
- **No early morning:** No commits before 8am

### Productivity by Time

**Commits per hour (active hours only):**
```
12pm-2pm:  18 commits (9.0 commits/hr)  ← HIGHEST
5pm-7pm:    9 commits (4.5 commits/hr)
8am-11am:   5 commits (1.25 commits/hr) ← Slower ramp-up
```

---

## 6. ADVANCED METADATA OPPORTUNITIES

### Available but Not Yet Used

**1. Git Notes (`git notes add`)**
- Store timeline annotations
- Link commits to vibe-levels
- Add retrospective comments
- Example: `git notes add -m "Spiral detected: 3 fix commits"`

**2. Commit Message Body Analysis**
- AI attribution footer (already present)
- Bullet points → task breakdown
- References to issues/PRs
- Example body:
  ```
  - Deleted 258 unit tests, replaced with 11 integration tests
  - Full retrospective analyzing ML detour
  - Hit: Tests Passing Lie, Instruction Drift
  ```

**3. File Churn Patterns**
- Track which files change together
- Detect component boundaries
- Identify hotspots
- Example: `src/gamification/*` changed in 8 commits

**4. Merge Commits**
- This repo has ZERO merge commits (linear history)
- If present: detect feature branches, PRs

**5. GPG Signatures**
- This repo: no signatures
- If present: trust/security indicators

**6. Trailer Parsing**
```
Co-Authored-By: Claude <noreply@anthropic.com>
→ AI-assisted indicator
```

### Could Be Added (New Data)

**1. Vibe-Level Annotations**
```bash
git notes --ref=vibe-level add -m "3" <commit>
# Later: git log --notes=vibe-level
```

**2. Session Metadata**
```bash
git notes --ref=session add -m "session-id: 007, duration: 108m" <commit>
```

**3. Spiral Markers**
```bash
git notes --ref=spiral add -m "fix-chain: 3 commits, trigger: API mismatch" <commit>
```

---

## 7. TIMELINE FEATURE RECOMMENDATIONS

### Data Schema for `vibe-check timeline`

```typescript
interface TimelineEvent {
  // Core Git Data
  hash: string;           // Full commit hash
  shortHash: string;      // 7-char hash
  timestamp: number;      // Unix timestamp
  datetime: string;       // ISO 8601
  author: string;         // Author name
  subject: string;        // Commit message (first line)
  body?: string;          // Full commit message
  
  // Semantic Analysis
  type: CommitType;       // feat|fix|docs|test|chore|etc
  scope?: string;         // (gamification), (v1.3), etc
  
  // Change Metrics
  filesChanged: number;
  insertions: number;
  deletions: number;
  netChange: number;      // insertions - deletions
  
  // Session Context
  sessionId: number;      // Computed from gaps
  sessionPosition: number; // 1st, 2nd, 3rd commit in session
  gapMinutes?: number;    // Minutes since previous commit
  
  // Derived Insights
  isRefactor: boolean;    // deletions > insertions
  isLargeFeature: boolean; // net > 500 lines
  isFix: boolean;         // type === 'fix' or in fix chain
  spiralDepth?: number;   // If part of fix chain
  
  // AI Detection
  isAiAssisted: boolean;  // From commit body
  
  // Future: Notes-based
  vibeLevel?: number;     // 0-5
  spiralTrigger?: string; // e.g., "API_MISMATCH"
}

interface Session {
  id: number;
  startTime: number;
  endTime: number;
  durationMinutes: number;
  commits: TimelineEvent[];
  
  // Aggregates
  totalLines: number;
  netChange: number;
  commitTypes: Record<CommitType, number>;
  
  // Metrics
  velocity: number;       // commits/hour
  reworkRatio: number;    // % fix commits
  avgLinesPerCommit: number;
  
  // Patterns
  hadSpiral: boolean;
  largestCommit: TimelineEvent;
}
```

### Session Detection Algorithm

```typescript
function detectSessions(commits: Commit[], gapThresholdMinutes = 60): Session[] {
  const sessions: Session[] = [];
  let currentSession: Commit[] = [commits[0]];
  
  for (let i = 1; i < commits.length; i++) {
    const gapMinutes = (commits[i].timestamp - commits[i-1].timestamp) / 60;
    
    if (gapMinutes >= gapThresholdMinutes) {
      // End current session
      sessions.push(buildSession(currentSession));
      currentSession = [commits[i]];
    } else {
      currentSession.push(commits[i]);
    }
  }
  
  // Don't forget last session
  sessions.push(buildSession(currentSession));
  return sessions;
}
```

### Timeline Output Format

**Recommended:**
```
Session 1: Nov 28, 12:09-13:56 (107 min) ━━━━━━━━━━━━━━━━
  12:09  feat      initial vibe-check CLI tool         +1591
  13:05  docs      add README and fix repository URL   +115
  13:27  fix       use scoped package name             +0
  13:41  feat      add npm CLI standards compliance    +1668
  13:51  docs      rewrite README                      +24
  13:51  chore     bump version to 1.0.2               +8
  13:56  docs      add CLAUDE.md                       +119
  
  Session metrics:
    Velocity: 3.9 commits/hr
    Rework: 14% (1 fix / 7 commits)
    Net change: +3525 lines (7 files)
    Pattern: Setup phase (feat → docs → fix)

[gap: 3.2 hours]

Session 2: Nov 28, 17:07-18:04 (57 min) ━━━━━━━━━
  17:07  docs      unified vibe system research        +2567
  17:07  wip       partial implementation              +855
  18:04  feat      implement ML learning loop          +1356
  
  Session metrics:
    Velocity: 3.2 commits/hr
    Rework: 0%
    Net change: +4778 lines (24 files)
    Pattern: Research → Implementation
```

### Visualization Ideas

**1. Session Timeline (ASCII)**
```
Nov 28 ━━━━━╋━━━╋━━━━━━━━━━━━━━━━╋━━╋━━━━━╋
            12pm      18pm        22pm  2am

Nov 29 ━━━━━━━━━━╋━━━━━━╋━━━━━━━━━━━━━━━━━━━━━
                10am    15pm              19pm

Nov 30 ━╋━━━━
       8am
```

**2. Commit Type Stacked Bar**
```
Session 1 [feat][docs][fix][feat][docs][chore][docs]
Session 2 [docs][wip][feat]
Session 3 [feat][chore]
...
```

**3. Lines Changed Heatmap**
```
Hour   Commits  Lines Changed
12pm   ████     +1,706  ▓▓▓▓▓▓▓▓▓
13pm   ██████   +1,819  ▓▓▓▓▓▓▓▓▓▓
17pm   ██       +3,422  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓
18pm   ██       +1,356  ▓▓▓▓▓▓▓
```

---

## 8. FINDINGS SUMMARY

### What Git Gives Us

1. **Rich Metadata:** Hash, timestamp, author, message, stats
2. **Precise Timing:** Unix timestamps → session gaps
3. **Semantic Structure:** Commit types, scopes
4. **Change Quantification:** Files, lines added/deleted
5. **AI Attribution:** Footer detection
6. **Extensibility:** Git notes for vibe-levels

### Session Detection Works

- **1-hour gap threshold** is optimal (69% <30min, 19% >1hr)
- Captures **9 sessions** over 3 days
- Average session: **61 minutes**
- Longest session: **227 minutes** (deep feature work)

### Commit Patterns Are Clear

- **feat:** Large, variable (avg +873 lines)
- **fix:** Tiny, precise (avg +14 lines)
- **docs:** Medium, consistent (avg +632 lines)
- **test:** Refactor-prone (avg -200 net)

### Time-of-Day Matters

- **Peak:** 12pm-2pm (41.9% of commits)
- **Developer:** Afternoon coder (62.8%)
- **Velocity:** 9 commits/hr during peak (vs 1.25/hr morning)

### Timeline Feature is Viable

- All necessary data is in git
- No external storage needed (use git notes for vibe-levels)
- Can compute metrics on-the-fly
- Rich visualizations possible with existing data

---

## 9. NEXT STEPS

### Phase 1: Basic Timeline (MVP)
- [x] Parse git log with timestamps
- [ ] Detect sessions (1hr gap)
- [ ] Group commits by session
- [ ] Display chronological list
- [ ] Show session summaries

### Phase 2: Metrics Integration
- [ ] Calculate session velocity
- [ ] Detect fix chains (spirals)
- [ ] Show rework ratio per session
- [ ] Highlight large features/refactors

### Phase 3: Visualization
- [ ] ASCII timeline bars
- [ ] Commit type color coding
- [ ] Lines changed heatmap
- [ ] Session duration bars

### Phase 4: Advanced Features
- [ ] Interactive drill-down
- [ ] Filter by commit type
- [ ] Filter by date range
- [ ] Export to JSON
- [ ] Git notes integration (vibe-levels)

---

**Conclusion:** Git provides everything needed for a rich timeline feature. The data is clean, structured, and reveals clear patterns in coding behavior. Session detection works reliably, and there's ample opportunity for visualization and insight extraction.

