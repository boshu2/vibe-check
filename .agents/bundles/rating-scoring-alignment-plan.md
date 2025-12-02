# Rating/Scoring Alignment Implementation Plan

**Type:** Plan
**Created:** 2025-11-30
**Depends On:** In-session analysis
**Loop:** Middle (bridges research to implementation)
**Tags:** scoring, dashboard, UX, metrics

---

## Overview

The dashboard currently has two scoring systems that measure different things:
1. **vibeScore (0-100%)** - Pattern-based from semantic-free metrics
2. **Metric-based overall rating** - Quality-based from 5 semantic metrics

The current quick fix aligned badges to vibeScore, but the metric-based rating may be a better predictor of coding health. This plan implements a dual-display approach that shows both meaningfully.

## Problem Analysis

### What vibeScore Measures (Pattern Health)
- `fileChurn`: Files touched repeatedly (instability signal)
- `timeSpiral`: Commit timing patterns (spiral detection)
- `velocityAnomaly`: Deviation from your baseline velocity
- `codeStability`: Lines surviving vs deleted (thrashing)

**Good for:** Detecting workflow patterns, identifying when you're struggling

### What Metric Rating Measures (Code Quality)
- `iterationVelocity`: Commits/hour (momentum)
- `reworkRatio`: % fix commits (building vs debugging)
- `trustPassRate`: % commits that stick (code quality)
- `debugSpiralDuration`: Time stuck in fix chains
- `flowEfficiency`: % time productive

**Good for:** Measuring actual coding effectiveness, quality outcomes

### Recommendation

**Show both** with clear labels. The metric-based rating is the better "grade" because it directly measures outcomes (did code stick? were you building or fixing?). The vibeScore is a supporting indicator.

---

## Approach Selected

**Option 3: Show both scores with distinct meanings**

- Primary: **Code Health** (metric-based) - the "grade"
- Secondary: **Pattern Score** (vibeScore) - the "trend indicator"

**Rationale:**
- Metric rating directly measures what matters (code quality, productivity)
- vibeScore catches patterns the metrics might miss
- Users get complete picture without confusion

---

## Files to Modify

### 1. `src/commands/analyze.ts:37-42`

**Purpose:** Revert to using metric-based rating for session recording (the quality grade)

**Before:**
```typescript
/**
 * Derive rating from vibeScore percentage to ensure badge matches displayed score
 */
function vibeScoreToRating(scorePercent: number): OverallRating {
  if (scorePercent >= 85) return 'ELITE';
  if (scorePercent >= 70) return 'HIGH';
  if (scorePercent >= 50) return 'MEDIUM';
  return 'LOW';
}
```

**After:**
```typescript
// REMOVED - using metric-based rating as primary quality indicator
// vibeScore is secondary pattern indicator
```

**Also revert lines 329-333:**

**Before:**
```typescript
      // Use score-based rating so badge matches displayed percentage
      const scoreBasedRating = vibeScoreToRating(vibeScorePercent);
      const gamificationResult = recordGamificationSession(
        vibeScorePercent,
        scoreBasedRating,
```

**After:**
```typescript
      // Use metric-based rating as primary quality indicator
      const gamificationResult = recordGamificationSession(
        vibeScorePercent,
        result.overall,  // Metric-based rating (quality grade)
```

**Validation:** `npm run build` passes

---

### 2. `src/insights/index.ts:23-31`

**Purpose:** Remove vibeScoreToRating helper (no longer needed in dashboard builder)

**Before:**
```typescript
import { Commit, OverallRating } from '../types';

/**
 * Derive rating from vibeScore percentage to ensure badge matches displayed score
 */
function vibeScoreToRating(scorePercent: number): OverallRating {
  if (scorePercent >= 85) return 'ELITE';
  if (scorePercent >= 70) return 'HIGH';
  if (scorePercent >= 50) return 'MEDIUM';
  return 'LOW';
}
```

**After:**
```typescript
import { Commit } from '../types';
```

---

### 3. `src/insights/index.ts:97-102`

**Purpose:** Revert rating distribution to use stored metric-based ratings

**Before:**
```typescript
  // Rating distribution (recalculate from vibeScore to ensure consistency)
  const ratingDistribution: Record<string, number> = { ELITE: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
  for (const s of sessions) {
    const rating = vibeScoreToRating(s.vibeScore);
    ratingDistribution[rating] = (ratingDistribution[rating] || 0) + 1;
  }
```

**After:**
```typescript
  // Rating distribution from metric-based quality grades
  const ratingDistribution: Record<string, number> = { ELITE: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
  for (const s of sessions) {
    ratingDistribution[s.overall] = (ratingDistribution[s.overall] || 0) + 1;
  }
```

---

### 4. `src/insights/index.ts:129-135`

**Purpose:** Revert scoreTrend to use stored metric-based ratings

**Before:**
```typescript
  // Score trend (last 30 sessions, oldest first for chart)
  // Recalculate rating from vibeScore to ensure badge matches score
  const scoreTrend = sessions.slice(-30).map(s => ({
    date: s.date,
    score: s.vibeScore,
    rating: vibeScoreToRating(s.vibeScore),
  }));
```

**After:**
```typescript
  // Score trend (last 30 sessions, oldest first for chart)
  const scoreTrend = sessions.slice(-30).map(s => ({
    date: s.date,
    score: s.vibeScore,
    rating: s.overall,  // Metric-based quality grade
  }));
```

---

### 5. `src/insights/index.ts:188-192`

**Purpose:** Revert current stats to use stored metric-based rating

**Before:**
```typescript
    stats: {
      current: {
        vibeScore: latestSession?.vibeScore || 0,
        rating: latestSession ? vibeScoreToRating(latestSession.vibeScore) : 'N/A',
      },
```

**After:**
```typescript
    stats: {
      current: {
        vibeScore: latestSession?.vibeScore || 0,
        rating: latestSession?.overall || 'N/A',  // Metric-based quality grade
      },
```

---

### 6. `src/insights/index.ts:216-224`

**Purpose:** Revert sessions mapping to use stored metric-based ratings

**Before:**
```typescript
    sessions: sessions.slice(-50).reverse().map(s => ({
      date: s.date,
      vibeScore: s.vibeScore,
      rating: vibeScoreToRating(s.vibeScore),  // Recalculate from score
      commits: s.commits,
      spirals: s.spirals,
      xpEarned: s.xpEarned,
      metrics: s.metrics || null,  // Include detailed metrics if available
    })),
```

**After:**
```typescript
    sessions: sessions.slice(-50).reverse().map(s => ({
      date: s.date,
      vibeScore: s.vibeScore,
      rating: s.overall,  // Metric-based quality grade
      commits: s.commits,
      spirals: s.spirals,
      xpEarned: s.xpEarned,
      metrics: s.metrics || null,  // Include detailed metrics if available
    })),
```

---

### 7. `dashboard/index.html:92-100`

**Purpose:** Clarify what each score means in the UI

**Before:**
```html
                    <div class="stat-card highlight">
                        <div class="stat-icon">🎯</div>
                        <div class="stat-content">
                            <span class="stat-value" id="currentScore">--</span>
                            <span class="stat-label">Current Vibe Score</span>
                            <span class="stat-hint" title="Code pattern health (0-100%)">Pattern Health</span>
                        </div>
                    </div>
```

**After:**
```html
                    <div class="stat-card highlight">
                        <div class="stat-icon">🎯</div>
                        <div class="stat-content">
                            <span class="stat-value" id="currentScore">--</span>
                            <span class="stat-label">Pattern Score</span>
                            <span class="stat-hint" title="Workflow pattern health (file churn, spirals, stability)">Workflow Patterns</span>
                        </div>
                    </div>
```

---

### 8. `dashboard/index.html` (after line 121, before stats-grid closing div)

**Purpose:** Add Code Health rating card to show metric-based grade

**Insert:**
```html
                    <div class="stat-card">
                        <div class="stat-icon">⚡</div>
                        <div class="stat-content">
                            <span class="stat-value rating-badge" id="codeHealthRating">--</span>
                            <span class="stat-label">Code Health</span>
                            <span class="stat-hint" title="Quality grade from velocity, trust, rework, flow metrics">Quality Grade</span>
                        </div>
                    </div>
```

---

### 9. `dashboard/app.js` - updateStats function

**Purpose:** Populate the new Code Health rating display

**Find the updateStats function and add after currentScore update:**

```javascript
    // Code Health rating (metric-based quality grade)
    const codeHealthEl = document.getElementById('codeHealthRating');
    if (codeHealthEl && stats.current.rating) {
      codeHealthEl.textContent = stats.current.rating;
      codeHealthEl.className = 'stat-value rating-badge rating-' + stats.current.rating.toLowerCase();
    }
```

---

### 10. `dashboard/styles.css`

**Purpose:** Style the rating badge in stats card

**Add:**
```css
/* Rating badge in stats card */
.stat-value.rating-badge {
  font-size: 1.25rem;
  font-weight: 700;
  padding: 4px 12px;
  border-radius: 6px;
}

.rating-badge.rating-elite {
  background: linear-gradient(135deg, #fbbf24, #f59e0b);
  color: #1a1a2e;
}

.rating-badge.rating-high {
  background: linear-gradient(135deg, #34d399, #10b981);
  color: #1a1a2e;
}

.rating-badge.rating-medium {
  background: linear-gradient(135deg, #60a5fa, #3b82f6);
  color: white;
}

.rating-badge.rating-low {
  background: linear-gradient(135deg, #f87171, #ef4444);
  color: white;
}
```

---

## Implementation Order

**CRITICAL: Sequence matters. Do not reorder.**

| Step | Action | Validation | Rollback |
|------|--------|------------|----------|
| 1 | Revert analyze.ts changes | `npm run build` | git checkout |
| 2 | Revert insights/index.ts changes | `npm run build` | git checkout |
| 3 | Update index.html stat cards | Visual check | git checkout |
| 4 | Update app.js for new element | Browser console | git checkout |
| 5 | Add CSS styles | Visual check | git checkout |
| 6 | Regenerate dashboard | `node dist/cli.js dashboard` | N/A |
| 7 | Full verification | Visual inspection | Revert all |

---

## Validation Strategy

### Build Validation
```bash
npm run build
# Expected: No errors
```

### Dashboard Generation
```bash
node dist/cli.js dashboard
# Expected: Opens dashboard with both scores visible
```

### Visual Validation
- Pattern Score shows percentage (e.g., "79%")
- Code Health shows rating badge (e.g., "ELITE" or "HIGH")
- Session list shows metric-based ratings
- Ratings now reflect actual code quality metrics

---

## Rollback Procedure

**Time to rollback:** 2 minutes

```bash
# Full rollback
git checkout -- src/commands/analyze.ts src/insights/index.ts dashboard/
npm run build
```

---

## Risk Assessment

### Low Risk
- **What:** UI changes only, no data loss
- **Mitigation:** Simple git revert available
- **Detection:** Visual inspection
- **Recovery:** git checkout

---

## Approval Checklist

**Human must verify before /implement:**

- [ ] Agree that metric-based rating is better "quality grade"
- [ ] Agree that vibeScore is useful as "pattern indicator"
- [ ] Approve showing both with distinct labels
- [ ] Approve reverting quick fix changes

---

## Alternative: Simpler Approach

If you prefer NOT to show both, we could instead:

**Option A: Just add labels to current approach**
- Keep vibeScore-based rating
- Relabel as "Pattern Grade"
- Minimal changes

**Option B: Just use metric rating everywhere**
- Revert all vibeScore-to-rating changes
- Accept that number and badge may differ
- Add tooltip explaining the difference

Let me know which approach you prefer before implementation.
