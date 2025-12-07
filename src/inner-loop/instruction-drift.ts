/**
 * Instruction Drift Detector
 *
 * Detects when AI starts "improving" things that weren't asked for:
 * - Changes files outside the stated scope
 * - Unrequested refactors
 * - Style changes to unrelated code
 * - "Cleanup" of code that was working fine
 *
 * This is a key "Inner Loop Disaster" in vibe coding.
 */

import { TimelineEvent } from '../types';
import {
  InstructionDriftResult,
  InstructionDrift,
  SessionScope,
  InnerLoopConfig,
  DEFAULT_INNER_LOOP_CONFIG,
} from './types';

// Patterns that indicate unrequested changes
const DRIFT_PATTERNS = {
  unrequested_refactor: [
    /\brefactor/i,
    /\bcleanup\b/i,
    /\bclean\s*up\b/i,
    /\breorganize/i,
    /\brestructure/i,
    /\bsimplify/i,
    /\bimprove\s+code/i,
  ],
  unrequested_improvement: [
    /\bimprove/i,
    /\benhance/i,
    /\boptimize/i,
    /\bbetter/i,
    /\bupgrade/i,
    /\bmodernize/i,
  ],
  style_change: [
    /\bformat/i,
    /\blint/i,
    /\bstyle\b/i,
    /\bprettier/i,
    /\bindent/i,
    /\bwhitespace/i,
    /\bspacing/i,
  ],
};

// Files that are often legitimately touched as side effects
const ALLOWED_SIDE_EFFECT_FILES = [
  /package\.json$/,
  /package-lock\.json$/,
  /yarn\.lock$/,
  /pnpm-lock\.yaml$/,
  /tsconfig\.json$/,
  /\.gitignore$/,
  /\.env\.example$/,
  /Cargo\.lock$/,
  /go\.sum$/,
];

/**
 * Detect instruction drift in commit history.
 */
export function detectInstructionDrift(
  events: TimelineEvent[],
  filesPerCommit: Map<string, string[]>,
  config: Partial<InnerLoopConfig> = {}
): InstructionDriftResult {
  const cfg = { ...DEFAULT_INNER_LOOP_CONFIG, ...config };
  const drifts: InstructionDrift[] = [];

  if (events.length === 0) {
    return {
      detected: false,
      drifts: [],
      totalDriftCommits: 0,
      totalUnauthorizedFiles: 0,
      message: 'No commits to analyze',
    };
  }

  // If we have explicit session scope, use it
  if (cfg.sessionScope) {
    const scopeDrifts = detectScopeCreep(events, filesPerCommit, cfg.sessionScope, cfg);
    drifts.push(...scopeDrifts);
  }

  // Always check for unrequested refactors/improvements
  const refactorDrifts = detectUnrequestedRefactors(events, filesPerCommit, cfg);
  drifts.push(...refactorDrifts);

  // Detect sudden file scope explosion
  const explosionDrifts = detectScopeExplosion(events, filesPerCommit, cfg);
  drifts.push(...explosionDrifts);

  // Calculate totals
  const totalDriftCommits = new Set(drifts.map((d) => d.commitHash)).size;
  const totalUnauthorizedFiles = new Set(drifts.flatMap((d) => d.unauthorizedFiles)).size;

  const detected = drifts.length > 0;
  let message = '';
  if (detected) {
    const driftTypes = new Set(drifts.map((d) => d.driftType));
    message = `🎯 Instruction drift detected: ${totalDriftCommits} commit${totalDriftCommits > 1 ? 's' : ''} went outside scope (${Array.from(driftTypes).join(', ')})`;
  }

  return {
    detected,
    drifts: drifts.slice(0, 10),
    totalDriftCommits,
    totalUnauthorizedFiles,
    message,
  };
}

/**
 * Detect commits that touch files outside the declared session scope.
 */
function detectScopeCreep(
  events: TimelineEvent[],
  filesPerCommit: Map<string, string[]>,
  scope: SessionScope,
  config: InnerLoopConfig
): InstructionDrift[] {
  const drifts: InstructionDrift[] = [];

  // Build set of authorized files/patterns
  const authorizedFiles = new Set(scope.intendedFiles);
  const authorizedDirs = scope.intendedDirs;

  for (const event of events) {
    const files = filesPerCommit.get(event.hash) || [];
    const unauthorizedFiles: string[] = [];

    for (const file of files) {
      // Skip allowed side-effect files
      if (isAllowedSideEffect(file, config)) continue;

      // Check if file is authorized
      const isAuthorized =
        authorizedFiles.has(file) ||
        authorizedDirs.some((dir) => file.startsWith(dir + '/') || file === dir);

      if (!isAuthorized) {
        unauthorizedFiles.push(file);
      }
    }

    if (unauthorizedFiles.length > 0) {
      drifts.push({
        commitHash: event.hash,
        commitMessage: event.subject,
        timestamp: event.timestamp,
        driftType: 'scope_creep',
        unauthorizedFiles,
        authorizedScope: [...scope.intendedFiles, ...scope.intendedDirs],
        description: `Changed ${unauthorizedFiles.length} file${unauthorizedFiles.length > 1 ? 's' : ''} outside declared scope`,
      });
    }
  }

  return drifts;
}

/**
 * Detect commits that do unrequested refactoring/improvements.
 */
function detectUnrequestedRefactors(
  events: TimelineEvent[],
  filesPerCommit: Map<string, string[]>,
  config: InnerLoopConfig
): InstructionDrift[] {
  const drifts: InstructionDrift[] = [];

  // Build "normal" working set from first few commits
  const workingSet = new Set<string>();
  const firstCommitCount = Math.min(3, events.length);

  for (let i = 0; i < firstCommitCount; i++) {
    const files = filesPerCommit.get(events[i].hash) || [];
    files.forEach((f) => workingSet.add(f));
  }

  for (const event of events) {
    const message = event.subject;

    // Check for refactor/improvement patterns
    for (const [driftType, patterns] of Object.entries(DRIFT_PATTERNS)) {
      const matchesPattern = patterns.some((p) => p.test(message));

      if (matchesPattern) {
        const files = filesPerCommit.get(event.hash) || [];

        // Check if this touches files outside the working set
        const outsideFiles = files.filter(
          (f) => !workingSet.has(f) && !isAllowedSideEffect(f, config)
        );

        if (outsideFiles.length > 0 || files.length > 5) {
          drifts.push({
            commitHash: event.hash,
            commitMessage: message,
            timestamp: event.timestamp,
            driftType: driftType as InstructionDrift['driftType'],
            unauthorizedFiles: outsideFiles,
            authorizedScope: Array.from(workingSet),
            description: `${driftType.replace(/_/g, ' ')}: ${message.substring(0, 50)}`,
          });
        }
      }
    }
  }

  return drifts;
}

/**
 * Detect sudden explosion in file scope (touching many more files than normal).
 */
function detectScopeExplosion(
  events: TimelineEvent[],
  filesPerCommit: Map<string, string[]>,
  config: InnerLoopConfig
): InstructionDrift[] {
  const drifts: InstructionDrift[] = [];

  if (events.length < 3) return drifts;

  // Calculate average files per commit
  let totalFiles = 0;
  const fileCounts: number[] = [];

  for (const event of events) {
    const files = filesPerCommit.get(event.hash) || [];
    const nonSideEffectFiles = files.filter((f) => !isAllowedSideEffect(f, config));
    fileCounts.push(nonSideEffectFiles.length);
    totalFiles += nonSideEffectFiles.length;
  }

  const avgFiles = totalFiles / events.length;
  const threshold = Math.max(avgFiles * 3, 10); // 3x average or at least 10

  // Find commits that touch way more files than average
  for (let i = 0; i < events.length; i++) {
    const event = events[i];
    const fileCount = fileCounts[i];

    if (fileCount > threshold) {
      const files = filesPerCommit.get(event.hash) || [];
      const nonSideEffectFiles = files.filter((f) => !isAllowedSideEffect(f, config));

      drifts.push({
        commitHash: event.hash,
        commitMessage: event.subject,
        timestamp: event.timestamp,
        driftType: 'scope_creep',
        unauthorizedFiles: nonSideEffectFiles,
        authorizedScope: [],
        description: `Touched ${fileCount} files (avg: ${Math.round(avgFiles)}) - possible scope explosion`,
      });
    }
  }

  return drifts;
}

/**
 * Check if a file is an allowed side-effect (like package.json).
 */
function isAllowedSideEffect(file: string, config: InnerLoopConfig): boolean {
  // Check config allowed files
  if (config.allowedDriftFiles.some((f) => file.endsWith(f))) {
    return true;
  }

  // Check default patterns
  return ALLOWED_SIDE_EFFECT_FILES.some((p) => p.test(file));
}

/**
 * Set session scope for drift detection.
 * Call this at session start to declare intended working files.
 */
export function createSessionScope(
  intendedFiles: string[],
  intendedDirs: string[],
  taskDescription?: string
): SessionScope {
  return {
    intendedFiles,
    intendedDirs,
    taskDescription,
    startTime: new Date(),
  };
}

/**
 * Infer session scope from first N commits.
 * Use this if no explicit scope was declared.
 */
export function inferSessionScope(
  events: TimelineEvent[],
  filesPerCommit: Map<string, string[]>,
  commitCount: number = 3
): SessionScope {
  const files = new Set<string>();
  const dirs = new Set<string>();

  const eventsToUse = events.slice(0, commitCount);

  for (const event of eventsToUse) {
    const commitFiles = filesPerCommit.get(event.hash) || [];
    for (const file of commitFiles) {
      files.add(file);

      // Extract directory
      const dir = file.split('/').slice(0, -1).join('/');
      if (dir) dirs.add(dir);
    }
  }

  return {
    intendedFiles: Array.from(files),
    intendedDirs: Array.from(dirs),
    startTime: events[0]?.timestamp || new Date(),
  };
}
