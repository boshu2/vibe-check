/**
 * "Tests Passing" Lie Detector
 *
 * Detects when AI claims "all tests passing" or "working" but the code
 * actually doesn't work. This is detected through:
 *
 * 1. Inferred: Commit claims success but is immediately followed by fixes
 * 2. Verified: Actually run tests/build and compare to commit claims
 *
 * This is a key "Inner Loop Disaster" in vibe coding.
 */

import { differenceInMinutes } from 'date-fns';
import { exec } from 'child_process';
import { promisify } from 'util';
import { TimelineEvent } from '../types.js';
import {
  TestsPassingLieResult,
  TestsPassingLie,
  InnerLoopConfig,
  DEFAULT_INNER_LOOP_CONFIG,
} from './types.js';

const execAsync = promisify(exec);

// Patterns that indicate a claim of success
const SUCCESS_CLAIM_PATTERNS = [
  /\bfix(ed|es)?\b/i,
  /\bworking\b/i,
  /\bdone\b/i,
  /\bcomplete[ds]?\b/i,
  /\bresolve[ds]?\b/i,
  /\bpass(es|ing)?\b/i,
  /\bgreen\b/i,
  /\bsuccessful(ly)?\b/i,
  /\ball\s+tests?\b/i,
  /\bready\b/i,
  /\bshould\s+work/i,
  /\bnow\s+works?\b/i,
];

// Patterns that indicate the commit is tentative (not a lie if it fails)
const TENTATIVE_PATTERNS = [
  /\btry\b/i,
  /\battempt/i,
  /\bmaybe\b/i,
  /\bwip\b/i,
  /\bwork\s*in\s*progress/i,
  /\bexperiment/i,
  /\btest(ing)?\b/i, // Just "testing" something
  /\bdebug/i,
  /\binvestigat/i,
];

/**
 * Detect "tests passing" lies through pattern analysis.
 * This is the inferred method that works without running actual tests.
 */
export function detectTestsPassingLie(
  events: TimelineEvent[],
  filesPerCommit: Map<string, string[]>,
  config: Partial<InnerLoopConfig> = {}
): TestsPassingLieResult {
  const cfg = { ...DEFAULT_INNER_LOOP_CONFIG, ...config };
  const lies: TestsPassingLie[] = [];

  if (events.length < 2) {
    return {
      detected: false,
      lies: [],
      totalLies: 0,
      message: 'Not enough commits to detect lies',
    };
  }

  // Sort by timestamp ascending
  const sorted = [...events].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

  for (let i = 0; i < sorted.length - 1; i++) {
    const commit = sorted[i];
    const claimsSuccess = claimsToBeSuccessful(commit.subject);
    const isTentative = isTentativeCommit(commit.subject);

    // Skip if tentative or doesn't claim success
    if (!claimsSuccess || isTentative) continue;

    // Look at following commits within 30 minutes
    const followingCommits = getFollowingCommitsInWindow(sorted, i, 30);

    // Check if followed by fix commits on same files
    const commitFiles = filesPerCommit.get(commit.hash) || [];
    const quickFixes = followingCommits.filter((fc) => {
      if (fc.type !== 'fix') return false;

      // Check file overlap
      const fcFiles = filesPerCommit.get(fc.hash) || [];
      const hasOverlap = commitFiles.some((f) => fcFiles.includes(f));

      // Or same scope
      const sameScope = commit.scope && fc.scope === commit.scope;

      return hasOverlap || sameScope;
    });

    if (quickFixes.length > 0) {
      const gap = differenceInMinutes(quickFixes[0].timestamp, commit.timestamp);

      lies.push({
        commitHash: commit.hash,
        commitMessage: commit.subject,
        timestamp: commit.timestamp,
        claimedSuccess: true,
        actualResult: 'inferred' as TestsPassingLie['actualResult'],
        verificationMethod: 'inferred',
      });
    }
  }

  const detected = lies.length > 0;
  let message = '';
  if (detected) {
    const lieRate = Math.round((lies.length / events.length) * 100);
    message = `🤥 ${lies.length} "tests passing" lie${lies.length > 1 ? 's' : ''} detected: commits claimed success but required immediate fixes (${lieRate}% lie rate)`;
  }

  return {
    detected,
    lies: lies.slice(0, 10),
    totalLies: lies.length,
    message,
  };
}

/**
 * Verify a specific commit by actually running tests.
 * This requires the repo to be at that commit state.
 */
export async function verifyCommit(
  repoPath: string,
  commitHash: string,
  config: Partial<InnerLoopConfig> = {}
): Promise<{ passed: boolean; output: string }> {
  const cfg = { ...DEFAULT_INNER_LOOP_CONFIG, ...config };

  // Determine test command
  const testCommand = cfg.testCommand || detectTestCommand(repoPath);
  if (!testCommand) {
    return { passed: true, output: 'No test command configured or detected' };
  }

  try {
    const { stdout, stderr } = await execAsync(testCommand, {
      cwd: repoPath,
      timeout: 120000, // 2 minute timeout
    });
    return { passed: true, output: stdout + stderr };
  } catch (error: unknown) {
    const execError = error as { stdout?: string; stderr?: string; message?: string };
    return {
      passed: false,
      output: (execError.stdout || '') + (execError.stderr || '') + (execError.message || ''),
    };
  }
}

/**
 * Verify build passes for a commit.
 */
export async function verifyBuild(
  repoPath: string,
  config: Partial<InnerLoopConfig> = {}
): Promise<{ passed: boolean; output: string }> {
  const cfg = { ...DEFAULT_INNER_LOOP_CONFIG, ...config };

  const buildCommand = cfg.buildCommand || detectBuildCommand(repoPath);
  if (!buildCommand) {
    return { passed: true, output: 'No build command configured or detected' };
  }

  try {
    const { stdout, stderr } = await execAsync(buildCommand, {
      cwd: repoPath,
      timeout: 300000, // 5 minute timeout
    });
    return { passed: true, output: stdout + stderr };
  } catch (error: unknown) {
    const execError = error as { stdout?: string; stderr?: string; message?: string };
    return {
      passed: false,
      output: (execError.stdout || '') + (execError.stderr || '') + (execError.message || ''),
    };
  }
}

/**
 * Check if a commit message claims success.
 */
function claimsToBeSuccessful(message: string): boolean {
  return SUCCESS_CLAIM_PATTERNS.some((p) => p.test(message));
}

/**
 * Check if a commit is tentative (WIP, try, experiment, etc.)
 */
function isTentativeCommit(message: string): boolean {
  return TENTATIVE_PATTERNS.some((p) => p.test(message));
}

/**
 * Get commits following a given index within a time window.
 */
function getFollowingCommitsInWindow(
  events: TimelineEvent[],
  index: number,
  windowMinutes: number
): TimelineEvent[] {
  const result: TimelineEvent[] = [];
  const baseTime = events[index].timestamp;
  const windowEnd = new Date(baseTime.getTime() + windowMinutes * 60 * 1000);

  for (let i = index + 1; i < events.length; i++) {
    if (events[i].timestamp > windowEnd) break;
    result.push(events[i]);
  }

  return result;
}

/**
 * Detect test command from project configuration.
 */
function detectTestCommand(repoPath: string): string | null {
  // Common test commands by project type
  // In real implementation, we'd check package.json, Makefile, etc.
  const commands = [
    'npm test',
    'yarn test',
    'pnpm test',
    'make test',
    'cargo test',
    'go test ./...',
    'pytest',
    'python -m pytest',
  ];

  // For now, return npm test as default for Node projects
  return 'npm test';
}

/**
 * Detect build command from project configuration.
 */
function detectBuildCommand(repoPath: string): string | null {
  return 'npm run build';
}
