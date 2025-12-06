/**
 * Pattern Detection Analyzer (VIBE-045)
 *
 * Analyzes git history to detect failure patterns:
 * - Debug spirals ("take N" pattern)
 * - Vague commits (<20 chars)
 * - Context amnesia (repeated scope visits)
 *
 * Proven algorithm from release-engineering retrospective (475 commits analyzed).
 */

import { Commit } from '../types';

export interface DebugSpiral {
  count: number;
  durationMinutes: number;
  commits: string[];
  dates: string[];
}

export interface VagueCommitInfo {
  count: number;
  percentage: number;
  threshold: number;
  examples: string[];
}

export interface ContextAmnesiaInfo {
  scopes: { name: string; visits: number }[];
}

export interface PatternDetectionResult {
  debugSpirals: DebugSpiral | null;
  vagueCommits: VagueCommitInfo;
  contextAmnesia: ContextAmnesiaInfo;
}

/**
 * Detect "take N" pattern indicating debug spirals.
 *
 * A debug spiral is detected when 3+ commits match the pattern "take N" or similar
 * retry patterns, indicating the developer is stuck in a fix-retry loop.
 */
export function detectDebugSpirals(commits: Commit[]): DebugSpiral | null {
  const takePattern = /^take\s*[0-9]+$/i;
  const retryPatterns = [
    /^(fix|try|attempt)\s*#?\d+$/i, // "fix 2", "try #3"
    /^(wip|temp|test)\s*\d*$/i, // "wip", "wip2"
    /^v\d+$/i, // "v2", "v3"
    takePattern,
  ];

  const spiralCommits = commits.filter((c) =>
    retryPatterns.some((pattern) => pattern.test(c.message.trim()))
  );

  if (spiralCommits.length < 3) {
    return null;
  }

  // Sort by date to calculate duration
  const sorted = [...spiralCommits].sort(
    (a, b) => a.date.getTime() - b.date.getTime()
  );

  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const durationMinutes =
    (last.date.getTime() - first.date.getTime()) / (60 * 1000);

  // Get unique dates
  const dates = [...new Set(sorted.map((c) => c.date.toISOString().split('T')[0]))];

  return {
    count: spiralCommits.length,
    durationMinutes: Math.round(durationMinutes * 10) / 10,
    commits: spiralCommits.map((c) => c.hash),
    dates,
  };
}

/**
 * Detect vague commits - messages that are too short to be meaningful.
 *
 * Threshold: < 20 characters is considered vague.
 * Examples: "ci", "v3", "blah", "take 2", "fix"
 */
export function detectVagueCommits(
  commits: Commit[],
  threshold: number = 20
): VagueCommitInfo {
  const vagueCommits = commits.filter(
    (c) => c.message.trim().length < threshold
  );

  // Get example vague messages (deduplicated, max 10)
  const examples = [
    ...new Set(vagueCommits.map((c) => c.message.trim())),
  ].slice(0, 10);

  return {
    count: vagueCommits.length,
    percentage:
      commits.length > 0
        ? Math.round((vagueCommits.length / commits.length) * 1000) / 10
        : 0,
    threshold,
    examples,
  };
}

/**
 * Detect context amnesia - repeatedly returning to the same scope/component.
 *
 * This indicates the developer keeps revisiting the same area, possibly
 * due to incomplete understanding or forgotten context.
 *
 * Reports scopes that appear in 5+ commits.
 */
export function detectContextAmnesia(
  commits: Commit[],
  minVisits: number = 5
): ContextAmnesiaInfo {
  const scopeCounts = new Map<string, number>();

  for (const commit of commits) {
    if (commit.scope) {
      const current = scopeCounts.get(commit.scope) || 0;
      scopeCounts.set(commit.scope, current + 1);
    }
  }

  // Filter to scopes with high visit counts, sorted descending
  const scopes = Array.from(scopeCounts.entries())
    .filter(([, count]) => count >= minVisits)
    .sort((a, b) => b[1] - a[1])
    .map(([name, visits]) => ({ name, visits }));

  return { scopes };
}

/**
 * Run all pattern detection on a set of commits.
 */
export function detectPatterns(commits: Commit[]): PatternDetectionResult {
  return {
    debugSpirals: detectDebugSpirals(commits),
    vagueCommits: detectVagueCommits(commits),
    contextAmnesia: detectContextAmnesia(commits),
  };
}
