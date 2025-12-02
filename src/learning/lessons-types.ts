/**
 * Lessons Database Types
 *
 * A lesson is a persistent learning extracted from pattern + intervention data.
 * Unlike nudges (ephemeral), lessons accumulate and get smarter over time.
 */

import { InterventionType } from '../gamification/types';

/**
 * A single lesson learned from recurring patterns
 */
export interface Lesson {
  // Identity
  id: string;                    // "lesson-ssl-001"
  version: number;               // Increments on updates
  createdAt: string;             // ISO datetime
  updatedAt: string;             // ISO datetime

  // Pattern context
  pattern: string;               // "SSL_TLS", "API_MISMATCH", etc.
  components: string[];          // Components where this occurs

  // The learning
  title: string;                 // Short description
  description: string;           // Full explanation
  rootCause?: string;            // Why this happens

  // How to prevent/fix
  prevention: string[];          // Preventive actions
  interventions: LessonIntervention[];

  // Data quality
  confidence: number;            // 0-100
  evidenceCount: number;         // How many spirals support this
  totalTimeWasted: number;       // Minutes lost to this pattern

  // User interaction
  dismissed: boolean;            // User said "not relevant"
  applied: boolean;              // User applied this lesson
  appliedDate?: string;          // When applied
  userEffectiveness?: number;    // User's assessment 0-100

  // Metadata
  severity: 'critical' | 'high' | 'medium' | 'low';
  tags: string[];
}

/**
 * An intervention associated with a lesson
 */
export interface LessonIntervention {
  type: InterventionType;
  successCount: number;          // Times it worked
  totalCount: number;            // Times tried
  effectiveness: number;         // successCount/totalCount * 100
  notes?: string;
}

/**
 * The lessons database
 */
export interface LessonsDatabase {
  version: string;
  lastUpdated: string;
  lastSynthesis: string;         // When we last ran synthesis

  // All lessons
  lessons: Lesson[];

  // Index by pattern for fast lookup
  lessonsByPattern: Record<string, string[]>;  // pattern → lesson IDs

  // Statistics
  stats: {
    totalLessons: number;
    activeLessons: number;       // Not dismissed
    patternsWithLessons: number;
    averageConfidence: number;
    totalTimeWastedMinutes: number;
  };

  // Synthesis history
  synthesisLog: SynthesisLogEntry[];
}

/**
 * Log entry for synthesis runs
 */
export interface SynthesisLogEntry {
  timestamp: string;
  lessonsCreated: number;
  lessonsUpdated: number;
  patternsProcessed: number;
}

/**
 * Result of surfacing lessons for a context
 */
export interface SurfacedLesson {
  lesson: Lesson;
  relevanceScore: number;        // 0-100
  reason: string;                // Why this was surfaced
  suggestedIntervention?: InterventionType;
}

// Constants
export const LESSONS_DB_VERSION = '1.0.0';
export const SYNTHESIS_THRESHOLD = 2;        // Min occurrences to create lesson
export const MAX_LESSONS = 100;              // Cap lessons database
export const CONFIDENCE_BASE = 50;           // Starting confidence
