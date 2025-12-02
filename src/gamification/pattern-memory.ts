/**
 * Pattern Memory - Track your spiral triggers over time
 *
 * This module stores and aggregates spiral pattern data to help users
 * identify their most common debugging pitfalls.
 */

import { PatternMemory, SpiralPatternRecord } from './types';
import { FixChain } from '../types';

const MAX_RECORDS = 100;
const PATTERN_MEMORY_VERSION = '1.0.0';

/**
 * Create initial empty pattern memory
 */
export function createInitialPatternMemory(): PatternMemory {
  return {
    version: PATTERN_MEMORY_VERSION,
    records: [],
    patternCounts: {},
    componentCounts: {},
    patternDurations: {},
    topPatterns: [],
    topComponents: [],
    avgRecoveryTime: 0,
    totalSpirals: 0,
  };
}

/**
 * Add spiral records from fix chains and recompute aggregates
 */
export function updatePatternMemory(
  memory: PatternMemory | undefined,
  fixChains: FixChain[]
): PatternMemory {
  const current = memory || createInitialPatternMemory();

  // Filter to only spirals (3+ consecutive fixes)
  const spirals = fixChains.filter((chain) => chain.isSpiral);

  if (spirals.length === 0) {
    return current;
  }

  // Create new records from fix chains
  const today = new Date().toISOString().split('T')[0];
  const newRecords: SpiralPatternRecord[] = spirals.map((chain) => ({
    pattern: chain.pattern || 'OTHER',
    component: chain.component,
    duration: chain.duration,
    commits: chain.commits,
    date: today,
  }));

  // Merge with existing records (keep last MAX_RECORDS)
  const allRecords = [...current.records, ...newRecords];
  const trimmedRecords = allRecords.slice(-MAX_RECORDS);

  // Recompute all aggregates from records
  return computeAggregates({
    ...current,
    records: trimmedRecords,
  });
}

/**
 * Compute all aggregate statistics from records
 */
function computeAggregates(memory: PatternMemory): PatternMemory {
  const records = memory.records;

  if (records.length === 0) {
    return createInitialPatternMemory();
  }

  // Count patterns
  const patternCounts: Record<string, number> = {};
  const componentCounts: Record<string, number> = {};
  const patternDurations: Record<string, number> = {};
  let totalDuration = 0;

  for (const record of records) {
    // Pattern counts
    patternCounts[record.pattern] = (patternCounts[record.pattern] || 0) + 1;

    // Component counts
    componentCounts[record.component] =
      (componentCounts[record.component] || 0) + 1;

    // Pattern durations
    patternDurations[record.pattern] =
      (patternDurations[record.pattern] || 0) + record.duration;

    totalDuration += record.duration;
  }

  // Get top 3 patterns by frequency
  const topPatterns = Object.entries(patternCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([pattern]) => pattern);

  // Get top 3 components by frequency
  const topComponents = Object.entries(componentCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([component]) => component);

  // Average recovery time
  const avgRecoveryTime =
    records.length > 0 ? Math.round(totalDuration / records.length) : 0;

  return {
    version: PATTERN_MEMORY_VERSION,
    records,
    patternCounts,
    componentCounts,
    patternDurations,
    topPatterns,
    topComponents,
    avgRecoveryTime,
    totalSpirals: records.length,
  };
}

/**
 * Get human-readable pattern name
 */
export function getPatternDisplayName(pattern: string): string {
  const names: Record<string, string> = {
    SECRETS_AUTH: 'Secrets & Auth',
    VOLUME_CONFIG: 'Volume Config',
    API_MISMATCH: 'API Mismatch',
    SSL_TLS: 'SSL/TLS',
    IMAGE_REGISTRY: 'Image/Registry',
    GITOPS_DRIFT: 'GitOps Drift',
    OTHER: 'Other',
  };
  return names[pattern] || pattern;
}

/**
 * Get pattern-specific advice
 */
export function getPatternAdvice(pattern: string): string {
  const advice: Record<string, string> = {
    SECRETS_AUTH:
      'Consider using a secrets manager or validating auth configs before deploy',
    VOLUME_CONFIG:
      'Add volume mount tests to your CI pipeline and validate paths early',
    API_MISMATCH:
      'Use schema validation and version checks before integration',
    SSL_TLS: 'Test certificate chains in staging and automate renewal checks',
    IMAGE_REGISTRY:
      'Verify image tags exist before deploy, consider digest-based pulls',
    GITOPS_DRIFT:
      'Run drift detection in CI and enforce reconciliation timeouts',
    OTHER: 'Consider adding pre-deployment validation for this component',
  };
  return advice[pattern] || advice.OTHER;
}

/**
 * Format pattern memory for display
 */
export function formatPatternMemory(memory: PatternMemory | undefined): {
  hasData: boolean;
  summary: string;
  topPatterns: Array<{
    pattern: string;
    displayName: string;
    count: number;
    totalMinutes: number;
    advice: string;
  }>;
  topComponents: Array<{ component: string; count: number }>;
  avgRecoveryTime: number;
  totalSpirals: number;
} {
  if (!memory || memory.records.length === 0) {
    return {
      hasData: false,
      summary: 'No spiral patterns recorded yet',
      topPatterns: [],
      topComponents: [],
      avgRecoveryTime: 0,
      totalSpirals: 0,
    };
  }

  const topPatterns = memory.topPatterns.map((pattern) => ({
    pattern,
    displayName: getPatternDisplayName(pattern),
    count: memory.patternCounts[pattern] || 0,
    totalMinutes: memory.patternDurations[pattern] || 0,
    advice: getPatternAdvice(pattern),
  }));

  const topComponents = memory.topComponents.map((component) => ({
    component,
    count: memory.componentCounts[component] || 0,
  }));

  // Generate summary
  let summary: string;
  if (memory.totalSpirals === 1) {
    summary = '1 spiral recorded';
  } else if (memory.totalSpirals < 5) {
    summary = `${memory.totalSpirals} spirals recorded`;
  } else if (topPatterns.length > 0) {
    const topPattern = topPatterns[0];
    const pct = Math.round((topPattern.count / memory.totalSpirals) * 100);
    summary = `${memory.totalSpirals} spirals total - ${topPattern.displayName} is your top trigger (${pct}%)`;
  } else {
    summary = `${memory.totalSpirals} spirals recorded`;
  }

  return {
    hasData: true,
    summary,
    topPatterns,
    topComponents,
    avgRecoveryTime: memory.avgRecoveryTime,
    totalSpirals: memory.totalSpirals,
  };
}
