/**
 * Inner Loop Failure Pattern Types
 *
 * These detect the 4 "Inner Loop Disasters" from vibe coding:
 * 1. "Tests Passing" Lie - AI claims success but code doesn't work
 * 2. Context Amnesia - Forgets instructions, re-does work
 * 3. Instruction Drift - "Improves" things not asked for
 * 4. Debug Loop Spiral - Adds logging instead of fixing
 */

import { Commit, TimelineEvent } from '../types.js';

// ===========================================
// 1. "Tests Passing" Lie
// ===========================================

export interface TestsPassingLieResult {
  detected: boolean;
  lies: TestsPassingLie[];
  totalLies: number;
  message: string;
}

export interface TestsPassingLie {
  commitHash: string;
  commitMessage: string;
  timestamp: Date;
  claimedSuccess: boolean; // Commit message claims fix/pass/working
  actualResult: 'build_failed' | 'tests_failed' | 'unknown';
  verificationMethod: 'npm_test' | 'npm_build' | 'make_test' | 'inferred';
}

// ===========================================
// 2. Context Amnesia
// ===========================================

export interface ContextAmnesiaResult {
  detected: boolean;
  incidents: ContextAmnesiaIncident[];
  totalIncidents: number;
  totalTimeWasted: number; // minutes
  message: string;
}

export interface ContextAmnesiaIncident {
  type: 'revert' | 'reimplementation' | 'forgotten_change';
  originalCommit: {
    hash: string;
    message: string;
    timestamp: Date;
  };
  repeatCommit: {
    hash: string;
    message: string;
    timestamp: Date;
  };
  scope: string | null;
  filesAffected: string[];
  gapMinutes: number; // Time between original and repeat
  description: string;
}

// ===========================================
// 3. Instruction Drift
// ===========================================

export interface InstructionDriftResult {
  detected: boolean;
  drifts: InstructionDrift[];
  totalDriftCommits: number;
  totalUnauthorizedFiles: number;
  message: string;
}

export interface InstructionDrift {
  commitHash: string;
  commitMessage: string;
  timestamp: Date;
  driftType: 'scope_creep' | 'unrequested_refactor' | 'unrequested_improvement' | 'style_change';
  unauthorizedFiles: string[];
  authorizedScope: string[]; // Expected files/dirs based on session intent
  description: string;
}

export interface SessionScope {
  intendedFiles: string[];
  intendedDirs: string[];
  taskDescription?: string;
  startTime: Date;
}

// ===========================================
// 4. Debug Loop Spiral (Enhanced)
// ===========================================

export interface LoggingOnlyResult {
  detected: boolean;
  loggingCommits: LoggingOnlyCommit[];
  consecutiveLoggingCount: number;
  totalLoggingCommits: number;
  message: string;
}

export interface LoggingOnlyCommit {
  hash: string;
  message: string;
  timestamp: Date;
  loggingStatements: number; // Count of console.log, print, etc. added
  actualFixes: number; // Count of non-logging changes
  isLoggingOnly: boolean;
  loggingPatterns: string[]; // e.g., ['console.log', 'console.error']
}

// ===========================================
// Aggregated Inner Loop Result
// ===========================================

export interface InnerLoopAnalysis {
  // Individual pattern results
  testsPassingLie: TestsPassingLieResult;
  contextAmnesia: ContextAmnesiaResult;
  instructionDrift: InstructionDriftResult;
  loggingOnly: LoggingOnlyResult;

  // Aggregated metrics
  summary: {
    totalIssuesDetected: number;
    criticalIssues: number; // High severity
    warningIssues: number; // Medium severity
    overallHealth: 'healthy' | 'warning' | 'critical';
  };

  // Recommendations
  recommendations: string[];
}

// ===========================================
// Detection Configuration
// ===========================================

export interface InnerLoopConfig {
  // Tests Passing Lie
  runTestsAfterCommit: boolean;
  testCommand?: string; // e.g., 'npm test', 'make test'
  buildCommand?: string; // e.g., 'npm run build'

  // Context Amnesia
  amnesiaWindowMinutes: number; // How far back to look for repeats (default: 60)
  similarityThreshold: number; // 0-1, how similar commits must be to flag (default: 0.7)

  // Instruction Drift
  sessionScope?: SessionScope;
  allowedDriftFiles: string[]; // Files that are always OK to change (e.g., package.json)

  // Logging Only
  maxConsecutiveLoggingCommits: number; // Flag after this many (default: 3)
  loggingPatterns: RegExp[]; // Patterns to detect logging statements
}

export const DEFAULT_INNER_LOOP_CONFIG: InnerLoopConfig = {
  runTestsAfterCommit: false,
  amnesiaWindowMinutes: 60,
  similarityThreshold: 0.7,
  allowedDriftFiles: ['package.json', 'package-lock.json', 'tsconfig.json', '.gitignore'],
  maxConsecutiveLoggingCommits: 3,
  loggingPatterns: [
    /console\.(log|error|warn|debug|info)\(/,
    /print\s*\(/,
    /logger\.(log|error|warn|debug|info)\(/,
    /System\.out\.print/,
    /fmt\.Print/,
    /debug!\(/,
    /println!\(/,
  ],
};
