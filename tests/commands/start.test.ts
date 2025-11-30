import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import {
  loadSession,
  saveSession,
  clearSession,
  getSessionPath,
  getVibeCheckDir,
  LEVEL_INFO,
} from '../../src/commands/start';

// Mock fs module
vi.mock('fs', () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  mkdirSync: vi.fn(),
  unlinkSync: vi.fn(),
}));

describe('commands/start', () => {
  const mockRepoPath = '/test/repo';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getVibeCheckDir', () => {
    it('returns .vibe-check directory in repo path', () => {
      const result = getVibeCheckDir('/test/repo');
      expect(result).toBe('/test/repo/.vibe-check');
    });

    it('uses cwd when no path provided', () => {
      const result = getVibeCheckDir();
      expect(result).toContain('.vibe-check');
    });
  });

  describe('getSessionPath', () => {
    it('returns session.json path in .vibe-check directory', () => {
      const result = getSessionPath('/test/repo');
      expect(result).toBe('/test/repo/.vibe-check/session.json');
    });
  });

  describe('loadSession', () => {
    it('returns null when session file does not exist', () => {
      (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(false);

      const result = loadSession(mockRepoPath);

      expect(result).toBeNull();
    });

    it('returns parsed session when file exists', () => {
      const mockSession = {
        level: 3,
        startedAt: '2025-11-28T10:00:00Z',
        startCommit: 'abc1234',
        repoPath: mockRepoPath,
      };

      (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(true);
      (fs.readFileSync as ReturnType<typeof vi.fn>).mockReturnValue(JSON.stringify(mockSession));

      const result = loadSession(mockRepoPath);

      expect(result).toEqual(mockSession);
    });

    it('returns null on JSON parse error', () => {
      (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(true);
      (fs.readFileSync as ReturnType<typeof vi.fn>).mockReturnValue('invalid json');

      const result = loadSession(mockRepoPath);

      expect(result).toBeNull();
    });
  });

  describe('saveSession', () => {
    it('creates directory if it does not exist', () => {
      (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(false);

      const session = {
        level: 3,
        startedAt: '2025-11-28T10:00:00Z',
        startCommit: 'abc1234',
        repoPath: mockRepoPath,
      };

      saveSession(session);

      expect(fs.mkdirSync).toHaveBeenCalledWith(
        expect.stringContaining('.vibe-check'),
        { recursive: true }
      );
    });

    it('writes session to file', () => {
      (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(true);

      const session = {
        level: 3,
        startedAt: '2025-11-28T10:00:00Z',
        startCommit: 'abc1234',
        repoPath: mockRepoPath,
      };

      saveSession(session);

      expect(fs.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining('session.json'),
        JSON.stringify(session, null, 2)
      );
    });
  });

  describe('clearSession', () => {
    it('deletes session file when it exists', () => {
      (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(true);

      clearSession(mockRepoPath);

      expect(fs.unlinkSync).toHaveBeenCalledWith(
        expect.stringContaining('session.json')
      );
    });

    it('does nothing when session file does not exist', () => {
      (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(false);

      clearSession(mockRepoPath);

      expect(fs.unlinkSync).not.toHaveBeenCalled();
    });
  });

  describe('LEVEL_INFO', () => {
    it('contains all levels 0-5', () => {
      expect(Object.keys(LEVEL_INFO).sort()).toEqual(['0', '1', '2', '3', '4', '5']);
    });

    it('has correct structure for each level', () => {
      Object.entries(LEVEL_INFO).forEach(([level, info]) => {
        expect(info).toHaveProperty('name');
        expect(info).toHaveProperty('trust');
        expect(info).toHaveProperty('expectRework');
        expect(info).toHaveProperty('expectTrust');
      });
    });

    it('level 5 has highest trust', () => {
      expect(LEVEL_INFO[5].trust).toBe('95%');
      expect(LEVEL_INFO[5].name).toBe('Full Automation');
    });

    it('level 0 has lowest trust', () => {
      expect(LEVEL_INFO[0].trust).toBe('0%');
      expect(LEVEL_INFO[0].name).toBe('Manual');
    });
  });
});
