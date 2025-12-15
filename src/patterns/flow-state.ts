import { TimelineEvent } from '../types.js';

export interface FlowStateResult {
  detected: boolean;
  duration: number; // minutes
  commits: number;
  velocity: number; // commits per hour
  peakType: string; // most common commit type during flow
}

/**
 * Detect flow state in a session.
 *
 * Definition: 5+ non-fix commits, no gap >30m, duration >45m
 * Value: Shows when you're in the zone
 */
export function detectFlowState(
  events: TimelineEvent[],
  sessionDuration: number
): FlowStateResult {
  // Count non-fix commits
  const nonFixCommits = events.filter(e => e.type !== 'fix');
  const nonFixCount = nonFixCommits.length;

  // Find max gap between consecutive commits
  let maxGap = 0;
  for (let i = 1; i < events.length; i++) {
    maxGap = Math.max(maxGap, events[i].gapMinutes);
  }

  // Check flow state conditions
  const detected = nonFixCount >= 5 && maxGap <= 30 && sessionDuration >= 45;

  // Calculate velocity (commits per hour)
  const velocity = sessionDuration > 0
    ? (events.length / sessionDuration) * 60
    : 0;

  // Find peak commit type during flow
  const typeCounts: Record<string, number> = {};
  for (const event of nonFixCommits) {
    typeCounts[event.type] = (typeCounts[event.type] || 0) + 1;
  }
  const peakType = Object.entries(typeCounts)
    .sort((a, b) => b[1] - a[1])[0]?.[0] || 'other';

  return {
    detected,
    duration: sessionDuration,
    commits: events.length,
    velocity: Math.round(velocity * 10) / 10,
    peakType,
  };
}
