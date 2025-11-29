import { Command } from 'commander';
import chalk from 'chalk';
import {
  loadProfile,
  getAchievementCounts,
  getRecentSessions,
} from '../gamification/profile';
import { formatStreak, formatWeeklyProgress } from '../gamification/streaks';
import { formatLevel, formatXPProgress, getLevelProgress } from '../gamification/xp';
import { LEVELS } from '../gamification/types';
import { getAllAchievements } from '../gamification/achievements';
import { formatPatternMemory } from '../gamification/pattern-memory';
import { formatInterventionMemory } from '../gamification/intervention-memory';

export function createProfileCommand(): Command {
  const cmd = new Command('profile')
    .description('View your vibe-check profile, stats, and achievements')
    .option('--achievements', 'Show all achievements', false)
    .option('--stats', 'Show detailed stats', false)
    .option('--patterns', 'Show spiral pattern memory (your triggers)', false)
    .option('--interventions', 'Show intervention memory (what breaks spirals)', false)
    .option('--json', 'Output as JSON', false)
    .action(async (options) => {
      await runProfile(options);
    });

  return cmd;
}

async function runProfile(options: {
  achievements: boolean;
  stats: boolean;
  patterns: boolean;
  interventions: boolean;
  json: boolean;
}): Promise<void> {
  const profile = loadProfile();

  if (options.json) {
    console.log(JSON.stringify(profile, null, 2));
    return;
  }

  const { xp, streak, achievements, stats } = profile;
  const levelInfo = LEVELS.find(l => l.level === xp.level)!;
  const achievementCounts = getAchievementCounts(profile);
  const recentSessions = getRecentSessions(profile, 30);

  // Header
  console.log();
  console.log(chalk.cyan('╭─────────────────────────────────────────────╮'));
  console.log(chalk.cyan('│') + chalk.bold.white('           Your Vibe Profile                 ') + chalk.cyan('│'));
  console.log(chalk.cyan('├─────────────────────────────────────────────┤'));

  // Level
  const levelBar = createProgressBar(getLevelProgress(xp), 20);
  console.log(chalk.cyan('│') + `  ${levelInfo.icon} ${chalk.bold(`Level ${xp.level} ${xp.levelName}`)}`.padEnd(52) + chalk.cyan('│'));
  console.log(chalk.cyan('│') + `  ${levelBar}  ${chalk.gray(`${xp.currentLevelXP}/${xp.nextLevelXP} XP`)}`.padEnd(60) + chalk.cyan('│'));
  console.log(chalk.cyan('│') + ''.padEnd(44) + chalk.cyan('│'));

  // Streak
  const streakDisplay = streak.current > 0
    ? `🔥 Current Streak: ${chalk.bold(streak.current.toString())} days${streak.current === streak.longest ? chalk.yellow(' (Best!)') : ''}`
    : '🔥 No active streak';
  console.log(chalk.cyan('│') + `  ${streakDisplay}`.padEnd(52) + chalk.cyan('│'));

  const weeklyBar = createProgressBar((streak.weeklyProgress / streak.weeklyGoal) * 100, 5);
  console.log(chalk.cyan('│') + `  📅 Weekly Goal: ${streak.weeklyProgress}/${streak.weeklyGoal} ${weeklyBar}`.padEnd(52) + chalk.cyan('│'));
  console.log(chalk.cyan('│') + `  🏆 Achievements: ${achievementCounts.unlocked}/${achievementCounts.total} unlocked`.padEnd(52) + chalk.cyan('│'));
  console.log(chalk.cyan('│') + ''.padEnd(44) + chalk.cyan('│'));

  // 30-Day Stats
  console.log(chalk.cyan('│') + chalk.bold('  📊 30-Day Stats').padEnd(52) + chalk.cyan('│'));

  const avgScore = recentSessions.length > 0
    ? Math.round(recentSessions.reduce((sum, s) => sum + s.vibeScore, 0) / recentSessions.length)
    : 0;
  const totalCommits = recentSessions.reduce((sum, s) => sum + s.commits, 0);

  console.log(chalk.cyan('│') + `  ├─ Avg Vibe Score: ${chalk.bold(avgScore.toString())}%`.padEnd(52) + chalk.cyan('│'));
  console.log(chalk.cyan('│') + `  ├─ Sessions: ${chalk.bold(recentSessions.length.toString())}`.padEnd(52) + chalk.cyan('│'));
  console.log(chalk.cyan('│') + `  ├─ Commits Analyzed: ${chalk.bold(totalCommits.toString())}`.padEnd(52) + chalk.cyan('│'));

  const spiralsAvoided = recentSessions.filter(s => s.spirals === 0 && s.commits >= 10).length;
  console.log(chalk.cyan('│') + `  └─ Zero-Spiral Sessions: ${chalk.bold(spiralsAvoided.toString())}`.padEnd(52) + chalk.cyan('│'));
  console.log(chalk.cyan('│') + ''.padEnd(44) + chalk.cyan('│'));

  // Pattern Memory Summary
  const patternInfo = formatPatternMemory(profile.patternMemory || { version: '1.0.0', records: [], patternCounts: {}, componentCounts: {}, patternDurations: {}, topPatterns: [], topComponents: [], avgRecoveryTime: 0, totalSpirals: 0 });
  if (patternInfo.hasData) {
    console.log(chalk.cyan('│') + chalk.bold('  🧠 Spiral Triggers').padEnd(52) + chalk.cyan('│'));
    if (patternInfo.topPatterns.length > 0) {
      const topTrigger = patternInfo.topPatterns[0];
      console.log(chalk.cyan('│') + `  └─ Top: ${chalk.yellow(topTrigger.displayName)} (${topTrigger.count}×)`.padEnd(52) + chalk.cyan('│'));
    }
    console.log(chalk.cyan('│') + `     Avg recovery: ${chalk.gray(patternInfo.avgRecoveryTime + ' min')}`.padEnd(52) + chalk.cyan('│'));
    console.log(chalk.cyan('│') + ''.padEnd(44) + chalk.cyan('│'));
  }

  // Intervention Memory Summary
  const interventionInfo = formatInterventionMemory(profile.interventionMemory);
  if (interventionInfo.hasData) {
    console.log(chalk.cyan('│') + chalk.bold('  🛠️  What Breaks Spirals').padEnd(52) + chalk.cyan('│'));
    if (interventionInfo.topInterventions.length > 0) {
      const top = interventionInfo.topInterventions[0];
      console.log(chalk.cyan('│') + `  └─ Go-to: ${chalk.green(top.icon + ' ' + top.name)} (${top.count}×)`.padEnd(52) + chalk.cyan('│'));
    }
    console.log(chalk.cyan('│') + ''.padEnd(44) + chalk.cyan('│'));
  }

  // Recent achievements
  const recentAchievements = achievements.slice(-3).reverse();
  if (recentAchievements.length > 0) {
    console.log(chalk.cyan('│') + chalk.bold('  Recent Achievements:').padEnd(52) + chalk.cyan('│'));
    for (const ach of recentAchievements) {
      const dateStr = ach.unlockedAt
        ? new Date(ach.unlockedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        : '';
      console.log(chalk.cyan('│') + `  ${ach.icon} ${ach.name} ${chalk.gray(`(${dateStr})`)}`.padEnd(52) + chalk.cyan('│'));
    }
  }

  console.log(chalk.cyan('╰─────────────────────────────────────────────╯'));
  console.log();

  // Show all achievements if requested
  if (options.achievements) {
    showAllAchievements(achievements);
  }

  // Show detailed stats if requested
  if (options.stats) {
    showDetailedStats(profile);
  }

  // Show pattern memory if requested
  if (options.patterns) {
    showPatternMemory(profile.patternMemory);
  }

  // Show intervention memory if requested
  if (options.interventions) {
    showInterventionMemory(profile.interventionMemory);
  }
}

function createProgressBar(percent: number, length: number): string {
  const filled = Math.round((percent / 100) * length);
  const empty = length - filled;
  return chalk.green('█'.repeat(filled)) + chalk.gray('░'.repeat(empty));
}

function showAllAchievements(unlockedAchievements: { id: string; name: string; icon: string; unlockedAt?: string }[]): void {
  const allAchievements = getAllAchievements(unlockedAchievements as any);
  const unlockedIds = new Set(unlockedAchievements.map(a => a.id));

  console.log(chalk.bold('\n🏆 All Achievements\n'));

  const categories = ['streak', 'score', 'sessions', 'special'];
  const categoryNames: Record<string, string> = {
    streak: '🔥 Streak',
    score: '📈 Score',
    sessions: '📊 Sessions',
    special: '⭐ Special',
  };

  for (const category of categories) {
    const categoryAchievements = allAchievements.filter(a => a.category === category);
    if (categoryAchievements.length === 0) continue;

    console.log(chalk.bold(categoryNames[category]));

    for (const ach of categoryAchievements) {
      const isUnlocked = unlockedIds.has(ach.id);
      const icon = isUnlocked ? ach.icon : (ach.hidden ? '❓' : '🔒');
      const name = isUnlocked || !ach.hidden ? ach.name : '???';
      const desc = isUnlocked || !ach.hidden ? ach.description : 'Keep playing to unlock!';

      const status = isUnlocked
        ? chalk.green('✓')
        : chalk.gray('○');

      console.log(`  ${status} ${icon} ${isUnlocked ? chalk.white(name) : chalk.gray(name)}`);
      console.log(`      ${chalk.gray(desc)}`);
    }
    console.log();
  }
}

function showDetailedStats(profile: any): void {
  const { stats, xp, streak } = profile;

  console.log(chalk.bold('\n📊 Detailed Statistics\n'));

  console.log(chalk.bold('Lifetime'));
  console.log(`  Total Sessions: ${chalk.bold(stats.totalSessions)}`);
  console.log(`  Commits Analyzed: ${chalk.bold(stats.totalCommitsAnalyzed.toLocaleString())}`);
  console.log(`  Average Score: ${chalk.bold(stats.avgVibeScore)}%`);
  console.log(`  Best Score: ${chalk.bold(stats.bestVibeScore)}%`);
  console.log(`  Total Spirals: ${chalk.bold(stats.totalSpiralsDetected)}`);
  console.log(`  Zero-Spiral Sessions: ${chalk.bold(stats.spiralsAvoided)}`);

  console.log();
  console.log(chalk.bold('Progress'));
  console.log(`  Total XP: ${chalk.bold(xp.total)}`);
  console.log(`  Current Level: ${chalk.bold(`${xp.level} (${xp.levelName})`)}`);
  console.log(`  Longest Streak: ${chalk.bold(streak.longest)} days`);

  console.log();
}

function showPatternMemory(memory: any): void {
  const patternInfo = formatPatternMemory(memory);

  console.log(chalk.bold('\n🧠 Pattern Memory - Your Spiral Triggers\n'));

  if (!patternInfo.hasData) {
    console.log(chalk.gray('  No spiral patterns recorded yet.'));
    console.log(chalk.gray('  When spirals are detected, patterns will be tracked here.'));
    console.log();
    return;
  }

  // Summary
  console.log(chalk.bold('Summary'));
  console.log(`  ${patternInfo.summary}`);
  console.log(`  Total spirals recorded: ${chalk.bold(patternInfo.totalSpirals.toString())}`);
  console.log(`  Average recovery time: ${chalk.bold(patternInfo.avgRecoveryTime.toString())} minutes`);
  console.log();

  // Top patterns
  if (patternInfo.topPatterns.length > 0) {
    console.log(chalk.bold('Top Spiral Patterns'));
    for (const pattern of patternInfo.topPatterns) {
      const bar = createPatternBar(pattern.count, patternInfo.totalSpirals);
      console.log(`  ${bar} ${chalk.yellow(pattern.displayName)} (${pattern.count}×, ${pattern.totalMinutes}m total)`);
      console.log(chalk.gray(`      💡 ${pattern.advice}`));
    }
    console.log();
  }

  // Top components
  if (patternInfo.topComponents.length > 0) {
    console.log(chalk.bold('Top Triggering Components'));
    for (const comp of patternInfo.topComponents) {
      const bar = createPatternBar(comp.count, patternInfo.totalSpirals);
      console.log(`  ${bar} ${comp.component} (${comp.count}×)`);
    }
    console.log();
  }

  console.log(chalk.gray('Use this data to identify recurring issues and add tracer tests.'));
  console.log();
}

function createPatternBar(count: number, total: number): string {
  const pct = total > 0 ? (count / total) * 100 : 0;
  const filled = Math.round(pct / 10);
  const empty = 10 - filled;
  return chalk.yellow('█'.repeat(filled)) + chalk.gray('░'.repeat(empty));
}

function createInterventionBar(count: number, total: number): string {
  const pct = total > 0 ? (count / total) * 100 : 0;
  const filled = Math.round(pct / 10);
  const empty = 10 - filled;
  return chalk.green('█'.repeat(filled)) + chalk.gray('░'.repeat(empty));
}

function showInterventionMemory(memory: any): void {
  const interventionInfo = formatInterventionMemory(memory);

  console.log(chalk.bold('\n🛠️  Intervention Memory - What Breaks Your Spirals\n'));

  if (!interventionInfo.hasData) {
    console.log(chalk.gray('  No interventions recorded yet.'));
    console.log(chalk.gray('  When you break out of a spiral, record what helped:'));
    console.log(chalk.gray('  vibe-check intervene TRACER_TEST --pattern SECRETS_AUTH'));
    console.log();
    return;
  }

  // Summary
  console.log(chalk.bold('Summary'));
  console.log(`  ${interventionInfo.summary}`);
  console.log(`  Average spiral duration: ${chalk.bold(interventionInfo.avgTimeToIntervene.toString())} minutes`);
  console.log();

  // Top interventions
  if (interventionInfo.topInterventions.length > 0) {
    console.log(chalk.bold('Your Go-To Interventions'));
    for (const int of interventionInfo.topInterventions) {
      const bar = createInterventionBar(int.count, interventionInfo.totalInterventions);
      console.log(`  ${int.icon} ${int.name.padEnd(15)} ${bar} ${int.count}×`);
    }
    console.log();
  }

  // Pattern-specific recommendations
  if (interventionInfo.patternRecommendations.length > 0) {
    console.log(chalk.bold('What Works by Pattern'));
    for (const rec of interventionInfo.patternRecommendations) {
      console.log(`  ${chalk.yellow(rec.pattern)}: ${rec.interventions.join(', ')}`);
    }
    console.log();
  }

  console.log(chalk.gray('Keep recording what breaks your spirals to build your playbook!'));
  console.log();
}

export async function runProfile2(options: any): Promise<void> {
  return runProfile(options);
}
