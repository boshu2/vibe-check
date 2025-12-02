/**
 * Lesson Surfacing
 *
 * Finds and formats relevant lessons to display based on current context.
 * This is the "proactive" part - surfacing learnings at the right time.
 */

import chalk from 'chalk';
import { Lesson, SurfacedLesson } from './lessons-types';
import { loadLessons, getLessonsForPattern, getActiveLessons } from './lessons-storage';
import { getInterventionDisplayName, getInterventionIcon } from '../gamification/intervention-memory';
import { InterventionType } from '../gamification/types';

/**
 * Get lessons relevant to a detected pattern
 *
 * Called from analyze.ts when spirals are detected
 */
export function surfaceLessonsForPattern(pattern: string): SurfacedLesson[] {
  const db = loadLessons();
  const lessons = getLessonsForPattern(db, pattern);

  if (lessons.length === 0) {
    return [];
  }

  return lessons
    .map(lesson => ({
      lesson,
      relevanceScore: calculateRelevance(lesson, pattern),
      reason: `You've seen ${lesson.pattern} ${lesson.evidenceCount} times before`,
      suggestedIntervention: getBestIntervention(lesson),
    }))
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
    .slice(0, 2); // Top 2 most relevant
}

/**
 * Get lessons relevant to a component being modified
 *
 * Called when we detect work in a historically problematic area
 */
export function surfaceLessonsForComponent(component: string): SurfacedLesson[] {
  const db = loadLessons();
  const activeLessons = getActiveLessons(db);

  // Find lessons that mention this component
  const relevant = activeLessons.filter(l =>
    l.components.some(c =>
      c.toLowerCase().includes(component.toLowerCase()) ||
      component.toLowerCase().includes(c.toLowerCase())
    )
  );

  if (relevant.length === 0) {
    return [];
  }

  return relevant
    .map(lesson => ({
      lesson,
      relevanceScore: calculateRelevance(lesson, lesson.pattern),
      reason: `${component} has caused ${lesson.pattern} spirals before`,
      suggestedIntervention: getBestIntervention(lesson),
    }))
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
    .slice(0, 2);
}

/**
 * Get top lessons to show in profile/status
 */
export function getTopLessons(limit: number = 3): Lesson[] {
  const db = loadLessons();
  const activeLessons = getActiveLessons(db);

  return activeLessons
    .sort((a, b) => {
      // Sort by: severity, confidence, evidence count
      const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      const severityDiff = severityOrder[b.severity] - severityOrder[a.severity];
      if (severityDiff !== 0) return severityDiff;

      if (a.confidence !== b.confidence) return b.confidence - a.confidence;
      return b.evidenceCount - a.evidenceCount;
    })
    .slice(0, limit);
}

/**
 * Format a surfaced lesson for CLI display
 */
export function formatSurfacedLesson(surfaced: SurfacedLesson): string[] {
  const { lesson, suggestedIntervention } = surfaced;
  const lines: string[] = [];

  // Color based on severity
  const severityColor = lesson.severity === 'critical' ? chalk.red :
                        lesson.severity === 'high' ? chalk.yellow :
                        chalk.cyan;

  const severityIcon = lesson.severity === 'critical' ? '🚨' :
                       lesson.severity === 'high' ? '⚠️' :
                       lesson.severity === 'medium' ? '💡' : '📝';

  lines.push(severityColor(`  ${severityIcon} LESSON: ${lesson.title}`));
  lines.push(chalk.gray(`     Pattern: ${lesson.pattern} (${lesson.evidenceCount}x, ${lesson.totalTimeWasted} min wasted)`));

  // Show best intervention if available
  if (suggestedIntervention) {
    const icon = getInterventionIcon(suggestedIntervention);
    const name = getInterventionDisplayName(suggestedIntervention);
    const intervention = lesson.interventions.find(i => i.type === suggestedIntervention);
    const effectiveness = intervention ? `${intervention.effectiveness}%` : '';
    lines.push(chalk.green(`     What worked: ${icon} ${name} ${effectiveness}`));
  }

  // Show top prevention tip
  if (lesson.prevention.length > 0) {
    lines.push(chalk.gray(`     Prevention: ${lesson.prevention[0]}`));
  }

  lines.push(chalk.gray(`     Run: vibe-check lesson ${lesson.id}`));

  return lines;
}

/**
 * Format a lesson for detailed view
 */
export function formatLessonDetail(lesson: Lesson): string[] {
  const lines: string[] = [];

  const severityColor = lesson.severity === 'critical' ? chalk.red :
                        lesson.severity === 'high' ? chalk.yellow :
                        chalk.cyan;

  lines.push('');
  lines.push(severityColor('='.repeat(64)));
  lines.push(severityColor(`  LESSON: ${lesson.title}`));
  lines.push(severityColor('='.repeat(64)));
  lines.push('');

  // Pattern info
  lines.push(chalk.bold.white('  PATTERN'));
  lines.push(`    ${lesson.pattern}`);
  lines.push(`    Occurrences: ${lesson.evidenceCount}`);
  lines.push(`    Time wasted: ${lesson.totalTimeWasted} min`);
  lines.push(`    Severity: ${lesson.severity}`);
  lines.push(`    Confidence: ${lesson.confidence}%`);
  lines.push('');

  // Components
  if (lesson.components.length > 0) {
    lines.push(chalk.bold.white('  COMPONENTS AFFECTED'));
    for (const comp of lesson.components) {
      lines.push(`    - ${comp}`);
    }
    lines.push('');
  }

  // Root cause
  if (lesson.rootCause) {
    lines.push(chalk.bold.white('  ROOT CAUSE'));
    lines.push(`    ${lesson.rootCause}`);
    lines.push('');
  }

  // Prevention
  if (lesson.prevention.length > 0) {
    lines.push(chalk.bold.white('  PREVENTION'));
    for (const step of lesson.prevention) {
      lines.push(`    - ${step}`);
    }
    lines.push('');
  }

  // What worked
  if (lesson.interventions.length > 0) {
    lines.push(chalk.bold.white('  WHAT WORKED'));
    for (const int of lesson.interventions) {
      const icon = getInterventionIcon(int.type);
      const name = getInterventionDisplayName(int.type);
      lines.push(`    ${icon} ${name}: ${int.effectiveness}% effective (${int.successCount}/${int.totalCount})`);
    }
    lines.push('');
  }

  // Status
  lines.push(chalk.bold.white('  STATUS'));
  if (lesson.applied) {
    lines.push(chalk.green(`    ✓ Applied on ${lesson.appliedDate}`));
    if (lesson.userEffectiveness !== undefined) {
      lines.push(`    User effectiveness rating: ${lesson.userEffectiveness}%`);
    }
  } else if (lesson.dismissed) {
    lines.push(chalk.gray('    ✗ Dismissed'));
  } else {
    lines.push(chalk.yellow('    ○ Not yet applied'));
  }
  lines.push('');

  // Actions
  lines.push(chalk.bold.white('  ACTIONS'));
  lines.push(chalk.gray(`    vibe-check lesson ${lesson.id} --apply 80    # Mark as applied with 80% effectiveness`));
  lines.push(chalk.gray(`    vibe-check lesson ${lesson.id} --dismiss     # Dismiss if not relevant`));
  lines.push('');

  lines.push(severityColor('='.repeat(64)));
  lines.push('');

  return lines;
}

/**
 * Format lessons summary for learn --status
 */
export function formatLessonsSummary(): string[] {
  const db = loadLessons();
  const lines: string[] = [];

  if (db.lessons.length === 0) {
    lines.push(chalk.gray('  No lessons learned yet (run a retrospective to generate)'));
    return lines;
  }

  lines.push(chalk.bold.white(`  LESSONS LEARNED (${db.stats.activeLessons} active)`));
  lines.push(`    Total time wasted on patterns: ${db.stats.totalTimeWastedMinutes} min`);
  lines.push(`    Average confidence: ${db.stats.averageConfidence}%`);
  lines.push('');

  // Top lessons
  const topLessons = getTopLessons(3);
  if (topLessons.length > 0) {
    lines.push(chalk.bold.white('  TOP LESSONS'));
    for (const lesson of topLessons) {
      const severityIcon = lesson.severity === 'critical' ? '🚨' :
                           lesson.severity === 'high' ? '⚠️' :
                           lesson.severity === 'medium' ? '💡' : '📝';
      lines.push(`    ${severityIcon} ${lesson.title}`);
      lines.push(chalk.gray(`       ${lesson.pattern}: ${lesson.evidenceCount}x, ${lesson.totalTimeWasted} min`));
    }
  }

  return lines;
}

/**
 * Calculate relevance score for a lesson
 */
function calculateRelevance(lesson: Lesson, pattern: string): number {
  let score = 0;

  // Base score from confidence
  score += lesson.confidence * 0.4;

  // Bonus for exact pattern match
  if (lesson.pattern === pattern) {
    score += 30;
  }

  // Bonus for high evidence count
  score += Math.min(20, lesson.evidenceCount * 4);

  // Bonus for recent updates (within 7 days)
  const daysSinceUpdate = Math.floor(
    (Date.now() - new Date(lesson.updatedAt).getTime()) / (1000 * 60 * 60 * 24)
  );
  if (daysSinceUpdate < 7) {
    score += 10;
  }

  // Penalty if already applied (user knows about it)
  if (lesson.applied) {
    score -= 20;
  }

  return Math.max(0, Math.min(100, score));
}

/**
 * Get the best intervention for a lesson
 */
function getBestIntervention(lesson: Lesson): InterventionType | undefined {
  if (lesson.interventions.length === 0) {
    return undefined;
  }

  // Return intervention with highest effectiveness
  const best = lesson.interventions.reduce((a, b) =>
    a.effectiveness > b.effectiveness ? a : b
  );

  return best.effectiveness > 50 ? best.type : undefined;
}
