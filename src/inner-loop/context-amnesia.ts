/**
 * Context Amnesia Detector
 *
 * Detects when AI forgets previous instructions and:
 * - Reverts intentional changes
 * - Re-implements code that was just deleted
 * - Repeats the same fix multiple times
 *
 * This is a key "Inner Loop Disaster" in vibe coding.
 */

import { differenceInMinutes } from 'date-fns';
import { TimelineEvent } from '../types';
import {
  ContextAmnesiaResult,
  ContextAmnesiaIncident,
  InnerLoopConfig,
  DEFAULT_INNER_LOOP_CONFIG,
} from './types';

interface CommitDiff {
  hash: string;
  message: string;
  timestamp: Date;
  scope: string | null;
  files: string[];
  additions: number;
  deletions: number;
  type: 'feat' | 'fix' | 'docs' | 'chore' | 'refactor' | 'test' | 'style' | 'other';
}

/**
 * Detect context amnesia patterns in commit history.
 */
export function detectContextAmnesia(
  events: TimelineEvent[],
  filesPerCommit: Map<string, string[]>,
  lineStatsPerCommit: Map<string, { additions: number; deletions: number }>,
  config: Partial<InnerLoopConfig> = {}
): ContextAmnesiaResult {
  const cfg = { ...DEFAULT_INNER_LOOP_CONFIG, ...config };
  const incidents: ContextAmnesiaIncident[] = [];

  if (events.length < 2) {
    return {
      detected: false,
      incidents: [],
      totalIncidents: 0,
      totalTimeWasted: 0,
      message: 'Not enough commits to detect context amnesia',
    };
  }

  // Build enriched commit data
  const commits: CommitDiff[] = events.map((e) => ({
    hash: e.hash,
    message: e.subject,
    timestamp: e.timestamp,
    scope: e.scope,
    files: filesPerCommit.get(e.hash) || [],
    additions: lineStatsPerCommit.get(e.hash)?.additions || 0,
    deletions: lineStatsPerCommit.get(e.hash)?.deletions || 0,
    type: e.type,
  }));

  // Sort by timestamp ascending
  commits.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

  // Detection strategies
  const revertIncidents = detectReverts(commits, cfg);
  const reimplementIncidents = detectReimplementation(commits, cfg);
  const repeatedFixIncidents = detectRepeatedFixes(commits, cfg);

  incidents.push(...revertIncidents, ...reimplementIncidents, ...repeatedFixIncidents);

  // Calculate total time wasted
  const totalTimeWasted = incidents.reduce((sum, i) => sum + i.gapMinutes, 0);

  // Generate message
  const detected = incidents.length > 0;
  let message = '';
  if (detected) {
    const types = new Set(incidents.map((i) => i.type));
    const typeStr = Array.from(types).join(', ');
    message = `🧠 Context amnesia detected: ${incidents.length} incident${incidents.length > 1 ? 's' : ''} (${typeStr}). ~${totalTimeWasted}m potentially wasted.`;
  }

  return {
    detected,
    incidents: incidents.slice(0, 10), // Top 10
    totalIncidents: incidents.length,
    totalTimeWasted,
    message,
  };
}

/**
 * Detect explicit reverts or undo patterns.
 */
function detectReverts(commits: CommitDiff[], config: InnerLoopConfig): ContextAmnesiaIncident[] {
  const incidents: ContextAmnesiaIncident[] = [];

  // Patterns that indicate a revert
  const revertPatterns = [
    /revert/i,
    /undo/i,
    /rollback/i,
    /back\s*out/i,
    /restore\s+previous/i,
  ];

  for (let i = 1; i < commits.length; i++) {
    const commit = commits[i];
    const isRevert = revertPatterns.some((p) => p.test(commit.message));

    if (isRevert) {
      // Find what was reverted (look back within window)
      const windowStart = new Date(
        commit.timestamp.getTime() - config.amnesiaWindowMinutes * 60 * 1000
      );

      // Find commits in window that touch same files
      for (let j = i - 1; j >= 0; j--) {
        const original = commits[j];
        if (original.timestamp < windowStart) break;

        const sharedFiles = commit.files.filter((f) => original.files.includes(f));
        if (sharedFiles.length > 0) {
          const gap = differenceInMinutes(commit.timestamp, original.timestamp);

          incidents.push({
            type: 'revert',
            originalCommit: {
              hash: original.hash,
              message: original.message,
              timestamp: original.timestamp,
            },
            repeatCommit: {
              hash: commit.hash,
              message: commit.message,
              timestamp: commit.timestamp,
            },
            scope: commit.scope || original.scope,
            filesAffected: sharedFiles,
            gapMinutes: gap,
            description: `Reverted changes from ${gap}m ago`,
          });
          break; // Only count once per revert
        }
      }
    }
  }

  return incidents;
}

/**
 * Detect reimplementation: code deleted then similar code re-added.
 */
function detectReimplementation(
  commits: CommitDiff[],
  config: InnerLoopConfig
): ContextAmnesiaIncident[] {
  const incidents: ContextAmnesiaIncident[] = [];

  // Track significant deletions
  const deletions: Array<{
    commit: CommitDiff;
    files: string[];
    linesDeleted: number;
  }> = [];

  for (const commit of commits) {
    // Significant deletion: more deletions than additions
    if (commit.deletions > commit.additions && commit.deletions > 10) {
      deletions.push({
        commit,
        files: commit.files,
        linesDeleted: commit.deletions,
      });
    }
  }

  // Look for later commits that re-add similar content to same files
  for (const deletion of deletions) {
    const windowEnd = new Date(
      deletion.commit.timestamp.getTime() + config.amnesiaWindowMinutes * 60 * 1000
    );

    for (const commit of commits) {
      // Must be after the deletion
      if (commit.timestamp <= deletion.commit.timestamp) continue;
      if (commit.timestamp > windowEnd) continue;

      // Must touch same files with additions
      const sharedFiles = commit.files.filter((f) => deletion.files.includes(f));
      if (sharedFiles.length === 0) continue;

      // Must have significant additions (reimplementing)
      if (commit.additions < deletion.linesDeleted * 0.5) continue;

      const gap = differenceInMinutes(commit.timestamp, deletion.commit.timestamp);

      // Check if this looks like reimplementation vs intentional refactor
      // Refactors usually have "refactor" in message
      if (/refactor/i.test(commit.message)) continue;

      incidents.push({
        type: 'reimplementation',
        originalCommit: {
          hash: deletion.commit.hash,
          message: deletion.commit.message,
          timestamp: deletion.commit.timestamp,
        },
        repeatCommit: {
          hash: commit.hash,
          message: commit.message,
          timestamp: commit.timestamp,
        },
        scope: commit.scope || deletion.commit.scope,
        filesAffected: sharedFiles,
        gapMinutes: gap,
        description: `Deleted ${deletion.linesDeleted} lines, then re-added ${commit.additions} lines ${gap}m later`,
      });
    }
  }

  return incidents;
}

/**
 * Detect repeated fixes: same area fixed multiple times in short window.
 */
function detectRepeatedFixes(
  commits: CommitDiff[],
  config: InnerLoopConfig
): ContextAmnesiaIncident[] {
  const incidents: ContextAmnesiaIncident[] = [];

  // Group fix commits by scope/files
  const fixCommits = commits.filter((c) => c.type === 'fix');

  // Track fixes per scope within time window
  const scopeFixes = new Map<string, CommitDiff[]>();

  for (const fix of fixCommits) {
    const scope = fix.scope || fix.files[0] || 'unknown';

    if (!scopeFixes.has(scope)) {
      scopeFixes.set(scope, []);
    }
    scopeFixes.get(scope)!.push(fix);
  }

  // Find scopes with 3+ fixes in window (beyond normal spiral detection)
  for (const [scope, fixes] of scopeFixes) {
    if (fixes.length < 3) continue;

    // Check if messages are similar (forgot what was tried)
    for (let i = 0; i < fixes.length - 1; i++) {
      const current = fixes[i];
      const next = fixes[i + 1];

      const gap = differenceInMinutes(next.timestamp, current.timestamp);
      if (gap > config.amnesiaWindowMinutes) continue;

      // Check message similarity
      const similarity = calculateSimilarity(current.message, next.message);
      if (similarity > config.similarityThreshold) {
        incidents.push({
          type: 'forgotten_change',
          originalCommit: {
            hash: current.hash,
            message: current.message,
            timestamp: current.timestamp,
          },
          repeatCommit: {
            hash: next.hash,
            message: next.message,
            timestamp: next.timestamp,
          },
          scope,
          filesAffected: [...new Set([...current.files, ...next.files])],
          gapMinutes: gap,
          description: `Similar fix attempted ${gap}m later (${Math.round(similarity * 100)}% similar)`,
        });
      }
    }
  }

  return incidents;
}

/**
 * Calculate similarity between two commit messages (Jaccard index).
 */
function calculateSimilarity(msg1: string, msg2: string): number {
  const words1 = new Set(
    msg1
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .split(/\s+/)
      .filter((w) => w.length > 2)
  );
  const words2 = new Set(
    msg2
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .split(/\s+/)
      .filter((w) => w.length > 2)
  );

  if (words1.size === 0 || words2.size === 0) return 0;

  const intersection = new Set([...words1].filter((w) => words2.has(w)));
  const union = new Set([...words1, ...words2]);

  return intersection.size / union.size;
}
