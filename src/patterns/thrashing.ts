import { TimelineEvent } from '../types';
import { differenceInMinutes } from 'date-fns';

export interface ThrashingFile {
  path: string;
  touchCount: number;
  commits: string[];
  netChange: number; // additions - deletions across all touches
  efficiency: number; // percentage (low = thrashing)
}

export interface ThrashingResult {
  detected: boolean;
  files: ThrashingFile[];
  totalThrashingMinutes: number;
  message: string;
}

/**
 * Detect thrashing patterns in commits.
 *
 * Definition: Same file touched 5+ times in 2 hours, low net change
 * Value: Identify incomplete understanding
 */
export function detectThrashing(
  events: TimelineEvent[],
  filesPerCommit: Map<string, string[]>,
  lineStatsPerCommit: Map<string, { additions: number; deletions: number }>
): ThrashingResult {
  if (events.length < 5) {
    return {
      detected: false,
      files: [],
      totalThrashingMinutes: 0,
      message: 'Not enough commits to detect thrashing',
    };
  }

  // Track file touches within 2-hour windows
  const fileTouches = new Map<string, { commits: string[]; timestamps: Date[] }>();

  for (const event of events) {
    const files = filesPerCommit.get(event.hash) || [];
    for (const file of files) {
      if (!fileTouches.has(file)) {
        fileTouches.set(file, { commits: [], timestamps: [] });
      }
      const touches = fileTouches.get(file)!;
      touches.commits.push(event.hash);
      touches.timestamps.push(event.timestamp);
    }
  }

  // Find files with 5+ touches in any 2-hour window
  const thrashingFiles: ThrashingFile[] = [];

  for (const [file, touches] of fileTouches) {
    // Skip config files and lock files
    if (file.includes('package-lock') || file.includes('yarn.lock') ||
        file.endsWith('.json') && !file.includes('src/')) {
      continue;
    }

    // Check for 5+ touches within 2 hours
    if (touches.commits.length >= 5) {
      // Find the densest 2-hour window
      let maxTouchesInWindow = 0;
      let windowCommits: string[] = [];

      for (let i = 0; i < touches.timestamps.length; i++) {
        const windowStart = touches.timestamps[i];
        const commitsInWindow: string[] = [];

        for (let j = i; j < touches.timestamps.length; j++) {
          const gap = differenceInMinutes(touches.timestamps[j], windowStart);
          if (gap <= 120) {
            commitsInWindow.push(touches.commits[j]);
          }
        }

        if (commitsInWindow.length > maxTouchesInWindow) {
          maxTouchesInWindow = commitsInWindow.length;
          windowCommits = commitsInWindow;
        }
      }

      if (maxTouchesInWindow >= 5) {
        // Calculate net change for this file
        let totalAdditions = 0;
        let totalDeletions = 0;

        for (const commitHash of windowCommits) {
          const stats = lineStatsPerCommit.get(commitHash);
          if (stats) {
            // This is total stats for commit, not per-file
            // For simplicity, we'll estimate based on commit count
            totalAdditions += stats.additions;
            totalDeletions += stats.deletions;
          }
        }

        const netChange = totalAdditions - totalDeletions;
        const totalChurn = totalAdditions + totalDeletions;

        // Efficiency: how much of the work was "kept"
        // Low efficiency (high churn, low net) = thrashing
        const efficiency = totalChurn > 0
          ? Math.round((Math.abs(netChange) / totalChurn) * 100)
          : 0;

        // Only flag if efficiency is low (< 50%)
        if (efficiency < 50) {
          thrashingFiles.push({
            path: file,
            touchCount: maxTouchesInWindow,
            commits: windowCommits,
            netChange,
            efficiency,
          });
        }
      }
    }
  }

  // Sort by touch count (worst thrashing first)
  thrashingFiles.sort((a, b) => b.touchCount - a.touchCount);

  // Calculate total thrashing time (rough estimate)
  const totalThrashingMinutes = thrashingFiles.reduce((sum, f) => {
    // Estimate 5 minutes per touch for thrashing files
    return sum + (f.touchCount * 5);
  }, 0);

  const detected = thrashingFiles.length > 0;
  const message = detected
    ? `${thrashingFiles.length} file${thrashingFiles.length > 1 ? 's' : ''} with repeated edits (potential confusion)`
    : 'No thrashing detected';

  return {
    detected,
    files: thrashingFiles.slice(0, 5), // Top 5 worst
    totalThrashingMinutes,
    message,
  };
}
