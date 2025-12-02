/**
 * Retrospective System
 *
 * Generates weekly retrospective summaries from accumulated data.
 */

import chalk from 'chalk';
import { RetroSummary } from './types';
import { loadLearningState, saveLearningState, recordRetroCompletion } from './storage';
import { loadProfile, getRecentSessions } from '../gamification/profile';
import { formatPatternMemory } from '../gamification/pattern-memory';
import { formatInterventionMemory } from '../gamification/intervention-memory';

/**
 * Generate a weekly retrospective summary
 */
export function generateWeeklyRetro(): RetroSummary {
  const profile = loadProfile();
  const sessions = getRecentSessions(profile, 7);

  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  // Calculate metrics
  const totalCommits = sessions.reduce((sum, s) => sum + s.commits, 0);
  const totalSpirals = sessions.reduce((sum, s) => sum + s.spirals, 0);
  const avgScore = sessions.length > 0
    ? Math.round(sessions.reduce((sum, s) => sum + s.vibeScore, 0) / sessions.length)
    : 0;

  // Get pattern analysis
  const patternData = formatPatternMemory(profile.patternMemory);
  const topPattern = patternData.topPatterns[0]?.pattern;

  // Get intervention analysis
  const interventionData = formatInterventionMemory(profile.interventionMemory);
  const topIntervention = interventionData.topInterventions[0]?.name;

  // Calculate changes from previous week
  const previousSessions = profile.sessions.slice(-14, -7);
  let trustPassRateChange: number | undefined;
  let spiralRateChange: number | undefined;

  if (previousSessions.length > 0 && sessions.length > 0) {
    const currentTrust = sessions.reduce((sum, s) =>
      sum + (s.metrics?.trustPassRate || 0), 0) / sessions.length;
    const prevTrust = previousSessions.reduce((sum, s) =>
      sum + (s.metrics?.trustPassRate || 0), 0) / previousSessions.length;
    trustPassRateChange = Math.round(currentTrust - prevTrust);

    const currentSpiralRate = totalSpirals / sessions.length;
    const prevSpiralRate = previousSessions.reduce((sum, s) => sum + s.spirals, 0) / previousSessions.length;
    spiralRateChange = Math.round((prevSpiralRate - currentSpiralRate) / (prevSpiralRate || 1) * 100);
  }

  // Generate key insight
  let keyInsight = '';
  if (totalSpirals === 0) {
    keyInsight = 'Zero spirals this week - excellent flow state!';
  } else if (topPattern && patternData.topPatterns[0]) {
    const topPatternData = patternData.topPatterns[0];
    keyInsight = `${topPatternData.displayName} is your main spiral trigger (${topPatternData.count} occurrences)`;
  } else {
    keyInsight = `${sessions.length} sessions completed with ${avgScore}% average score`;
  }

  return {
    date: now.toISOString().split('T')[0],
    periodStart: weekAgo.toISOString().split('T')[0],
    periodEnd: now.toISOString().split('T')[0],
    sessionsCount: sessions.length,
    commitsCount: totalCommits,
    activeMinutes: sessions.length * 30, // Estimate
    topPattern,
    topIntervention,
    keyInsight,
    trustPassRateChange,
    spiralRateChange,
  };
}

/**
 * Display retrospective in terminal
 */
export function displayRetro(summary: RetroSummary): void {
  const profile = loadProfile();
  const patternData = formatPatternMemory(profile.patternMemory);
  const interventionData = formatInterventionMemory(profile.interventionMemory);

  console.log('');
  console.log(chalk.bold.cyan('='.repeat(64)));
  console.log(chalk.bold.cyan('  WEEKLY RETROSPECTIVE'));
  console.log(chalk.bold.cyan(`  ${summary.periodStart} - ${summary.periodEnd}`));
  console.log(chalk.bold.cyan('='.repeat(64)));
  console.log('');

  // Sessions summary
  console.log(chalk.bold.white('  SESSIONS'));
  console.log(`    ${summary.sessionsCount} sessions | ${summary.commitsCount} commits`);
  console.log('');

  // Top patterns
  if (patternData.hasData && patternData.topPatterns.length > 0) {
    console.log(chalk.bold.white('  TOP SPIRAL TRIGGERS'));
    for (const pattern of patternData.topPatterns.slice(0, 3)) {
      console.log(`    ${pattern.displayName}: ${pattern.count} spirals (${pattern.totalMinutes} min)`);
      console.log(chalk.gray(`      ${pattern.advice}`));
    }
    console.log('');
  }

  // What worked
  if (interventionData.hasData && interventionData.topInterventions.length > 0) {
    console.log(chalk.bold.white('  WHAT WORKED'));
    for (const intervention of interventionData.topInterventions.slice(0, 3)) {
      console.log(`    ${intervention.icon} ${intervention.name}: ${intervention.count} times`);
    }
    console.log('');
  }

  // Progress
  console.log(chalk.bold.white('  PROGRESS'));
  if (summary.trustPassRateChange !== undefined) {
    const trustColor = summary.trustPassRateChange >= 0 ? chalk.green : chalk.yellow;
    const trustSign = summary.trustPassRateChange >= 0 ? '+' : '';
    console.log(`    Trust Pass Rate: ${trustColor(`${trustSign}${summary.trustPassRateChange}%`)}`);
  }
  if (summary.spiralRateChange !== undefined) {
    const spiralColor = summary.spiralRateChange >= 0 ? chalk.green : chalk.yellow;
    const spiralSign = summary.spiralRateChange >= 0 ? '+' : '';
    console.log(`    Spiral Reduction: ${spiralColor(`${spiralSign}${summary.spiralRateChange}%`)}`);
  }
  console.log('');

  // Key insight
  console.log(chalk.bold.cyan(`  KEY INSIGHT: ${summary.keyInsight}`));
  console.log('');

  console.log(chalk.bold.cyan('='.repeat(64)));
  console.log('');
}

/**
 * Run and save retrospective
 */
export function runAndSaveRetro(): RetroSummary {
  const summary = generateWeeklyRetro();
  displayRetro(summary);

  const state = loadLearningState();
  const updatedState = recordRetroCompletion(state, summary);
  saveLearningState(updatedState);

  return summary;
}

/**
 * Check if retrospective is due
 */
export function isRetroDue(): { due: boolean; reason: string; daysSince: number } {
  const state = loadLearningState();

  if (!state.lastWeeklyRetro) {
    return { due: true, reason: 'No retrospective recorded yet', daysSince: 999 };
  }

  const lastRetro = new Date(state.lastWeeklyRetro);
  const now = new Date();
  const daysSince = Math.floor((now.getTime() - lastRetro.getTime()) / (1000 * 60 * 60 * 24));

  if (daysSince >= 7) {
    return { due: true, reason: `${daysSince} days since last retrospective`, daysSince };
  }

  return { due: false, reason: '', daysSince };
}
