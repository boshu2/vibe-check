# vibe-check timeline: Complete Research Bundle

**Type:** Research Synthesis
**Created:** 2025-11-30
**Agents:** 3 parallel (Git Data, Pattern Detection, UX/Visualization)

---

## Executive Summary

The `vibe-check timeline` command will transform vibe-check from a point-in-time metrics tool into a **retrospective storytelling tool**. Based on analysis of the actual vibe-check git repository (43 commits, 9 sessions, 3 days), we have comprehensive data on what's possible and valuable.

**Key Finding:** Git provides everything we need - no external storage required. The timeline can show ~10 hours of actual coding time vs. 45 hours wall clock, highlight the 2h 24m ML detour, and surface patterns like "5 features in 1h 58m post-delete."

---

## The Numbers (From Real Data)

| Metric | Value | Source |
|--------|-------|--------|
| Sessions detected | 9 | 1-hour gap threshold |
| Active coding time | ~10 hours | Sum of session durations |
| Wall clock time | 45 hours | First to last commit |
| Commits | 43 | git log |
| Features | 16 | feat commits |
| Lines deleted | 1,563 | ML detour |
| Peak productivity | 12pm-2pm (42%) | Time analysis |
| Commit gap <30m | 69% | Tight feedback loops |

---

## Pattern Detection (Must-Have)

### 1. Debug Spirals ✅ (Already Implemented)
- 3+ consecutive fix commits = spiral
- Pattern classification: SECRETS_AUTH, VOLUME_CONFIG, etc.
- Threshold: Elite <15m, Low >45m

### 2. Flow States 🌊 (New)
```
Definition: 5+ non-fix commits, no gap >30m, duration >45m
Value: Shows when you're in the zone
Display: Session highlighted with 🌊, velocity shown
```

### 3. Post-Delete Sprints ⚡ (New)
```
Definition: Deletions > 2× additions, then velocity >50% above baseline
Value: Shows ROI of simplification
Display: Sprint box with before/after velocity comparison
```

### 4. Detours 🚧 (New)
```
Definition: Code added then deleted in same analysis window
Value: Track wasted time, learn from experiments
Display: Time lost, files affected, lesson learned
```

### 5. Thrashing 🔄 (New)
```
Definition: Same file touched 5+ times in 2 hours, low net change
Value: Identify incomplete understanding
Display: File list with touch count and efficiency
```

### 6. Late Night Spirals 🌙 (New)
```
Definition: Debug session after 22:00 with 3+ fix commits
Value: Show tired debugging is inefficient
Display: Duration, outcome, "fresh eyes" comparison
```

---

## Timeline Format (Hybrid Recommended)

### Default View
```
════════════════════════════════════════════════════════════════
                      VIBE-CHECK TIMELINE
                    Nov 28 - Nov 30 (3 days)
════════════════════════════════════════════════════════════════

  TREND  ▂▆▁▂▇▁  Active: ~10h  Commits: 43  Features: 16

  📅 Thu Nov 28 ─────────────────────────── 68% MEDIUM
     3 sessions, 13 commits, 0 spirals, +95 XP
     ✓ feat: initial CLI (12:09-13:56, 1h 47m)
     ○ ML detour begins (17:07)

  📅 Fri Nov 29 ─────────────────────────── 87% ELITE 🏆
     4 sessions, 26 commits, 0 spirals, +185 XP
     ✗ ML deleted (15:35, -1,563 lines)
     ⚡ Post-delete sprint: 5 features in 1h 58m
     ✓ v1.5.0 shipped (17:33)

  📅 Sat Nov 30 ─────────────────────────── 84% HIGH
     1 session, 3 commits, 0 spirals, +40 XP
     ✓ Test cleanup + retrospective

════════════════════════════════════════════════════════════════
  INSIGHTS

  ⚡ Post-delete sprint: 2.3× faster after removing ML
  🚧 ML Detour: 2h 24m building, deleted 21h later
  🌊 Flow states: 3 detected (avg 82 min)

  💡 Recommendation: Trust simplification impulses
════════════════════════════════════════════════════════════════
```

### Symbols
- `●` feat commit
- `◆` shipped version
- `○` milestone/other
- `✗` deleted code
- `✓` clean work
- `⚠` spiral warning

### Color Scheme (Match Existing)
- **Green:** ELITE, flow states, clean sessions
- **Cyan:** Headers, borders, structure
- **Yellow:** MEDIUM, warnings, spirals
- **Red:** LOW, deletions, problems
- **Gray:** Metadata, timestamps, hints
- **Magenta:** Patterns, insights

---

## Data Schema

```typescript
interface TimelineEvent {
  // Git data
  hash: string;
  timestamp: Date;
  author: string;
  subject: string;
  type: CommitType;
  scope: string | null;

  // Change metrics
  filesChanged: number;
  insertions: number;
  deletions: number;
  netChange: number;

  // Session context
  sessionId: string;
  sessionPosition: number;
  gapMinutes: number;

  // Pattern flags
  isRefactor: boolean;
  isLargeFeature: boolean;
  spiralDepth: number;
  isAiAssisted: boolean;
}

interface TimelineSession {
  id: string;
  start: Date;
  end: Date;
  duration: number;
  commits: TimelineEvent[];

  // Metrics
  vibeScore: number;
  overall: Rating;
  trustPassRate: number;
  reworkRatio: number;

  // Patterns detected
  flowState: boolean;
  spirals: FixChain[];
  thrashing: ThrashingPattern[];

  // Gamification
  xpEarned: number;
  achievements: string[];
}

interface TimelineDay {
  date: string;
  sessions: TimelineSession[];
  dayScore: number;
  dayRating: Rating;

  // Aggregates
  totalCommits: number;
  totalDuration: number;
  totalXp: number;
}
```

---

## Implementation Plan

### Phase 1: Core Timeline (MVP)
- [ ] `vibe-check timeline` command
- [ ] Session detection (1-hour gap)
- [ ] Day grouping
- [ ] Hybrid format output
- [ ] Basic flags: --since, --until, --expand

**Files:**
- `src/commands/timeline.ts`
- `src/output/timeline.ts`

### Phase 2: Pattern Detection
- [ ] Flow state detection
- [ ] Post-delete sprint detection
- [ ] Thrashing detection
- [ ] Enhanced git stats (file changes)

**Files:**
- `src/patterns/flow-state.ts`
- `src/patterns/post-delete-sprint.ts`
- `src/patterns/thrashing.ts`
- `src/git.ts` (extend for stats)

### Phase 3: Insights Engine
- [ ] Detour detection (add → delete tracking)
- [ ] Late night spiral detection
- [ ] Automatic recommendations
- [ ] Pattern trend analysis

**Files:**
- `src/patterns/detour.ts`
- `src/patterns/late-night.ts`
- `src/insights/recommendations.ts`

### Phase 4: Export & Integration
- [ ] JSON export
- [ ] Markdown export
- [ ] HTML export (shareable)
- [ ] Dashboard integration

**Files:**
- `src/output/timeline-json.ts`
- `src/output/timeline-markdown.ts`
- `dashboard/timeline.html`

---

## CLI Interface

```bash
# Basic usage
vibe-check timeline                    # Last 7 days
vibe-check timeline --since "1 month"  # Custom range

# Filtering
vibe-check timeline --filter spirals   # Only sessions with spirals
vibe-check timeline --filter feat      # Only feat commits
vibe-check timeline --min-score 80     # Only HIGH/ELITE

# Expansion
vibe-check timeline --expand           # Show all details
vibe-check timeline --expand Nov-29    # Expand specific day

# Export
vibe-check timeline --output report.json
vibe-check timeline --output report.md
vibe-check timeline --share            # Generate shareable HTML
```

---

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Adoption | 30% of users run weekly | Analytics |
| Insight discovery | "Didn't know I did X" | User feedback |
| Behavior change | Spiral duration decreases | Pre/post comparison |
| Sharing | Timeline screenshots shared | Social tracking |

---

## Key Insights for Implementation

1. **Session Detection:** 1-hour gap is optimal (69% of gaps <30m, 19% >1hr)

2. **Time-of-Day:** Peak productivity 12pm-2pm (42% of commits) - could add "best hours" insight

3. **Commit Types:** 37% feat, 21% docs, 9% fix - healthy ratio, sessions with 5+ commits show type mixing

4. **AI Attribution:** 100% of commits have AI footer - could track AI-assisted vs manual

5. **Post-Delete Pattern:** Real example shows 5 features in 1h 58m after deleting 1,563 lines - this is the killer insight

---

## Ready for Implementation

This research provides everything needed to build the timeline feature. The hybrid format balances overview + detail, the pattern detection adds unique value, and the export formats enable sharing.

**Next step:** `/implement timeline-feature-research-complete-2025-11-30.md`
