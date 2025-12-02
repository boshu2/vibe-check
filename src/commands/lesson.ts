/**
 * Lesson Command
 *
 * View, manage, and interact with learned lessons.
 */

import { Command } from 'commander';
import chalk from 'chalk';
import {
  loadLessons,
  saveLessons,
  getLessonById,
  getActiveLessons,
  dismissLesson,
  applyLesson,
} from '../learning/lessons-storage';
import {
  formatLessonDetail,
  formatLessonsSummary,
  getTopLessons,
} from '../learning/surfacing';
import { getPatternDisplayName } from '../gamification/pattern-memory';

export function createLessonCommand(): Command {
  const cmd = new Command('lesson')
    .description('View and manage learned lessons from your spiral patterns')
    .argument('[lesson-id]', 'View a specific lesson by ID')
    .option('--list', 'List all lessons')
    .option('--pattern <pattern>', 'Filter lessons by pattern (e.g., SSL_TLS)')
    .option('--apply <effectiveness>', 'Mark lesson as applied with effectiveness score (0-100)')
    .option('--dismiss', 'Dismiss a lesson as not relevant')
    .option('--stats', 'Show lessons statistics')
    .action(async (lessonId, options) => {
      await runLesson(lessonId, options);
    });

  return cmd;
}

interface LessonOptions {
  list?: boolean;
  pattern?: string;
  apply?: string;
  dismiss?: boolean;
  stats?: boolean;
}

async function runLesson(lessonId: string | undefined, options: LessonOptions): Promise<void> {
  const db = loadLessons();

  // Handle --stats
  if (options.stats) {
    showStats();
    return;
  }

  // Handle --list
  if (options.list) {
    listLessons(options.pattern);
    return;
  }

  // Handle specific lesson by ID
  if (lessonId) {
    const lesson = getLessonById(db, lessonId);

    if (!lesson) {
      console.log(chalk.red(`\n  Lesson not found: ${lessonId}\n`));
      console.log(chalk.gray('  Run `vibe-check lesson --list` to see available lessons'));
      return;
    }

    // Handle --dismiss
    if (options.dismiss) {
      const updated = dismissLesson(db, lessonId);
      saveLessons(updated);
      console.log(chalk.green(`\n  Lesson dismissed: ${lesson.title}\n`));
      return;
    }

    // Handle --apply
    if (options.apply) {
      const effectiveness = parseInt(options.apply, 10);
      if (isNaN(effectiveness) || effectiveness < 0 || effectiveness > 100) {
        console.log(chalk.red('\n  Effectiveness must be 0-100\n'));
        return;
      }
      const updated = applyLesson(db, lessonId, effectiveness);
      saveLessons(updated);
      console.log(chalk.green(`\n  Lesson marked as applied with ${effectiveness}% effectiveness\n`));
      return;
    }

    // Show lesson detail
    const lines = formatLessonDetail(lesson);
    for (const line of lines) {
      console.log(line);
    }
    return;
  }

  // Default: show summary and top lessons
  showSummary();
}

function showStats(): void {
  const db = loadLessons();

  console.log('');
  console.log(chalk.bold.cyan('='.repeat(64)));
  console.log(chalk.bold.cyan('  LESSONS STATISTICS'));
  console.log(chalk.bold.cyan('='.repeat(64)));
  console.log('');

  console.log(chalk.bold.white('  OVERVIEW'));
  console.log(`    Total lessons: ${db.stats.totalLessons}`);
  console.log(`    Active lessons: ${db.stats.activeLessons}`);
  console.log(`    Patterns covered: ${db.stats.patternsWithLessons}`);
  console.log(`    Average confidence: ${db.stats.averageConfidence}%`);
  console.log(`    Total time wasted: ${db.stats.totalTimeWastedMinutes} min`);
  console.log('');

  // Lessons by severity
  const bySeverity = {
    critical: db.lessons.filter(l => l.severity === 'critical' && !l.dismissed).length,
    high: db.lessons.filter(l => l.severity === 'high' && !l.dismissed).length,
    medium: db.lessons.filter(l => l.severity === 'medium' && !l.dismissed).length,
    low: db.lessons.filter(l => l.severity === 'low' && !l.dismissed).length,
  };

  console.log(chalk.bold.white('  BY SEVERITY'));
  console.log(`    🚨 Critical: ${bySeverity.critical}`);
  console.log(`    ⚠️  High: ${bySeverity.high}`);
  console.log(`    💡 Medium: ${bySeverity.medium}`);
  console.log(`    📝 Low: ${bySeverity.low}`);
  console.log('');

  // Applied vs not
  const applied = db.lessons.filter(l => l.applied).length;
  const dismissed = db.lessons.filter(l => l.dismissed).length;
  const pending = db.lessons.filter(l => !l.applied && !l.dismissed).length;

  console.log(chalk.bold.white('  STATUS'));
  console.log(`    ✓ Applied: ${applied}`);
  console.log(`    ○ Pending: ${pending}`);
  console.log(`    ✗ Dismissed: ${dismissed}`);
  console.log('');

  // Last synthesis
  if (db.lastSynthesis) {
    const date = new Date(db.lastSynthesis).toLocaleDateString();
    console.log(chalk.bold.white('  LAST SYNTHESIS'));
    console.log(`    ${date}`);
    if (db.synthesisLog.length > 0) {
      const last = db.synthesisLog[db.synthesisLog.length - 1];
      console.log(`    Created: ${last.lessonsCreated}, Updated: ${last.lessonsUpdated}`);
    }
  }
  console.log('');

  console.log(chalk.bold.cyan('='.repeat(64)));
  console.log('');
}

function listLessons(patternFilter?: string): void {
  const db = loadLessons();
  let lessons = getActiveLessons(db);

  // Apply pattern filter
  if (patternFilter) {
    lessons = lessons.filter(l =>
      l.pattern.toLowerCase().includes(patternFilter.toLowerCase())
    );
  }

  if (lessons.length === 0) {
    console.log(chalk.yellow('\n  No lessons found.\n'));
    if (!patternFilter) {
      console.log(chalk.gray('  Run `vibe-check learn --retro` to generate lessons from your patterns.'));
    }
    return;
  }

  console.log('');
  console.log(chalk.bold.cyan('='.repeat(64)));
  console.log(chalk.bold.cyan(`  LESSONS${patternFilter ? ` (${patternFilter})` : ''}`));
  console.log(chalk.bold.cyan('='.repeat(64)));
  console.log('');

  // Group by pattern
  const byPattern: Record<string, typeof lessons> = {};
  for (const lesson of lessons) {
    if (!byPattern[lesson.pattern]) {
      byPattern[lesson.pattern] = [];
    }
    byPattern[lesson.pattern].push(lesson);
  }

  for (const [pattern, patternLessons] of Object.entries(byPattern)) {
    const displayName = getPatternDisplayName(pattern);
    console.log(chalk.bold.white(`  ${displayName} (${pattern})`));

    for (const lesson of patternLessons) {
      const severityIcon = lesson.severity === 'critical' ? '🚨' :
                           lesson.severity === 'high' ? '⚠️' :
                           lesson.severity === 'medium' ? '💡' : '📝';
      const statusIcon = lesson.applied ? chalk.green('✓') :
                         lesson.dismissed ? chalk.gray('✗') : '○';

      console.log(`    ${severityIcon} ${statusIcon} ${lesson.title}`);
      console.log(chalk.gray(`       ${lesson.evidenceCount}x, ${lesson.totalTimeWasted} min, ${lesson.confidence}% confidence`));
      console.log(chalk.gray(`       ID: ${lesson.id}`));
    }
    console.log('');
  }

  console.log(chalk.gray('  View details: vibe-check lesson <lesson-id>'));
  console.log(chalk.gray('  Apply lesson: vibe-check lesson <lesson-id> --apply 80'));
  console.log('');
}

function showSummary(): void {
  const db = loadLessons();

  console.log('');
  console.log(chalk.bold.cyan('='.repeat(64)));
  console.log(chalk.bold.cyan('  LESSONS LEARNED'));
  console.log(chalk.bold.cyan('='.repeat(64)));
  console.log('');

  if (db.lessons.length === 0) {
    console.log(chalk.gray('  No lessons learned yet.'));
    console.log('');
    console.log(chalk.gray('  Lessons are automatically generated from your spiral patterns.'));
    console.log(chalk.gray('  Run `vibe-check learn --retro` to generate lessons.'));
    console.log('');
    console.log(chalk.bold.cyan('='.repeat(64)));
    console.log('');
    return;
  }

  const lines = formatLessonsSummary();
  for (const line of lines) {
    console.log(line);
  }
  console.log('');

  console.log(chalk.gray('  Commands:'));
  console.log(chalk.gray('    vibe-check lesson --list          # List all lessons'));
  console.log(chalk.gray('    vibe-check lesson --stats         # Show statistics'));
  console.log(chalk.gray('    vibe-check lesson <id>            # View lesson detail'));
  console.log('');

  console.log(chalk.bold.cyan('='.repeat(64)));
  console.log('');
}
