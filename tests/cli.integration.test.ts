import { describe, it, expect, beforeAll } from 'vitest';
import { execSync } from 'child_process';
import * as fs from 'fs';

/**
 * Integration tests for vibe-check CLI.
 * These test actual CLI behavior, not internal functions.
 */

const CLI = 'node dist/cli.js';
const REPO_ROOT = process.cwd();

function run(args: string): { stdout: string; stderr: string; exitCode: number } {
  try {
    const stdout = execSync(`${CLI} ${args}`, {
      cwd: REPO_ROOT,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return { stdout, stderr: '', exitCode: 0 };
  } catch (error: any) {
    return {
      stdout: error.stdout || '',
      stderr: error.stderr || '',
      exitCode: error.status || 1,
    };
  }
}

describe('CLI Integration', () => {
  beforeAll(() => {
    execSync('npm run build', { cwd: REPO_ROOT, stdio: 'ignore' });
  });

  describe('vibe-check (default)', () => {
    it('runs on a git repo', () => {
      const result = run('--since "1 month ago"');
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('VIBE-CHECK');
    });

    it('outputs valid JSON', () => {
      const result = run('--since "1 month ago" --format json');
      expect(result.exitCode).toBe(0);
      const data = JSON.parse(result.stdout);
      expect(data).toHaveProperty('period');
      expect(data).toHaveProperty('commits');
      expect(data).toHaveProperty('metrics');
    });

    it('outputs markdown', () => {
      const result = run('--since "1 month ago" --format markdown');
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('# Vibe-Check Report');
    });

    it('includes VibeScore with --score', () => {
      const result = run('--since "1 month ago" --score --format json');
      const data = JSON.parse(result.stdout);
      expect(data).toHaveProperty('vibeScore');
    });

    it('writes to file with -o', () => {
      const outFile = '/tmp/vibe-test.json';
      run(`--since "1 month ago" --format json -o ${outFile}`);
      expect(fs.existsSync(outFile)).toBe(true);
      fs.unlinkSync(outFile);
    });
  });

  describe('subcommands', () => {
    it('profile works', () => {
      const result = run('profile');
      expect(result.exitCode).toBe(0);
    });

    it('profile --json works', () => {
      const result = run('profile --json');
      expect(() => JSON.parse(result.stdout)).not.toThrow();
    });

    it('analyze works', () => {
      const result = run('analyze --since "2 weeks ago"');
      expect(result.exitCode).toBe(0);
    });
  });

  describe('timeline command', () => {
    it('runs timeline with default format', () => {
      const result = run('timeline --since "1 week ago"');
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('VIBE-CHECK TIMELINE');
    });

    it('outputs timeline as JSON', () => {
      const result = run('timeline --since "1 week ago" --format json');
      expect(result.exitCode).toBe(0);
      const data = JSON.parse(result.stdout);
      expect(data).toHaveProperty('days');
      expect(data).toHaveProperty('sessions');
      expect(data).toHaveProperty('detours');
      expect(data).toHaveProperty('lateNightSpirals');
    });

    it('outputs timeline as Markdown', () => {
      const result = run('timeline --since "1 week ago" --format markdown');
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('# Vibe-Check Timeline Report');
      expect(result.stdout).toContain('## Summary');
      expect(result.stdout).toContain('## Daily Breakdown');
      expect(result.stdout).toContain('## Insights');
    });

    it('outputs timeline as HTML', () => {
      const result = run('timeline --since "1 week ago" --format html');
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('<!DOCTYPE html>');
      expect(result.stdout).toContain('VIBE-CHECK TIMELINE');
      expect(result.stdout).toContain('class="day"');
    });

    it('timeline --expand shows session details', () => {
      const result = run('timeline --since "1 week ago" --expand');
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Session');
    });

    it('timeline creates cache file', () => {
      run('timeline --since "1 week ago"');
      expect(fs.existsSync('.vibe-check/timeline.json')).toBe(true);
    });

    it('timeline verbose shows cache info', () => {
      const result = run('timeline --since "1 week ago" -v 2>&1');
      expect(result.exitCode).toBe(0);
      // Verbose output goes to stderr, captured in either stdout or stderr
      const combined = result.stdout + result.stderr;
      expect(combined).toMatch(/Cache:/);
    });

    it('timeline JSON includes stored insights', () => {
      const result = run('timeline --since "1 week ago" --format json');
      expect(result.exitCode).toBe(0);
      const data = JSON.parse(result.stdout);
      expect(data).toHaveProperty('storedInsights');
      expect(data).toHaveProperty('trends');
      expect(data).toHaveProperty('patternStats');
    });
  });

  describe('error handling', () => {
    it('--help works', () => {
      const result = run('--help');
      expect(result.stdout).toContain('Options');
    });

    it('--version works', () => {
      const result = run('--version');
      expect(result.stdout).toMatch(/\d+\.\d+\.\d+/);
    });

    it('fails on non-git directory', () => {
      const result = run('--repo /tmp');
      expect(result.exitCode).not.toBe(0);
    });
  });
});
