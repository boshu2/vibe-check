import simpleGit, { SimpleGit, LogResult, DefaultLogFields } from 'simple-git';
import { Commit } from './types';

const COMMIT_TYPES = ['feat', 'fix', 'docs', 'chore', 'refactor', 'test', 'style'] as const;

export async function getCommits(
  repoPath: string,
  since?: string,
  until?: string
): Promise<Commit[]> {
  const git: SimpleGit = simpleGit(repoPath);

  // Build options for git log
  const options: Record<string, string | number | boolean> = {};

  if (since) {
    options['--since'] = since;
  }
  if (until) {
    options['--until'] = until;
  }

  try {
    const log: LogResult<DefaultLogFields> = await git.log(options);

    return log.all.map((entry) => parseCommit(entry));
  } catch (error) {
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

    if (COMMIT_TYPES.includes(normalizedType as typeof COMMIT_TYPES[number])) {
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
 * Get file-level statistics for semantic-free metrics.
 */
export async function getFileStats(
  repoPath: string,
  since?: string,
  until?: string
): Promise<FileStats> {
  const git: SimpleGit = simpleGit(repoPath);
  const filesPerCommit = new Map<string, string[]>();
  const lineStats: { additions: number; deletions: number }[] = [];

  // Build options for git log
  const logOptions: Record<string, string | number | boolean> = {};
  if (since) logOptions['--since'] = since;
  if (until) logOptions['--until'] = until;

  try {
    // Get log with file names
    const log = await git.log(logOptions);

    for (const commit of log.all) {
      const hash = commit.hash.substring(0, 7);

      // Get diff stats for this commit
      try {
        const diffStat = await git.raw(['diff-tree', '--numstat', '--root', '-r', commit.hash]);
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

        filesPerCommit.set(hash, files);
        lineStats.push({ additions, deletions });
      } catch {
        // If diff-tree fails, just record empty
        filesPerCommit.set(hash, []);
        lineStats.push({ additions: 0, deletions: 0 });
      }
    }
  } catch {
    // Return empty stats on error - silent fail
  }

  return { filesPerCommit, lineStats };
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
  const git: SimpleGit = simpleGit(repoPath);
  const filesPerCommit = new Map<string, string[]>();
  const lineStatsPerCommit = new Map<string, { additions: number; deletions: number }>();

  // Build options for git log
  const logOptions: Record<string, string | number | boolean> = {};
  if (since) logOptions['--since'] = since;
  if (until) logOptions['--until'] = until;

  try {
    const log = await git.log(logOptions);

    for (const commit of log.all) {
      const hash = commit.hash.substring(0, 7);

      try {
        const diffStat = await git.raw(['diff-tree', '--numstat', '--root', '-r', commit.hash]);
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

        filesPerCommit.set(hash, files);
        lineStatsPerCommit.set(hash, { additions, deletions });
      } catch {
        filesPerCommit.set(hash, []);
        lineStatsPerCommit.set(hash, { additions: 0, deletions: 0 });
      }
    }
  } catch {
    // Return empty stats on error
  }

  return { filesPerCommit, lineStatsPerCommit };
}
