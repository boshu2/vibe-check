/**
 * Intervention Effectiveness Scoring
 *
 * Analyzes how well different interventions break spirals
 * and provides data-driven recommendations.
 */

import { InterventionMemory, InterventionRecord, InterventionType } from '../gamification/types';

export interface InterventionScore {
  type: InterventionType;
  name: string;
  icon: string;
  effectiveness: number; // 0-100
  avgResolutionTime: number; // minutes
  totalUses: number;
  successRate: number; // percentage
  bestForPatterns: string[];
}

export interface EffectivenessAnalysis {
  scores: InterventionScore[];
  topRecommendation: InterventionType | null;
  insights: string[];
}

// Intervention metadata
const INTERVENTION_META: Record<InterventionType, { name: string; icon: string }> = {
  TRACER_TEST: { name: 'Tracer Test', icon: '🧪' },
  BREAK: { name: 'Take a Break', icon: '☕' },
  DOCS: { name: 'Read Docs', icon: '📚' },
  REFACTOR: { name: 'Refactor', icon: '🔄' },
  HELP: { name: 'Ask for Help', icon: '🤝' },
  ROLLBACK: { name: 'Rollback', icon: '⏪' },
  OTHER: { name: 'Other', icon: '💡' },
};

/**
 * Calculate effectiveness scores for all interventions
 */
export function calculateEffectiveness(memory: InterventionMemory | undefined): EffectivenessAnalysis {
  if (!memory || memory.records.length === 0) {
    return {
      scores: [],
      topRecommendation: null,
      insights: ['No intervention data yet. Use `vibe-check intervene` to record your techniques.'],
    };
  }

  // Group records by intervention type
  const byType = new Map<InterventionType, InterventionRecord[]>();
  for (const record of memory.records) {
    if (!byType.has(record.type)) {
      byType.set(record.type, []);
    }
    byType.get(record.type)!.push(record);
  }

  // Calculate scores for each type
  const scores: InterventionScore[] = [];

  for (const [type, records] of byType.entries()) {
    const meta = INTERVENTION_META[type] || { name: type, icon: '💡' };

    // Average resolution time
    const totalDuration = records.reduce((sum, r) => sum + r.spiralDuration, 0);
    const avgResolutionTime = Math.round(totalDuration / records.length);

    // Find patterns this intervention is used for
    const patternCounts = new Map<string, number>();
    for (const record of records) {
      if (record.spiralPattern) {
        patternCounts.set(
          record.spiralPattern,
          (patternCounts.get(record.spiralPattern) || 0) + 1
        );
      }
    }
    const bestForPatterns = Array.from(patternCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 2)
      .map(([pattern]) => pattern);

    // Calculate effectiveness score
    // Lower resolution time = higher effectiveness
    // More uses = more reliable data
    const baseScore = Math.max(0, 100 - avgResolutionTime); // Penalize long resolutions
    const usageBonus = Math.min(20, records.length * 2); // Up to 20 bonus for usage
    const effectiveness = Math.min(100, Math.round(baseScore + usageBonus));

    scores.push({
      type,
      name: meta.name,
      icon: meta.icon,
      effectiveness,
      avgResolutionTime,
      totalUses: records.length,
      successRate: 100, // All recorded interventions are "successful" by definition
      bestForPatterns,
    });
  }

  // Sort by effectiveness
  scores.sort((a, b) => b.effectiveness - a.effectiveness);

  // Generate insights
  const insights = generateInsights(scores, memory);

  return {
    scores,
    topRecommendation: scores.length > 0 ? scores[0].type : null,
    insights,
  };
}

/**
 * Generate actionable insights from effectiveness data
 */
function generateInsights(scores: InterventionScore[], memory: InterventionMemory): string[] {
  const insights: string[] = [];

  if (scores.length === 0) return insights;

  // Top performer insight
  const top = scores[0];
  if (top.totalUses >= 3) {
    insights.push(
      `${top.icon} ${top.name} is your most effective technique (${top.avgResolutionTime}m avg resolution)`
    );
  }

  // Underused effective techniques
  const underused = scores.filter(s => s.effectiveness > 70 && s.totalUses < 3);
  if (underused.length > 0) {
    const technique = underused[0];
    insights.push(
      `Try ${technique.icon} ${technique.name} more often - it resolves issues in ${technique.avgResolutionTime}m`
    );
  }

  // Pattern-specific recommendations
  const patternInterventions = memory.effectiveByPattern;
  for (const [pattern, types] of Object.entries(patternInterventions)) {
    if (types.length > 0) {
      const bestType = types[0] as InterventionType;
      const meta = INTERVENTION_META[bestType];
      if (meta) {
        insights.push(
          `For ${pattern} issues, ${meta.icon} ${meta.name} works best for you`
        );
      }
    }
  }

  // Time-based insight
  if (memory.avgTimeToIntervene > 30) {
    insights.push(
      `You wait ${memory.avgTimeToIntervene}m on average before intervening. Try the 15-minute rule.`
    );
  }

  return insights.slice(0, 4); // Max 4 insights
}

/**
 * Get recommended intervention for a specific situation
 */
export function getRecommendation(
  memory: InterventionMemory | undefined,
  pattern?: string,
  currentDuration?: number
): {
  intervention: InterventionType;
  reason: string;
  urgency: 'low' | 'medium' | 'high';
} {
  const defaultRec = {
    intervention: 'TRACER_TEST' as InterventionType,
    reason: 'Write a test to validate your assumptions',
    urgency: 'medium' as const,
  };

  if (!memory || memory.records.length === 0) {
    return defaultRec;
  }

  // Check for pattern-specific recommendation
  if (pattern && memory.effectiveByPattern[pattern]?.length > 0) {
    const type = memory.effectiveByPattern[pattern][0] as InterventionType;
    const meta = INTERVENTION_META[type];
    return {
      intervention: type,
      reason: `${meta.icon} ${meta.name} has worked for ${pattern} before`,
      urgency: currentDuration && currentDuration > 30 ? 'high' : 'medium',
    };
  }

  // Fall back to most used effective intervention
  if (memory.topInterventions.length > 0) {
    const type = memory.topInterventions[0] as InterventionType;
    const meta = INTERVENTION_META[type];
    return {
      intervention: type,
      reason: `${meta.icon} ${meta.name} is your most reliable technique`,
      urgency: currentDuration && currentDuration > 45 ? 'high' : 'medium',
    };
  }

  return defaultRec;
}

/**
 * Compare two interventions
 */
export function compareInterventions(
  memory: InterventionMemory | undefined,
  type1: InterventionType,
  type2: InterventionType
): {
  winner: InterventionType | null;
  comparison: string;
} {
  if (!memory || memory.records.length === 0) {
    return { winner: null, comparison: 'Not enough data to compare' };
  }

  const records1 = memory.records.filter(r => r.type === type1);
  const records2 = memory.records.filter(r => r.type === type2);

  if (records1.length === 0 && records2.length === 0) {
    return { winner: null, comparison: 'Neither intervention has been used' };
  }

  const avg1 = records1.length > 0
    ? records1.reduce((sum, r) => sum + r.spiralDuration, 0) / records1.length
    : Infinity;

  const avg2 = records2.length > 0
    ? records2.reduce((sum, r) => sum + r.spiralDuration, 0) / records2.length
    : Infinity;

  const meta1 = INTERVENTION_META[type1];
  const meta2 = INTERVENTION_META[type2];

  if (avg1 < avg2) {
    const diff = Math.round(avg2 - avg1);
    return {
      winner: type1,
      comparison: `${meta1.icon} ${meta1.name} resolves ${diff}m faster than ${meta2.icon} ${meta2.name}`,
    };
  } else if (avg2 < avg1) {
    const diff = Math.round(avg1 - avg2);
    return {
      winner: type2,
      comparison: `${meta2.icon} ${meta2.name} resolves ${diff}m faster than ${meta1.icon} ${meta1.name}`,
    };
  } else {
    return {
      winner: null,
      comparison: `${meta1.icon} ${meta1.name} and ${meta2.icon} ${meta2.name} are equally effective`,
    };
  }
}
