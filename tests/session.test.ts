import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

const CLI_PATH = path.join(__dirname, '..', 'dist', 'cli.js');
const TEST_REPO = process.cwd(); // vibe-check repo itself
const ACTIVE_SESSION_PATH = path.join(TEST_REPO, '.vibe-check', 'active-session.json');

function runCli(args: string): string {
  try {
    return execSync(`node ${CLI_PATH} ${args}`, {
      encoding: 'utf-8',
      cwd: TEST_REPO,
      timeout: 30000,
    });
  } catch (error: unknown) {
    const execError = error as { stdout?: string; stderr?: string };
    return execError.stdout || execError.stderr || '';
  }
}

function cleanupSession(): void {
  if (fs.existsSync(ACTIVE_SESSION_PATH)) {
    fs.unlinkSync(ACTIVE_SESSION_PATH);
  }
}

describe('vibe-check session', () => {
  beforeEach(() => {
    cleanupSession();
  });

  afterEach(() => {
    cleanupSession();
  });

  describe('session start', () => {
    it('creates active session file', () => {
      runCli('session start --level 3 --format json');
      expect(fs.existsSync(ACTIVE_SESSION_PATH)).toBe(true);
    });

    it('returns JSON with session_id and baseline', () => {
      const output = runCli('session start --level 3 --format json');
      const data = JSON.parse(output);

      expect(data).toHaveProperty('session_id');
      expect(data).toHaveProperty('started_at');
      expect(data).toHaveProperty('vibe_level', 3);
      expect(data).toHaveProperty('baseline');
    });

    it('captures baseline metrics from last 7 days', () => {
      const output = runCli('session start --level 2 --format json');
      const data = JSON.parse(output);

      // This repo should have commits, so baseline should exist
      if (data.baseline) {
        expect(data.baseline).toHaveProperty('trust_pass_rate');
        expect(data.baseline).toHaveProperty('rework_ratio');
        expect(data.baseline).toHaveProperty('iteration_velocity');
      }
    });

    it('rejects starting session when one is active', () => {
      runCli('session start --level 3 --format json');
      const output = runCli('session start --level 4 --format json');
      const data = JSON.parse(output);

      expect(data).toHaveProperty('error');
      expect(data.error).toContain('already active');
    });

    it('shows terminal output by default', () => {
      const output = runCli('session start --level 3');
      expect(output).toContain('SESSION STARTED');
      expect(output).toContain('Vibe Level: 3');
    });
  });

  describe('session status', () => {
    it('shows no session when none active', () => {
      const output = runCli('session status');
      expect(output).toContain('No active session');
    });

    it('shows session info when active', () => {
      runCli('session start --level 3 --format json');
      const output = runCli('session status');

      expect(output).toContain('ACTIVE SESSION');
      expect(output).toContain('Vibe Level: 3');
    });
  });

  describe('session end', () => {
    it('returns error when no session active', () => {
      const output = runCli('session end --format json');
      const data = JSON.parse(output);

      expect(data).toHaveProperty('error');
      expect(data.error).toContain('No active session');
    });

    it('clears active session file', () => {
      runCli('session start --level 3 --format json');
      expect(fs.existsSync(ACTIVE_SESSION_PATH)).toBe(true);

      // Modify session to capture older commits
      const session = JSON.parse(fs.readFileSync(ACTIVE_SESSION_PATH, 'utf-8'));
      session.startedAt = '2025-12-01T00:00:00.000Z';
      fs.writeFileSync(ACTIVE_SESSION_PATH, JSON.stringify(session));

      runCli('session end --format json');
      expect(fs.existsSync(ACTIVE_SESSION_PATH)).toBe(false);
    });

    it('returns metrics and retro in JSON format', () => {
      runCli('session start --level 3 --format json');

      // Modify session to capture older commits
      const session = JSON.parse(fs.readFileSync(ACTIVE_SESSION_PATH, 'utf-8'));
      session.startedAt = '2025-12-01T00:00:00.000Z';
      fs.writeFileSync(ACTIVE_SESSION_PATH, JSON.stringify(session));

      const output = runCli('session end --format json');
      const data = JSON.parse(output);

      expect(data).toHaveProperty('session_id');
      expect(data).toHaveProperty('started_at');
      expect(data).toHaveProperty('ended_at');
      expect(data).toHaveProperty('vibe_level', 3);
      expect(data).toHaveProperty('metrics');
      expect(data).toHaveProperty('retro');
      expect(data).toHaveProperty('commits');
    });

    it('includes failure pattern detection in retro', () => {
      runCli('session start --level 3 --format json');

      const session = JSON.parse(fs.readFileSync(ACTIVE_SESSION_PATH, 'utf-8'));
      session.startedAt = '2025-12-01T00:00:00.000Z';
      fs.writeFileSync(ACTIVE_SESSION_PATH, JSON.stringify(session));

      const output = runCli('session end --format json');
      const data = JSON.parse(output);

      expect(data.retro).toHaveProperty('failure_patterns_hit');
      expect(data.retro).toHaveProperty('failure_patterns_avoided');
      expect(data.retro).toHaveProperty('spirals_detected');
      expect(data.retro).toHaveProperty('learnings');

      expect(Array.isArray(data.retro.failure_patterns_hit)).toBe(true);
      expect(Array.isArray(data.retro.failure_patterns_avoided)).toBe(true);
      expect(Array.isArray(data.retro.learnings)).toBe(true);
    });

    it('includes baseline comparison when baseline exists', () => {
      runCli('session start --level 3 --format json');

      const session = JSON.parse(fs.readFileSync(ACTIVE_SESSION_PATH, 'utf-8'));
      session.startedAt = '2025-12-01T00:00:00.000Z';
      fs.writeFileSync(ACTIVE_SESSION_PATH, JSON.stringify(session));

      const output = runCli('session end --format json');
      const data = JSON.parse(output);

      if (data.baseline_comparison) {
        expect(data.baseline_comparison).toHaveProperty('trust_delta');
        expect(data.baseline_comparison).toHaveProperty('rework_delta');
        expect(data.baseline_comparison).toHaveProperty('verdict');
        expect(data.baseline_comparison).toHaveProperty('message');
      }
    });

    it('shows terminal output with metrics summary', () => {
      runCli('session start --level 3 --format json');

      const session = JSON.parse(fs.readFileSync(ACTIVE_SESSION_PATH, 'utf-8'));
      session.startedAt = '2025-12-01T00:00:00.000Z';
      fs.writeFileSync(ACTIVE_SESSION_PATH, JSON.stringify(session));

      const output = runCli('session end --format terminal');
      expect(output).toContain('SESSION COMPLETE');
      expect(output).toContain('Metrics');
      expect(output).toContain('Trust Pass Rate');
    });
  });

  describe('session workflow integration', () => {
    it('full workflow: start -> status -> end', () => {
      // Start
      const startOutput = runCli('session start --level 2 --format json');
      const startData = JSON.parse(startOutput);
      expect(startData.session_id).toBeDefined();

      // Status
      const statusOutput = runCli('session status');
      expect(statusOutput).toContain('ACTIVE SESSION');
      expect(statusOutput).toContain('Vibe Level: 2');

      // Modify to capture commits
      const session = JSON.parse(fs.readFileSync(ACTIVE_SESSION_PATH, 'utf-8'));
      session.startedAt = '2025-12-01T00:00:00.000Z';
      fs.writeFileSync(ACTIVE_SESSION_PATH, JSON.stringify(session));

      // End
      const endOutput = runCli('session end --format json');
      const endData = JSON.parse(endOutput);

      expect(endData.session_id).toBe(startData.session_id);
      expect(endData.vibe_level).toBe(2);
      expect(endData.metrics).toBeDefined();
      expect(endData.retro).toBeDefined();

      // Session should be cleared
      expect(fs.existsSync(ACTIVE_SESSION_PATH)).toBe(false);
    });
  });
});
