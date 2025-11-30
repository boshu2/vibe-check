# Storage Enhancement Research: Utilizing NDJSON for vibe-check Mission

**Type:** Research Synthesis
**Created:** 2025-11-30
**Agents:** 3 parallel (Landscape, Patterns, Constraints)
**Status:** Complete

---

## Executive Summary

The new storage layer (atomic.ts, commit-log.ts, schema.ts) transforms vibe-check from **point-in-time analysis** to **longitudinal productivity intelligence**. This research identifies 12 enhancement opportunities, prioritized by effort/impact, with immediate fixes for security gaps.

**Key Finding:** NDJSON enables complete event history that unlocks cross-session queries, regression detection, and predictive insights—all while maintaining git-friendly diffs.

---

## Current Architecture (Agent 1)

### Storage Locations

| Location | Purpose | Format |
|----------|---------|--------|
| `~/.vibe-check/profile.json` | XP, streaks, achievements | JSON |
| `.vibe-check/timeline.json` | Sessions, insights, trends | JSON |
| `.vibe-check/commits.ndjson` | Append-only commit log (NEW) | NDJSON |
| `.vibe-check/sessions.json` | Auto-detected sessions | JSON |
| `.vibe-check/calibration.json` | Level calibration | JSON |

### Data Flow

```
Git commits → getCommits() → buildTimeline() → updateStore() → timeline.json
                   ↓                ↓
              detectSessions()   detectPatterns()
                   ↓                ↓
              TimelineSession[]  flowState, spirals, detours, thrashing
                   ↓
              recordSession() → profile.json (XP, achievements)
```

### 7 Commands & Their Data Needs

| Command | Reads | Writes | Storage Gap |
|---------|-------|--------|-------------|
| `analyze` | git, latest.json | profile, sessions, latest | No commit log integration |
| `timeline` | git, timeline.json | timeline.json | ✓ Uses new storage |
| `profile` | profile.json | - | No cross-repo aggregation |
| `start` | session.json | session.json | - |
| `watch` | git (in-memory) | - | **No persistence** |
| `intervene` | profile.json | profile.json | - |
| `init-hook` | - | .git/hooks | No execution history |

---

## Enhancement Opportunities (Agent 2)

### Priority Matrix

| # | Opportunity | Effort | Impact | Priority |
|---|-------------|--------|--------|----------|
| 1 | Multi-session queries | Medium | High | **P0** |
| 2 | Spiral regression detection | High | High | **P0** |
| 3 | Scope-based analysis | High | High | **P0** |
| 4 | Intervention effectiveness | Medium | High | **P0** |
| 5 | Recovery time trends | Medium | High | **P0** |
| 6 | Commitment validation | Medium | Medium | P1 |
| 7 | Hourly/daily rollups | Medium | Medium | P1 |
| 8 | Productivity evolution | Low | Medium | P1 |
| 9 | Seasonal patterns | Medium | Medium | P1 |
| 10 | Session clustering | High | Medium | P2 |
| 11 | Spiral prediction | Very High | Medium | P2 |
| 12 | Multi-repo aggregation | Very High | High | P3 |

### Top 5 Enhancements (P0)

#### 1. Multi-Session Queries
**What:** Query all commits.ndjson to answer:
- "Which scope has most spirals?"
- "What's my spiral rate by hour?"
- "Average session length by day of week?"

**Implementation:**
```typescript
// src/analysis/cross-session-analysis.ts
export function queryCommits(commits: Commit[], filter: QueryFilter): Commit[]
```

**Integration:** Add `--all-time` flag to `analyze` command

#### 2. Spiral Regression Detection
**What:** Alert when spiral patterns re-emerge after improvement.

**Example:**
- Week 1-4: 2 spirals/week
- Week 5-8: 0.5 spirals/week (improvement!)
- Week 9: 3 spirals/week → **ALERT: Regression detected**

**Implementation:**
```typescript
// src/patterns/spiral-regression.ts
export function detectRegressions(trends: TrendData): RegressionAlert[]
```

#### 3. Scope-Based Analysis
**What:** Track productivity per code scope (auth, database, ui).

**Output:**
```
Scope: auth
  Commits: 156 (12% of total)
  Spirals: 8 (0.051 per commit)
  Avg fix time: 34 minutes
  Top pattern: SECRETS_AUTH (5x)
```

#### 4. Intervention Effectiveness
**What:** Score each intervention by how well it breaks spirals.

**Output:**
```
Tracer tests: 8/10 effective (80%) | 12 min resolution
Taking a break: 4/6 effective (67%) | 18 min resolution
```

#### 5. Recovery Time Trends
**What:** Track if recovery time per spiral type is improving.

**Insight:** "SSL/TLS spirals: 45 min → 32 min → 28 min. Keep it up!"

---

## Constraints & Risks (Agent 3)

### Critical Issues (Fix Now)

| Issue | Severity | Fix |
|-------|----------|-----|
| **No .gitignore enforcement** | HIGH | Create on first run |
| **Schema version hardcoded** | MEDIUM | Use CURRENT_SCHEMA_VERSION |
| **NDJSON bad line fails all** | MEDIUM | Skip bad lines gracefully |
| **--insights undocumented** | LOW | Add to help text |

### Technical Constraints

| Constraint | Current | Risk |
|------------|---------|------|
| File size (1 year) | ~500 KB | GREEN |
| File size (10 years) | ~5 MB | YELLOW |
| Read performance | O(n) | GREEN (<20ms for 10K lines) |
| Duplicate detection | O(n) per append | YELLOW (acceptable) |
| Windows atomic rename | Not guaranteed | LOW |

### Privacy Concerns

**Sensitive data stored:**
- Work timing patterns (when you code)
- Component names (architecture leak)
- Author names (in commit-log)
- Productivity metrics (embarrassing if shared)

**Recommendation:**
1. Enforce `.gitignore` on first run
2. Add `vibe-check cache clear` command
3. Document data sensitivity

---

## Recommended Implementation Path

### Phase 1: Hardening (v1.5.1) - This Week

```
[ ] Fix .gitignore enforcement
[ ] Fix schema versioning
[ ] Improve NDJSON error handling
[ ] Document --insights and --no-cache
```

**Files to modify:**
- `src/storage/timeline-store.ts` (schema version)
- `src/storage/atomic.ts` (NDJSON error handling)
- `src/commands/timeline.ts` (help text)

### Phase 2: Query Foundation (v1.6.0) - Next Week

```
[ ] Create src/analysis/cross-session-analysis.ts
[ ] Add vibe-check analyze --all-time
[ ] Add vibe-check analyze --scope <scope>
[ ] Add vibe-check cache status/clear
```

### Phase 3: Intelligence (v1.7.0)

```
[ ] Spiral regression detection
[ ] Intervention effectiveness scoring
[ ] Recovery time trend tracking
[ ] Scope health reports
```

### Phase 4: Advanced Analytics (v2.0.0)

```
[ ] Seasonal pattern detection
[ ] Productivity evolution index
[ ] Session clustering
[ ] Predictive spiral warnings
```

---

## Integration Points

### Where New Features Fit

| Feature | File | Function |
|---------|------|----------|
| Cross-session queries | NEW: `src/analysis/cross-session-analysis.ts` | `queryCommits()` |
| Regression detection | NEW: `src/patterns/spiral-regression.ts` | `detectRegressions()` |
| Scope analysis | NEW: `src/analysis/scope-analysis.ts` | `analyzeScopeHealth()` |
| Rollups | NEW: `src/storage/rollups.ts` | `computeDailyRollup()` |
| Cache commands | NEW: `src/commands/cache.ts` | `clear()`, `status()` |

### Existing Code to Leverage

| Existing | Location | Reuse For |
|----------|----------|-----------|
| Pattern memory | `src/gamification/pattern-memory.ts` | Regression detection |
| Intervention memory | `src/gamification/intervention-memory.ts` | Effectiveness scoring |
| Trend data | `src/storage/timeline-store.ts` | Seasonal analysis |
| Session detection | `src/commands/timeline.ts` | Clustering |

---

## NDJSON Power Unlocks

### Before (Point-in-Time)
- Single `vibe-check timeline` run
- Limited to last 500 sessions
- Can't answer "How am I trending?"

### After (Longitudinal)
- Complete event history (never lost)
- Query all time: "Show me all auth spirals ever"
- Trends automatic: week-over-week comparison
- Insights emerge: regression detection, commitment tracking
- Foundation for team analytics: multi-repo aggregation

---

## Key Metrics Enabled

| Metric | Data Source | Value |
|--------|-------------|-------|
| Spiral rate by scope | commits.ndjson | Find architectural weak spots |
| Recovery time trend | pattern-memory | Track improvement |
| Intervention effectiveness | intervention-memory | Data-driven recommendations |
| Seasonal patterns | commits.ndjson timestamps | Schedule deep work |
| Regression alerts | weekly trends | Early warning system |

---

## Quick Wins (< 1 Hour Each)

1. **Fix schema version** - 5 min
2. **Add NDJSON error recovery** - 15 min
3. **Document --insights flag** - 5 min
4. **Add .gitignore check** - 20 min
5. **Add cache status command** - 30 min

---

## Next Steps

1. **Implement Phase 1 fixes** (hardening)
2. **Create cross-session-analysis.ts** (query foundation)
3. **Add --scope flag to analyze** (scope analysis)
4. **Build regression detection** (intelligence layer)

---

## Files for Reference

| Category | Files |
|----------|-------|
| New Storage | `src/storage/atomic.ts`, `commit-log.ts`, `schema.ts` |
| Timeline | `src/storage/timeline-store.ts`, `src/commands/timeline.ts` |
| Patterns | `src/patterns/*.ts` (6 detectors) |
| Gamification | `src/gamification/pattern-memory.ts`, `intervention-memory.ts` |
| Documentation | `docs/DATA-ARCHITECTURE.md`, `docs/JSON-STORAGE-PATTERNS.md` |
