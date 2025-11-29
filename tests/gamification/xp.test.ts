import { describe, it, expect } from 'vitest';
import {
  createInitialXP,
  calculateSessionXP,
  addXP,
  getLevelForXP,
  getLevelProgress,
} from '../../src/gamification/xp';
import { SessionRecord, StreakState, XP_REWARDS } from '../../src/gamification/types';

describe('XP System', () => {
  describe('createInitialXP', () => {
    it('creates initial XP state at level 1', () => {
      const xp = createInitialXP();
      expect(xp.total).toBe(0);
      expect(xp.level).toBe(1);
      expect(xp.levelName).toBe('Novice');
      expect(xp.currentLevelXP).toBe(0);
      expect(xp.nextLevelXP).toBe(100);
    });
  });

  describe('calculateSessionXP', () => {
    const mockSession = (overall: SessionRecord['overall'], spirals = 0, commits = 20): SessionRecord => ({
      date: '2025-11-29',
      timestamp: '2025-11-29T12:00:00Z',
      vibeScore: 80,
      overall,
      commits,
      spirals,
      xpEarned: 0,
      achievementsUnlocked: [],
    });

    const mockStreak = (current = 0): StreakState => ({
      current,
      longest: current,
      lastActiveDate: '2025-11-29',
      weeklyGoal: 5,
      weeklyProgress: 1,
      freezesRemaining: 3,
    });

    it('awards base XP for ELITE session', () => {
      const xp = calculateSessionXP(mockSession('ELITE'), mockStreak(), 0);
      expect(xp).toBeGreaterThanOrEqual(XP_REWARDS.eliteSession + XP_REWARDS.dailyCheckIn);
    });

    it('awards base XP for HIGH session', () => {
      const xp = calculateSessionXP(mockSession('HIGH'), mockStreak(), 0);
      expect(xp).toBeGreaterThanOrEqual(XP_REWARDS.highSession + XP_REWARDS.dailyCheckIn);
    });

    it('awards base XP for MEDIUM session', () => {
      const xp = calculateSessionXP(mockSession('MEDIUM'), mockStreak(), 0);
      expect(xp).toBeGreaterThanOrEqual(XP_REWARDS.mediumSession + XP_REWARDS.dailyCheckIn);
    });

    it('awards base XP for LOW session', () => {
      const xp = calculateSessionXP(mockSession('LOW'), mockStreak(), 0);
      expect(xp).toBeGreaterThanOrEqual(XP_REWARDS.lowSession + XP_REWARDS.dailyCheckIn);
    });

    it('adds streak bonus', () => {
      const noStreak = calculateSessionXP(mockSession('HIGH'), mockStreak(0), 0);
      const withStreak = calculateSessionXP(mockSession('HIGH'), mockStreak(7), 0);
      expect(withStreak - noStreak).toBe(XP_REWARDS.streakBonus * 7);
    });

    it('caps streak bonus at 30 days', () => {
      const streak30 = calculateSessionXP(mockSession('HIGH'), mockStreak(30), 0);
      const streak50 = calculateSessionXP(mockSession('HIGH'), mockStreak(50), 0);
      expect(streak30).toBe(streak50); // Both capped at 30 days
    });

    it('adds no-spirals bonus when applicable', () => {
      const withSpirals = calculateSessionXP(mockSession('HIGH', 2, 20), mockStreak(), 0);
      const noSpirals = calculateSessionXP(mockSession('HIGH', 0, 20), mockStreak(), 0);
      expect(noSpirals - withSpirals).toBe(XP_REWARDS.noSpirals);
    });

    it('does not add no-spirals bonus for low commit count', () => {
      const lowCommits = calculateSessionXP(mockSession('HIGH', 0, 5), mockStreak(), 0);
      const highCommits = calculateSessionXP(mockSession('HIGH', 0, 20), mockStreak(), 0);
      expect(highCommits - lowCommits).toBe(XP_REWARDS.noSpirals);
    });

    it('adds achievement XP', () => {
      const noAchievements = calculateSessionXP(mockSession('HIGH'), mockStreak(), 0);
      const withAchievements = calculateSessionXP(mockSession('HIGH'), mockStreak(), 2);
      expect(withAchievements - noAchievements).toBe(XP_REWARDS.achievementBase * 2);
    });
  });

  describe('addXP', () => {
    it('adds XP without leveling up', () => {
      const initial = createInitialXP();
      const { xp, leveledUp } = addXP(initial, 50);

      expect(xp.total).toBe(50);
      expect(xp.level).toBe(1);
      expect(xp.currentLevelXP).toBe(50);
      expect(leveledUp).toBe(false);
    });

    it('handles level up', () => {
      const initial = createInitialXP();
      const { xp, leveledUp, newLevel } = addXP(initial, 150);

      expect(xp.total).toBe(150);
      expect(xp.level).toBe(2);
      expect(xp.levelName).toBe('Apprentice');
      expect(leveledUp).toBe(true);
      expect(newLevel?.level).toBe(2);
    });

    it('handles multiple level ups', () => {
      const initial = createInitialXP();
      const { xp, leveledUp } = addXP(initial, 700);

      expect(xp.total).toBe(700);
      expect(xp.level).toBe(4);
      expect(xp.levelName).toBe('Expert');
      expect(leveledUp).toBe(true);
    });

    it('tracks last session XP', () => {
      const initial = createInitialXP();
      const { xp } = addXP(initial, 75);
      expect(xp.lastSessionXP).toBe(75);
    });
  });

  describe('getLevelForXP', () => {
    it('returns level 1 for 0 XP', () => {
      const { level, levelInfo } = getLevelForXP(0);
      expect(level).toBe(1);
      expect(levelInfo.name).toBe('Novice');
    });

    it('returns level 2 for 100 XP', () => {
      const { level, levelInfo } = getLevelForXP(100);
      expect(level).toBe(2);
      expect(levelInfo.name).toBe('Apprentice');
    });

    it('returns level 6 for 2000+ XP', () => {
      const { level, levelInfo } = getLevelForXP(5000);
      expect(level).toBe(6);
      expect(levelInfo.name).toBe('Grandmaster');
    });
  });

  describe('getLevelProgress', () => {
    it('returns 0% at level start', () => {
      const xp = createInitialXP();
      expect(getLevelProgress(xp)).toBe(0);
    });

    it('returns 50% at midpoint', () => {
      const xp = { ...createInitialXP(), currentLevelXP: 50 };
      expect(getLevelProgress(xp)).toBe(50);
    });

    it('returns 100% at max level', () => {
      const xp = {
        total: 5000,
        level: 6,
        levelName: 'Grandmaster',
        currentLevelXP: 3000,
        nextLevelXP: Infinity,
        lastSessionXP: 0,
      };
      expect(getLevelProgress(xp)).toBe(100);
    });
  });
});
