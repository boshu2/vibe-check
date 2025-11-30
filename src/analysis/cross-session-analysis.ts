/**
 * Cross-session analysis for querying historical commit data.
 * Enables queries like "show all auth spirals" or "commits by scope".
 */
import { readCommitLog, StoredCommit } from '../storage/commit-log';
import { Commit } from '../types';

export interface QueryFilter {
  scope?: string;           // Filter by commit scope
  type?: string;            // Filter by commit type (feat, fix, etc.)
  author?: string;          // Filter by author
  since?: Date;             // Start date
  until?: Date;             // End date
  messagePattern?: RegExp;  // Filter by message pattern
}

export interface ScopeStats {
  scope: string;
  commitCount: number;
  fixCount: number;
  featCount: number;
  spiralRatio: number;      // fix/total ratio - higher = more problematic
  firstSeen: Date;
  lastSeen: Date;
  authors: string[];
}

export interface CrossSessionSummary {
  totalCommits: number;
  dateRange: { from: Date; to: Date } | null;
  byScope: ScopeStats[];
  byType: Record<string, number>;
  byAuthor: Record<string, number>;
  byHour: Record<number, number>;
  byDayOfWeek: Record<number, number>;
}

/**
 * Load all commits from the NDJSON log
 */
export function loadAllCommits(repoPath: string = process.cwd()): Commit[] {
  return readCommitLog(repoPath);
}

/**
 * Query commits with filters
 */
export function queryCommits(commits: Commit[], filter: QueryFilter): Commit[] {
  return commits.filter(commit => {
    if (filter.scope && commit.scope !== filter.scope) return false;
    if (filter.type && commit.type !== filter.type) return false;
    if (filter.author && commit.author !== filter.author) return false;
    if (filter.since && commit.date < filter.since) return false;
    if (filter.until && commit.date > filter.until) return false;
    if (filter.messagePattern && !filter.messagePattern.test(commit.message)) return false;
    return true;
  });
}

/**
 * Get statistics by scope
 */
export function analyzeByScope(commits: Commit[]): ScopeStats[] {
  const scopeMap = new Map<string, {
    commits: Commit[];
    authors: Set<string>;
  }>();

  for (const commit of commits) {
    const scope = commit.scope || '(no scope)';
    if (!scopeMap.has(scope)) {
      scopeMap.set(scope, { commits: [], authors: new Set() });
    }
    const entry = scopeMap.get(scope)!;
    entry.commits.push(commit);
    entry.authors.add(commit.author);
  }

  const stats: ScopeStats[] = [];

  for (const [scope, data] of scopeMap.entries()) {
    const sorted = [...data.commits].sort((a, b) => a.date.getTime() - b.date.getTime());
    const fixCount = data.commits.filter(c => c.type === 'fix').length;
    const featCount = data.commits.filter(c => c.type === 'feat').length;

    stats.push({
      scope,
      commitCount: data.commits.length,
      fixCount,
      featCount,
      spiralRatio: data.commits.length > 0 ? fixCount / data.commits.length : 0,
      firstSeen: sorted[0].date,
      lastSeen: sorted[sorted.length - 1].date,
      authors: Array.from(data.authors),
    });
  }

  // Sort by commit count descending
  return stats.sort((a, b) => b.commitCount - a.commitCount);
}

/**
 * Get comprehensive cross-session summary
 */
export function getCrossSessionSummary(commits: Commit[]): CrossSessionSummary {
  if (commits.length === 0) {
    return {
      totalCommits: 0,
      dateRange: null,
      byScope: [],
      byType: {},
      byAuthor: {},
      byHour: {},
      byDayOfWeek: {},
    };
  }

  const sorted = [...commits].sort((a, b) => a.date.getTime() - b.date.getTime());

  // By type
  const byType: Record<string, number> = {};
  for (const commit of commits) {
    byType[commit.type] = (byType[commit.type] || 0) + 1;
  }

  // By author
  const byAuthor: Record<string, number> = {};
  for (const commit of commits) {
    byAuthor[commit.author] = (byAuthor[commit.author] || 0) + 1;
  }

  // By hour of day
  const byHour: Record<number, number> = {};
  for (const commit of commits) {
    const hour = commit.date.getHours();
    byHour[hour] = (byHour[hour] || 0) + 1;
  }

  // By day of week (0 = Sunday)
  const byDayOfWeek: Record<number, number> = {};
  for (const commit of commits) {
    const day = commit.date.getDay();
    byDayOfWeek[day] = (byDayOfWeek[day] || 0) + 1;
  }

  return {
    totalCommits: commits.length,
    dateRange: {
      from: sorted[0].date,
      to: sorted[sorted.length - 1].date,
    },
    byScope: analyzeByScope(commits),
    byType,
    byAuthor,
    byHour,
    byDayOfWeek,
  };
}

/**
 * Find scopes with high spiral ratios (potential trouble spots)
 */
export function findProblematicScopes(commits: Commit[], threshold: number = 0.5): ScopeStats[] {
  const byScope = analyzeByScope(commits);
  return byScope
    .filter(s => s.commitCount >= 3 && s.spiralRatio >= threshold)
    .sort((a, b) => b.spiralRatio - a.spiralRatio);
}

/**
 * Find peak productivity hours
 */
export function findPeakHours(commits: Commit[]): { hour: number; count: number }[] {
  const summary = getCrossSessionSummary(commits);
  return Object.entries(summary.byHour)
    .map(([hour, count]) => ({ hour: parseInt(hour), count }))
    .sort((a, b) => b.count - a.count);
}

/**
 * Get commits for a specific scope with detailed analysis
 */
export function analyzeScopeDetail(commits: Commit[], scope: string): {
  commits: Commit[];
  stats: ScopeStats | null;
  recentActivity: Commit[];
  fixChainRisk: 'low' | 'medium' | 'high';
} {
  const scopeCommits = commits.filter(c => c.scope === scope);

  if (scopeCommits.length === 0) {
    return {
      commits: [],
      stats: null,
      recentActivity: [],
      fixChainRisk: 'low',
    };
  }

  const stats = analyzeByScope(scopeCommits)[0];
  const sorted = [...scopeCommits].sort((a, b) => b.date.getTime() - a.date.getTime());
  const recentActivity = sorted.slice(0, 10);

  // Determine fix chain risk based on spiral ratio
  let fixChainRisk: 'low' | 'medium' | 'high' = 'low';
  if (stats.spiralRatio >= 0.6) {
    fixChainRisk = 'high';
  } else if (stats.spiralRatio >= 0.4) {
    fixChainRisk = 'medium';
  }

  return {
    commits: scopeCommits,
    stats,
    recentActivity,
    fixChainRisk,
  };
}
