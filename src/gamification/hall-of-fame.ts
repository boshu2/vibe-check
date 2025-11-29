import { Leaderboards } from './leaderboards';

export interface HallOfFameRecord {
  category: string;
  icon: string;
  value: string;
  date: string;
  context: string;
}

/**
 * Get Hall of Fame records from leaderboards
 */
export function getHallOfFame(leaderboards: Leaderboards): HallOfFameRecord[] {
  const records: HallOfFameRecord[] = [];
  const pb = leaderboards.personalBests;

  if (pb.highestScore) {
    records.push({
      category: 'Best Vibe Score',
      icon: '🏆',
      value: `${pb.highestScore.vibeScore}%`,
      date: pb.highestScore.date,
      context: `${pb.highestScore.repoName} - ${pb.highestScore.overall}`,
    });
  }

  if (pb.longestStreak > 0) {
    records.push({
      category: 'Longest Streak',
      icon: '🔥',
      value: `${pb.longestStreak} days`,
      date: 'All time',
      context: 'Consecutive daily check-ins',
    });
  }

  if (pb.bestWeekXP) {
    records.push({
      category: 'Best Week XP',
      icon: '⚡',
      value: `${pb.bestWeekXP.xp} XP`,
      date: pb.bestWeekXP.week,
      context: 'Most XP earned in a single week',
    });
  }

  if (pb.mostCommits) {
    records.push({
      category: 'Most Commits',
      icon: '📊',
      value: `${pb.mostCommits.commits}`,
      date: pb.mostCommits.date,
      context: `${pb.mostCommits.repoName} - single session`,
    });
  }

  return records;
}

/**
 * Format Hall of Fame for display
 */
export function formatHallOfFame(records: HallOfFameRecord[]): string {
  if (records.length === 0) {
    return 'No records yet. Keep coding!';
  }

  const lines: string[] = ['🏛️  HALL OF FAME', ''];

  for (const record of records) {
    lines.push(`${record.icon} ${record.category}: ${record.value}`);
    lines.push(`   ${record.date} - ${record.context}`);
    lines.push('');
  }

  return lines.join('\n');
}
