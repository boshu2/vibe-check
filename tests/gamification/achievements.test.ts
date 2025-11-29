import { describe, it, expect } from 'vitest';
import {
  ACHIEVEMENTS,
  checkAchievements,
  getAchievement,
  getAllAchievements,
} from '../../src/gamification/achievements';
import { SessionRecord, StreakState, XPState } from '../../src/gamification/types';

describe('Achievements', () => {
  const mockSession = (
    overall: SessionRecord['overall'] = 'HIGH',
    vibeScore = 80,
    commits = 20,
    spirals = 0
  ): SessionRecord => ({
    date: '2025-11-29',
    timestamp: '2025-11-29T12:00:00Z',
    vibeScore,
    overall,
    commits,
    spirals,
    xpEarned: 50,
    achievementsUnlocked: [],
  });

  const mockStreak = (current = 0, longest = 0): StreakState => ({
    current,
    longest: longest || current,
    lastActiveDate: '2025-11-29',
    weeklyGoal: 5,
    weeklyProgress: 1,
    freezesRemaining: 3,
  });

  const mockXP = (): XPState => ({
    total: 100,
    level: 2,
    levelName: 'Apprentice',
    currentLevelXP: 0,
    nextLevelXP: 200,
    lastSessionXP: 50,
  });

  describe('ACHIEVEMENTS', () => {
    it('has at least 15 achievements defined', () => {
      expect(ACHIEVEMENTS.length).toBeGreaterThanOrEqual(15);
    });

    it('has achievements in all categories', () => {
      const categories = new Set(ACHIEVEMENTS.map(a => a.category));
      expect(categories.has('streak')).toBe(true);
      expect(categories.has('score')).toBe(true);
      expect(categories.has('sessions')).toBe(true);
      expect(categories.has('special')).toBe(true);
    });

    it('has unique IDs for all achievements', () => {
      const ids = ACHIEVEMENTS.map(a => a.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it('has hidden achievements', () => {
      const hidden = ACHIEVEMENTS.filter(a => a.hidden);
      expect(hidden.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('checkAchievements', () => {
    it('unlocks first_check on first session', () => {
      const unlocked = checkAchievements(
        [],  // No previous sessions
        mockStreak(),
        mockXP(),
        mockSession(),
        []  // No achievements unlocked yet
      );

      expect(unlocked.some(a => a.id === 'first_check')).toBe(true);
    });

    it('does not re-unlock already unlocked achievements', () => {
      const unlocked = checkAchievements(
        [],
        mockStreak(),
        mockXP(),
        mockSession(),
        ['first_check']  // Already unlocked
      );

      expect(unlocked.some(a => a.id === 'first_check')).toBe(false);
    });

    it('unlocks elite_vibes for ELITE rating', () => {
      const unlocked = checkAchievements(
        [],
        mockStreak(),
        mockXP(),
        mockSession('ELITE', 95),
        []
      );

      expect(unlocked.some(a => a.id === 'elite_vibes')).toBe(true);
    });

    it('unlocks week_warrior for 7-day streak', () => {
      const unlocked = checkAchievements(
        [],
        mockStreak(7),
        mockXP(),
        mockSession(),
        []
      );

      expect(unlocked.some(a => a.id === 'week_warrior')).toBe(true);
    });

    it('unlocks fortnight_force for 14-day streak', () => {
      const unlocked = checkAchievements(
        [],
        mockStreak(14),
        mockXP(),
        mockSession(),
        []
      );

      expect(unlocked.some(a => a.id === 'fortnight_force')).toBe(true);
    });

    it('unlocks monthly_master for 30-day streak', () => {
      const unlocked = checkAchievements(
        [],
        mockStreak(30),
        mockXP(),
        mockSession(),
        []
      );

      expect(unlocked.some(a => a.id === 'monthly_master')).toBe(true);
    });

    it('unlocks score_90 for 90%+ score', () => {
      const unlocked = checkAchievements(
        [],
        mockStreak(),
        mockXP(),
        mockSession('ELITE', 92),
        []
      );

      expect(unlocked.some(a => a.id === 'score_90')).toBe(true);
    });

    it('unlocks zen_master for 50+ commits with 0 spirals', () => {
      const unlocked = checkAchievements(
        [],
        mockStreak(),
        mockXP(),
        mockSession('HIGH', 80, 55, 0),  // 55 commits, 0 spirals
        []
      );

      expect(unlocked.some(a => a.id === 'zen_master')).toBe(true);
    });

    it('does not unlock zen_master with spirals', () => {
      const unlocked = checkAchievements(
        [],
        mockStreak(),
        mockXP(),
        mockSession('HIGH', 80, 55, 2),  // 55 commits, 2 spirals
        []
      );

      expect(unlocked.some(a => a.id === 'zen_master')).toBe(false);
    });

    it('unlocks ten_sessions after 10 sessions', () => {
      const previousSessions = Array.from({ length: 9 }, () => mockSession());

      const unlocked = checkAchievements(
        previousSessions,
        mockStreak(),
        mockXP(),
        mockSession(),
        []
      );

      expect(unlocked.some(a => a.id === 'ten_sessions')).toBe(true);
    });

    it('unlocks consistent_high for 5 consecutive HIGH+ sessions', () => {
      const previousSessions = Array.from({ length: 4 }, () => mockSession('HIGH'));

      const unlocked = checkAchievements(
        previousSessions,
        mockStreak(),
        mockXP(),
        mockSession('ELITE'),  // 5th HIGH+ session
        []
      );

      expect(unlocked.some(a => a.id === 'consistent_high')).toBe(true);
    });

    it('unlocks spiral_survivor for recovering from 5+ spirals to ELITE', () => {
      const unlocked = checkAchievements(
        [],
        mockStreak(),
        mockXP(),
        mockSession('ELITE', 85, 30, 5),  // 5 spirals but ELITE
        []
      );

      expect(unlocked.some(a => a.id === 'spiral_survivor')).toBe(true);
    });

    it('unlocks perfect_score for 100% vibe score', () => {
      const unlocked = checkAchievements(
        [],
        mockStreak(),
        mockXP(),
        mockSession('ELITE', 100),
        []
      );

      expect(unlocked.some(a => a.id === 'perfect_score')).toBe(true);
    });
  });

  describe('getAchievement', () => {
    it('returns achievement by ID', () => {
      const achievement = getAchievement('first_check');
      expect(achievement?.name).toBe('First Blood');
    });

    it('returns undefined for unknown ID', () => {
      const achievement = getAchievement('nonexistent');
      expect(achievement).toBeUndefined();
    });
  });

  describe('getAllAchievements', () => {
    it('returns all achievements with unlock status', () => {
      const unlockedAchievements = [
        { id: 'first_check', name: 'First Blood', icon: '🩸', unlockedAt: '2025-11-29T12:00:00Z' },
      ];

      const all = getAllAchievements(unlockedAchievements as any);

      expect(all.length).toBe(ACHIEVEMENTS.length);
      expect(all.find(a => a.id === 'first_check')?.unlockedAt).toBeDefined();
      expect(all.find(a => a.id === 'week_warrior')?.unlockedAt).toBeUndefined();
    });
  });
});
