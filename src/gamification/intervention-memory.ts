/**
 * Intervention Memory - Track what breaks your spirals
 *
 * This module stores and aggregates intervention data to help users
 * identify what techniques work best for breaking their debug spirals.
 */

import {
  InterventionMemory,
  InterventionRecord,
  InterventionType,
} from './types';

const MAX_RECORDS = 100;
const INTERVENTION_MEMORY_VERSION = '1.0.0';

// Intervention type metadata
export const INTERVENTION_INFO: Record<
  InterventionType,
  { name: string; icon: string; description: string }
> = {
  TRACER_TEST: {
    name: 'Tracer Test',
    icon: '🧪',
    description: 'Wrote a test to validate assumptions',
  },
  BREAK: {
    name: 'Take a Break',
    icon: '☕',
    description: 'Stepped away to clear your head',
  },
  DOCS: {
    name: 'Read Docs',
    icon: '📚',
    description: 'Consulted documentation',
  },
  REFACTOR: {
    name: 'Refactor',
    icon: '🔄',
    description: 'Changed approach or architecture',
  },
  HELP: {
    name: 'Ask for Help',
    icon: '🤝',
    description: 'Asked a human or AI for assistance',
  },
  ROLLBACK: {
    name: 'Rollback',
    icon: '⏪',
    description: 'Reverted to a known good state',
  },
  OTHER: {
    name: 'Other',
    icon: '💡',
    description: 'Custom intervention',
  },
};

/**
 * Create initial empty intervention memory
 */
export function createInitialInterventionMemory(): InterventionMemory {
  return {
    version: INTERVENTION_MEMORY_VERSION,
    records: [],
    typeCounts: {},
    effectiveByPattern: {},
    topInterventions: [],
    avgTimeToIntervene: 0,
    totalInterventions: 0,
  };
}

/**
 * Record a new intervention and recompute aggregates
 */
export function recordIntervention(
  memory: InterventionMemory | undefined,
  intervention: Omit<InterventionRecord, 'date'>
): InterventionMemory {
  const current = memory || createInitialInterventionMemory();

  const newRecord: InterventionRecord = {
    ...intervention,
    date: new Date().toISOString().split('T')[0],
  };

  // Add to records (keep last MAX_RECORDS)
  const allRecords = [...current.records, newRecord];
  const trimmedRecords = allRecords.slice(-MAX_RECORDS);

  // Recompute all aggregates
  return computeAggregates({
    ...current,
    records: trimmedRecords,
  });
}

/**
 * Compute all aggregate statistics from records
 */
function computeAggregates(memory: InterventionMemory): InterventionMemory {
  const records = memory.records;

  if (records.length === 0) {
    return createInitialInterventionMemory();
  }

  // Count intervention types
  const typeCounts: Record<string, number> = {};
  const effectiveByPattern: Record<string, string[]> = {};
  let totalDuration = 0;

  for (const record of records) {
    // Type counts
    typeCounts[record.type] = (typeCounts[record.type] || 0) + 1;

    // Track which interventions work for which patterns
    if (record.spiralPattern) {
      if (!effectiveByPattern[record.spiralPattern]) {
        effectiveByPattern[record.spiralPattern] = [];
      }
      if (!effectiveByPattern[record.spiralPattern].includes(record.type)) {
        effectiveByPattern[record.spiralPattern].push(record.type);
      }
    }

    totalDuration += record.spiralDuration;
  }

  // Get top 3 intervention types by frequency
  const topInterventions = Object.entries(typeCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([type]) => type);

  // Average time to intervene
  const avgTimeToIntervene =
    records.length > 0 ? Math.round(totalDuration / records.length) : 0;

  return {
    version: INTERVENTION_MEMORY_VERSION,
    records,
    typeCounts,
    effectiveByPattern,
    topInterventions,
    avgTimeToIntervene,
    totalInterventions: records.length,
  };
}

/**
 * Get intervention display name
 */
export function getInterventionDisplayName(type: InterventionType): string {
  return INTERVENTION_INFO[type]?.name || type;
}

/**
 * Get intervention icon
 */
export function getInterventionIcon(type: InterventionType): string {
  return INTERVENTION_INFO[type]?.icon || '💡';
}

/**
 * Get recommended intervention for a pattern based on history
 */
export function getRecommendedIntervention(
  memory: InterventionMemory | undefined,
  pattern: string
): InterventionType | null {
  if (!memory || memory.records.length === 0) {
    return null;
  }

  // Check pattern-specific interventions first
  const patternInterventions = memory.effectiveByPattern[pattern];
  if (patternInterventions && patternInterventions.length > 0) {
    // Return the most used intervention for this pattern
    const counts: Record<string, number> = {};
    for (const record of memory.records) {
      if (record.spiralPattern === pattern) {
        counts[record.type] = (counts[record.type] || 0) + 1;
      }
    }
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    if (sorted.length > 0) {
      return sorted[0][0] as InterventionType;
    }
  }

  // Fall back to overall most effective intervention
  if (memory.topInterventions.length > 0) {
    return memory.topInterventions[0] as InterventionType;
  }

  return null;
}

/**
 * Format intervention memory for display
 */
export function formatInterventionMemory(memory: InterventionMemory | undefined): {
  hasData: boolean;
  summary: string;
  topInterventions: Array<{
    type: InterventionType;
    name: string;
    icon: string;
    count: number;
  }>;
  patternRecommendations: Array<{
    pattern: string;
    interventions: string[];
  }>;
  avgTimeToIntervene: number;
  totalInterventions: number;
} {
  if (!memory || memory.records.length === 0) {
    return {
      hasData: false,
      summary: 'No interventions recorded yet',
      topInterventions: [],
      patternRecommendations: [],
      avgTimeToIntervene: 0,
      totalInterventions: 0,
    };
  }

  const topInterventions = memory.topInterventions.map((type) => ({
    type: type as InterventionType,
    name: getInterventionDisplayName(type as InterventionType),
    icon: getInterventionIcon(type as InterventionType),
    count: memory.typeCounts[type] || 0,
  }));

  const patternRecommendations = Object.entries(memory.effectiveByPattern)
    .slice(0, 3)
    .map(([pattern, interventions]) => ({
      pattern,
      interventions: interventions.map((i) =>
        getInterventionDisplayName(i as InterventionType)
      ),
    }));

  // Generate summary
  let summary: string;
  if (memory.totalInterventions === 1) {
    summary = '1 intervention recorded';
  } else if (topInterventions.length > 0) {
    const top = topInterventions[0];
    const pct = Math.round((top.count / memory.totalInterventions) * 100);
    summary = `${memory.totalInterventions} interventions - ${top.name} is your go-to (${pct}%)`;
  } else {
    summary = `${memory.totalInterventions} interventions recorded`;
  }

  return {
    hasData: true,
    summary,
    topInterventions,
    patternRecommendations,
    avgTimeToIntervene: memory.avgTimeToIntervene,
    totalInterventions: memory.totalInterventions,
  };
}

/**
 * Get all available intervention types
 */
export function getAllInterventionTypes(): Array<{
  type: InterventionType;
  name: string;
  icon: string;
  description: string;
}> {
  return (Object.keys(INTERVENTION_INFO) as InterventionType[]).map((type) => ({
    type,
    ...INTERVENTION_INFO[type],
  }));
}
