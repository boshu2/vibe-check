import * as fs from 'fs';
import * as path from 'path';

export interface SessionRecord {
  id: string;
  startedAt: string;
  endedAt: string;
  commits: number;
  trustPassRate: number;
  reworkRatio: number;
  spirals: number;
  vibeScore?: number;
}

export interface SessionHistory {
  sessions: SessionRecord[];
  baseline: {
    trustPassRate: number;
    reworkRatio: number;
    avgCommits: number;
    avgDuration: number; // minutes
  } | null;
  lastUpdated: string;
}

const SESSION_GAP_MINUTES = 120; // 2 hours = new session
const MIN_SESSIONS_FOR_BASELINE = 5;

export function getSessionsPath(repoPath: string = process.cwd()): string {
  return path.join(repoPath, '.vibe-check', 'sessions.json');
}

export function loadSessionHistory(repoPath: string = process.cwd()): SessionHistory {
  const sessionsPath = getSessionsPath(repoPath);

  if (!fs.existsSync(sessionsPath)) {
    return {
      sessions: [],
      baseline: null,
      lastUpdated: new Date().toISOString(),
    };
  }

  try {
    const data = JSON.parse(fs.readFileSync(sessionsPath, 'utf-8'));
    return data;
  } catch {
    return {
      sessions: [],
      baseline: null,
      lastUpdated: new Date().toISOString(),
    };
  }
}

export function saveSessionHistory(history: SessionHistory, repoPath: string = process.cwd()): void {
  const sessionsPath = getSessionsPath(repoPath);
  const dir = path.dirname(sessionsPath);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  history.lastUpdated = new Date().toISOString();
  fs.writeFileSync(sessionsPath, JSON.stringify(history, null, 2));
}

export function recordSession(
  repoPath: string,
  startedAt: Date,
  endedAt: Date,
  commits: number,
  trustPassRate: number,
  reworkRatio: number,
  spirals: number,
  vibeScore?: number
): SessionHistory {
  const history = loadSessionHistory(repoPath);

  // Check if this session already exists (same start time)
  const sessionId = startedAt.toISOString().slice(0, 16); // minute precision
  const existing = history.sessions.find(s => s.id === sessionId);

  if (existing) {
    // Update existing session
    existing.endedAt = endedAt.toISOString();
    existing.commits = commits;
    existing.trustPassRate = trustPassRate;
    existing.reworkRatio = reworkRatio;
    existing.spirals = spirals;
    if (vibeScore !== undefined) existing.vibeScore = vibeScore;
  } else {
    // Add new session
    history.sessions.push({
      id: sessionId,
      startedAt: startedAt.toISOString(),
      endedAt: endedAt.toISOString(),
      commits,
      trustPassRate,
      reworkRatio,
      spirals,
      vibeScore,
    });
  }

  // Keep last 100 sessions
  if (history.sessions.length > 100) {
    history.sessions = history.sessions.slice(-100);
  }

  // Recalculate baseline
  history.baseline = calculateBaseline(history.sessions);

  saveSessionHistory(history, repoPath);
  return history;
}

export function calculateBaseline(sessions: SessionRecord[]): SessionHistory['baseline'] {
  if (sessions.length < MIN_SESSIONS_FOR_BASELINE) {
    return null;
  }

  // Use last 20 sessions for baseline
  const recent = sessions.slice(-20);

  const avgTrust = recent.reduce((sum, s) => sum + s.trustPassRate, 0) / recent.length;
  const avgRework = recent.reduce((sum, s) => sum + s.reworkRatio, 0) / recent.length;
  const avgCommits = recent.reduce((sum, s) => sum + s.commits, 0) / recent.length;

  const avgDuration = recent.reduce((sum, s) => {
    const start = new Date(s.startedAt);
    const end = new Date(s.endedAt);
    return sum + (end.getTime() - start.getTime()) / 60000;
  }, 0) / recent.length;

  return {
    trustPassRate: Math.round(avgTrust),
    reworkRatio: Math.round(avgRework),
    avgCommits: Math.round(avgCommits),
    avgDuration: Math.round(avgDuration),
  };
}

export interface SessionDetection {
  isNewSession: boolean;
  sessionStart: Date;
  gapMinutes: number | null;
}

export function detectSessionBoundary(
  commits: Array<{ date: Date }>,
  repoPath: string = process.cwd()
): SessionDetection {
  if (commits.length === 0) {
    return {
      isNewSession: true,
      sessionStart: new Date(),
      gapMinutes: null,
    };
  }

  // Sort commits by date (oldest first)
  const sorted = [...commits].sort((a, b) => a.date.getTime() - b.date.getTime());

  // Find the session start (first commit after a gap > SESSION_GAP_MINUTES)
  let sessionStart = sorted[0].date;
  let maxGap = 0;

  for (let i = 1; i < sorted.length; i++) {
    const gap = (sorted[i].date.getTime() - sorted[i - 1].date.getTime()) / 60000;
    if (gap > SESSION_GAP_MINUTES) {
      sessionStart = sorted[i].date;
      maxGap = gap;
    }
  }

  // Check if there's been a gap since the last recorded session
  const history = loadSessionHistory(repoPath);
  let gapFromLastSession: number | null = null;

  if (history.sessions.length > 0) {
    const lastSession = history.sessions[history.sessions.length - 1];
    const lastEnd = new Date(lastSession.endedAt);
    gapFromLastSession = (sessionStart.getTime() - lastEnd.getTime()) / 60000;
  }

  return {
    isNewSession: maxGap > SESSION_GAP_MINUTES || (gapFromLastSession !== null && gapFromLastSession > SESSION_GAP_MINUTES),
    sessionStart,
    gapMinutes: gapFromLastSession,
  };
}

export interface BaselineComparison {
  hasBaseline: boolean;
  baseline: SessionHistory['baseline'];
  current: {
    trustPassRate: number;
    reworkRatio: number;
    commits: number;
    duration: number;
  };
  comparison: {
    trustDelta: number;     // positive = better than baseline
    reworkDelta: number;    // negative = better than baseline
    verdict: 'above' | 'below' | 'normal';
    message: string;
  } | null;
}

export function compareToBaseline(
  repoPath: string,
  trustPassRate: number,
  reworkRatio: number,
  commits: number,
  durationMinutes: number
): BaselineComparison {
  const history = loadSessionHistory(repoPath);

  const current = {
    trustPassRate,
    reworkRatio,
    commits,
    duration: durationMinutes,
  };

  if (!history.baseline) {
    const sessionsNeeded = MIN_SESSIONS_FOR_BASELINE - history.sessions.length;
    return {
      hasBaseline: false,
      baseline: null,
      current,
      comparison: null,
    };
  }

  const trustDelta = trustPassRate - history.baseline.trustPassRate;
  const reworkDelta = reworkRatio - history.baseline.reworkRatio;

  // Determine verdict
  let verdict: 'above' | 'below' | 'normal';
  let message: string;

  const trustBetter = trustDelta > 5;
  const trustWorse = trustDelta < -10;
  const reworkBetter = reworkDelta < -5;
  const reworkWorse = reworkDelta > 10;

  if (trustBetter && !reworkWorse) {
    verdict = 'above';
    message = 'Better than your usual - nice flow!';
  } else if (trustWorse || reworkWorse) {
    verdict = 'below';
    if (trustWorse && reworkWorse) {
      message = 'Rougher than usual - consider taking a break';
    } else if (trustWorse) {
      message = 'Trust lower than usual - slow down and verify';
    } else {
      message = 'More rework than usual - might be spiraling';
    }
  } else {
    verdict = 'normal';
    message = 'Typical session for you';
  }

  return {
    hasBaseline: true,
    baseline: history.baseline,
    current,
    comparison: {
      trustDelta,
      reworkDelta,
      verdict,
      message,
    },
  };
}
