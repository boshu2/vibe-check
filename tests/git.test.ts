import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getCommits, isGitRepo, getFileStats } from '../src/git';

// Mock simple-git
vi.mock('simple-git', () => {
  const mockGit = {
    log: vi.fn(),
    status: vi.fn(),
    raw: vi.fn(),
  };
  return {
    default: vi.fn(() => mockGit),
  };
});

import simpleGit from 'simple-git';

describe('git', () => {
  let mockGit: ReturnType<typeof simpleGit>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockGit = simpleGit('/fake/path');
  });

  describe('getCommits', () => {
    it('returns empty array for no commits', async () => {
      (mockGit.log as ReturnType<typeof vi.fn>).mockResolvedValue({ all: [] });

      const commits = await getCommits('/fake/path');

      expect(commits).toEqual([]);
    });

    it('parses conventional commit format correctly', async () => {
      (mockGit.log as ReturnType<typeof vi.fn>).mockResolvedValue({
        all: [
          {
            hash: 'abc1234567890',
            date: '2025-11-28T10:00:00Z',
            message: 'feat(auth): add oauth support',
            author_name: 'Test User',
          },
        ],
      });

      const commits = await getCommits('/fake/path');

      expect(commits).toHaveLength(1);
      expect(commits[0].type).toBe('feat');
      expect(commits[0].scope).toBe('auth');
      expect(commits[0].hash).toBe('abc1234');
      expect(commits[0].author).toBe('Test User');
    });

    it('parses fix commits correctly', async () => {
      (mockGit.log as ReturnType<typeof vi.fn>).mockResolvedValue({
        all: [
          {
            hash: 'def1234567890',
            date: '2025-11-28T10:00:00Z',
            message: 'fix: resolve token refresh issue',
            author_name: 'Test User',
          },
        ],
      });

      const commits = await getCommits('/fake/path');

      expect(commits[0].type).toBe('fix');
      expect(commits[0].scope).toBeNull();
    });

    it('marks non-conventional commits as other', async () => {
      (mockGit.log as ReturnType<typeof vi.fn>).mockResolvedValue({
        all: [
          {
            hash: 'ghi1234567890',
            date: '2025-11-28T10:00:00Z',
            message: 'WIP random changes',
            author_name: 'Test User',
          },
        ],
      });

      const commits = await getCommits('/fake/path');

      expect(commits[0].type).toBe('other');
    });

    it('handles all commit types', async () => {
      const types = ['feat', 'fix', 'docs', 'chore', 'refactor', 'test', 'style'];

      (mockGit.log as ReturnType<typeof vi.fn>).mockResolvedValue({
        all: types.map((type, i) => ({
          hash: `${type}1234567890`,
          date: '2025-11-28T10:00:00Z',
          message: `${type}: test message`,
          author_name: 'Test User',
        })),
      });

      const commits = await getCommits('/fake/path');

      expect(commits).toHaveLength(7);
      types.forEach((type, i) => {
        expect(commits[i].type).toBe(type);
      });
    });

    it('passes since option to git log', async () => {
      (mockGit.log as ReturnType<typeof vi.fn>).mockResolvedValue({ all: [] });

      await getCommits('/fake/path', '1 week ago');

      expect(mockGit.log).toHaveBeenCalledWith({ '--since': '1 week ago' });
    });

    it('passes until option to git log', async () => {
      (mockGit.log as ReturnType<typeof vi.fn>).mockResolvedValue({ all: [] });

      await getCommits('/fake/path', undefined, '2025-11-28');

      expect(mockGit.log).toHaveBeenCalledWith({ '--until': '2025-11-28' });
    });

    it('passes both since and until options', async () => {
      (mockGit.log as ReturnType<typeof vi.fn>).mockResolvedValue({ all: [] });

      await getCommits('/fake/path', '1 week ago', '2025-11-28');

      expect(mockGit.log).toHaveBeenCalledWith({
        '--since': '1 week ago',
        '--until': '2025-11-28',
      });
    });

    it('throws error on git failure', async () => {
      (mockGit.log as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Git error'));

      await expect(getCommits('/fake/path')).rejects.toThrow('Failed to read git log: Git error');
    });

    it('truncates commit message to first line', async () => {
      (mockGit.log as ReturnType<typeof vi.fn>).mockResolvedValue({
        all: [
          {
            hash: 'abc1234567890',
            date: '2025-11-28T10:00:00Z',
            message: 'feat: first line\n\nSecond paragraph with details',
            author_name: 'Test User',
          },
        ],
      });

      const commits = await getCommits('/fake/path');

      expect(commits[0].message).toBe('feat: first line');
    });

    it('converts date string to Date object', async () => {
      (mockGit.log as ReturnType<typeof vi.fn>).mockResolvedValue({
        all: [
          {
            hash: 'abc1234567890',
            date: '2025-11-28T10:00:00Z',
            message: 'feat: test',
            author_name: 'Test User',
          },
        ],
      });

      const commits = await getCommits('/fake/path');

      expect(commits[0].date).toBeInstanceOf(Date);
      expect(commits[0].date.toISOString()).toBe('2025-11-28T10:00:00.000Z');
    });
  });

  describe('isGitRepo', () => {
    it('returns true for valid git repository', async () => {
      (mockGit.status as ReturnType<typeof vi.fn>).mockResolvedValue({});

      const result = await isGitRepo('/fake/path');

      expect(result).toBe(true);
    });

    it('returns false for non-git directory', async () => {
      (mockGit.status as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Not a git repo'));

      const result = await isGitRepo('/fake/path');

      expect(result).toBe(false);
    });
  });

  describe('getFileStats', () => {
    it('returns file stats for commits', async () => {
      (mockGit.log as ReturnType<typeof vi.fn>).mockResolvedValue({
        all: [
          { hash: 'abc1234567890' },
          { hash: 'def1234567890' },
        ],
      });

      (mockGit.raw as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce('10\t5\tsrc/file1.ts\n20\t10\tsrc/file2.ts')
        .mockResolvedValueOnce('5\t2\tsrc/file1.ts');

      const stats = await getFileStats('/fake/path');

      expect(stats.filesPerCommit.size).toBe(2);
      expect(stats.filesPerCommit.get('abc1234')).toEqual(['src/file1.ts', 'src/file2.ts']);
      expect(stats.filesPerCommit.get('def1234')).toEqual(['src/file1.ts']);
      expect(stats.lineStats).toHaveLength(2);
      expect(stats.lineStats[0]).toEqual({ additions: 30, deletions: 15 });
      expect(stats.lineStats[1]).toEqual({ additions: 5, deletions: 2 });
    });

    it('handles empty diff-tree output', async () => {
      (mockGit.log as ReturnType<typeof vi.fn>).mockResolvedValue({
        all: [{ hash: 'abc1234567890' }],
      });

      (mockGit.raw as ReturnType<typeof vi.fn>).mockResolvedValue('');

      const stats = await getFileStats('/fake/path');

      expect(stats.filesPerCommit.get('abc1234')).toEqual([]);
      expect(stats.lineStats[0]).toEqual({ additions: 0, deletions: 0 });
    });

    it('handles diff-tree failure gracefully', async () => {
      (mockGit.log as ReturnType<typeof vi.fn>).mockResolvedValue({
        all: [{ hash: 'abc1234567890' }],
      });

      (mockGit.raw as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('diff-tree failed'));

      const stats = await getFileStats('/fake/path');

      expect(stats.filesPerCommit.get('abc1234')).toEqual([]);
      expect(stats.lineStats[0]).toEqual({ additions: 0, deletions: 0 });
    });

    it('handles git log failure gracefully', async () => {
      (mockGit.log as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Log failed'));

      const stats = await getFileStats('/fake/path');

      expect(stats.filesPerCommit.size).toBe(0);
      expect(stats.lineStats).toEqual([]);
    });

    it('passes date options to git log', async () => {
      (mockGit.log as ReturnType<typeof vi.fn>).mockResolvedValue({ all: [] });

      await getFileStats('/fake/path', '1 week ago', '2025-11-28');

      expect(mockGit.log).toHaveBeenCalledWith({
        '--since': '1 week ago',
        '--until': '2025-11-28',
      });
    });
  });
});
