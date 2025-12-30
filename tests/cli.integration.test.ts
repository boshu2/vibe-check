import { describe, it, expect, beforeAll } from 'vitest';
import { execSync } from 'child_process';
import * as fs from 'fs';

/**
 * Integration tests for vibe-check CLI (v0.1.0 stripped-down version).
 * Tests actual CLI behavior for the core analyze functionality.
 *
 * Note: Uses execSync with hardcoded test commands (no user input).
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
      const result = run('--since "1 month ago" --json');
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

    it('writes to file with -o', () => {
      const outFile = '/tmp/vibe-test.json';
      run(`--since "1 month ago" --json -o ${outFile}`);
      expect(fs.existsSync(outFile)).toBe(true);
      fs.unlinkSync(outFile);
    });

    it('shows simple output with --simple', () => {
      const result = run('--since "1 month ago" --simple');
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('VIBE-CHECK');
      expect(result.stdout).toContain('Rating:');
    });
  });

  describe('error handling', () => {
    it('--help works', () => {
      const result = run('--help');
      const combined = result.stdout + result.stderr;
      expect(combined).toContain('Options');
    });

    it('--version works', () => {
      const result = run('--version');
      const combined = result.stdout + result.stderr;
      expect(combined).toMatch(/\d+\.\d+\.\d+/);
    });

    it('fails on non-git directory', () => {
      const result = run('--repo /tmp');
      expect(result.exitCode).not.toBe(0);
    });
  });
});
