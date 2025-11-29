import { describe, it, expect } from 'vitest';
import {
  createInitialStreak,
  updateStreak,
  isStreakAtRisk,
  formatStreak,
  formatWeeklyProgress,
} from '../../src/gamification/streaks';
import { StreakState } from '../../src/gamification/types';

describe('Streaks', () => {
  // Helper to format date as ISO date string
  const toDateStr = (date: Date) => date.toISOString().split('T')[0];

  describe('createInitialStreak', () => {
    it('creates initial streak state with zeros', () => {
      const streak = createInitialStreak();
      expect(streak.current).toBe(0);
      expect(streak.longest).toBe(0);
      expect(streak.lastActiveDate).toBe('');
      expect(streak.weeklyGoal).toBe(5);
      expect(streak.weeklyProgress).toBe(0);
      expect(streak.freezesRemaining).toBe(1);
    });
  });

  describe('updateStreak', () => {
    it('starts streak at 1 for first session', () => {
      const initial = createInitialStreak();
      const sessionDate = new Date('2025-11-29T12:00:00Z');

      const updated = updateStreak(initial, sessionDate);

      expect(updated.current).toBe(1);
      expect(updated.longest).toBe(1);
      expect(updated.lastActiveDate).toBe('2025-11-29');
    });

    it('extends streak for consecutive day', () => {
      const yesterday = new Date('2025-11-28');
      const today = new Date('2025-11-29');

      const streak: StreakState = {
        current: 5,
        longest: 5,
        lastActiveDate: toDateStr(yesterday),
        weeklyGoal: 5,
        weeklyProgress: 3,
        freezesRemaining: 1,
      };

      const updated = updateStreak(streak, today);

      expect(updated.current).toBe(6);
      expect(updated.longest).toBe(6);
    });

    it('does not double-count same day', () => {
      const today = new Date('2025-11-29');

      const streak: StreakState = {
        current: 5,
        longest: 5,
        lastActiveDate: toDateStr(today),
        weeklyGoal: 5,
        weeklyProgress: 3,
        freezesRemaining: 1,
      };

      const updated = updateStreak(streak, today);

      expect(updated.current).toBe(5);  // No change
      expect(updated.weeklyProgress).toBe(3);  // No change
    });

    it('resets streak when more than 2 days gap without freeze', () => {
      const threeDaysAgo = new Date('2025-11-26');
      const today = new Date('2025-11-29');

      const streak: StreakState = {
        current: 10,
        longest: 10,
        lastActiveDate: toDateStr(threeDaysAgo),
        weeklyGoal: 5,
        weeklyProgress: 3,
        freezesRemaining: 0,  // No freezes
      };

      const updated = updateStreak(streak, today);

      expect(updated.current).toBe(1);  // Reset
      expect(updated.longest).toBe(10);  // Longest preserved
    });

    it('uses freeze to preserve streak when missing one day', () => {
      const twoDaysAgo = new Date('2025-11-27');
      const today = new Date('2025-11-29');

      const streak: StreakState = {
        current: 10,
        longest: 10,
        lastActiveDate: toDateStr(twoDaysAgo),
        weeklyGoal: 5,
        weeklyProgress: 3,
        freezesRemaining: 1,
      };

      const updated = updateStreak(streak, today);

      expect(updated.current).toBe(11);  // Extended with freeze
      expect(updated.freezesRemaining).toBe(0);  // Freeze consumed
      expect(updated.lastFreezeUsed).toBe('2025-11-28');  // Yesterday
    });

    it('updates longest streak when current exceeds it', () => {
      const yesterday = new Date('2025-11-28');
      const today = new Date('2025-11-29');

      const streak: StreakState = {
        current: 7,
        longest: 7,
        lastActiveDate: toDateStr(yesterday),
        weeklyGoal: 5,
        weeklyProgress: 4,
        freezesRemaining: 1,
      };

      const updated = updateStreak(streak, today);

      expect(updated.current).toBe(8);
      expect(updated.longest).toBe(8);
    });

    it('preserves longest streak when current is lower', () => {
      const yesterday = new Date('2025-11-28');
      const today = new Date('2025-11-29');

      const streak: StreakState = {
        current: 3,
        longest: 15,
        lastActiveDate: toDateStr(yesterday),
        weeklyGoal: 5,
        weeklyProgress: 2,
        freezesRemaining: 1,
      };

      const updated = updateStreak(streak, today);

      expect(updated.current).toBe(4);
      expect(updated.longest).toBe(15);  // Preserved
    });
  });

  describe('isStreakAtRisk', () => {
    it('returns false for no streak', () => {
      const streak = createInitialStreak();
      expect(isStreakAtRisk(streak)).toBe(false);
    });

    it('returns false if checked in today', () => {
      const today = new Date();
      const streak: StreakState = {
        current: 5,
        longest: 5,
        lastActiveDate: toDateStr(today),
        weeklyGoal: 5,
        weeklyProgress: 3,
        freezesRemaining: 1,
      };

      expect(isStreakAtRisk(streak)).toBe(false);
    });

    it('returns true if not checked in today', () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      const streak: StreakState = {
        current: 5,
        longest: 5,
        lastActiveDate: toDateStr(yesterday),
        weeklyGoal: 5,
        weeklyProgress: 3,
        freezesRemaining: 1,
      };

      expect(isStreakAtRisk(streak)).toBe(true);
    });
  });

  describe('formatStreak', () => {
    it('returns no streak message for 0 streak', () => {
      const streak = createInitialStreak();
      expect(formatStreak(streak)).toBe('No active streak');
    });

    it('shows fire emoji for active streak', () => {
      const streak: StreakState = {
        current: 3,
        longest: 5,
        lastActiveDate: '2025-11-29',
        weeklyGoal: 5,
        weeklyProgress: 3,
        freezesRemaining: 1,
      };

      const formatted = formatStreak(streak);
      expect(formatted).toContain('🔥');
      expect(formatted).toContain('3-day streak');
    });

    it('uses star emoji for 6-14 day streaks', () => {
      const streak: StreakState = {
        current: 10,
        longest: 10,
        lastActiveDate: '2025-11-29',
        weeklyGoal: 5,
        weeklyProgress: 5,
        freezesRemaining: 1,
      };

      const formatted = formatStreak(streak);
      expect(formatted).toContain('🌟');
      expect(formatted).toContain('10-day streak');
    });

    it('shows personal best for 7+ day record', () => {
      const streak: StreakState = {
        current: 10,
        longest: 10,
        lastActiveDate: '2025-11-29',
        weeklyGoal: 5,
        weeklyProgress: 5,
        freezesRemaining: 1,
      };

      const formatted = formatStreak(streak);
      expect(formatted).toContain('Personal Best');
    });
  });

  describe('formatWeeklyProgress', () => {
    it('shows progress bar with filled and empty blocks', () => {
      const streak: StreakState = {
        current: 3,
        longest: 3,
        lastActiveDate: '2025-11-29',
        weeklyGoal: 5,
        weeklyProgress: 3,
        freezesRemaining: 1,
      };

      const formatted = formatWeeklyProgress(streak);
      expect(formatted).toContain('3/5');
      expect(formatted).toContain('█'.repeat(3));
      expect(formatted).toContain('░'.repeat(2));
    });

    it('handles full progress', () => {
      const streak: StreakState = {
        current: 7,
        longest: 7,
        lastActiveDate: '2025-11-29',
        weeklyGoal: 5,
        weeklyProgress: 5,
        freezesRemaining: 1,
      };

      const formatted = formatWeeklyProgress(streak);
      expect(formatted).toContain('5/5');
      expect(formatted).not.toContain('░');
    });
  });
});
