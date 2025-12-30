import { simpleGit, SimpleGit, LogResult, DefaultLogFields } from 'simple-git';
import { Commit } from './types.js';

const COMMIT_TYPES = ['feat', 'fix', 'docs', 'chore', 'refactor', 'test', 'style', 'tracer'] as const;

// Tracer bullet commit patterns (tb: is shorthand for tracer:)
const TRACER_ALIASES = ['tb'] as const;

export async function getCommits(
  repoPath: string,
  since?: string,
  until?: string,
  timeoutSeconds?: number,
  maxCommits?: number
): Promise<Commit[]> {
  // Configure git with timeout if provided
  const git: SimpleGit = simpleGit(repoPath, {
    timeout: {
      block: timeoutSeconds ? timeoutSeconds * 1000 : 120000, // Default 120s
    },
  });

  // Build options for git log
  const options: Record<string, string | number | boolean> = {};

  if (since) {
    options['--since'] = since;
  }
  if (until) {
    options['--until'] = until;
  }
  // Add max-count if limit specified
  if (maxCommits) {
    options['--max-count'] = maxCommits;
  }

  try {
    const log: LogResult<DefaultLogFields> = await git.log(options);
    const commitCount = log.all.length;

    // Warn if we hit the max commits limit
    if (maxCommits && commitCount >= maxCommits) {
      console.warn(`\nWarning: Analyzed first ${commitCount} commits (limit: ${maxCommits})`);
      console.warn(`Use --max-commits to adjust the limit.\n`);
    }

    return log.all.map((entry) => parseCommit(entry));
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);

    // Check if this is a timeout error
    if (errorMsg.includes('timeout') || errorMsg.includes('ETIMEDOUT')) {
      console.error(`\nError: Git operation timed out after ${timeoutSeconds || 'default'}s`);
      console.error('Try increasing the timeout with --timeout <seconds>\n');
      process.exit(2); // ExitCode.GIT_ERROR
    }

    if (error instanceof Error) {
      throw new Error(`Failed to read git log: ${error.message}`);
    }
    throw error;
  }
}

function parseCommit(entry: DefaultLogFields): Commit {
  const { hash, date, message, author_name } = entry;

  // Parse conventional commit format: type(scope): description
  const conventionalMatch = message.match(/^(\w+)(?:\(([^)]+)\))?:\s*(.+)/);

  let type: Commit['type'] = 'other';
  let scope: string | null = null;

  if (conventionalMatch) {
    const [, rawType, rawScope] = conventionalMatch;
    const normalizedType = rawType.toLowerCase();

    // Check for tracer aliases (tb: -> tracer)
    if (TRACER_ALIASES.includes(normalizedType as typeof TRACER_ALIASES[number])) {
      type = 'tracer';
    } else if (COMMIT_TYPES.includes(normalizedType as typeof COMMIT_TYPES[number])) {
      type = normalizedType as Commit['type'];
    }
    scope = rawScope || null;
  }

  return {
    hash: hash.substring(0, 7),
    date: new Date(date),
    message: message.split('\n')[0], // First line only
    type,
    scope,
    author: author_name,
  };
}

export async function isGitRepo(repoPath: string): Promise<boolean> {
  const git: SimpleGit = simpleGit(repoPath);
  try {
    await git.status();
    return true;
  } catch {
    return false;
  }
}

/**
 * Get the latest commit hash in the repo
 */
export async function getLatestCommitHash(repoPath: string): Promise<string> {
  const git: SimpleGit = simpleGit(repoPath);
  try {
    const log = await git.log({ n: 1 });
    return log.latest?.hash.substring(0, 7) || '';
  } catch {
    return '';
  }
}

/**
 * Get commits since a specific commit hash (for incremental sync)
 */
export async function getCommitsSince(
  repoPath: string,
  sinceHash: string
): Promise<Commit[]> {
  const git: SimpleGit = simpleGit(repoPath);

  try {
    // Get commits after the given hash
    const log = await git.log({ from: sinceHash, to: 'HEAD' });
    return log.all.map((entry) => parseCommit(entry));
  } catch {
    // If hash doesn't exist or error, return empty
    return [];
  }
}

/**
 * Check if a commit hash exists in the repo
 */
export async function commitExists(repoPath: string, hash: string): Promise<boolean> {
  const git: SimpleGit = simpleGit(repoPath);
  try {
    await git.raw(['cat-file', '-t', hash]);
    return true;
  } catch {
    return false;
  }
}

export interface FileStats {
  filesPerCommit: Map<string, string[]>;
  lineStats: { additions: number; deletions: number }[];
}

export interface CommitStats {
  filesPerCommit: Map<string, string[]>;
  lineStatsPerCommit: Map<string, { additions: number; deletions: number }>;
}

/**
 * Internal: Parse diff stats from git diff-tree output.
 * Extracted to avoid duplication between getFileStats and getCommitStats.
 */
function parseDiffStats(diffStat: string): {
  files: string[];
  additions: number;
  deletions: number;
} {
  const lines = diffStat.trim().split('\n').filter(l => l.length > 0);
  const files: string[] = [];
  let additions = 0;
  let deletions = 0;

  for (const line of lines) {
    const parts = line.split('\t');
    if (parts.length >= 3) {
      const add = parseInt(parts[0], 10) || 0;
      const del = parseInt(parts[1], 10) || 0;
      const file = parts[2];
      additions += add;
      deletions += del;
      files.push(file);
    }
  }

  return { files, additions, deletions };
}

/**
 * Internal: Get diff stats for a single commit.
 * Returns files changed and line stats.
 */
async function getCommitDiffStats(
  git: SimpleGit,
  commitHash: string
): Promise<{ files: string[]; additions: number; deletions: number }> {
  try {
    const diffStat = await git.raw(['diff-tree', '--numstat', '--root', '-r', commitHash]);
    return parseDiffStats(diffStat);
  } catch {
    return { files: [], additions: 0, deletions: 0 };
  }
}

/**
 * Internal: Core implementation for fetching git statistics.
 * Used by both getFileStats and getCommitStats to avoid code duplication.
 */
async function fetchGitStats(
  repoPath: string,
  since?: string,
  until?: string
): Promise<{
  filesPerCommit: Map<string, string[]>;
  lineStatsArray: { additions: number; deletions: number }[];
  lineStatsMap: Map<string, { additions: number; deletions: number }>;
}> {
  const git: SimpleGit = simpleGit(repoPath);
  const filesPerCommit = new Map<string, string[]>();
  const lineStatsArray: { additions: number; deletions: number }[] = [];
  const lineStatsMap = new Map<string, { additions: number; deletions: number }>();

  // Build options for git log
  const logOptions: Record<string, string | number | boolean> = {};
  if (since) logOptions['--since'] = since;
  if (until) logOptions['--until'] = until;

  try {
    const log = await git.log(logOptions);

    for (const commit of log.all) {
      const hash = commit.hash.substring(0, 7);
      const stats = await getCommitDiffStats(git, commit.hash);

      filesPerCommit.set(hash, stats.files);
      lineStatsArray.push({ additions: stats.additions, deletions: stats.deletions });
      lineStatsMap.set(hash, { additions: stats.additions, deletions: stats.deletions });
    }
  } catch {
    // Return empty stats on error - silent fail
  }

  return { filesPerCommit, lineStatsArray, lineStatsMap };
}

/**
 * Get file-level statistics for semantic-free metrics.
 */
export async function getFileStats(
  repoPath: string,
  since?: string,
  until?: string
): Promise<FileStats> {
  const { filesPerCommit, lineStatsArray } = await fetchGitStats(repoPath, since, until);
  return { filesPerCommit, lineStats: lineStatsArray };
}

/**
 * Get per-commit statistics for pattern detection.
 * Returns a map of commit hash -> stats
 */
export async function getCommitStats(
  repoPath: string,
  since?: string,
  until?: string
): Promise<CommitStats> {
  const { filesPerCommit, lineStatsMap } = await fetchGitStats(repoPath, since, until);
  return { filesPerCommit, lineStatsPerCommit: lineStatsMap };
}
