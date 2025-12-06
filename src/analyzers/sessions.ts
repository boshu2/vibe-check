/**
 * Session Detection Algorithm (VIBE-046)
 *
 * Identifies work sessions from git history using configurable time gap threshold.
 * Proven algorithm from release-engineering retrospective (46 sessions detected from 475 commits).
 *
 * Default threshold: 90 minutes between commits starts a new session.
 */

import { Commit } from '../types';

export interface DetectedSession {
  sessionId: number;
  startDate: Date;
  endDate: Date;
  durationMinutes: number;
  commits: Commit[];
  commitCount: number;
}

export interface SessionStats {
  totalSessions: number;
  totalCommits: number;
  avgCommitsPerSession: number;
  avgDurationMinutes: number;
  medianDurationMinutes: number;
  longestSessionMinutes: number;
  shortestSessionMinutes: number;
}

export interface SessionDetectionResult {
  sessions: DetectedSession[];
  stats: SessionStats;
  analysisRange: {
    from: Date;
    to: Date;
  };
}

/**
 * Detect work sessions from a list of commits.
 *
 * A new session starts when the gap between consecutive commits exceeds the threshold.
 *
 * @param commits List of commits (will be sorted by date)
 * @param gapThresholdMinutes Minutes between commits to start new session (default: 90)
 * @returns Session detection result with sessions and statistics
 */
export function detectSessions(
  commits: Commit[],
  gapThresholdMinutes: number = 90
): SessionDetectionResult {
  if (commits.length === 0) {
    return {
      sessions: [],
      stats: {
        totalSessions: 0,
        totalCommits: 0,
        avgCommitsPerSession: 0,
        avgDurationMinutes: 0,
        medianDurationMinutes: 0,
        longestSessionMinutes: 0,
        shortestSessionMinutes: 0,
      },
      analysisRange: {
        from: new Date(),
        to: new Date(),
      },
    };
  }

  // Sort commits by date (oldest first)
  const sortedCommits = [...commits].sort(
    (a, b) => a.date.getTime() - b.date.getTime()
  );

  const gapThresholdMs = gapThresholdMinutes * 60 * 1000;
  const sessions: DetectedSession[] = [];
  let currentSessionCommits: Commit[] = [];
  let sessionId = 1;

  for (const commit of sortedCommits) {
    if (currentSessionCommits.length === 0) {
      // Start first session
      currentSessionCommits = [commit];
    } else {
      const lastCommit = currentSessionCommits[currentSessionCommits.length - 1];
      const gap = commit.date.getTime() - lastCommit.date.getTime();

      if (gap > gapThresholdMs) {
        // Gap exceeded - save current session and start new one
        sessions.push(createSession(sessionId, currentSessionCommits));
        sessionId++;
        currentSessionCommits = [commit];
      } else {
        // Continue current session
        currentSessionCommits.push(commit);
      }
    }
  }

  // Don't forget the last session
  if (currentSessionCommits.length > 0) {
    sessions.push(createSession(sessionId, currentSessionCommits));
  }

  // Calculate statistics
  const stats = calculateStats(sessions);

  return {
    sessions,
    stats,
    analysisRange: {
      from: sortedCommits[0].date,
      to: sortedCommits[sortedCommits.length - 1].date,
    },
  };
}

function createSession(sessionId: number, commits: Commit[]): DetectedSession {
  const startDate = commits[0].date;
  const endDate = commits[commits.length - 1].date;
  const durationMinutes =
    (endDate.getTime() - startDate.getTime()) / (60 * 1000);

  return {
    sessionId,
    startDate,
    endDate,
    durationMinutes: Math.round(durationMinutes * 10) / 10, // Round to 1 decimal
    commits,
    commitCount: commits.length,
  };
}

function calculateStats(sessions: DetectedSession[]): SessionStats {
  if (sessions.length === 0) {
    return {
      totalSessions: 0,
      totalCommits: 0,
      avgCommitsPerSession: 0,
      avgDurationMinutes: 0,
      medianDurationMinutes: 0,
      longestSessionMinutes: 0,
      shortestSessionMinutes: 0,
    };
  }

  const totalCommits = sessions.reduce((sum, s) => sum + s.commitCount, 0);
  const durations = sessions.map((s) => s.durationMinutes).sort((a, b) => a - b);

  // Calculate median
  const mid = Math.floor(durations.length / 2);
  const medianDuration =
    durations.length % 2 === 0
      ? (durations[mid - 1] + durations[mid]) / 2
      : durations[mid];

  return {
    totalSessions: sessions.length,
    totalCommits,
    avgCommitsPerSession:
      Math.round((totalCommits / sessions.length) * 10) / 10,
    avgDurationMinutes:
      Math.round(
        (durations.reduce((sum, d) => sum + d, 0) / durations.length) * 10
      ) / 10,
    medianDurationMinutes: Math.round(medianDuration * 10) / 10,
    longestSessionMinutes: durations[durations.length - 1],
    shortestSessionMinutes: durations[0],
  };
}
