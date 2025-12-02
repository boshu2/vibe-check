/**
 * Lessons Database Storage
 *
 * Persists lessons to ~/.vibe-check/lessons.json (global, not per-repo).
 * Lessons are meant to accumulate across all repositories.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  LessonsDatabase,
  Lesson,
  LESSONS_DB_VERSION,
  MAX_LESSONS,
} from './lessons-types';

const LESSONS_DIR = '.vibe-check';
const LESSONS_FILE = 'lessons.json';

/**
 * Get lessons database file path (global)
 */
export function getLessonsPath(): string {
  return path.join(os.homedir(), LESSONS_DIR, LESSONS_FILE);
}

/**
 * Create initial empty lessons database
 */
export function createInitialLessonsDatabase(): LessonsDatabase {
  const now = new Date().toISOString();
  return {
    version: LESSONS_DB_VERSION,
    lastUpdated: now,
    lastSynthesis: '',
    lessons: [],
    lessonsByPattern: {},
    stats: {
      totalLessons: 0,
      activeLessons: 0,
      patternsWithLessons: 0,
      averageConfidence: 0,
      totalTimeWastedMinutes: 0,
    },
    synthesisLog: [],
  };
}

/**
 * Load lessons database from disk
 */
export function loadLessons(): LessonsDatabase {
  const filePath = getLessonsPath();

  if (fs.existsSync(filePath)) {
    try {
      const data = fs.readFileSync(filePath, 'utf-8');
      const db = JSON.parse(data) as LessonsDatabase;
      return migrateLessonsDatabase(db);
    } catch {
      return createInitialLessonsDatabase();
    }
  }

  return createInitialLessonsDatabase();
}

/**
 * Save lessons database to disk
 */
export function saveLessons(db: LessonsDatabase): void {
  const dirPath = path.join(os.homedir(), LESSONS_DIR);
  const filePath = getLessonsPath();

  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }

  // Update metadata
  db.lastUpdated = new Date().toISOString();
  db.stats = computeStats(db);

  // Trim if too many lessons
  if (db.lessons.length > MAX_LESSONS) {
    db.lessons = trimLessons(db.lessons);
  }

  // Rebuild index
  db.lessonsByPattern = buildPatternIndex(db.lessons);

  fs.writeFileSync(filePath, JSON.stringify(db, null, 2));
}

/**
 * Add or update a lesson in the database
 */
export function upsertLesson(db: LessonsDatabase, lesson: Lesson): LessonsDatabase {
  const existingIndex = db.lessons.findIndex(l => l.id === lesson.id);

  if (existingIndex >= 0) {
    // Update existing
    db.lessons[existingIndex] = {
      ...lesson,
      version: db.lessons[existingIndex].version + 1,
      updatedAt: new Date().toISOString(),
    };
  } else {
    // Add new
    db.lessons.push(lesson);
  }

  // Rebuild index
  db.lessonsByPattern = buildPatternIndex(db.lessons);

  return db;
}

/**
 * Get lesson by ID
 */
export function getLessonById(db: LessonsDatabase, id: string): Lesson | undefined {
  return db.lessons.find(l => l.id === id);
}

/**
 * Get lessons for a pattern
 */
export function getLessonsForPattern(db: LessonsDatabase, pattern: string): Lesson[] {
  const ids = db.lessonsByPattern[pattern] || [];
  return ids
    .map(id => db.lessons.find(l => l.id === id))
    .filter((l): l is Lesson => l !== undefined && !l.dismissed);
}

/**
 * Get all active (non-dismissed) lessons
 */
export function getActiveLessons(db: LessonsDatabase): Lesson[] {
  return db.lessons.filter(l => !l.dismissed);
}

/**
 * Dismiss a lesson
 */
export function dismissLesson(db: LessonsDatabase, lessonId: string): LessonsDatabase {
  const lesson = db.lessons.find(l => l.id === lessonId);
  if (lesson) {
    lesson.dismissed = true;
    lesson.updatedAt = new Date().toISOString();
  }
  return db;
}

/**
 * Mark a lesson as applied with effectiveness score
 */
export function applyLesson(
  db: LessonsDatabase,
  lessonId: string,
  effectiveness: number
): LessonsDatabase {
  const lesson = db.lessons.find(l => l.id === lessonId);
  if (lesson) {
    lesson.applied = true;
    lesson.appliedDate = new Date().toISOString();
    lesson.userEffectiveness = effectiveness;
    lesson.updatedAt = new Date().toISOString();

    // Adjust confidence based on effectiveness
    if (effectiveness >= 70) {
      lesson.confidence = Math.min(100, lesson.confidence + 5);
    } else if (effectiveness < 40) {
      lesson.confidence = Math.max(0, lesson.confidence - 10);
    }
  }
  return db;
}

/**
 * Build pattern → lesson IDs index
 */
function buildPatternIndex(lessons: Lesson[]): Record<string, string[]> {
  const index: Record<string, string[]> = {};

  for (const lesson of lessons) {
    if (!index[lesson.pattern]) {
      index[lesson.pattern] = [];
    }
    index[lesson.pattern].push(lesson.id);
  }

  return index;
}

/**
 * Compute database statistics
 */
function computeStats(db: LessonsDatabase): LessonsDatabase['stats'] {
  const activeLessons = db.lessons.filter(l => !l.dismissed);
  const patterns = new Set(activeLessons.map(l => l.pattern));
  const totalConfidence = activeLessons.reduce((sum, l) => sum + l.confidence, 0);
  const totalTimeWasted = db.lessons.reduce((sum, l) => sum + l.totalTimeWasted, 0);

  return {
    totalLessons: db.lessons.length,
    activeLessons: activeLessons.length,
    patternsWithLessons: patterns.size,
    averageConfidence: activeLessons.length > 0
      ? Math.round(totalConfidence / activeLessons.length)
      : 0,
    totalTimeWastedMinutes: totalTimeWasted,
  };
}

/**
 * Trim lessons to MAX_LESSONS, keeping most valuable
 */
function trimLessons(lessons: Lesson[]): Lesson[] {
  // Sort by: not dismissed, confidence, evidence count, recency
  return lessons
    .sort((a, b) => {
      // Keep non-dismissed first
      if (a.dismissed !== b.dismissed) return a.dismissed ? 1 : -1;
      // Higher confidence first
      if (a.confidence !== b.confidence) return b.confidence - a.confidence;
      // More evidence first
      if (a.evidenceCount !== b.evidenceCount) return b.evidenceCount - a.evidenceCount;
      // More recent first
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    })
    .slice(0, MAX_LESSONS);
}

/**
 * Migrate old database versions
 */
function migrateLessonsDatabase(db: LessonsDatabase): LessonsDatabase {
  if (!db.version) {
    db.version = LESSONS_DB_VERSION;
  }

  // Ensure all fields exist
  if (!db.synthesisLog) {
    db.synthesisLog = [];
  }
  if (!db.lessonsByPattern) {
    db.lessonsByPattern = buildPatternIndex(db.lessons || []);
  }
  if (!db.stats) {
    db.stats = computeStats(db);
  }

  return db;
}
