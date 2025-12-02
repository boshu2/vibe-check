/**
 * Nudge Display System
 *
 * Formats and displays nudges in CLI output.
 */

import chalk from 'chalk';
import { Nudge } from './types';
import { loadLearningState, saveLearningState, markNudgesDisplayed, getPendingNudges } from './storage';

/**
 * Format nudges for CLI display (after gamification section)
 */
export function formatNudgesForCli(maxDisplay: number = 2): string[] {
  const state = loadLearningState();
  const nudges = getPendingNudges(state);

  if (nudges.length === 0) {
    return [];
  }

  const toDisplay = nudges.slice(0, maxDisplay);
  const lines: string[] = [];

  lines.push('');

  for (const nudge of toDisplay) {
    lines.push(formatSingleNudge(nudge));
  }

  if (nudges.length > maxDisplay) {
    lines.push(chalk.gray(`  ... and ${nudges.length - maxDisplay} more. Run \`vibe-check profile\` to see all.`));
  }

  // Mark as displayed
  const updatedState = markNudgesDisplayed(state, toDisplay.length);
  saveLearningState(updatedState);

  return lines;
}

/**
 * Format a single nudge for display
 */
function formatSingleNudge(nudge: Nudge): string {
  const lines: string[] = [];

  // Color based on type
  const colorFn = nudge.type === 'pattern' ? chalk.yellow :
                  nudge.type === 'retro' ? chalk.cyan :
                  nudge.type === 'achievement' ? chalk.green :
                  chalk.white;

  lines.push(colorFn(`  ${nudge.icon} ${nudge.title}`));
  lines.push(chalk.gray(`     ${nudge.message}`));

  if (nudge.action) {
    lines.push(chalk.gray(`     ${nudge.action}`));
  }

  return lines.join('\n');
}

/**
 * Get nudge summary for profile command
 */
export function getNudgeSummary(): {
  pending: number;
  displayed: number;
  dismissed: number;
  nudges: Nudge[];
} {
  const state = loadLearningState();
  const pending = getPendingNudges(state);

  return {
    pending: pending.length,
    displayed: state.nudgesDisplayed,
    dismissed: state.nudgesDismissed,
    nudges: pending,
  };
}
