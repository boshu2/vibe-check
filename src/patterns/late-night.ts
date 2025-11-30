import { TimelineEvent, TimelineSession, FixChain } from '../types';

export interface LateNightSpiralResult {
  detected: boolean;
  spirals: LateNightSpiral[];
  totalDuration: number; // minutes of late-night debugging
  message: string;
}

export interface LateNightSpiral {
  sessionId: string;
  startTime: Date;
  endTime: Date;
  duration: number; // minutes
  fixCount: number;
  component: string;
  resolved: boolean; // did they fix it that night?
  nextDayResolution?: {
    duration: number; // time to fix with fresh eyes
    improvement: number; // ratio of time saved
  };
}

// Late night threshold: 22:00 (10 PM)
const LATE_NIGHT_HOUR = 22;
// Early morning threshold: 06:00 (6 AM)
const EARLY_MORNING_HOUR = 6;

/**
 * Detect late-night spirals: debug sessions after 22:00 with 3+ fix commits.
 *
 * Definition: Debug session after 22:00 with 3+ fix commits
 * Value: Show that tired debugging is inefficient
 *
 * Enhanced: Also compare with "fresh eyes" resolution time if available
 */
export function detectLateNightSpiral(
  sessions: TimelineSession[]
): LateNightSpiralResult {
  const lateNightSpirals: LateNightSpiral[] = [];

  for (const session of sessions) {
    // Check if session is during late night hours
    const sessionHour = session.start.getHours();
    const isLateNight = sessionHour >= LATE_NIGHT_HOUR || sessionHour < EARLY_MORNING_HOUR;

    if (!isLateNight) continue;

    // Check for spirals in this session
    for (const spiral of session.spirals) {
      // A spiral is 3+ fix commits for same component
      if (spiral.commits < 3) continue;

      // Find if this component was fixed the next day
      const nextDayFix = findNextDayResolution(
        spiral.component,
        session,
        sessions
      );

      lateNightSpirals.push({
        sessionId: session.id,
        startTime: spiral.firstCommit,
        endTime: spiral.lastCommit,
        duration: spiral.duration,
        fixCount: spiral.commits,
        component: spiral.component,
        resolved: !nextDayFix, // If no next-day fix, they solved it at night
        nextDayResolution: nextDayFix,
      });
    }

    // Also check for high fix density even without formal spirals
    const fixCommits = session.commits.filter(c => c.type === 'fix');
    if (fixCommits.length >= 3 && session.spirals.length === 0) {
      // Late night session with lots of fixes but no detected spiral
      // Could be a diffuse debugging session
      const components = new Set(fixCommits.map(c => c.scope || 'unknown'));
      for (const component of components) {
        const componentFixes = fixCommits.filter(c => (c.scope || 'unknown') === component);
        if (componentFixes.length >= 3) {
          const duration = componentFixes.length > 1
            ? Math.round((componentFixes[componentFixes.length - 1].timestamp.getTime() -
                componentFixes[0].timestamp.getTime()) / (1000 * 60))
            : session.duration;

          lateNightSpirals.push({
            sessionId: session.id,
            startTime: componentFixes[0].timestamp,
            endTime: componentFixes[componentFixes.length - 1].timestamp,
            duration,
            fixCount: componentFixes.length,
            component,
            resolved: true, // Assume resolved if no next-day data
          });
        }
      }
    }
  }

  // Calculate total duration
  const totalDuration = lateNightSpirals.reduce((sum, s) => sum + s.duration, 0);

  // Generate message
  let message = '';
  if (lateNightSpirals.length > 0) {
    const withFreshEyes = lateNightSpirals.filter(s => s.nextDayResolution);
    if (withFreshEyes.length > 0) {
      const avgImprovement = withFreshEyes.reduce(
        (sum, s) => sum + (s.nextDayResolution?.improvement || 0), 0
      ) / withFreshEyes.length;
      message = `🌙 ${lateNightSpirals.length} late-night spiral${lateNightSpirals.length > 1 ? 's' : ''}: ` +
        `${formatDuration(totalDuration)} debugging after 10pm. ` +
        `Fresh eyes solve ${Math.round(avgImprovement * 100)}% faster.`;
    } else {
      message = `🌙 ${lateNightSpirals.length} late-night spiral${lateNightSpirals.length > 1 ? 's' : ''}: ` +
        `${formatDuration(totalDuration)} debugging after 10pm. Consider sleeping on it!`;
    }
  }

  return {
    detected: lateNightSpirals.length > 0,
    spirals: lateNightSpirals,
    totalDuration,
    message,
  };
}

/**
 * Check if the same component was fixed more quickly the next day
 */
function findNextDayResolution(
  component: string,
  lateNightSession: TimelineSession,
  allSessions: TimelineSession[]
): { duration: number; improvement: number } | undefined {
  // Look for sessions the next day
  const lateNightDate = lateNightSession.start.toDateString();

  for (const session of allSessions) {
    // Skip the late night session itself
    if (session.id === lateNightSession.id) continue;

    // Check if this session is the next day (or later morning)
    const sessionDate = session.start.toDateString();
    const sessionHour = session.start.getHours();

    // Must be after the late night session
    if (session.start <= lateNightSession.end) continue;

    // Look for fixes to the same component
    const componentFixes = session.commits.filter(
      c => c.type === 'fix' && (c.scope || 'unknown') === component
    );

    if (componentFixes.length > 0) {
      // Found a next-day resolution
      // Calculate how long it took with fresh eyes
      const freshDuration = componentFixes.length > 1
        ? Math.round((componentFixes[componentFixes.length - 1].timestamp.getTime() -
            componentFixes[0].timestamp.getTime()) / (1000 * 60))
        : 15; // Assume 15 minutes for single-commit fixes

      // Compare with late night duration
      const lateNightDuration = lateNightSession.spirals.find(
        s => s.component === component
      )?.duration || 30;

      const improvement = lateNightDuration > 0
        ? (lateNightDuration - freshDuration) / lateNightDuration
        : 0;

      return {
        duration: freshDuration,
        improvement: Math.max(0, improvement), // Only positive improvements
      };
    }
  }

  return undefined;
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
