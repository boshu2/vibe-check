/**
 * Quality Metrics Analyzer (VIBE-045)
 *
 * Calculates commit message quality metrics:
 * - Conventional commits percentage
 * - Descriptive commits percentage
 * - Vague commits percentage
 *
 * Proven algorithm from release-engineering retrospective.
 */

import { Commit } from '../types.js';

export interface QualityMetrics {
  totalCommits: number;
  conventionalCommits: {
    count: number;
    percentage: number;
  };
  descriptiveCommits: {
    count: number;
    percentage: number;
    minLength: number;
  };
  vagueCommits: {
    count: number;
    percentage: number;
    threshold: number;
  };
}

/**
 * Conventional commit types as per spec.
 */
const CONVENTIONAL_TYPES = [
  'feat',
  'fix',
  'docs',
  'style',
  'refactor',
  'perf',
  'test',
  'build',
  'ci',
  'chore',
  'revert',
];

/**
 * Check if a commit message follows conventional commit format.
 *
 * Format: type(scope?): description
 * Examples: "feat: add login", "fix(auth): handle token expiry"
 */
export function isConventionalCommit(message: string): boolean {
  const conventionalPattern = new RegExp(
    `^(${CONVENTIONAL_TYPES.join('|')})(\\([^)]+\\))?:\\s*.+`,
    'i'
  );
  return conventionalPattern.test(message.trim());
}

/**
 * Check if a commit message is descriptive (meaningful length).
 *
 * A descriptive commit has at least 20 characters in the first line.
 */
export function isDescriptiveCommit(
  message: string,
  minLength: number = 20
): boolean {
  const firstLine = message.trim().split('\n')[0];
  return firstLine.length >= minLength;
}

/**
 * Check if a commit message is vague (too short to be meaningful).
 *
 * Threshold: < 20 characters
 */
export function isVagueCommit(
  message: string,
  threshold: number = 20
): boolean {
  const firstLine = message.trim().split('\n')[0];
  return firstLine.length < threshold;
}

/**
 * Calculate quality metrics for a set of commits.
 */
export function calculateQualityMetrics(
  commits: Commit[],
  vagueThreshold: number = 20,
  descriptiveMinLength: number = 20
): QualityMetrics {
  const total = commits.length;

  if (total === 0) {
    return {
      totalCommits: 0,
      conventionalCommits: { count: 0, percentage: 0 },
      descriptiveCommits: { count: 0, percentage: 0, minLength: descriptiveMinLength },
      vagueCommits: { count: 0, percentage: 0, threshold: vagueThreshold },
    };
  }

  const conventionalCount = commits.filter((c) =>
    isConventionalCommit(c.message)
  ).length;

  const descriptiveCount = commits.filter((c) =>
    isDescriptiveCommit(c.message, descriptiveMinLength)
  ).length;

  const vagueCount = commits.filter((c) =>
    isVagueCommit(c.message, vagueThreshold)
  ).length;

  return {
    totalCommits: total,
    conventionalCommits: {
      count: conventionalCount,
      percentage: Math.round((conventionalCount / total) * 1000) / 10,
    },
    descriptiveCommits: {
      count: descriptiveCount,
      percentage: Math.round((descriptiveCount / total) * 1000) / 10,
      minLength: descriptiveMinLength,
    },
    vagueCommits: {
      count: vagueCount,
      percentage: Math.round((vagueCount / total) * 1000) / 10,
      threshold: vagueThreshold,
    },
  };
}

/**
 * Generate a recommendation based on quality metrics.
 *
 * Returns 'sweep' if cleanup is recommended, 'maintain' if quality is acceptable.
 */
export function getRecommendation(
  metrics: QualityMetrics,
  hasSpirals: boolean
): 'sweep' | 'maintain' | 'celebrate' {
  // Sweep if: >50% vague commits OR any debug spirals
  if (metrics.vagueCommits.percentage > 50 || hasSpirals) {
    return 'sweep';
  }

  // Celebrate if: >80% conventional AND <10% vague
  if (
    metrics.conventionalCommits.percentage > 80 &&
    metrics.vagueCommits.percentage < 10
  ) {
    return 'celebrate';
  }

  // Otherwise maintain current practices
  return 'maintain';
}
