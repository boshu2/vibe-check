# Feature: vibe-check timeline

**Type:** Plan
**Created:** 2025-11-30
**Priority:** High (core feature alignment)

---

## Vision

Add a `vibe-check timeline` command that visualizes your entire coding history - sessions, commits, features shipped, and detours. This is the essence of what vibe-check is: understanding your patterns at a glance.

---

## The Problem

Right now vibe-check tells you:
- Current session metrics
- Your profile/streaks/XP
- Individual spiral detection

But it doesn't show the **big picture**:
- How long did this project actually take?
- Where did I spend time vs. where did I waste time?
- What was the rhythm of productive vs. stuck sessions?

---

## Proposed Command

```bash
vibe-check timeline [--since <date>] [--format <terminal|json|html>]
```

### Terminal Output (Default)

```
═══════════════════════════════════════════════════════════════════════════════
                         PROJECT TIMELINE: vibe-check
═══════════════════════════════════════════════════════════════════════════════

Day 1 │ Thu Nov 28                                            4h 11m │ 13 commits
──────┼────────────────────────────────────────────────────────────────────────
 12:09│ ● feat: initial vibe-check CLI                                   │ 1h 47m
 13:56│ ◆ v1.0.2 shipped                                                 │
 17:07│ ○ ML research begins                                             │ 57m
 18:04│ ● feat: ML learning loop                                         │
 20:58│ ◆ v2.0.0 shipped (ML)                                           │ 1h 27m
 22:25│ ● test: ML unit tests                                            │

Day 2 │ Fri Nov 29                                            5h 49m │ 26 commits
──────┼────────────────────────────────────────────────────────────────────────
 10:25│ ● feat: gamification (XP, streaks, achievements)                 │ ~15m
 11:55│ ● feat: GitHub Action + hooks                                    │ 1h 48m
 15:35│ ✗ DELETED: ML (1,563 lines)                                      │
 15:46│ ● feat: watch mode                                               │ 11m
 16:01│ ● feat: baseline comparison                                      │ 15m
 16:25│ ● feat: pattern memory                                           │ 24m
 16:45│ ● feat: interventions                                            │ 20m
 17:33│ ◆ v1.5.0 shipped                                                 │

Day 3 │ Sat Nov 30                                            43m │ 3 commits
──────┼────────────────────────────────────────────────────────────────────────
 08:21│ ● test: cleanup                                                  │ 43m
 09:04│ ○ retrospective                                                  │

═══════════════════════════════════════════════════════════════════════════════

SUMMARY
───────────────────────────────────────────────────────────────────────────────
  Active time:    ~10 hours across 3 days
  Wall clock:     45 hours (Thu 12:09 → Sat 09:04)
  Commits:        43 total (37% feat, 21% docs, 14% chore, 9% test, 9% fix)
  Features:       16 shipped
  Deleted:        1,563 lines (ML detour)

PATTERNS DETECTED
───────────────────────────────────────────────────────────────────────────────
  ⚡ Post-delete sprint: 5 features in 1h 58m after removing ML
  📉 ML detour: 2h 24m building, 21h 31m before deletion
  ✓ No debug spirals detected
```

### Symbols

- `●` feat commit
- `◆` shipped version (git tag or version bump)
- `○` milestone/docs/other
- `✗` deleted code / major refactor

---

## Technical Implementation

### Session Detection Algorithm

```typescript
interface Session {
  start: Date;
  end: Date;
  duration: number;  // minutes
  commits: Commit[];
  features: string[];  // feat commit messages
  deletions: number;   // lines removed
  rating: Rating;
}

function detectSessions(commits: Commit[], gapThreshold = 60): Session[] {
  // Group commits into sessions (1hr gap = new session)
  // Calculate duration from first to last commit
  // Minimum 15min for single-commit sessions (thinking time)
}
```

### Data Sources

1. **Git log** - commits, timestamps, messages
2. **Git diff stats** - lines added/removed per commit
3. **Git tags** - version releases
4. **Profile data** - historical sessions (if available)

### Output Formats

| Format | Use Case |
|--------|----------|
| `terminal` | Interactive viewing (default) |
| `json` | CI/CD integration, dashboards |
| `html` | Export for sharing, blog posts |
| `markdown` | Documentation, READMEs |

---

## Phase 1: Core Timeline

**Deliverables:**
- [ ] `vibe-check timeline` command
- [ ] Session detection algorithm
- [ ] Terminal output with day grouping
- [ ] Commit type symbols
- [ ] Duration calculations

**Metrics:**
- Active time vs wall clock time
- Commits per session
- Commit type breakdown

---

## Phase 2: Insights

**Deliverables:**
- [ ] Pattern detection (post-delete sprints, detours)
- [ ] Deleted code tracking
- [ ] Version/release markers
- [ ] Session rating overlay

---

## Phase 3: Export Formats

**Deliverables:**
- [ ] JSON output for dashboards
- [ ] HTML export for sharing
- [ ] Markdown for documentation
- [ ] Integration with `vibe-check profile --timeline`

---

## Why This Matters

This feature turns vibe-check from a "point-in-time" tool into a **retrospective** tool. It answers:

1. **"How long did this actually take?"** - Real active time, not wall clock
2. **"Where did I waste time?"** - Detours and deleted code highlighted
3. **"What was my rhythm?"** - Session patterns visible
4. **"Did I improve?"** - Compare project starts to finishes

The timeline is the artifact you look at after shipping to understand your process.

---

## Example Use Cases

1. **Blog post generation** - Export timeline for "how I built X" posts
2. **Retrospectives** - Team review of project development patterns
3. **Time tracking** - Accurate active development time (not estimates)
4. **Learning** - See your own productivity patterns over time

---

## Ready to Implement

Approve this plan, then `/implement` Phase 1.
