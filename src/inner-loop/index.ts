/**
 * Inner Loop Failure Pattern Detection
 *
 * This module detects the 4 "Inner Loop Disasters" from vibe coding:
 * 1. "Tests Passing" Lie - AI claims success but code doesn't work
 * 2. Context Amnesia - Forgets instructions, re-does work
 * 3. Instruction Drift - "Improves" things not asked for
 * 4. Debug Loop Spiral - Adds logging instead of fixing
 */

import { TimelineEvent } from '../types';
import {
  InnerLoopAnalysis,
  InnerLoopConfig,
  DEFAULT_INNER_LOOP_CONFIG,
  TestsPassingLieResult,
  ContextAmnesiaResult,
  InstructionDriftResult,
  LoggingOnlyResult,
  SessionScope,
} from './types';
import { detectTestsPassingLie } from './tests-passing-lie';
import { detectContextAmnesia } from './context-amnesia';
import { detectInstructionDrift, createSessionScope, inferSessionScope } from './instruction-drift';
import { detectLoggingOnlyCommits, analyzeCommitsForLogging } from './logging-only';

// Re-export types
export * from './types';

// Re-export individual detectors
export { detectTestsPassingLie } from './tests-passing-lie';
export { detectContextAmnesia } from './context-amnesia';
export { detectInstructionDrift, createSessionScope, inferSessionScope } from './instruction-drift';
export { detectLoggingOnlyCommits, analyzeCommitsForLogging } from './logging-only';

/**
 * Run all inner loop failure pattern detectors.
 */
export function analyzeInnerLoop(
  events: TimelineEvent[],
  filesPerCommit: Map<string, string[]>,
  lineStatsPerCommit: Map<string, { additions: number; deletions: number }>,
  config: Partial<InnerLoopConfig> = {}
): InnerLoopAnalysis {
  const cfg = { ...DEFAULT_INNER_LOOP_CONFIG, ...config };

  // Run all detectors
  const testsPassingLie = detectTestsPassingLie(events, filesPerCommit, cfg);
  const contextAmnesia = detectContextAmnesia(events, filesPerCommit, lineStatsPerCommit, cfg);
  const instructionDrift = detectInstructionDrift(events, filesPerCommit, cfg);
  const loggingOnly = detectLoggingOnlyCommits(events, cfg);

  // Calculate summary
  const totalIssues =
    testsPassingLie.totalLies +
    contextAmnesia.totalIncidents +
    instructionDrift.totalDriftCommits +
    (loggingOnly.detected ? 1 : 0);

  // Critical: Tests Passing Lie, high Context Amnesia
  const criticalIssues =
    testsPassingLie.totalLies + (contextAmnesia.totalIncidents >= 3 ? 1 : 0);

  // Warning: Instruction Drift, Debug Loop
  const warningIssues =
    (instructionDrift.detected ? 1 : 0) + (loggingOnly.detected ? 1 : 0);

  // Determine overall health
  let overallHealth: 'healthy' | 'warning' | 'critical' = 'healthy';
  if (criticalIssues > 0) {
    overallHealth = 'critical';
  } else if (warningIssues > 0 || contextAmnesia.totalIncidents > 0) {
    overallHealth = 'warning';
  }

  // Generate recommendations
  const recommendations = generateRecommendations(
    testsPassingLie,
    contextAmnesia,
    instructionDrift,
    loggingOnly
  );

  return {
    testsPassingLie,
    contextAmnesia,
    instructionDrift,
    loggingOnly,
    summary: {
      totalIssuesDetected: totalIssues,
      criticalIssues,
      warningIssues,
      overallHealth,
    },
    recommendations,
  };
}

/**
 * Generate recommendations based on detected patterns.
 */
function generateRecommendations(
  testsPassingLie: TestsPassingLieResult,
  contextAmnesia: ContextAmnesiaResult,
  instructionDrift: InstructionDriftResult,
  loggingOnly: LoggingOnlyResult
): string[] {
  const recommendations: string[] = [];

  // Tests Passing Lie recommendations
  if (testsPassingLie.detected) {
    recommendations.push(
      '🤥 STOP: AI claimed success but code needed fixes. Verify builds/tests actually pass before proceeding.'
    );
    recommendations.push(
      'Run `npm test` or your test command after each "fix" commit to verify.'
    );
  }

  // Context Amnesia recommendations
  if (contextAmnesia.detected) {
    if (contextAmnesia.incidents.some((i) => i.type === 'revert')) {
      recommendations.push(
        '🧠 AI is reverting previous work. Check if changes were intentional before accepting reverts.'
      );
    }
    if (contextAmnesia.incidents.some((i) => i.type === 'reimplementation')) {
      recommendations.push(
        '🧠 AI deleted then re-added code. This suggests context loss - try breaking task into smaller pieces.'
      );
    }
    if (contextAmnesia.incidents.some((i) => i.type === 'forgotten_change')) {
      recommendations.push(
        '🧠 Similar fixes being attempted repeatedly. Consider restarting with clear instructions.'
      );
    }
  }

  // Instruction Drift recommendations
  if (instructionDrift.detected) {
    if (instructionDrift.drifts.some((d) => d.driftType === 'scope_creep')) {
      recommendations.push(
        '🎯 AI changed files outside your stated scope. Be explicit: "ONLY modify src/feature.ts"'
      );
    }
    if (instructionDrift.drifts.some((d) => d.driftType === 'unrequested_refactor')) {
      recommendations.push(
        '🎯 AI did unrequested refactoring. Add: "Do NOT refactor or clean up other code"'
      );
    }
    if (instructionDrift.drifts.some((d) => d.driftType === 'unrequested_improvement')) {
      recommendations.push(
        '🎯 AI made unrequested "improvements". Be explicit about what NOT to do.'
      );
    }
  }

  // Debug Loop recommendations
  if (loggingOnly.detected) {
    recommendations.push(
      '🔍 Debug loop detected: Multiple logging commits without fixes. STOP and think about the root cause.'
    );
    recommendations.push(
      'Try: 1) Read error messages carefully, 2) Check the docs, 3) Simplify to minimal reproduction'
    );
    if (loggingOnly.consecutiveLoggingCount >= 5) {
      recommendations.push(
        '⚠️  EMERGENCY: 5+ consecutive debug commits. Consider: git stash, take a break, start fresh.'
      );
    }
  }

  // General emergency recommendation
  const totalCritical =
    testsPassingLie.totalLies +
    contextAmnesia.totalIncidents +
    (loggingOnly.consecutiveLoggingCount >= 3 ? 1 : 0);

  if (totalCritical >= 3) {
    recommendations.unshift(
      '🚨 EMERGENCY PROTOCOL: Multiple inner loop failures detected. STOP → git status → backup → start simple'
    );
  }

  return recommendations;
}

/**
 * Quick check for inner loop issues (fast, no diff analysis).
 */
export function quickInnerLoopCheck(
  events: TimelineEvent[],
  filesPerCommit: Map<string, string[]>,
  lineStatsPerCommit: Map<string, { additions: number; deletions: number }>
): {
  hasIssues: boolean;
  issueCount: number;
  topIssue: string | null;
} {
  const analysis = analyzeInnerLoop(events, filesPerCommit, lineStatsPerCommit);

  const issues: string[] = [];
  if (analysis.testsPassingLie.detected) issues.push('tests-passing-lie');
  if (analysis.contextAmnesia.detected) issues.push('context-amnesia');
  if (analysis.instructionDrift.detected) issues.push('instruction-drift');
  if (analysis.loggingOnly.detected) issues.push('debug-loop');

  return {
    hasIssues: issues.length > 0,
    issueCount: issues.length,
    topIssue: issues[0] || null,
  };
}

/**
 * Format inner loop analysis for terminal output.
 */
export function formatInnerLoopAnalysis(analysis: InnerLoopAnalysis): string {
  const lines: string[] = [];

  // Header
  const healthEmoji =
    analysis.summary.overallHealth === 'critical'
      ? '🚨'
      : analysis.summary.overallHealth === 'warning'
        ? '⚠️'
        : '✅';
  lines.push(`\n${healthEmoji} Inner Loop Health: ${analysis.summary.overallHealth.toUpperCase()}`);
  lines.push('─'.repeat(50));

  // Individual pattern results
  if (analysis.testsPassingLie.detected) {
    lines.push(`🤥 Tests Passing Lie: ${analysis.testsPassingLie.message}`);
  }
  if (analysis.contextAmnesia.detected) {
    lines.push(`🧠 Context Amnesia: ${analysis.contextAmnesia.message}`);
  }
  if (analysis.instructionDrift.detected) {
    lines.push(`🎯 Instruction Drift: ${analysis.instructionDrift.message}`);
  }
  if (analysis.loggingOnly.detected) {
    lines.push(`🔍 Debug Loop: ${analysis.loggingOnly.message}`);
  }

  // Summary
  if (analysis.summary.totalIssuesDetected > 0) {
    lines.push('');
    lines.push(
      `Total: ${analysis.summary.totalIssuesDetected} issue${analysis.summary.totalIssuesDetected > 1 ? 's' : ''} ` +
        `(${analysis.summary.criticalIssues} critical, ${analysis.summary.warningIssues} warning)`
    );
  } else {
    lines.push('No inner loop issues detected.');
  }

  // Recommendations
  if (analysis.recommendations.length > 0) {
    lines.push('');
    lines.push('Recommendations:');
    for (const rec of analysis.recommendations.slice(0, 5)) {
      lines.push(`  ${rec}`);
    }
  }

  return lines.join('\n');
}
