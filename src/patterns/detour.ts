import { TimelineEvent } from '../types';

export interface DetourResult {
  detected: boolean;
  detours: Detour[];
  totalTimeLost: number; // minutes
  message: string;
}

export interface Detour {
  scope: string;
  filesAffected: string[];
  linesAdded: number;
  linesDeleted: number;
  startTime: Date;
  endTime: Date;
  duration: number; // minutes between first add and final delete
}

/**
 * Detect detours: code added then deleted within the analysis window.
 *
 * Definition: Code added then deleted in same analysis window
 * Value: Track wasted time, learn from experiments
 *
 * How it works:
 * 1. Track files/scopes with significant additions
 * 2. Look for later commits that delete from same files/scopes
 * 3. If deletions exceed 50% of additions, it's a detour
 */
export function detectDetour(
  events: TimelineEvent[],
  filesPerCommit: Map<string, string[]>,
  lineStatsPerCommit: Map<string, { additions: number; deletions: number }>
): DetourResult {
  const detours: Detour[] = [];

  // Group commits by scope (use scope or infer from files)
  const scopeHistory = new Map<string, {
    additions: number;
    deletions: number;
    files: Set<string>;
    firstAddTime: Date;
    lastDeleteTime: Date;
    addCommits: TimelineEvent[];
    deleteCommits: TimelineEvent[];
  }>();

  // Build history per scope
  for (const event of events) {
    const scope = event.scope || inferScope(event, filesPerCommit);
    if (!scope) continue;

    const stats = lineStatsPerCommit.get(event.hash);
    if (!stats) continue;

    if (!scopeHistory.has(scope)) {
      scopeHistory.set(scope, {
        additions: 0,
        deletions: 0,
        files: new Set(),
        firstAddTime: event.timestamp,
        lastDeleteTime: event.timestamp,
        addCommits: [],
        deleteCommits: [],
      });
    }

    const history = scopeHistory.get(scope)!;
    history.additions += stats.additions;
    history.deletions += stats.deletions;

    // Track files touched
    const files = filesPerCommit.get(event.hash) || [];
    for (const file of files) {
      history.files.add(file);
    }

    // Track commit types
    if (stats.additions > stats.deletions) {
      if (history.addCommits.length === 0) {
        history.firstAddTime = event.timestamp;
      }
      history.addCommits.push(event);
    } else if (stats.deletions > stats.additions * 2) {
      // Significant deletion
      history.lastDeleteTime = event.timestamp;
      history.deleteCommits.push(event);
    }
  }

  // Identify detours: scopes where we added then deleted significantly
  for (const [scope, history] of scopeHistory.entries()) {
    // Skip if no significant additions followed by deletions
    if (history.addCommits.length === 0 || history.deleteCommits.length === 0) {
      continue;
    }

    // Check if deletions happened AFTER additions
    const lastAdd = history.addCommits[history.addCommits.length - 1];
    const hasDeleteAfterAdd = history.deleteCommits.some(
      d => d.timestamp > lastAdd.timestamp
    );
    if (!hasDeleteAfterAdd) continue;

    // Detour threshold: deleted >50% of what was added
    const netDeletionRatio = history.deletions / Math.max(history.additions, 1);
    if (netDeletionRatio < 0.5) continue;

    // This is a detour
    const duration = Math.round(
      (history.lastDeleteTime.getTime() - history.firstAddTime.getTime()) / (1000 * 60)
    );

    detours.push({
      scope,
      filesAffected: Array.from(history.files),
      linesAdded: history.additions,
      linesDeleted: history.deletions,
      startTime: history.firstAddTime,
      endTime: history.lastDeleteTime,
      duration,
    });
  }

  // Calculate total time lost
  const totalTimeLost = detours.reduce((sum, d) => sum + d.duration, 0);

  // Generate message
  let message = '';
  if (detours.length > 0) {
    const topDetour = detours.sort((a, b) => b.duration - a.duration)[0];
    message = `🚧 ${detours.length} detour${detours.length > 1 ? 's' : ''} detected: ` +
      `${topDetour.scope} took ${formatDuration(topDetour.duration)} ` +
      `(${topDetour.linesAdded} lines added, then ${topDetour.linesDeleted} deleted)`;
  }

  return {
    detected: detours.length > 0,
    detours,
    totalTimeLost,
    message,
  };
}

/**
 * Infer scope from files touched by a commit
 */
function inferScope(
  event: TimelineEvent,
  filesPerCommit: Map<string, string[]>
): string | null {
  const files = filesPerCommit.get(event.hash) || [];
  if (files.length === 0) return null;

  // Find common directory or file pattern
  const commonParts = files[0].split('/');
  for (let i = 1; i < files.length; i++) {
    const parts = files[i].split('/');
    let j = 0;
    while (j < commonParts.length && j < parts.length && commonParts[j] === parts[j]) {
      j++;
    }
    commonParts.length = j;
  }

  // Return the deepest meaningful directory
  if (commonParts.length >= 2) {
    return commonParts.slice(0, 2).join('/');
  }
  return commonParts[0] || null;
}

/**
 * Format duration for display
 */
function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${minutes}m`;
  }
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}
