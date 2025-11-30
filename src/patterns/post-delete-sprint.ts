import { TimelineSession } from '../types';

export interface PostDeleteSprintResult {
  detected: boolean;
  deleteSession: {
    id: string;
    linesDeleted: number;
    timestamp: Date;
  } | null;
  sprintSession: {
    id: string;
    features: number;
    duration: number;
    velocity: number; // features per hour
  } | null;
  velocityIncrease: number; // percentage increase vs baseline
  message: string;
}

/**
 * Detect post-delete sprints across sessions.
 *
 * Definition: Deletions > 2× additions in one session, then velocity >50% above baseline
 * Value: Shows ROI of simplification
 */
export function detectPostDeleteSprint(
  sessions: TimelineSession[],
  commitStats: Map<string, { additions: number; deletions: number }>
): PostDeleteSprintResult {
  if (sessions.length < 2) {
    return {
      detected: false,
      deleteSession: null,
      sprintSession: null,
      velocityIncrease: 0,
      message: 'Not enough sessions to detect pattern',
    };
  }

  // Calculate baseline velocity (features per hour across all sessions)
  let totalFeatures = 0;
  let totalMinutes = 0;
  for (const session of sessions) {
    const featCount = session.commits.filter(c => c.type === 'feat').length;
    totalFeatures += featCount;
    totalMinutes += session.duration;
  }
  const baselineVelocity = totalMinutes > 0 ? (totalFeatures / totalMinutes) * 60 : 0;

  // Find sessions with heavy deletions (deletions > 2× additions)
  for (let i = 0; i < sessions.length - 1; i++) {
    const session = sessions[i];

    // Calculate total additions/deletions for this session
    let sessionAdditions = 0;
    let sessionDeletions = 0;
    for (const commit of session.commits) {
      const stats = commitStats.get(commit.hash);
      if (stats) {
        sessionAdditions += stats.additions;
        sessionDeletions += stats.deletions;
      }
    }

    // Check if this is a "delete session" (deletions > 2× additions)
    const isDeleteSession = sessionDeletions > sessionAdditions * 2 && sessionDeletions > 100;

    if (isDeleteSession) {
      // Check subsequent sessions for sprint behavior
      for (let j = i + 1; j < sessions.length; j++) {
        const sprintCandidate = sessions[j];
        const sprintFeatures = sprintCandidate.commits.filter(c => c.type === 'feat').length;
        const sprintDuration = sprintCandidate.duration;

        // Calculate sprint velocity
        const sprintVelocity = sprintDuration > 0 ? (sprintFeatures / sprintDuration) * 60 : 0;

        // Check if sprint velocity is >50% above baseline
        const velocityIncrease = baselineVelocity > 0
          ? ((sprintVelocity - baselineVelocity) / baselineVelocity) * 100
          : 0;

        if (velocityIncrease > 50 && sprintFeatures >= 3) {
          return {
            detected: true,
            deleteSession: {
              id: session.id,
              linesDeleted: sessionDeletions,
              timestamp: session.start,
            },
            sprintSession: {
              id: sprintCandidate.id,
              features: sprintFeatures,
              duration: sprintDuration,
              velocity: Math.round(sprintVelocity * 10) / 10,
            },
            velocityIncrease: Math.round(velocityIncrease),
            message: `${Math.round(velocityIncrease)}% faster after removing ${sessionDeletions} lines`,
          };
        }
      }
    }
  }

  return {
    detected: false,
    deleteSession: null,
    sprintSession: null,
    velocityIncrease: 0,
    message: 'No post-delete sprint detected',
  };
}
