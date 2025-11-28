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
