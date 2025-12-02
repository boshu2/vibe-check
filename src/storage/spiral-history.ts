/**
 * Spiral History Storage
 *
 * Append-only NDJSON log of spiral events with resolution tracking.
 * Enables personalized coaching based on what worked before.
 */
import * as path from 'path';
import * as os from 'os';
import { appendLineSync, readNdjsonSync, atomicWriteSync } from './atomic';

// Resolution types - what broke the spiral
export type SpiralResolution = 'TEST' | 'BREAK' | 'DOCS' | 'HELP' | 'ROLLBACK' | 'OTHER';

// Spiral record stored in NDJSON
export interface SpiralRecord {
  date: string; // ISO date
  pattern: string; // SECRETS_AUTH, VOLUME_CONFIG, etc.
  component: string; // auth, database, api, etc.
  duration: number; // minutes in spiral
  commits: number; // number of fix commits
  resolution?: SpiralResolution; // What broke the spiral
  resolvedAt?: string; // ISO date when resolved
}

// Advice returned from history analysis
export interface SpiralAdvice {
  yourHistory: {
    times: number;
    avgDuration: number;
    totalMinutes: number;
  };
  whatWorked: Array<{
    resolution: SpiralResolution;
    times: number;
    avgDuration: number;
  }>;
  suggestion: string;
}

const HISTORY_DIR = '.vibe-check';
const HISTORY_FILE = 'spiral-history.ndjson';
const MAX_RECORDS = 100; // Keep last 100 spirals

/**
 * Get spiral history file path (in user's home directory)
 */
export function getSpiralHistoryPath(): string {
  return path.join(os.homedir(), HISTORY_DIR, HISTORY_FILE);
}

/**
 * Append a spiral to history
 */
export function appendSpiral(
  pattern: string,
  component: string,
  duration: number,
  commits: number
): void {
  const record: SpiralRecord = {
    date: new Date().toISOString(),
    pattern,
    component,
    duration,
    commits,
  };

  appendLineSync(getSpiralHistoryPath(), JSON.stringify(record));
}

/**
 * Resolve the most recent unresolved spiral
 */
export function resolveSpiral(resolution: SpiralResolution): boolean {
  const records = readSpiralHistory();

  // Find most recent unresolved spiral
  for (let i = records.length - 1; i >= 0; i--) {
    if (!records[i].resolution) {
      records[i].resolution = resolution;
      records[i].resolvedAt = new Date().toISOString();

      // Rewrite entire file (since we're modifying existing record)
      rewriteHistory(records);
      return true;
    }
  }

  return false; // No unresolved spiral found
}

/**
 * Read all spiral history
 */
export function readSpiralHistory(): SpiralRecord[] {
  return readNdjsonSync<SpiralRecord>(getSpiralHistoryPath());
}

/**
 * Get personalized advice for a pattern
 */
export function getAdvice(pattern: string, component?: string): SpiralAdvice | null {
  const records = readSpiralHistory();

  // Filter to matching pattern (and optionally component)
  const matching = records.filter(
    (r) => r.pattern === pattern && (!component || r.component === component)
  );

  if (matching.length === 0) {
    return null;
  }

  // Calculate history stats
  const totalDuration = matching.reduce((sum, r) => sum + r.duration, 0);
  const avgDuration = Math.round(totalDuration / matching.length);

  // Group by resolution
  const resolutionStats = new Map<SpiralResolution, { times: number; totalDuration: number }>();

  for (const record of matching) {
    if (record.resolution) {
      const stats = resolutionStats.get(record.resolution) || { times: 0, totalDuration: 0 };
      stats.times++;
      stats.totalDuration += record.duration;
      resolutionStats.set(record.resolution, stats);
    }
  }

  // Sort by frequency
  const whatWorked = Array.from(resolutionStats.entries())
    .map(([resolution, stats]) => ({
      resolution,
      times: stats.times,
      avgDuration: Math.round(stats.totalDuration / stats.times),
    }))
    .sort((a, b) => b.times - a.times);

  // Generate suggestion
  const suggestion = generateSuggestion(pattern, whatWorked, matching.length);

  return {
    yourHistory: {
      times: matching.length,
      avgDuration,
      totalMinutes: totalDuration,
    },
    whatWorked,
    suggestion,
  };
}

/**
 * Get pattern statistics for insights command
 */
export function getPatternStats(
  days = 30
): Array<{
  pattern: string;
  times: number;
  avgDuration: number;
  bestFix: SpiralResolution | null;
  components: string[];
}> {
  const records = readSpiralHistory();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);

  // Filter to recent records
  const recent = records.filter((r) => new Date(r.date) >= cutoff);

  // Group by pattern
  const patternStats = new Map<
    string,
    {
      times: number;
      totalDuration: number;
      resolutions: Map<SpiralResolution, number>;
      components: Set<string>;
    }
  >();

  for (const record of recent) {
    const stats = patternStats.get(record.pattern) || {
      times: 0,
      totalDuration: 0,
      resolutions: new Map(),
      components: new Set(),
    };

    stats.times++;
    stats.totalDuration += record.duration;
    stats.components.add(record.component);

    if (record.resolution) {
      stats.resolutions.set(
        record.resolution,
        (stats.resolutions.get(record.resolution) || 0) + 1
      );
    }

    patternStats.set(record.pattern, stats);
  }

  // Convert to array and sort by frequency
  return Array.from(patternStats.entries())
    .map(([pattern, stats]) => {
      // Find most common resolution
      let bestFix: SpiralResolution | null = null;
      let maxCount = 0;
      for (const [resolution, count] of stats.resolutions) {
        if (count > maxCount) {
          maxCount = count;
          bestFix = resolution;
        }
      }

      return {
        pattern,
        times: stats.times,
        avgDuration: Math.round(stats.totalDuration / stats.times),
        bestFix,
        components: Array.from(stats.components),
      };
    })
    .sort((a, b) => b.times - a.times);
}

/**
 * Rewrite entire history (used when modifying records)
 */
function rewriteHistory(records: SpiralRecord[]): void {
  const filePath = getSpiralHistoryPath();

  // Trim to max records
  const trimmed = records.slice(-MAX_RECORDS);

  // Write each record as a line
  const content = trimmed.map((r) => JSON.stringify(r)).join('\n') + '\n';

  // Use atomic write for safety
  atomicWriteSync(filePath, content);
}

/**
 * Generate actionable suggestion based on history
 */
function generateSuggestion(
  pattern: string,
  whatWorked: Array<{ resolution: SpiralResolution; times: number }>,
  totalTimes: number
): string {
  // Pattern-specific base advice
  const patternAdvice: Record<string, string> = {
    SECRETS_AUTH: 'Write a test that validates your auth/token assumptions',
    VOLUME_CONFIG: 'Check mount paths and permissions with a minimal test pod',
    API_MISMATCH: 'Verify API version and schema against the docs',
    SSL_TLS: 'Test certificate chain and FIPS compliance in isolation',
    IMAGE_REGISTRY: 'Verify image exists and credentials are valid with docker pull',
    GITOPS_DRIFT: 'Sync with ArgoCD and check for resource conflicts',
  };

  const baseAdvice = patternAdvice[pattern] || 'Take a step back and validate your assumptions';

  // If we have history of what worked, personalize
  if (whatWorked.length > 0) {
    const best = whatWorked[0];
    const resolutionText: Record<SpiralResolution, string> = {
      TEST: 'writing a test',
      BREAK: 'taking a break',
      DOCS: 'reading the docs',
      HELP: 'asking for help',
      ROLLBACK: 'rolling back',
      OTHER: 'trying something different',
    };

    if (best.times >= 2) {
      return `Your go-to: ${resolutionText[best.resolution]} (worked ${best.times}x). ${baseAdvice}`;
    }
  }

  // First time or no resolution data
  if (totalTimes === 1) {
    return baseAdvice;
  }

  return `You've hit this ${totalTimes}x. ${baseAdvice}`;
}

/**
 * Friendly pattern names for display
 */
export function getPatternDisplayName(pattern: string): string {
  const names: Record<string, string> = {
    SECRETS_AUTH: 'OAuth/Token Issues',
    VOLUME_CONFIG: 'Volume/Mount Issues',
    API_MISMATCH: 'API Version/Schema Issues',
    SSL_TLS: 'SSL/TLS/Certificate Issues',
    IMAGE_REGISTRY: 'Image/Registry Issues',
    GITOPS_DRIFT: 'GitOps Sync Issues',
    OTHER: 'Other Issues',
  };

  return names[pattern] || pattern;
}

/**
 * Friendly resolution names for display
 */
export function getResolutionDisplayName(resolution: SpiralResolution): string {
  const names: Record<SpiralResolution, string> = {
    TEST: 'Wrote a test',
    BREAK: 'Took a break',
    DOCS: 'Read the docs',
    HELP: 'Asked for help',
    ROLLBACK: 'Rolled back',
    OTHER: 'Other',
  };

  return names[resolution];
}
