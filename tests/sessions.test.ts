/**
 * Tracer Tests for VIBE-046: Session Detection Algorithm
 *
 * These tests validate the session detection algorithm against known inputs.
 * Proven algorithm from release-engineering retrospective (46 sessions from 475 commits).
 */

import { describe, it, expect } from 'vitest';
import { detectSessions, DetectedSession } from '../src/analyzers/sessions';
import { Commit } from '../src/types';
import { execSync } from 'child_process';
import * as path from 'path';

const CLI_PATH = path.join(__dirname, '..', 'dist', 'cli.js');
const TEST_REPO = process.cwd();

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

function createCommit(hash: string, minutesAgo: number, message: string = 'test'): Commit {
  const date = new Date();
  date.setMinutes(date.getMinutes() - minutesAgo);
  return {
    hash,
    date,
    message,
    type: 'feat',
    scope: null,
    author: 'test',
  };
}

describe('Session Detection Algorithm (VIBE-046)', () => {
  describe('detectSessions function', () => {
    it('returns empty result for no commits', () => {
      const result = detectSessions([]);

      expect(result.sessions).toHaveLength(0);
      expect(result.stats.totalSessions).toBe(0);
      expect(result.stats.totalCommits).toBe(0);
    });

    it('creates single session for closely-spaced commits', () => {
      // All commits within 30 minutes of each other (under 90-min threshold)
      const commits = [
        createCommit('aaa', 60, 'first'),
        createCommit('bbb', 40, 'second'),
        createCommit('ccc', 20, 'third'),
      ];

      const result = detectSessions(commits);

      expect(result.sessions).toHaveLength(1);
      expect(result.sessions[0].commitCount).toBe(3);
      expect(result.stats.totalSessions).toBe(1);
      expect(result.stats.totalCommits).toBe(3);
    });

    it('creates multiple sessions with 90+ minute gaps', () => {
      // Session 1: commits at 0, 30 min
      // Gap: 120 minutes
      // Session 2: commits at 150, 180 min
      const now = Date.now();
      const commits: Commit[] = [
        { hash: 'a', date: new Date(now - 180 * 60000), message: 's1-c1', type: 'feat', scope: null, author: 'test' },
        { hash: 'b', date: new Date(now - 150 * 60000), message: 's1-c2', type: 'feat', scope: null, author: 'test' },
        // 120 min gap here
        { hash: 'c', date: new Date(now - 30 * 60000), message: 's2-c1', type: 'feat', scope: null, author: 'test' },
        { hash: 'd', date: new Date(now), message: 's2-c2', type: 'feat', scope: null, author: 'test' },
      ];

      const result = detectSessions(commits);

      expect(result.sessions).toHaveLength(2);
      expect(result.sessions[0].commitCount).toBe(2);
      expect(result.sessions[1].commitCount).toBe(2);
    });

    it('respects custom gap threshold', () => {
      // Commits 45 min apart - should be 1 session with 90-min threshold, 2 sessions with 30-min threshold
      const now = Date.now();
      const commits: Commit[] = [
        { hash: 'a', date: new Date(now - 90 * 60000), message: 'c1', type: 'feat', scope: null, author: 'test' },
        { hash: 'b', date: new Date(now - 45 * 60000), message: 'c2', type: 'feat', scope: null, author: 'test' },
        { hash: 'c', date: new Date(now), message: 'c3', type: 'feat', scope: null, author: 'test' },
      ];

      const result90 = detectSessions(commits, 90);
      const result30 = detectSessions(commits, 30);

      expect(result90.sessions).toHaveLength(1);
      expect(result30.sessions).toHaveLength(3); // Each commit is its own session at 30-min threshold
    });

    it('calculates session duration correctly', () => {
      const now = Date.now();
      const commits: Commit[] = [
        { hash: 'a', date: new Date(now - 60 * 60000), message: 'start', type: 'feat', scope: null, author: 'test' },
        { hash: 'b', date: new Date(now - 30 * 60000), message: 'middle', type: 'feat', scope: null, author: 'test' },
        { hash: 'c', date: new Date(now), message: 'end', type: 'feat', scope: null, author: 'test' },
      ];

      const result = detectSessions(commits);

      expect(result.sessions).toHaveLength(1);
      expect(result.sessions[0].durationMinutes).toBe(60);
    });

    it('calculates median duration correctly', () => {
      const now = Date.now();
      // Create 3 sessions with durations: 30, 60, 80 min
      // Commits within a session must be < 90 min apart
      // Gaps between sessions must be > 90 min
      const commits: Commit[] = [
        // Session 1: 30 min duration
        { hash: 'a1', date: new Date(now - 700 * 60000), message: 's1', type: 'feat', scope: null, author: 'test' },
        { hash: 'a2', date: new Date(now - 670 * 60000), message: 's1', type: 'feat', scope: null, author: 'test' },
        // 110 min gap (> 90)
        // Session 2: 60 min duration
        { hash: 'b1', date: new Date(now - 560 * 60000), message: 's2', type: 'feat', scope: null, author: 'test' },
        { hash: 'b2', date: new Date(now - 500 * 60000), message: 's2', type: 'feat', scope: null, author: 'test' },
        // 310 min gap (> 90)
        // Session 3: 80 min duration (commits 80 min apart < 90)
        { hash: 'c1', date: new Date(now - 190 * 60000), message: 's3', type: 'feat', scope: null, author: 'test' },
        { hash: 'c2', date: new Date(now - 110 * 60000), message: 's3', type: 'feat', scope: null, author: 'test' },
      ];

      const result = detectSessions(commits);

      expect(result.sessions).toHaveLength(3);
      expect(result.stats.medianDurationMinutes).toBe(60); // Middle value of [30, 60, 80]
    });

    it('handles single-commit sessions', () => {
      const now = Date.now();
      const commits: Commit[] = [
        { hash: 'a', date: new Date(now - 200 * 60000), message: 'lone', type: 'feat', scope: null, author: 'test' },
        // 100+ min gap
        { hash: 'b', date: new Date(now), message: 'another', type: 'feat', scope: null, author: 'test' },
      ];

      const result = detectSessions(commits);

      expect(result.sessions).toHaveLength(2);
      expect(result.sessions[0].commitCount).toBe(1);
      expect(result.sessions[0].durationMinutes).toBe(0);
    });

    it('sorts commits by date regardless of input order', () => {
      const now = Date.now();
      // Provide commits out of order
      const commits: Commit[] = [
        { hash: 'c', date: new Date(now), message: 'third', type: 'feat', scope: null, author: 'test' },
        { hash: 'a', date: new Date(now - 60 * 60000), message: 'first', type: 'feat', scope: null, author: 'test' },
        { hash: 'b', date: new Date(now - 30 * 60000), message: 'second', type: 'feat', scope: null, author: 'test' },
      ];

      const result = detectSessions(commits);

      expect(result.sessions).toHaveLength(1);
      expect(result.sessions[0].commits[0].hash).toBe('a'); // First by time
      expect(result.sessions[0].commits[2].hash).toBe('c'); // Last by time
    });
  });

  describe('sessions CLI command', () => {
    it('runs without error', () => {
      const output = runCli('sessions --since "30 days ago" --format json');
      // Should either return valid JSON or empty result
      expect(() => JSON.parse(output)).not.toThrow();
    });

    it('returns expected JSON structure', () => {
      const output = runCli('sessions --since "1 month ago" --format json');
      const data = JSON.parse(output);

      expect(data).toHaveProperty('totalSessions');
      expect(data).toHaveProperty('totalCommits');
      expect(data).toHaveProperty('avgCommitsPerSession');
      expect(data).toHaveProperty('avgDurationMinutes');
      expect(data).toHaveProperty('medianDurationMinutes');
      expect(data).toHaveProperty('sessions');
      expect(Array.isArray(data.sessions)).toBe(true);
    });

    it('respects --threshold flag', () => {
      // Lower threshold should produce more sessions
      const output30 = runCli('sessions --since "1 month ago" --threshold 30 --format json');
      const output120 = runCli('sessions --since "1 month ago" --threshold 120 --format json');

      const data30 = JSON.parse(output30);
      const data120 = JSON.parse(output120);

      // More sessions with tighter threshold (usually)
      expect(data30.totalSessions).toBeGreaterThanOrEqual(data120.totalSessions);
    });

    it('shows terminal output by default', () => {
      const output = runCli('sessions --since "30 days ago"');
      expect(output).toContain('Session Analysis');
      expect(output).toContain('Total Sessions');
    });

    it('outputs markdown format', () => {
      const output = runCli('sessions --since "30 days ago" --format markdown');
      expect(output).toContain('# Session Analysis');
      expect(output).toContain('| Metric | Value |');
    });

    it('respects --limit flag', () => {
      const output = runCli('sessions --since "1 month ago" --limit 3 --format json');
      const data = JSON.parse(output);

      expect(data.sessions.length).toBeLessThanOrEqual(3);
    });
  });
});
