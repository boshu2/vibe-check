# Insight Mining & Dashboard Implementation Plan

**Type:** Plan
**Created:** 2025-11-30
**Depends On:** insight-mining-dashboard-research-2025-11-30.md
**Loop:** Middle (bridges research to implementation)
**Tags:** dashboard, insights, visualization

---

## Overview

Create an insight engine that generates prioritized actionable insights, then connect the existing dashboard to real data via a `vibe-check dashboard` command.

## Approach Selected

**Hybrid Architecture (Option D from research):**
1. Insight engine module generates insights from all data sources
2. Dashboard command exports JSON + opens browser
3. Static dashboard reads JSON file

## PDC Strategy

### Prevent
- [x] Research bundle completed
- [ ] Test JSON loading in browser before full implementation

### Detect
- [ ] Validate each insight generator produces valid output
- [ ] Test dashboard renders with real data

### Correct
- [ ] Rollback: delete new files, revert dashboard/app.js

---

## Files to Create

### 1. `src/insights/types.ts`

**Purpose:** Define insight interfaces and categories

```typescript
/**
 * Insight types for vibe-check dashboard
 */

export type InsightCategory =
  | 'productivity'   // Peak hours, best days
  | 'patterns'       // Problematic scopes, spiral triggers
  | 'growth'         // Improvement streaks, trends
  | 'warning'        // Regression alerts, risks
  | 'celebration';   // Personal bests, achievements

export type InsightSeverity = 'info' | 'warning' | 'critical' | 'success';

export interface Insight {
  id: string;
  category: InsightCategory;
  severity: InsightSeverity;
  icon: string;
  title: string;
  message: string;
  metric?: string;
  value?: number;
  comparison?: {
    type: 'baseline' | 'previous' | 'goal';
    label: string;
    value: number;
    change: number;
  };
  action?: string;
  source: string;
  priority: number;  // 1-10, higher = more important
}

export interface DashboardData {
  version: string;
  generatedAt: string;
  repo: string;

  profile: {
    level: number;
    levelName: string;
    levelIcon: string;
    xp: { current: number; next: number; total: number };
    streak: { current: number; longest: number };
    achievementCount: number;
    totalAchievements: number;
  };

  stats: {
    current: { vibeScore: number; rating: string };
    averages: { day7: number; day30: number; allTime: number };
    totals: { sessions: number; commits: number; spirals: number; features: number };
  };

  charts: {
    scoreTrend: Array<{ date: string; score: number; rating: string }>;
    ratingDistribution: Record<string, number>;
    hourlyActivity: Record<string, number>;
    scopeHealth: Array<{ scope: string; commits: number; fixRatio: number }>;
  };

  insights: Insight[];

  sessions: Array<{
    date: string;
    vibeScore: number;
    rating: string;
    commits: number;
    spirals: number;
    xpEarned: number;
  }>;

  achievements: Array<{
    id: string;
    name: string;
    icon: string;
    description: string;
    unlockedAt?: string;
  }>;
}
```

**Validation:** `npm run build` passes

---

### 2. `src/insights/generators.ts`

**Purpose:** Individual insight generation functions

```typescript
/**
 * Insight generators - each produces insights from specific data sources
 */

import { Insight } from './types';
import { UserProfile } from '../gamification/types';
import { TimelineStore } from '../storage/timeline-store';
import { Commit } from '../types';

/**
 * Find peak productivity hours from commits
 */
export function generatePeakHoursInsight(commits: Commit[]): Insight | null {
  if (commits.length < 10) return null;

  const hourCounts: Record<number, number> = {};
  for (const commit of commits) {
    const hour = commit.date.getHours();
    hourCounts[hour] = (hourCounts[hour] || 0) + 1;
  }

  const sorted = Object.entries(hourCounts)
    .map(([h, c]) => ({ hour: parseInt(h), count: c }))
    .sort((a, b) => b.count - a.count);

  if (sorted.length === 0) return null;

  const peakHour = sorted[0].hour;
  const peakPct = Math.round((sorted[0].count / commits.length) * 100);
  const hourStr = peakHour < 12 ? `${peakHour}am` : peakHour === 12 ? '12pm' : `${peakHour - 12}pm`;

  return {
    id: 'peak-hours',
    category: 'productivity',
    severity: 'info',
    icon: '⏰',
    title: 'Peak Productivity',
    message: `You're most productive around ${hourStr} (${peakPct}% of commits)`,
    metric: 'peak_hour',
    value: peakHour,
    action: 'Protect this time for deep work',
    source: 'commits',
    priority: 5,
  };
}

/**
 * Detect improvement streak from trends
 */
export function generateImprovementStreakInsight(store: TimelineStore): Insight | null {
  const weeks = store.trends.weekly;
  if (weeks.length < 2) return null;

  let streak = 0;
  for (let i = weeks.length - 2; i >= 0; i--) {
    const current = weeks[i];
    const next = weeks[i + 1];
    const currentRate = current.sessions > 0 ? current.spirals / current.sessions : 0;
    const nextRate = next.sessions > 0 ? next.spirals / next.sessions : 0;
    if (nextRate <= currentRate) {
      streak++;
    } else {
      break;
    }
  }

  if (streak < 2) return null;

  return {
    id: 'improvement-streak',
    category: 'growth',
    severity: 'success',
    icon: '🎯',
    title: 'Improvement Streak',
    message: `${streak}-week improvement streak! Your spiral rate keeps dropping.`,
    metric: 'improvement_weeks',
    value: streak,
    source: 'timeline.trends',
    priority: 7,
  };
}

/**
 * Find problematic scopes with high fix ratios
 */
export function generateProblematicScopesInsight(commits: Commit[]): Insight | null {
  const scopeStats = new Map<string, { total: number; fixes: number }>();

  for (const commit of commits) {
    const scope = commit.scope || '(no scope)';
    if (!scopeStats.has(scope)) {
      scopeStats.set(scope, { total: 0, fixes: 0 });
    }
    const stats = scopeStats.get(scope)!;
    stats.total++;
    if (commit.type === 'fix') stats.fixes++;
  }

  const problematic = Array.from(scopeStats.entries())
    .map(([scope, stats]) => ({
      scope,
      ...stats,
      ratio: stats.total > 0 ? stats.fixes / stats.total : 0,
    }))
    .filter(s => s.total >= 3 && s.ratio >= 0.5)
    .sort((a, b) => b.ratio - a.ratio);

  if (problematic.length === 0) return null;

  const worst = problematic[0];
  const pct = Math.round(worst.ratio * 100);

  return {
    id: 'problematic-scope',
    category: 'warning',
    severity: 'warning',
    icon: '⚠️',
    title: 'High-Risk Scope',
    message: `"${worst.scope}" has ${pct}% fix commits (${worst.fixes}/${worst.total})`,
    metric: 'scope_fix_ratio',
    value: worst.ratio,
    action: 'Consider adding tracer tests for this area',
    source: 'commits',
    priority: 8,
  };
}

/**
 * Check for streak at risk
 */
export function generateStreakRiskInsight(profile: UserProfile): Insight | null {
  const { streak } = profile;
  if (streak.current < 3) return null;

  const today = new Date().toISOString().split('T')[0];
  if (streak.lastActiveDate === today) return null;

  const lastActive = new Date(streak.lastActiveDate);
  const now = new Date();
  const daysSince = Math.floor((now.getTime() - lastActive.getTime()) / (1000 * 60 * 60 * 24));

  if (daysSince === 0) return null;

  return {
    id: 'streak-risk',
    category: 'warning',
    severity: daysSince >= 1 ? 'warning' : 'info',
    icon: '🔥',
    title: 'Streak at Risk',
    message: `Your ${streak.current}-day streak needs a session today!`,
    action: 'Run vibe-check --score to maintain streak',
    source: 'profile',
    priority: 9,
  };
}

/**
 * Celebrate personal best
 */
export function generatePersonalBestInsight(profile: UserProfile): Insight | null {
  const sessions = profile.sessions;
  if (sessions.length < 2) return null;

  const latest = sessions[0];
  const previousBest = Math.max(...sessions.slice(1).map(s => s.vibeScore));

  if (latest.vibeScore > previousBest) {
    return {
      id: 'personal-best',
      category: 'celebration',
      severity: 'success',
      icon: '🏆',
      title: 'New Personal Best!',
      message: `${latest.vibeScore}% beats your previous best of ${previousBest}%`,
      metric: 'vibe_score',
      value: latest.vibeScore,
      comparison: {
        type: 'previous',
        label: 'Previous best',
        value: previousBest,
        change: latest.vibeScore - previousBest,
      },
      source: 'profile',
      priority: 10,
    };
  }

  return null;
}

/**
 * Show level progress
 */
export function generateLevelProgressInsight(profile: UserProfile): Insight | null {
  const { xp } = profile;
  const progress = Math.round((xp.currentLevelXP / xp.nextLevelXP) * 100);

  if (progress >= 80) {
    return {
      id: 'level-close',
      category: 'growth',
      severity: 'info',
      icon: '📈',
      title: 'Level Up Soon!',
      message: `${progress}% to Level ${xp.level + 1} (${xp.nextLevelXP - xp.currentLevelXP} XP to go)`,
      metric: 'level_progress',
      value: progress,
      source: 'profile',
      priority: 6,
    };
  }

  return null;
}

/**
 * Late night warning
 */
export function generateLateNightInsight(commits: Commit[]): Insight | null {
  const recentCommits = commits.slice(0, 20);
  const lateNight = recentCommits.filter(c => {
    const hour = c.date.getHours();
    return hour >= 23 || hour < 5;
  });

  if (lateNight.length < 3) return null;

  const pct = Math.round((lateNight.length / recentCommits.length) * 100);

  return {
    id: 'late-night',
    category: 'warning',
    severity: 'warning',
    icon: '🌙',
    title: 'Late Night Sessions',
    message: `${pct}% of recent commits are between 11pm-5am`,
    action: 'Late night coding correlates with more spirals',
    source: 'commits',
    priority: 7,
  };
}

/**
 * Recent achievement
 */
export function generateRecentAchievementInsight(profile: UserProfile): Insight | null {
  const recent = profile.achievements
    .filter(a => a.unlockedAt)
    .sort((a, b) => new Date(b.unlockedAt!).getTime() - new Date(a.unlockedAt!).getTime())
    .slice(0, 1);

  if (recent.length === 0) return null;

  const ach = recent[0];
  const unlockedDate = new Date(ach.unlockedAt!);
  const daysSince = Math.floor((Date.now() - unlockedDate.getTime()) / (1000 * 60 * 60 * 24));

  if (daysSince > 7) return null;

  return {
    id: 'recent-achievement',
    category: 'celebration',
    severity: 'success',
    icon: ach.icon,
    title: 'Achievement Unlocked!',
    message: `${ach.name}: ${ach.description}`,
    source: 'profile',
    priority: 8,
  };
}
```

**Validation:** `npm run build` passes

---

### 3. `src/insights/index.ts`

**Purpose:** Main insight engine - aggregates all generators

```typescript
/**
 * Insight Engine - generates prioritized insights from all data sources
 */

import { Insight, DashboardData } from './types';
import {
  generatePeakHoursInsight,
  generateImprovementStreakInsight,
  generateProblematicScopesInsight,
  generateStreakRiskInsight,
  generatePersonalBestInsight,
  generateLevelProgressInsight,
  generateLateNightInsight,
  generateRecentAchievementInsight,
} from './generators';
import { UserProfile, LEVELS } from '../gamification/types';
import { loadStore, readCommitLog } from '../storage';
import { loadProfile } from '../gamification/profile';
import { ACHIEVEMENTS } from '../gamification/achievements';

export { Insight, DashboardData } from './types';

/**
 * Generate all insights from available data
 */
export function generateInsights(
  profile: UserProfile,
  commits: ReturnType<typeof readCommitLog>,
  repoPath: string
): Insight[] {
  const store = loadStore(repoPath);
  const insights: Insight[] = [];

  // Run all generators
  const generators = [
    () => generatePeakHoursInsight(commits),
    () => generateImprovementStreakInsight(store),
    () => generateProblematicScopesInsight(commits),
    () => generateStreakRiskInsight(profile),
    () => generatePersonalBestInsight(profile),
    () => generateLevelProgressInsight(profile),
    () => generateLateNightInsight(commits),
    () => generateRecentAchievementInsight(profile),
  ];

  for (const gen of generators) {
    try {
      const insight = gen();
      if (insight) insights.push(insight);
    } catch {
      // Skip failed generators
    }
  }

  // Sort by priority (highest first)
  return insights.sort((a, b) => b.priority - a.priority);
}

/**
 * Build complete dashboard data export
 */
export function buildDashboardData(repoPath: string = process.cwd()): DashboardData {
  const profile = loadProfile();
  const commits = readCommitLog(repoPath);
  const store = loadStore(repoPath);

  // Level info
  const levelInfo = LEVELS.find(l => l.level === profile.xp.level) || LEVELS[0];

  // Calculate averages
  const sessions = profile.sessions;
  const day7Sessions = sessions.filter(s => {
    const d = new Date(s.date);
    return Date.now() - d.getTime() < 7 * 24 * 60 * 60 * 1000;
  });
  const day30Sessions = sessions.filter(s => {
    const d = new Date(s.date);
    return Date.now() - d.getTime() < 30 * 24 * 60 * 60 * 1000;
  });

  const avg = (arr: number[]) => arr.length > 0 ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0;

  // Rating distribution
  const ratingDistribution: Record<string, number> = { ELITE: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
  for (const s of sessions) {
    ratingDistribution[s.overall] = (ratingDistribution[s.overall] || 0) + 1;
  }

  // Hourly activity from commits
  const hourlyActivity: Record<string, number> = {};
  for (const commit of commits) {
    const hour = commit.date.getHours().toString();
    hourlyActivity[hour] = (hourlyActivity[hour] || 0) + 1;
  }

  // Scope health
  const scopeStats = new Map<string, { total: number; fixes: number }>();
  for (const commit of commits) {
    const scope = commit.scope || '(no scope)';
    if (!scopeStats.has(scope)) scopeStats.set(scope, { total: 0, fixes: 0 });
    const stats = scopeStats.get(scope)!;
    stats.total++;
    if (commit.type === 'fix') stats.fixes++;
  }
  const scopeHealth = Array.from(scopeStats.entries())
    .map(([scope, stats]) => ({
      scope,
      commits: stats.total,
      fixRatio: stats.total > 0 ? Math.round((stats.fixes / stats.total) * 100) : 0,
    }))
    .sort((a, b) => b.commits - a.commits)
    .slice(0, 10);

  // Score trend (last 30 sessions)
  const scoreTrend = sessions.slice(0, 30).reverse().map(s => ({
    date: s.date,
    score: s.vibeScore,
    rating: s.overall,
  }));

  // Generate insights
  const insights = generateInsights(profile, commits, repoPath);

  // Map achievements
  const allAchievements = ACHIEVEMENTS.map(a => {
    const unlocked = profile.achievements.find(ua => ua.id === a.id);
    return {
      id: a.id,
      name: a.name,
      icon: a.icon,
      description: a.description,
      unlockedAt: unlocked?.unlockedAt,
    };
  });

  return {
    version: '1.0.0',
    generatedAt: new Date().toISOString(),
    repo: repoPath,

    profile: {
      level: profile.xp.level,
      levelName: profile.xp.levelName,
      levelIcon: levelInfo.icon,
      xp: {
        current: profile.xp.currentLevelXP,
        next: profile.xp.nextLevelXP,
        total: profile.xp.total,
      },
      streak: {
        current: profile.streak.current,
        longest: profile.streak.longest,
      },
      achievementCount: profile.achievements.length,
      totalAchievements: ACHIEVEMENTS.length,
    },

    stats: {
      current: {
        vibeScore: sessions[0]?.vibeScore || 0,
        rating: sessions[0]?.overall || 'N/A',
      },
      averages: {
        day7: avg(day7Sessions.map(s => s.vibeScore)),
        day30: avg(day30Sessions.map(s => s.vibeScore)),
        allTime: avg(sessions.map(s => s.vibeScore)),
      },
      totals: {
        sessions: sessions.length,
        commits: commits.length,
        spirals: sessions.reduce((sum, s) => sum + s.spirals, 0),
        features: store.sessions.reduce((sum, s) => sum + s.commitCount, 0),
      },
    },

    charts: {
      scoreTrend,
      ratingDistribution,
      hourlyActivity,
      scopeHealth,
    },

    insights,

    sessions: sessions.slice(0, 50).map(s => ({
      date: s.date,
      vibeScore: s.vibeScore,
      rating: s.overall,
      commits: s.commits,
      spirals: s.spirals,
      xpEarned: s.xpEarned,
    })),

    achievements: allAchievements,
  };
}
```

**Validation:** `npm run build` passes

---

### 4. `src/commands/dashboard.ts`

**Purpose:** CLI command to export data and open dashboard

```typescript
import { Command } from 'commander';
import chalk from 'chalk';
import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { buildDashboardData } from '../insights';

export interface DashboardOptions {
  repo: string;
  open: boolean;
  output?: string;
}

export function createDashboardCommand(): Command {
  const cmd = new Command('dashboard')
    .description('Open the vibe-check dashboard with your stats')
    .option('-r, --repo <path>', 'Repository path', process.cwd())
    .option('--no-open', 'Export data without opening browser')
    .option('-o, --output <file>', 'Custom output path for dashboard-data.json')
    .action(async (options) => {
      await runDashboard(options);
    });

  return cmd;
}

async function runDashboard(options: DashboardOptions): Promise<void> {
  const { repo, open, output } = options;

  console.log(chalk.cyan('Building dashboard data...'));

  try {
    // Build dashboard data
    const data = buildDashboardData(repo);

    // Determine output path
    const dashboardDir = path.join(__dirname, '../../dashboard');
    const outputPath = output || path.join(dashboardDir, 'dashboard-data.json');

    // Ensure dashboard directory exists
    if (!fs.existsSync(dashboardDir)) {
      console.error(chalk.red('Dashboard directory not found'));
      process.exit(1);
    }

    // Write data
    fs.writeFileSync(outputPath, JSON.stringify(data, null, 2));
    console.log(chalk.green(`Data exported to ${outputPath}`));

    // Show summary
    console.log('');
    console.log(chalk.bold('Dashboard Summary:'));
    console.log(`  Level: ${data.profile.levelIcon} ${data.profile.level} ${data.profile.levelName}`);
    console.log(`  Streak: 🔥 ${data.profile.streak.current} days`);
    console.log(`  Sessions: ${data.stats.totals.sessions}`);
    console.log(`  Insights: ${data.insights.length} generated`);
    console.log('');

    // Open browser
    if (open) {
      const htmlPath = path.join(dashboardDir, 'index.html');
      const url = `file://${htmlPath}`;

      console.log(chalk.cyan(`Opening dashboard...`));

      // Cross-platform open command
      const openCmd = process.platform === 'darwin' ? 'open' :
                      process.platform === 'win32' ? 'start' : 'xdg-open';

      exec(`${openCmd} "${url}"`, (error) => {
        if (error) {
          console.log(chalk.yellow(`Could not open browser automatically.`));
          console.log(chalk.gray(`Open manually: ${url}`));
        }
      });
    } else {
      const htmlPath = path.join(dashboardDir, 'index.html');
      console.log(chalk.gray(`Open dashboard: file://${htmlPath}`));
    }
  } catch (error) {
    if (error instanceof Error) {
      console.error(chalk.red(`Error: ${error.message}`));
    }
    process.exit(1);
  }
}
```

**Validation:** `npm run build` passes, `node dist/cli.js dashboard --help` shows options

---

## Files to Modify

### 1. `src/commands/index.ts:8`

**Purpose:** Export dashboard command

**Before:**
```typescript
export { createTimelineCommand, runTimeline, TimelineOptions } from './timeline';
export { createCacheCommand } from './cache';
```

**After:**
```typescript
export { createTimelineCommand, runTimeline, TimelineOptions } from './timeline';
export { createCacheCommand } from './cache';
export { createDashboardCommand } from './dashboard';
```

**Validation:** `npm run build` passes

---

### 2. `src/cli.ts:3`

**Purpose:** Import dashboard command

**Before:**
```typescript
import { createAnalyzeCommand, createStartCommand, createProfileCommand, createInitHookCommand, createWatchCommand, createInterveneCommand, createTimelineCommand, createCacheCommand, runAnalyze } from './commands';
```

**After:**
```typescript
import { createAnalyzeCommand, createStartCommand, createProfileCommand, createInitHookCommand, createWatchCommand, createInterveneCommand, createTimelineCommand, createCacheCommand, createDashboardCommand, runAnalyze } from './commands';
```

**Validation:** `npm run build` passes

---

### 3. `src/cli.ts:27`

**Purpose:** Register dashboard command

**Before:**
```typescript
program.addCommand(createCacheCommand());

// Default behavior: if no subcommand, run analyze with passed options
```

**After:**
```typescript
program.addCommand(createCacheCommand());
program.addCommand(createDashboardCommand());

// Default behavior: if no subcommand, run analyze with passed options
```

**Validation:** `node dist/cli.js --help` shows dashboard command

---

### 4. `dashboard/app.js:59-68`

**Purpose:** Load real data instead of mock

**Before:**
```javascript
  async loadProfile() {
    // In a real implementation, this would fetch from an API or local file
    // For now, we'll use mock data or localStorage
    const stored = localStorage.getItem('vibe-check-profile');
    if (stored) {
      this.profile = JSON.parse(stored);
    } else {
      this.profile = this.getMockProfile();
    }
  }
```

**After:**
```javascript
  async loadProfile() {
    // Try to load dashboard-data.json (generated by vibe-check dashboard)
    try {
      const response = await fetch('dashboard-data.json');
      if (response.ok) {
        const data = await response.json();
        this.dashboardData = data;
        this.profile = this.transformToProfile(data);
        return;
      }
    } catch (e) {
      console.log('No dashboard-data.json found, using mock data');
    }

    // Fall back to localStorage or mock
    const stored = localStorage.getItem('vibe-check-profile');
    if (stored) {
      this.profile = JSON.parse(stored);
    } else {
      this.profile = this.getMockProfile();
    }
  }

  transformToProfile(data) {
    // Transform DashboardData to legacy profile format for existing UI
    return {
      version: data.version,
      xp: {
        total: data.profile.xp.total,
        level: data.profile.level,
        levelName: data.profile.levelName,
        currentLevelXP: data.profile.xp.current,
        nextLevelXP: data.profile.xp.next,
      },
      streak: data.profile.streak,
      achievements: data.achievements.filter(a => a.unlockedAt),
      sessions: data.sessions,
      stats: {
        totalSessions: data.stats.totals.sessions,
        totalCommitsAnalyzed: data.stats.totals.commits,
        avgVibeScore: data.stats.averages.allTime,
        bestVibeScore: Math.max(...data.sessions.map(s => s.vibeScore), 0),
        spiralsAvoided: data.sessions.filter(s => s.spirals === 0).length,
      },
    };
  }
```

**Validation:** Dashboard loads without errors when dashboard-data.json exists

---

### 5. `dashboard/index.html:166` (after recent sessions section)

**Purpose:** Add insights section to dashboard

**Before:**
```html
            </section>

            <!-- History Page -->
```

**After:**
```html
                <!-- Insights Section -->
                <div class="recent-section" id="insightsSection">
                    <div class="section-header">
                        <h3>Insights</h3>
                    </div>
                    <div class="insights-list" id="insightsList">
                        <div class="empty-state">
                            <span class="empty-icon">💡</span>
                            <p>Run <code>vibe-check dashboard</code> to generate insights</p>
                        </div>
                    </div>
                </div>
            </section>

            <!-- History Page -->
```

**Validation:** HTML loads without errors

---

### 6. `dashboard/app.js:191` (after renderRecentSessions)

**Purpose:** Add insight rendering function

**Before:**
```javascript
  initCharts() {
```

**After:**
```javascript
  renderInsights() {
    const container = document.getElementById('insightsList');
    if (!this.dashboardData?.insights?.length) {
      container.innerHTML = `
        <div class="empty-state">
          <span class="empty-icon">💡</span>
          <p>Run <code>vibe-check dashboard</code> to generate insights</p>
        </div>
      `;
      return;
    }

    const insights = this.dashboardData.insights.slice(0, 5);
    container.innerHTML = insights.map(insight => {
      const severityClass = {
        success: 'insight-success',
        warning: 'insight-warning',
        critical: 'insight-critical',
        info: 'insight-info',
      }[insight.severity] || 'insight-info';

      return `
        <div class="insight-item ${severityClass}">
          <span class="insight-icon">${insight.icon}</span>
          <div class="insight-content">
            <div class="insight-title">${insight.title}</div>
            <div class="insight-message">${insight.message}</div>
            ${insight.action ? `<div class="insight-action">${insight.action}</div>` : ''}
          </div>
        </div>
      `;
    }).join('');
  }

  initCharts() {
```

**Validation:** `renderInsights` method exists

---

### 7. `dashboard/app.js:142`

**Purpose:** Call renderInsights in renderDashboard

**Before:**
```javascript
  renderDashboard() {
    this.updateProfileSummary();
    this.updateStats();
    this.renderRecentSessions();
  }
```

**After:**
```javascript
  renderDashboard() {
    this.updateProfileSummary();
    this.updateStats();
    this.renderRecentSessions();
    this.renderInsights();
  }
```

**Validation:** Insights render on dashboard load

---

### 8. `dashboard/styles.css` (append at end)

**Purpose:** Add insight styling

**Append:**
```css
/* Insights Section */
.insights-list {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.insight-item {
  display: flex;
  gap: var(--spacing-md);
  padding: var(--spacing-md);
  border-radius: var(--radius-md);
  background: var(--bg-secondary);
  border-left: 3px solid var(--text-muted);
}

.insight-item.insight-success {
  border-left-color: var(--color-success);
  background: rgba(63, 185, 80, 0.1);
}

.insight-item.insight-warning {
  border-left-color: var(--color-warning);
  background: rgba(210, 153, 34, 0.1);
}

.insight-item.insight-critical {
  border-left-color: var(--color-danger);
  background: rgba(248, 81, 73, 0.1);
}

.insight-item.insight-info {
  border-left-color: var(--color-accent);
  background: rgba(88, 166, 255, 0.1);
}

.insight-icon {
  font-size: 1.5rem;
  line-height: 1;
}

.insight-content {
  flex: 1;
}

.insight-title {
  font-weight: 600;
  margin-bottom: 0.25rem;
}

.insight-message {
  color: var(--text-muted);
  font-size: 0.875rem;
}

.insight-action {
  margin-top: 0.5rem;
  font-size: 0.75rem;
  color: var(--color-accent);
}
```

**Validation:** Styles apply correctly to insights

---

## Implementation Order

**CRITICAL: Sequence matters. Do not reorder.**

| Step | Action | Validation | Rollback |
|------|--------|------------|----------|
| 1 | Create `src/insights/types.ts` | `npm run build` | Delete file |
| 2 | Create `src/insights/generators.ts` | `npm run build` | Delete file |
| 3 | Create `src/insights/index.ts` | `npm run build` | Delete file |
| 4 | Create `src/commands/dashboard.ts` | `npm run build` | Delete file |
| 5 | Modify `src/commands/index.ts` | `npm run build` | Revert line |
| 6 | Modify `src/cli.ts` (2 changes) | `npm run build` | Revert lines |
| 7 | Modify `dashboard/app.js` | Browser test | Revert file |
| 8 | Modify `dashboard/index.html` | Browser test | Revert file |
| 9 | Append `dashboard/styles.css` | Visual check | Remove appended |
| 10 | Full test | `vibe-check dashboard` | Revert all |

---

## Validation Strategy

### Build Validation
```bash
npm run build
# Expected: No errors
```

### Unit Validation
```bash
npm test
# Expected: All tests pass
```

### Integration Validation
```bash
node dist/cli.js dashboard --help
# Expected: Shows dashboard command options

node dist/cli.js dashboard --no-open
# Expected: Creates dashboard/dashboard-data.json

cat dashboard/dashboard-data.json | head -20
# Expected: Valid JSON with profile, stats, insights
```

### Browser Validation
```bash
open dashboard/index.html
# Expected: Dashboard loads with real data and insights
```

---

## Rollback Procedure

**Time to rollback:** 5 minutes

### Full Rollback
```bash
# Delete new files
rm -f src/insights/types.ts
rm -f src/insights/generators.ts
rm -f src/insights/index.ts
rm -f src/commands/dashboard.ts
rm -f dashboard/dashboard-data.json

# Revert modified files
git checkout -- src/commands/index.ts
git checkout -- src/cli.ts
git checkout -- dashboard/app.js
git checkout -- dashboard/index.html
git checkout -- dashboard/styles.css

# Verify
npm run build
```

---

## Approval Checklist

**Human must verify before /implement:**

- [ ] Every file specified precisely (file:line)
- [ ] All templates complete (no placeholders)
- [ ] Validation commands provided
- [ ] Rollback procedure complete
- [ ] Implementation order is correct
- [ ] Risks identified and mitigated

---

## Next Step

Once approved: `/implement insight-dashboard-plan-2025-11-30.md`
