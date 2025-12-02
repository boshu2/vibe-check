/**
 * Lesson Synthesis Engine
 *
 * Automatically extracts lessons from pattern + intervention memory.
 * Runs during retrospectives to keep the lessons database current.
 */

import {
  Lesson,
  LessonsDatabase,
  LessonIntervention,
  SynthesisLogEntry,
  SYNTHESIS_THRESHOLD,
  CONFIDENCE_BASE,
} from './lessons-types';
import { loadLessons, saveLessons, upsertLesson } from './lessons-storage';
import { PatternMemory, InterventionMemory, InterventionType } from '../gamification/types';
import { getPatternDisplayName, getPatternAdvice } from '../gamification/pattern-memory';
import { getInterventionDisplayName } from '../gamification/intervention-memory';

/**
 * Synthesize lessons from pattern and intervention memory
 *
 * Called from retrospective to update the lessons database
 */
export function synthesizeLessons(
  patternMemory: PatternMemory | undefined,
  interventionMemory: InterventionMemory | undefined
): { lessonsCreated: number; lessonsUpdated: number } {
  if (!patternMemory || patternMemory.records.length === 0) {
    return { lessonsCreated: 0, lessonsUpdated: 0 };
  }

  let db = loadLessons();
  let lessonsCreated = 0;
  let lessonsUpdated = 0;

  // Process each pattern that meets threshold
  for (const [pattern, count] of Object.entries(patternMemory.patternCounts)) {
    if (count < SYNTHESIS_THRESHOLD) continue;

    const existingLesson = db.lessons.find(l => l.pattern === pattern && !l.dismissed);

    if (existingLesson) {
      // Update existing lesson
      const updated = updateLessonFromMemory(
        existingLesson,
        pattern,
        patternMemory,
        interventionMemory
      );
      db = upsertLesson(db, updated);
      lessonsUpdated++;
    } else {
      // Create new lesson
      const newLesson = createLessonFromMemory(
        pattern,
        patternMemory,
        interventionMemory
      );
      db = upsertLesson(db, newLesson);
      lessonsCreated++;
    }
  }

  // Log synthesis
  const logEntry: SynthesisLogEntry = {
    timestamp: new Date().toISOString(),
    lessonsCreated,
    lessonsUpdated,
    patternsProcessed: Object.keys(patternMemory.patternCounts).length,
  };
  db.synthesisLog.push(logEntry);

  // Keep only last 10 log entries
  if (db.synthesisLog.length > 10) {
    db.synthesisLog = db.synthesisLog.slice(-10);
  }

  db.lastSynthesis = new Date().toISOString();
  saveLessons(db);

  return { lessonsCreated, lessonsUpdated };
}

/**
 * Create a new lesson from pattern memory data
 */
function createLessonFromMemory(
  pattern: string,
  patternMemory: PatternMemory,
  interventionMemory: InterventionMemory | undefined
): Lesson {
  const now = new Date().toISOString();
  const displayName = getPatternDisplayName(pattern);
  const advice = getPatternAdvice(pattern);

  // Get components associated with this pattern
  const components = getComponentsForPattern(pattern, patternMemory);

  // Get interventions that worked for this pattern
  const interventions = getInterventionsForPattern(pattern, interventionMemory);

  // Calculate time wasted
  const totalTimeWasted = patternMemory.patternDurations[pattern] || 0;
  const evidenceCount = patternMemory.patternCounts[pattern] || 0;

  // Calculate initial confidence
  const confidence = calculateConfidence(evidenceCount, interventions, false);

  // Determine severity based on time wasted
  const severity = totalTimeWasted > 120 ? 'critical' :
                   totalTimeWasted > 60 ? 'high' :
                   totalTimeWasted > 30 ? 'medium' : 'low';

  return {
    id: generateLessonId(pattern),
    version: 1,
    createdAt: now,
    updatedAt: now,
    pattern,
    components,
    title: `${displayName} causes recurring spirals`,
    description: `You've encountered ${displayName} issues ${evidenceCount} times, ` +
                 `wasting ${totalTimeWasted} minutes total. ${advice}`,
    rootCause: getRootCauseForPattern(pattern),
    prevention: getPreventionForPattern(pattern),
    interventions,
    confidence,
    evidenceCount,
    totalTimeWasted,
    dismissed: false,
    applied: false,
    severity,
    tags: getTagsForPattern(pattern),
  };
}

/**
 * Update an existing lesson with new data
 */
function updateLessonFromMemory(
  lesson: Lesson,
  pattern: string,
  patternMemory: PatternMemory,
  interventionMemory: InterventionMemory | undefined
): Lesson {
  const newComponents = getComponentsForPattern(pattern, patternMemory);
  const newInterventions = getInterventionsForPattern(pattern, interventionMemory);
  const newEvidenceCount = patternMemory.patternCounts[pattern] || 0;
  const newTimeWasted = patternMemory.patternDurations[pattern] || 0;

  // Merge components
  const components = [...new Set([...lesson.components, ...newComponents])];

  // Merge interventions (update effectiveness)
  const interventions = mergeInterventions(lesson.interventions, newInterventions);

  // Recalculate confidence
  const confidence = calculateConfidence(
    newEvidenceCount,
    interventions,
    lesson.applied
  );

  // Update severity if time wasted increased significantly
  const severity = newTimeWasted > 120 ? 'critical' :
                   newTimeWasted > 60 ? 'high' :
                   newTimeWasted > 30 ? 'medium' : 'low';

  return {
    ...lesson,
    components,
    interventions,
    confidence,
    evidenceCount: newEvidenceCount,
    totalTimeWasted: newTimeWasted,
    severity,
    description: `You've encountered ${getPatternDisplayName(pattern)} issues ${newEvidenceCount} times, ` +
                 `wasting ${newTimeWasted} minutes total. ${getPatternAdvice(pattern)}`,
  };
}

/**
 * Get components where a pattern occurs
 */
function getComponentsForPattern(pattern: string, patternMemory: PatternMemory): string[] {
  const components = new Set<string>();

  for (const record of patternMemory.records) {
    if (record.pattern === pattern && record.component) {
      components.add(record.component);
    }
  }

  return Array.from(components).slice(0, 5); // Top 5 components
}

/**
 * Get interventions that worked for a pattern
 */
function getInterventionsForPattern(
  pattern: string,
  interventionMemory: InterventionMemory | undefined
): LessonIntervention[] {
  if (!interventionMemory || interventionMemory.records.length === 0) {
    return [];
  }

  // Count interventions for this pattern
  const counts: Record<string, { success: number; total: number }> = {};

  for (const record of interventionMemory.records) {
    if (record.spiralPattern === pattern) {
      if (!counts[record.type]) {
        counts[record.type] = { success: 0, total: 0 };
      }
      counts[record.type].total++;
      // Assume any recorded intervention was successful (broke the spiral)
      counts[record.type].success++;
    }
  }

  return Object.entries(counts)
    .map(([type, data]) => ({
      type: type as InterventionType,
      successCount: data.success,
      totalCount: data.total,
      effectiveness: Math.round((data.success / data.total) * 100),
    }))
    .sort((a, b) => b.effectiveness - a.effectiveness);
}

/**
 * Merge intervention data from existing and new
 */
function mergeInterventions(
  existing: LessonIntervention[],
  incoming: LessonIntervention[]
): LessonIntervention[] {
  const merged = new Map<InterventionType, LessonIntervention>();

  // Start with existing
  for (const int of existing) {
    merged.set(int.type, { ...int });
  }

  // Add/update with incoming
  for (const int of incoming) {
    const current = merged.get(int.type);
    if (current) {
      current.successCount += int.successCount;
      current.totalCount += int.totalCount;
      current.effectiveness = Math.round(
        (current.successCount / current.totalCount) * 100
      );
    } else {
      merged.set(int.type, { ...int });
    }
  }

  return Array.from(merged.values())
    .sort((a, b) => b.effectiveness - a.effectiveness);
}

/**
 * Calculate confidence score for a lesson
 */
function calculateConfidence(
  evidenceCount: number,
  interventions: LessonIntervention[],
  applied: boolean
): number {
  let confidence = CONFIDENCE_BASE;

  // +5 per evidence (up to +25)
  confidence += Math.min(25, evidenceCount * 5);

  // +15 if an intervention has >70% effectiveness
  if (interventions.some(i => i.effectiveness > 70)) {
    confidence += 15;
  }

  // +10 if user has applied and confirmed
  if (applied) {
    confidence += 10;
  }

  return Math.min(100, Math.max(0, confidence));
}

/**
 * Generate a unique lesson ID
 */
function generateLessonId(pattern: string): string {
  const timestamp = Date.now().toString(36);
  const patternSlug = pattern.toLowerCase().replace(/_/g, '-');
  return `lesson-${patternSlug}-${timestamp}`;
}

/**
 * Get root cause explanation for a pattern
 */
function getRootCauseForPattern(pattern: string): string {
  const causes: Record<string, string> = {
    SECRETS_AUTH: 'Authentication configs often fail silently or have environment-specific behavior',
    VOLUME_CONFIG: 'Volume mounts have complex permission and path requirements that vary by platform',
    API_MISMATCH: 'API contracts change without notice or documentation lags behind implementation',
    SSL_TLS: 'Certificate chains are complex and expiration/rotation is easy to miss',
    IMAGE_REGISTRY: 'Container registries have authentication and tagging edge cases',
    GITOPS_DRIFT: 'Manual changes bypass GitOps and cause state divergence',
    OTHER: 'Complex interactions between components cause unexpected behavior',
  };
  return causes[pattern] || causes.OTHER;
}

/**
 * Get prevention strategies for a pattern
 */
function getPreventionForPattern(pattern: string): string[] {
  const prevention: Record<string, string[]> = {
    SECRETS_AUTH: [
      'Add secret validation to CI pipeline',
      'Use secret scanning tools',
      'Test auth flows in staging before prod',
    ],
    VOLUME_CONFIG: [
      'Add volume mount tests to CI',
      'Validate paths exist before mount',
      'Document platform-specific requirements',
    ],
    API_MISMATCH: [
      'Use schema validation (OpenAPI, JSON Schema)',
      'Version APIs explicitly',
      'Add contract tests between services',
    ],
    SSL_TLS: [
      'Automate certificate renewal',
      'Test certificate chains in staging',
      'Set up expiration monitoring',
    ],
    IMAGE_REGISTRY: [
      'Use digest-based pulls instead of tags',
      'Verify images exist before deploy',
      'Cache images locally for reliability',
    ],
    GITOPS_DRIFT: [
      'Enable drift detection in CI',
      'Block manual kubectl/oc commands',
      'Set reconciliation timeouts',
    ],
    OTHER: [
      'Add integration tests for the component',
      'Document failure modes',
      'Create runbook for common issues',
    ],
  };
  return prevention[pattern] || prevention.OTHER;
}

/**
 * Get tags for a pattern
 */
function getTagsForPattern(pattern: string): string[] {
  const tags: Record<string, string[]> = {
    SECRETS_AUTH: ['security', 'auth', 'secrets'],
    VOLUME_CONFIG: ['infrastructure', 'storage', 'kubernetes'],
    API_MISMATCH: ['api', 'integration', 'contracts'],
    SSL_TLS: ['security', 'certificates', 'networking'],
    IMAGE_REGISTRY: ['containers', 'docker', 'registry'],
    GITOPS_DRIFT: ['gitops', 'kubernetes', 'drift'],
    OTHER: ['general'],
  };
  return tags[pattern] || tags.OTHER;
}
