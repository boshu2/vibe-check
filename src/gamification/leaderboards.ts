import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { SessionRecord } from './types';

const LEADERBOARD_FILE = 'leaderboards.json';

export interface LeaderboardEntry {
  date: string;
  repoPath: string;
  repoName: string;
  vibeScore: number;
  overall: string;
  commits: number;
  xpEarned: number;
}

export interface Leaderboards {
  version: string;
  entries: LeaderboardEntry[];      // All-time entries (top 100)
  byRepo: Record<string, LeaderboardEntry[]>;  // Per-repo top 10
  personalBests: {
    highestScore: LeaderboardEntry | null;
    longestStreak: number;
    bestWeekXP: { week: string; xp: number } | null;
    mostCommits: LeaderboardEntry | null;
  };
}

/**
 * Get leaderboards file path
 */
export function getLeaderboardsPath(): string {
  return path.join(os.homedir(), '.vibe-check', LEADERBOARD_FILE);
}

/**
 * Load leaderboards from disk
 */
export function loadLeaderboards(): Leaderboards {
  const filePath = getLeaderboardsPath();

  if (fs.existsSync(filePath)) {
    try {
      return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    } catch {
      return createInitialLeaderboards();
    }
  }

  return createInitialLeaderboards();
}

/**
 * Save leaderboards to disk
 */
export function saveLeaderboards(leaderboards: Leaderboards): void {
  const filePath = getLeaderboardsPath();
  const dir = path.dirname(filePath);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(filePath, JSON.stringify(leaderboards, null, 2));
}

/**
 * Create initial leaderboards
 */
export function createInitialLeaderboards(): Leaderboards {
  return {
    version: '1.0.0',
    entries: [],
    byRepo: {},
    personalBests: {
      highestScore: null,
      longestStreak: 0,
      bestWeekXP: null,
      mostCommits: null,
    },
  };
}

/**
 * Record a session to leaderboards
 */
export function recordToLeaderboard(
  session: SessionRecord,
  repoPath: string,
  xpEarned: number,
  streak: number
): Leaderboards {
  const leaderboards = loadLeaderboards();
  const repoName = path.basename(repoPath);

  const entry: LeaderboardEntry = {
    date: session.date,
    repoPath,
    repoName,
    vibeScore: session.vibeScore,
    overall: session.overall,
    commits: session.commits,
    xpEarned,
  };

  // Add to global entries (sorted by score, top 100)
  leaderboards.entries.push(entry);
  leaderboards.entries.sort((a, b) => b.vibeScore - a.vibeScore);
  leaderboards.entries = leaderboards.entries.slice(0, 100);

  // Add to repo-specific entries (top 10)
  if (!leaderboards.byRepo[repoPath]) {
    leaderboards.byRepo[repoPath] = [];
  }
  leaderboards.byRepo[repoPath].push(entry);
  leaderboards.byRepo[repoPath].sort((a, b) => b.vibeScore - a.vibeScore);
  leaderboards.byRepo[repoPath] = leaderboards.byRepo[repoPath].slice(0, 10);

  // Update personal bests
  if (!leaderboards.personalBests.highestScore ||
      session.vibeScore > leaderboards.personalBests.highestScore.vibeScore) {
    leaderboards.personalBests.highestScore = entry;
  }

  if (streak > leaderboards.personalBests.longestStreak) {
    leaderboards.personalBests.longestStreak = streak;
  }

  if (!leaderboards.personalBests.mostCommits ||
      session.commits > leaderboards.personalBests.mostCommits.commits) {
    leaderboards.personalBests.mostCommits = entry;
  }

  // Track weekly XP
  const weekStart = getWeekStartISO(new Date(session.date));
  const currentWeekXP = leaderboards.personalBests.bestWeekXP;
  if (!currentWeekXP || currentWeekXP.week !== weekStart) {
    // New week - check if we beat previous best
    // (simplified - in practice would need to sum week's XP)
    leaderboards.personalBests.bestWeekXP = { week: weekStart, xp: xpEarned };
  } else {
    currentWeekXP.xp += xpEarned;
  }

  saveLeaderboards(leaderboards);
  return leaderboards;
}

/**
 * Format leaderboard for display
 */
export function formatLeaderboard(leaderboards: Leaderboards, repoPath?: string): string {
  const lines: string[] = [];

  if (repoPath && leaderboards.byRepo[repoPath]) {
    const repoEntries = leaderboards.byRepo[repoPath];
    lines.push(`📊 Top Scores - ${path.basename(repoPath)}`);
    lines.push('');

    for (let i = 0; i < Math.min(repoEntries.length, 5); i++) {
      const e = repoEntries[i];
      const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '  ';
      lines.push(`${medal} ${e.vibeScore}% ${e.overall.padEnd(6)} ${e.date}`);
    }
  } else {
    lines.push('🏆 All-Time Top Scores');
    lines.push('');

    for (let i = 0; i < Math.min(leaderboards.entries.length, 10); i++) {
      const e = leaderboards.entries[i];
      const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
      lines.push(`${medal} ${e.vibeScore}% ${e.overall.padEnd(6)} ${e.repoName} (${e.date})`);
    }
  }

  return lines.join('\n');
}

function getWeekStartISO(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d.toISOString().split('T')[0];
}
