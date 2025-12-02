# Dashboard Data Quality Fixes - Implementation Plan

**Type:** Plan
**Created:** 2025-11-30
**Loop:** Middle (bridges analysis to implementation)
**Tags:** dashboard, data-quality, metrics, rating

---

## Overview

Fix data quality issues in vibe-check dashboard:
1. **Rating system mismatch** - ELITE rating shows for low scores (63%)
2. **Mock data in visualizations** - Radar chart uses hardcoded values
3. **Missing metric context** - Session records don't store actual metrics

## Root Cause Analysis

### Issue 1: Rating vs Score Disconnect

**Finding:** The `overall` rating (ELITE/HIGH/MEDIUM/LOW) is calculated from **metric ratings**, not the vibeScore percentage.

```typescript
// src/metrics/index.ts:96-111
function calculateOverallRating(ratings: Rating[]): OverallRating {
  const scores = { elite: 4, high: 3, medium: 2, low: 1 };
  const avgScore = ratings.reduce((sum, r) => sum + scores[r], 0) / ratings.length;

  if (avgScore >= 3.5) return 'ELITE';  // 5 metrics averaging 3.5+
  // ...
}
```

Meanwhile, `vibeScore` is calculated separately from semantic-free metrics (fileChurn, timeSpiral, etc.).

**Result:** A session can have vibeScore=63% but rating=ELITE if the individual metric ratings (velocity, rework, trust, spirals, flow) all score well.

**Decision:** This is actually **correct by design**. The vibeScore is a different measure than the overall rating. The issue is **display confusion** - we should clarify this in the UI.

### Issue 2: Mock Data in Radar Chart

**Finding:** The main radar chart in `app.js:380-391` uses hardcoded mock data:
```javascript
data: [92, 78, 85, 88, 95],  // NOT REAL DATA
```

And the session detail modal calculates fake metrics:
```javascript
const velocity = Math.round(session.commits / 2); // fake
const trustRate = Math.max(0, 100 - (session.spirals * 10)); // fake
```

**Solution:** We need to either:
1. Store real metrics in SessionRecord (schema change)
2. Re-calculate metrics from commits when building dashboard data

Option 2 is simpler and maintains backward compatibility.

### Issue 3: Session Record Missing Metrics

**Finding:** `SessionRecord` in types stores minimal data:
```typescript
interface SessionRecord {
  vibeScore: number;
  overall: string;
  commits: number;
  spirals: number;
  xpEarned: number;
  // NO: iterationVelocity, reworkRatio, trustPassRate, flowEfficiency
}
```

**Solution:** Enhance SessionRecord to include metrics, and update dashboard to use them.

---

## Implementation Plan

### Phase 1: Enhance SessionRecord (Store Real Metrics)

#### File: `src/gamification/types.ts:38-49`

**Before:**
```typescript
export interface SessionRecord {
  date: string;
  timestamp: string;
  vibeScore: number;
  overall: 'ELITE' | 'HIGH' | 'MEDIUM' | 'LOW';
  commits: number;
  spirals: number;
  xpEarned: number;
  achievementsUnlocked: string[];
  periodFrom?: string;
  periodTo?: string;
}
```

**After:**
```typescript
export interface SessionRecord {
  date: string;
  timestamp: string;
  vibeScore: number;
  overall: 'ELITE' | 'HIGH' | 'MEDIUM' | 'LOW';
  commits: number;
  spirals: number;
  xpEarned: number;
  achievementsUnlocked: string[];
  periodFrom?: string;
  periodTo?: string;
  // NEW: Store actual metric values for dashboard
  metrics?: {
    iterationVelocity: number;  // commits/hour
    reworkRatio: number;        // % fix commits
    trustPassRate: number;      // % commits without immediate fix
    flowEfficiency: number;     // % time building vs debugging
    debugSpiralDuration: number; // avg minutes in spirals
  };
}
```

**Validation:** TypeScript compile, existing sessions still load (metrics optional)

---

### Phase 2: Record Metrics During Analysis

#### File: `src/gamification/profile.ts` - `recordSession` function

**Find the recordSession function and add metrics parameter.**

**Before (around line 130):**
```typescript
export function recordSession(
  vibeScore: number,
  overall: OverallRating,
  commits: number,
  spirals: number
): { profile: UserProfile; achievements: Achievement[] } {
```

**After:**
```typescript
export interface RecordSessionOptions {
  vibeScore: number;
  overall: OverallRating;
  commits: number;
  spirals: number;
  metrics?: {
    iterationVelocity: number;
    reworkRatio: number;
    trustPassRate: number;
    flowEfficiency: number;
    debugSpiralDuration: number;
  };
  periodFrom?: string;
  periodTo?: string;
}

export function recordSession(
  options: RecordSessionOptions
): { profile: UserProfile; achievements: Achievement[] } {
```

**Then update the session creation to include metrics.**

---

### Phase 3: Pass Metrics from Analyze Command

#### File: `src/commands/analyze.ts` - around line 240

**Find where recordGamificationSession is called and pass metrics.**

**Before:**
```typescript
recordGamificationSession(
  Math.round(vibeScoreValue * 100),
  result.overall,
  commits.length,
  spiralCount
);
```

**After:**
```typescript
recordGamificationSession({
  vibeScore: Math.round(vibeScoreValue * 100),
  overall: result.overall,
  commits: commits.length,
  spirals: spiralCount,
  metrics: {
    iterationVelocity: result.metrics.iterationVelocity.value,
    reworkRatio: result.metrics.reworkRatio.value,
    trustPassRate: result.metrics.trustPassRate.value,
    flowEfficiency: result.metrics.flowEfficiency.value,
    debugSpiralDuration: result.metrics.debugSpiralDuration.value,
  },
  periodFrom: result.period.from.toISOString(),
  periodTo: result.period.to.toISOString(),
});
```

---

### Phase 4: Update Dashboard Data Builder

#### File: `src/insights/index.ts` - `buildDashboardData` function

**Update sessions mapping to include metrics (around line 192):**

**Before:**
```typescript
sessions: sessions.slice(-50).reverse().map(s => ({
  date: s.date,
  vibeScore: s.vibeScore,
  rating: s.overall,
  commits: s.commits,
  spirals: s.spirals,
  xpEarned: s.xpEarned,
})),
```

**After:**
```typescript
sessions: sessions.slice(-50).reverse().map(s => ({
  date: s.date,
  vibeScore: s.vibeScore,
  rating: s.overall,
  commits: s.commits,
  spirals: s.spirals,
  xpEarned: s.xpEarned,
  metrics: s.metrics || null,
})),
```

**Also add aggregate metrics for the main radar chart:**

```typescript
// Calculate average metrics from recent sessions
const recentWithMetrics = sessions.filter(s => s.metrics).slice(-10);
const avgMetrics = recentWithMetrics.length > 0 ? {
  iterationVelocity: avg(recentWithMetrics.map(s => s.metrics!.iterationVelocity)),
  reworkRatio: avg(recentWithMetrics.map(s => s.metrics!.reworkRatio)),
  trustPassRate: avg(recentWithMetrics.map(s => s.metrics!.trustPassRate)),
  flowEfficiency: avg(recentWithMetrics.map(s => s.metrics!.flowEfficiency)),
  debugSpiralDuration: avg(recentWithMetrics.map(s => s.metrics!.debugSpiralDuration)),
} : null;
```

Add to charts section:
```typescript
charts: {
  scoreTrend,
  ratingDistribution,
  hourlyActivity,
  scopeHealth,
  avgMetrics,  // NEW
},
```

---

### Phase 5: Update Dashboard UI to Use Real Metrics

#### File: `dashboard/app.js` - `initRadarChart` function (line 374)

**Before:**
```javascript
// Mock metrics data
this.charts.radar = new Chart(ctx, {
  type: 'radar',
  data: {
    labels: ['Trust Pass', 'Velocity', 'Flow', 'Stability', 'No Spirals'],
    datasets: [{
      label: 'Current',
      data: [92, 78, 85, 88, 95],  // HARDCODED
```

**After:**
```javascript
initRadarChart() {
  const canvas = document.getElementById('radarCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Use real metrics from dashboard data, or defaults
  const metrics = this.dashboardData?.charts?.avgMetrics;
  const data = metrics ? [
    Math.min(100, metrics.trustPassRate),
    Math.min(100, metrics.iterationVelocity * 10), // scale velocity to 0-100
    Math.min(100, metrics.flowEfficiency),
    Math.max(0, 100 - metrics.reworkRatio), // invert: lower rework = higher score
    Math.max(0, 100 - metrics.debugSpiralDuration * 2), // scale spirals
  ] : [80, 80, 80, 80, 80]; // default if no data

  this.charts.radar = new Chart(ctx, {
    // ...
    datasets: [{
      label: 'Average',
      data: data,
      // ...
    }]
  });
}
```

---

### Phase 6: Update Session Detail Modal

#### File: `dashboard/app.js` - `showSessionDetail` function (line 843)

**Before:**
```javascript
// Calculate derived metrics (mock values based on score)
const velocity = Math.round(session.commits / 2);
const trustRate = Math.max(0, 100 - (session.spirals * 10));
```

**After:**
```javascript
// Use real metrics if available, otherwise estimate
const metrics = session.metrics;
const velocity = metrics?.iterationVelocity?.toFixed(1) || `~${Math.round(session.commits / 2)}`;
const trustRate = metrics?.trustPassRate?.toFixed(0) || Math.max(0, 100 - (session.spirals * 10));
const reworkRatio = metrics?.reworkRatio?.toFixed(0) || '--';
const flowEff = metrics?.flowEfficiency?.toFixed(0) || '--';

document.getElementById('detailVelocity').textContent = `${velocity}/hr`;
document.getElementById('detailTrust').textContent = `${trustRate}%`;
```

---

### Phase 7: Add Clarification to UI

#### File: `dashboard/index.html` - Stats card section

Add tooltip or subtitle explaining the difference:

**Before:**
```html
<span class="stat-label">Current Vibe Score</span>
```

**After:**
```html
<span class="stat-label">Current Vibe Score</span>
<span class="stat-hint" title="Code pattern health (0-100%)">Pattern Score</span>
```

Add CSS for hint:
```css
.stat-hint {
  font-size: 0.625rem;
  color: var(--text-muted);
  display: block;
}
```

---

## Implementation Order

| Step | Action | Files | Validation |
|------|--------|-------|------------|
| 1 | Add metrics to SessionRecord type | `types.ts` | `npm run build` |
| 2 | Update recordSession signature | `profile.ts` | `npm run build` |
| 3 | Pass metrics from analyze | `analyze.ts` | `npm run build` |
| 4 | Update dashboard data builder | `insights/index.ts` | `npm run build` |
| 5 | Use real data in radar chart | `app.js` | Visual check |
| 6 | Use real data in session modal | `app.js` | Visual check |
| 7 | Add UI clarification | `index.html`, `styles.css` | Visual check |
| 8 | Full test | All | `vibe-check dashboard` |

---

## Rollback Procedure

All changes are additive (new optional fields). To rollback:

```bash
git checkout HEAD~1 -- src/gamification/types.ts
git checkout HEAD~1 -- src/gamification/profile.ts
git checkout HEAD~1 -- src/commands/analyze.ts
git checkout HEAD~1 -- src/insights/index.ts
git checkout HEAD~1 -- dashboard/app.js
npm run build
```

---

## Validation Strategy

### After Each Step
```bash
npm run build   # No TypeScript errors
npm test        # Tests still pass
```

### After All Steps
```bash
# Generate fresh dashboard data
node dist/cli.js dashboard --no-open

# Verify metrics are in output
cat dashboard/dashboard-data.json | grep -A5 '"metrics"'

# Open dashboard and verify:
# 1. Radar chart shows real values (not 92, 78, 85, 88, 95)
# 2. Session detail shows real metrics
# 3. UI clarifies score vs rating
```

---

## Risk Assessment

| Risk | Level | Mitigation |
|------|-------|------------|
| Breaking existing profiles | Low | metrics field is optional |
| TypeScript errors | Low | Incremental compilation |
| Dashboard not loading | Medium | Keep old data format compatible |

---

## Files Changed Summary

| File | Change Type | Lines Changed |
|------|-------------|---------------|
| `src/gamification/types.ts` | Modify | +10 |
| `src/gamification/profile.ts` | Modify | +25 |
| `src/commands/analyze.ts` | Modify | +15 |
| `src/insights/index.ts` | Modify | +20 |
| `dashboard/app.js` | Modify | +30 |
| `dashboard/index.html` | Modify | +5 |
| `dashboard/styles.css` | Modify | +5 |

**Total:** ~110 lines changed across 7 files

---

## Approval Checklist

- [ ] Schema change is backward compatible (optional field)
- [ ] All TypeScript files will compile
- [ ] Dashboard handles missing metrics gracefully
- [ ] Real metrics flow from analyze → profile → dashboard
- [ ] UI clearly distinguishes vibeScore from rating

---

## Next Step

Once approved: Implement changes in order listed above.
