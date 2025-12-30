/**
 * Logging-Only Commit Detector
 *
 * Detects "Debug Loop Spiral" pattern where AI adds logging/print statements
 * instead of actually fixing the root cause. Signs of this:
 *
 * - Commits that only add console.log/print statements
 * - Multiple consecutive debugging commits without substantive changes
 * - Increasing logging density without resolution
 *
 * This is a key "Inner Loop Disaster" in vibe coding.
 *
 * ## Two Detection Modes
 *
 * 1. **Lightweight Inference** (`detectLoggingOnlyCommits`)
 *    - Sync function, fast, no git operations
 *    - Infers from commit message patterns ("add logging", "debug", "trace")
 *    - Returns `loggingStatements: 0` (not calculated from diffs)
 *    - Use for: Quick checks, CI pipelines, real-time watch mode
 *
 * 2. **Full Diff Analysis** (`analyzeCommitsForLogging`)
 *    - Async function, requires repo path
 *    - Inspects actual diffs to count logging statements added
 *    - Returns accurate `loggingStatements` and `actualFixes` counts
 *    - Use for: Detailed session analysis, audit reports
 */

import { simpleGit, SimpleGit } from 'simple-git';
import { TimelineEvent } from '../types.js';
import {
  LoggingOnlyResult,
  LoggingOnlyCommit,
  InnerLoopConfig,
  DEFAULT_INNER_LOOP_CONFIG,
} from './types.js';

// Patterns that indicate logging statements by language
const LOGGING_PATTERNS: Record<string, RegExp[]> = {
  javascript: [
    /console\.(log|error|warn|debug|info|trace|dir|table)\s*\(/,
    /console\.(time|timeEnd|timeLog|group|groupEnd)\s*\(/,
    /debugger;/,
  ],
  typescript: [
    /console\.(log|error|warn|debug|info|trace|dir|table)\s*\(/,
    /console\.(time|timeEnd|timeLog|group|groupEnd)\s*\(/,
    /debugger;/,
  ],
  python: [
    /print\s*\(/,
    /logging\.(debug|info|warning|error|critical)\s*\(/,
    /logger\.(debug|info|warning|error|critical)\s*\(/,
    /pprint\s*\(/,
    /breakpoint\s*\(/,
    /import\s+pdb/,
    /pdb\.set_trace\s*\(/,
  ],
  java: [
    /System\.out\.print(ln)?\s*\(/,
    /System\.err\.print(ln)?\s*\(/,
    /logger\.(debug|info|warn|error|trace)\s*\(/,
    /log\.(debug|info|warn|error|trace)\s*\(/,
    /LOG\.(debug|info|warn|error|trace)\s*\(/,
  ],
  go: [
    /fmt\.Print(ln|f)?\s*\(/,
    /log\.Print(ln|f)?\s*\(/,
    /log\.(Debug|Info|Warn|Error|Fatal)(f|ln)?\s*\(/,
  ],
  rust: [
    /println!\s*\(/,
    /eprintln!\s*\(/,
    /dbg!\s*\(/,
    /debug!\s*\(/,
    /info!\s*\(/,
    /warn!\s*\(/,
    /error!\s*\(/,
    /trace!\s*\(/,
  ],
  ruby: [
    /puts\s+/,
    /p\s+/,
    /pp\s+/,
    /Rails\.logger\.(debug|info|warn|error)\s*\(/,
    /logger\.(debug|info|warn|error)\s*\(/,
    /binding\.pry/,
    /byebug/,
  ],
  php: [
    /var_dump\s*\(/,
    /print_r\s*\(/,
    /echo\s+/,
    /error_log\s*\(/,
    /dd\s*\(/,
    /dump\s*\(/,
  ],
};

// Aggregate all patterns for quick detection
const ALL_LOGGING_PATTERNS = Object.values(LOGGING_PATTERNS).flat();

/**
 * Detect logging-only commits from timeline events (lightweight inference).
 *
 * This is a fast, synchronous function that infers debugging activity from
 * commit message patterns. It does NOT analyze diffs, so `loggingStatements`
 * will always be 0 in the results.
 *
 * For accurate logging statement counts, use `analyzeCommitsForLogging` instead.
 *
 * @param events - Timeline events with commit messages
 * @param config - Configuration options
 * @returns Detection result with inferred debugging commits
 */
export function detectLoggingOnlyCommits(
  events: TimelineEvent[],
  config: Partial<InnerLoopConfig> = {}
): LoggingOnlyResult {
  const cfg = { ...DEFAULT_INNER_LOOP_CONFIG, ...config };
  const loggingCommits: LoggingOnlyCommit[] = [];

  if (events.length === 0) {
    return {
      detected: false,
      loggingCommits: [],
      consecutiveLoggingCount: 0,
      totalLoggingCommits: 0,
      message: 'No commits to analyze',
    };
  }

  // Sort by timestamp
  const sorted = [...events].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

  // Patterns that suggest logging/debugging activity
  const debuggingPatterns = [
    /\badd(ed|ing)?\s+(log|debug|print)/i,
    /\blog(ging)?\b/i,
    /\bdebug(ging)?\b/i,
    /\bprint\s+statement/i,
    /\btrace\b/i,
    /\bconsole\b/i,
    /\btemporary\b/i,
    /\btemp\b/i,
    /\bwip\b/i,
    /\binvestigat/i,
    /\bdiagnos/i,
  ];

  for (const event of sorted) {
    const message = event.subject.toLowerCase();
    const isDebugging = debuggingPatterns.some((p) => p.test(message));

    // Infer if this is a logging-only commit
    // True if message suggests debugging AND it's a small change
    if (isDebugging) {
      loggingCommits.push({
        hash: event.hash,
        message: event.subject,
        timestamp: event.timestamp,
        loggingStatements: 0, // Not calculated in inferred mode
        actualFixes: 0,
        isLoggingOnly: true, // Inferred from message patterns
        loggingPatterns: [],
        detectionMode: 'inferred',
      });
    }
  }

  // Find longest consecutive run
  let maxConsecutive = 0;
  let currentConsecutive = 0;

  for (const event of sorted) {
    const isLogging = loggingCommits.some((lc) => lc.hash === event.hash);
    if (isLogging) {
      currentConsecutive++;
      maxConsecutive = Math.max(maxConsecutive, currentConsecutive);
    } else {
      currentConsecutive = 0;
    }
  }

  const detected = maxConsecutive >= cfg.maxConsecutiveLoggingCommits;
  let message = '';
  if (detected) {
    message = `🔍 Debug loop detected: ${maxConsecutive} consecutive logging/debug commits. Consider stepping back to understand the root cause.`;
  } else if (loggingCommits.length > 0) {
    message = `${loggingCommits.length} debug/logging commit${loggingCommits.length > 1 ? 's' : ''} found`;
  }

  return {
    detected,
    loggingCommits: loggingCommits.slice(0, 10),
    consecutiveLoggingCount: maxConsecutive,
    totalLoggingCommits: loggingCommits.length,
    message,
  };
}

/**
 * Analyze a commit diff to count logging statements.
 * This is the more accurate version that actually looks at the diff.
 */
export async function analyzeCommitForLogging(
  repoPath: string,
  commitHash: string,
  config: Partial<InnerLoopConfig> = {}
): Promise<LoggingOnlyCommit | null> {
  const cfg = { ...DEFAULT_INNER_LOOP_CONFIG, ...config };
  const git: SimpleGit = simpleGit(repoPath);

  try {
    // Get the commit diff
    const diff = await git.show([commitHash, '--format=', '--unified=0']);
    const commitLog = await git.log(['-1', '--format=%s', commitHash]);
    const message = commitLog.latest?.message || '';

    // Count logging statements added (lines starting with +)
    const addedLines = diff
      .split('\n')
      .filter((line) => line.startsWith('+') && !line.startsWith('+++'));

    let loggingStatements = 0;
    const foundPatterns: string[] = [];

    for (const line of addedLines) {
      for (const pattern of ALL_LOGGING_PATTERNS) {
        if (pattern.test(line)) {
          loggingStatements++;
          // Extract pattern name for reporting
          const patternStr = pattern.toString();
          if (!foundPatterns.includes(patternStr)) {
            foundPatterns.push(patternStr);
          }
          break;
        }
      }
    }

    // Count non-logging changes
    const actualFixes = addedLines.length - loggingStatements;

    // Determine if this is logging-only
    const isLoggingOnly =
      loggingStatements > 0 && (actualFixes === 0 || loggingStatements / addedLines.length > 0.8);

    return {
      hash: commitHash,
      message,
      timestamp: new Date(), // Would need to get from git log
      loggingStatements,
      actualFixes,
      isLoggingOnly,
      loggingPatterns: foundPatterns,
      detectionMode: 'diff_analysis',
    };
  } catch {
    return null;
  }
}

/**
 * Analyze multiple commits for logging patterns (full diff analysis).
 *
 * This is the accurate version that inspects actual git diffs to count
 * logging statements added per commit. Unlike the lightweight version,
 * this provides accurate `loggingStatements` and `actualFixes` counts.
 *
 * Use this for detailed session analysis and audit reports where accuracy
 * matters more than speed.
 *
 * @param repoPath - Path to the git repository
 * @param events - Timeline events to analyze
 * @param config - Configuration options
 * @returns Detection result with accurate logging counts per commit
 */
export async function analyzeCommitsForLogging(
  repoPath: string,
  events: TimelineEvent[],
  config: Partial<InnerLoopConfig> = {}
): Promise<LoggingOnlyResult> {
  const cfg = { ...DEFAULT_INNER_LOOP_CONFIG, ...config };
  const loggingCommits: LoggingOnlyCommit[] = [];

  // Analyze each commit
  for (const event of events) {
    const result = await analyzeCommitForLogging(repoPath, event.hash, config);
    if (result) {
      result.timestamp = event.timestamp;
      if (result.loggingStatements > 0) {
        loggingCommits.push(result);
      }
    }
  }

  // Sort by timestamp
  loggingCommits.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

  // Find consecutive logging-only commits
  let maxConsecutive = 0;
  let currentConsecutive = 0;

  const sorted = [...events].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

  for (const event of sorted) {
    const loggingCommit = loggingCommits.find((lc) => lc.hash === event.hash);
    if (loggingCommit?.isLoggingOnly) {
      currentConsecutive++;
      maxConsecutive = Math.max(maxConsecutive, currentConsecutive);
    } else {
      currentConsecutive = 0;
    }
  }

  const detected = maxConsecutive >= cfg.maxConsecutiveLoggingCommits;

  // Generate message
  let message = '';
  if (detected) {
    const totalLogging = loggingCommits.reduce((sum, c) => sum + c.loggingStatements, 0);
    message = `🔍 Debug loop spiral: ${maxConsecutive} consecutive logging commits (${totalLogging} log statements added). Stop and think about the root cause.`;
  } else if (loggingCommits.length > 0) {
    message = `${loggingCommits.filter((c) => c.isLoggingOnly).length} logging-only commit${loggingCommits.length > 1 ? 's' : ''} detected`;
  }

  return {
    detected,
    loggingCommits,
    consecutiveLoggingCount: maxConsecutive,
    totalLoggingCommits: loggingCommits.length,
    message,
  };
}
