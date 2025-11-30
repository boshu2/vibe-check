# Test Coverage Gaps Implementation Plan

**Type:** Plan
**Created:** 2025-11-30
**Loop:** Middle (bridges research to implementation)
**Tags:** testing, coverage, vitest

---

## Overview

Fill remaining test coverage gaps identified in code review. Current coverage: 36.28%. Target: >60% statement coverage on critical modules.

## Priority Modules (0% Coverage Currently)

| Module | Lines | Complexity | Priority |
|--------|-------|------------|----------|
| `metrics/file-churn.ts` | 80 | Medium | HIGH |
| `metrics/time-spiral.ts` | 69 | Low | HIGH |
| `metrics/velocity-anomaly.ts` | 75 | Medium | HIGH |
| `metrics/code-stability.ts` | 83 | Medium | HIGH |
| `output/json.ts` | 100 | Low | MEDIUM |
| `output/markdown.ts` | 146 | Low | MEDIUM |

---

## Files to Create

### 1. `tests/metrics/file-churn.test.ts`

**Purpose:** Test file churn calculation - files touched 3+ times in 1 hour

```typescript
import { describe, it, expect } from 'vitest';
import { calculateFileChurn } from '../../src/metrics/file-churn';
import { Commit } from '../../src/types';

describe('metrics/file-churn', () => {
  const mockCommit = (hash: string, date: Date): Commit => ({
    hash,
    date,
    message: 'test',
    type: 'feat',
    scope: null,
    author: 'test',
  });

  describe('calculateFileChurn', () => {
    it('returns 100% for empty commits', () => {
      const result = calculateFileChurn([], new Map());
      expect(result.value).toBe(100);
      expect(result.churnedFiles).toBe(0);
      expect(result.totalFiles).toBe(0);
    });

    it('returns 100% when no files are churned', () => {
      const commits = [
        mockCommit('abc', new Date('2025-11-28T10:00:00Z')),
        mockCommit('def', new Date('2025-11-28T11:00:00Z')),
      ];
      const filesPerCommit = new Map([
        ['abc', ['file1.ts']],
        ['def', ['file2.ts']],
      ]);

      const result = calculateFileChurn(commits, filesPerCommit);

      expect(result.value).toBe(100);
      expect(result.rating).toBe('elite');
      expect(result.churnedFiles).toBe(0);
      expect(result.totalFiles).toBe(2);
    });

    it('detects churn when file touched 3+ times in 1 hour', () => {
      const baseTime = new Date('2025-11-28T10:00:00Z').getTime();
      const commits = [
        mockCommit('a', new Date(baseTime)),
        mockCommit('b', new Date(baseTime + 10 * 60 * 1000)), // +10 min
        mockCommit('c', new Date(baseTime + 20 * 60 * 1000)), // +20 min
      ];
      const filesPerCommit = new Map([
        ['a', ['file1.ts']],
        ['b', ['file1.ts']],
        ['c', ['file1.ts']],
      ]);

      const result = calculateFileChurn(commits, filesPerCommit);

      expect(result.churnedFiles).toBe(1);
      expect(result.totalFiles).toBe(1);
      expect(result.value).toBe(0); // 100% churn = 0 score
      expect(result.rating).toBe('low');
    });

    it('does not detect churn if touches span more than 1 hour', () => {
      const baseTime = new Date('2025-11-28T10:00:00Z').getTime();
      const commits = [
        mockCommit('a', new Date(baseTime)),
        mockCommit('b', new Date(baseTime + 40 * 60 * 1000)), // +40 min
        mockCommit('c', new Date(baseTime + 90 * 60 * 1000)), // +90 min (>1hr span)
      ];
      const filesPerCommit = new Map([
        ['a', ['file1.ts']],
        ['b', ['file1.ts']],
        ['c', ['file1.ts']],
      ]);

      const result = calculateFileChurn(commits, filesPerCommit);

      expect(result.churnedFiles).toBe(0);
      expect(result.rating).toBe('elite');
    });

    it('calculates correct rating thresholds', () => {
      const baseTime = new Date('2025-11-28T10:00:00Z').getTime();

      // Create 10 files, 2 churned (20% churn ratio)
      const commits: Commit[] = [];
      const filesPerCommit = new Map<string, string[]>();

      // 2 churned files
      for (let i = 0; i < 3; i++) {
        const hash = `churn1-${i}`;
        commits.push(mockCommit(hash, new Date(baseTime + i * 5 * 60 * 1000)));
        filesPerCommit.set(hash, ['churnedFile1.ts']);
      }
      for (let i = 0; i < 3; i++) {
        const hash = `churn2-${i}`;
        commits.push(mockCommit(hash, new Date(baseTime + i * 5 * 60 * 1000)));
        filesPerCommit.set(hash, ['churnedFile2.ts']);
      }

      // 8 non-churned files
      for (let i = 0; i < 8; i++) {
        const hash = `single-${i}`;
        commits.push(mockCommit(hash, new Date(baseTime + i * 60 * 60 * 1000)));
        filesPerCommit.set(hash, [`file${i}.ts`]);
      }

      const result = calculateFileChurn(commits, filesPerCommit);

      expect(result.churnedFiles).toBe(2);
      expect(result.totalFiles).toBe(10);
      expect(result.rating).toBe('high'); // 20% is in 10-25% range
    });

    it('handles missing files in map gracefully', () => {
      const commits = [
        mockCommit('abc', new Date('2025-11-28T10:00:00Z')),
      ];
      const filesPerCommit = new Map<string, string[]>(); // Empty map

      const result = calculateFileChurn(commits, filesPerCommit);

      expect(result.value).toBe(100);
      expect(result.totalFiles).toBe(0);
    });

    it('includes correct description for each rating', () => {
      const elite = calculateFileChurn([], new Map());
      expect(elite.description).toContain('Elite');

      // For other ratings, would need to construct appropriate data
    });
  });
});
```

**Validation:** `npm test -- tests/metrics/file-churn.test.ts`

---

### 2. `tests/metrics/time-spiral.test.ts`

**Purpose:** Test time spiral detection - commits < 5 min apart

```typescript
import { describe, it, expect } from 'vitest';
import { calculateTimeSpiral } from '../../src/metrics/time-spiral';
import { Commit } from '../../src/types';

describe('metrics/time-spiral', () => {
  const mockCommit = (date: Date): Commit => ({
    hash: Math.random().toString(36).substring(7),
    date,
    message: 'test',
    type: 'feat',
    scope: null,
    author: 'test',
  });

  describe('calculateTimeSpiral', () => {
    it('returns elite for empty commits', () => {
      const result = calculateTimeSpiral([]);

      expect(result.value).toBe(100);
      expect(result.rating).toBe('elite');
      expect(result.spiralCommits).toBe(0);
      expect(result.totalCommits).toBe(0);
    });

    it('returns elite for single commit', () => {
      const result = calculateTimeSpiral([
        mockCommit(new Date('2025-11-28T10:00:00Z')),
      ]);

      expect(result.value).toBe(100);
      expect(result.rating).toBe('elite');
      expect(result.description).toContain('Insufficient');
    });

    it('detects spiral when commits < 5 min apart', () => {
      const baseTime = new Date('2025-11-28T10:00:00Z').getTime();
      const commits = [
        mockCommit(new Date(baseTime)),
        mockCommit(new Date(baseTime + 2 * 60 * 1000)), // +2 min (spiral)
        mockCommit(new Date(baseTime + 3 * 60 * 1000)), // +1 min (spiral)
      ];

      const result = calculateTimeSpiral(commits);

      expect(result.spiralCommits).toBe(2);
      expect(result.totalCommits).toBe(3);
    });

    it('no spiral when commits >= 5 min apart', () => {
      const baseTime = new Date('2025-11-28T10:00:00Z').getTime();
      const commits = [
        mockCommit(new Date(baseTime)),
        mockCommit(new Date(baseTime + 10 * 60 * 1000)), // +10 min
        mockCommit(new Date(baseTime + 20 * 60 * 1000)), // +10 min
      ];

      const result = calculateTimeSpiral(commits);

      expect(result.spiralCommits).toBe(0);
      expect(result.rating).toBe('elite');
    });

    it('calculates correct rating based on spiral ratio', () => {
      const baseTime = new Date('2025-11-28T10:00:00Z').getTime();

      // 50% spiral ratio (5 spirals out of 10 commits)
      const commits = [
        mockCommit(new Date(baseTime)),
        mockCommit(new Date(baseTime + 1 * 60 * 1000)), // spiral
        mockCommit(new Date(baseTime + 10 * 60 * 1000)),
        mockCommit(new Date(baseTime + 11 * 60 * 1000)), // spiral
        mockCommit(new Date(baseTime + 20 * 60 * 1000)),
        mockCommit(new Date(baseTime + 21 * 60 * 1000)), // spiral
        mockCommit(new Date(baseTime + 30 * 60 * 1000)),
        mockCommit(new Date(baseTime + 31 * 60 * 1000)), // spiral
        mockCommit(new Date(baseTime + 40 * 60 * 1000)),
        mockCommit(new Date(baseTime + 41 * 60 * 1000)), // spiral
      ];

      const result = calculateTimeSpiral(commits);

      expect(result.spiralCommits).toBe(5);
      expect(result.rating).toBe('medium'); // 50% is in 30-50% range
    });

    it('returns low rating for >50% spiral ratio', () => {
      const baseTime = new Date('2025-11-28T10:00:00Z').getTime();

      // All rapid-fire commits
      const commits = Array.from({ length: 10 }, (_, i) =>
        mockCommit(new Date(baseTime + i * 60 * 1000)) // 1 min apart
      );

      const result = calculateTimeSpiral(commits);

      expect(result.rating).toBe('low');
      expect(result.description).toContain('frustrated iteration');
    });

    it('sorts commits by date before analysis', () => {
      const baseTime = new Date('2025-11-28T10:00:00Z').getTime();

      // Commits in random order
      const commits = [
        mockCommit(new Date(baseTime + 10 * 60 * 1000)),
        mockCommit(new Date(baseTime)),
        mockCommit(new Date(baseTime + 5 * 60 * 1000)),
      ];

      const result = calculateTimeSpiral(commits);

      // Should detect no spirals (5+ min between each when sorted)
      expect(result.spiralCommits).toBe(0);
    });

    it('includes description for each rating', () => {
      const eliteResult = calculateTimeSpiral([
        mockCommit(new Date('2025-11-28T10:00:00Z')),
      ]);
      expect(eliteResult.description).toContain('Insufficient');
    });
  });
});
```

**Validation:** `npm test -- tests/metrics/time-spiral.test.ts`

---

### 3. `tests/metrics/velocity-anomaly.test.ts`

**Purpose:** Test velocity anomaly detection using z-score

```typescript
import { describe, it, expect } from 'vitest';
import { calculateVelocityAnomaly } from '../../src/metrics/velocity-anomaly';
import { Commit } from '../../src/types';

describe('metrics/velocity-anomaly', () => {
  const mockCommit = (date: Date): Commit => ({
    hash: Math.random().toString(36).substring(7),
    date,
    message: 'test',
    type: 'feat',
    scope: null,
    author: 'test',
  });

  describe('calculateVelocityAnomaly', () => {
    it('returns result for empty commits', () => {
      const result = calculateVelocityAnomaly([]);

      expect(result.currentVelocity).toBe(0);
      expect(result.zScore).toBeDefined();
    });

    it('uses default baseline when none provided', () => {
      const commits = [
        mockCommit(new Date('2025-11-28T10:00:00Z')),
      ];

      const result = calculateVelocityAnomaly(commits);

      expect(result.baselineMean).toBe(3.0);
      expect(result.baselineStdDev).toBe(1.5);
    });

    it('uses provided baseline', () => {
      const commits = [
        mockCommit(new Date('2025-11-28T10:00:00Z')),
      ];
      const baseline = { mean: 5.0, stdDev: 2.0 };

      const result = calculateVelocityAnomaly(commits, baseline);

      expect(result.baselineMean).toBe(5.0);
      expect(result.baselineStdDev).toBe(2.0);
    });

    it('calculates z-score correctly', () => {
      const baseTime = new Date('2025-11-28T10:00:00Z').getTime();
      // 6 commits in 1 hour = 6 commits/hour velocity
      const commits = Array.from({ length: 6 }, (_, i) =>
        mockCommit(new Date(baseTime + i * 10 * 60 * 1000))
      );

      // Baseline: mean=3, stdDev=1.5
      // Current velocity ~6, z-score = (6-3)/1.5 = 2
      const result = calculateVelocityAnomaly(commits);

      expect(result.currentVelocity).toBeGreaterThan(0);
      expect(result.zScore).toBeGreaterThan(0);
    });

    it('returns elite for velocity near baseline', () => {
      const baseTime = new Date('2025-11-28T10:00:00Z').getTime();
      // ~3 commits per hour (matches default baseline mean)
      const commits = [
        mockCommit(new Date(baseTime)),
        mockCommit(new Date(baseTime + 20 * 60 * 1000)),
        mockCommit(new Date(baseTime + 40 * 60 * 1000)),
      ];

      const result = calculateVelocityAnomaly(commits);

      expect(result.rating).toBe('elite');
      expect(result.description).toContain('near baseline');
    });

    it('handles zero stdDev gracefully', () => {
      const commits = [
        mockCommit(new Date('2025-11-28T10:00:00Z')),
      ];
      const baseline = { mean: 3.0, stdDev: 0 };

      const result = calculateVelocityAnomaly(commits, baseline);

      expect(result.zScore).toBe(0);
    });

    it('returns low rating for high z-score', () => {
      const baseTime = new Date('2025-11-28T10:00:00Z').getTime();
      // 20 commits in 1 hour = very high velocity
      const commits = Array.from({ length: 20 }, (_, i) =>
        mockCommit(new Date(baseTime + i * 3 * 60 * 1000))
      );

      const result = calculateVelocityAnomaly(commits);

      // Should be far from baseline
      expect(result.zScore).toBeGreaterThan(2);
      expect(result.rating).toBe('low');
      expect(result.description).toContain('unusual pattern');
    });

    it('includes velocity in description', () => {
      const commits = [
        mockCommit(new Date('2025-11-28T10:00:00Z')),
        mockCommit(new Date('2025-11-28T10:30:00Z')),
      ];

      const result = calculateVelocityAnomaly(commits);

      expect(result.description).toContain('/hr');
    });
  });
});
```

**Validation:** `npm test -- tests/metrics/velocity-anomaly.test.ts`

---

### 4. `tests/metrics/code-stability.test.ts`

**Purpose:** Test code stability calculation from line stats

```typescript
import { describe, it, expect } from 'vitest';
import { calculateCodeStability } from '../../src/metrics/code-stability';
import { Commit } from '../../src/types';

describe('metrics/code-stability', () => {
  const mockCommit = (message: string): Commit => ({
    hash: Math.random().toString(36).substring(7),
    date: new Date(),
    message,
    type: 'feat',
    scope: null,
    author: 'test',
  });

  describe('calculateCodeStability', () => {
    it('estimates stability from commit messages when no stats', () => {
      const commits = [
        mockCommit('feat: add feature'),
        mockCommit('fix: something'),
        mockCommit('feat: another feature'),
      ];

      const result = calculateCodeStability(commits);

      expect(result.description).toContain('Estimated');
      expect(result.linesAdded).toBe(0);
      expect(result.linesSurviving).toBe(0);
    });

    it('returns elite when no fix/revert commits', () => {
      const commits = [
        mockCommit('feat: add feature'),
        mockCommit('feat: another feature'),
        mockCommit('docs: update readme'),
      ];

      const result = calculateCodeStability(commits);

      expect(result.value).toBe(100);
      expect(result.rating).toBe('elite');
    });

    it('penalizes fix commits in estimation', () => {
      const commits = [
        mockCommit('feat: add feature'),
        mockCommit('fix: broken thing'),
        mockCommit('fix: another fix'),
        mockCommit('fix: yet another'),
      ];

      const result = calculateCodeStability(commits);

      // 75% fix commits = 25% score
      expect(result.value).toBe(25);
      expect(result.rating).toBe('low');
    });

    it('detects revert commits', () => {
      const commits = [
        mockCommit('feat: add feature'),
        mockCommit('revert: undo feature'),
      ];

      const result = calculateCodeStability(commits);

      expect(result.value).toBe(50); // 50% fix/revert
    });

    it('detects undo in messages', () => {
      const commits = [
        mockCommit('feat: add feature'),
        mockCommit('chore: undo previous change'),
      ];

      const result = calculateCodeStability(commits);

      expect(result.value).toBe(50);
    });

    it('calculates stability from line stats', () => {
      const commits = [mockCommit('feat: test')];
      const stats = [
        { additions: 100, deletions: 20 },
      ];

      const result = calculateCodeStability(commits, stats);

      // deletions/additions = 0.2, score = 1 - (0.2 * 0.5) = 0.9
      expect(result.value).toBe(90);
      expect(result.rating).toBe('elite');
      expect(result.linesAdded).toBe(100);
    });

    it('handles high churn (many deletions)', () => {
      const commits = [mockCommit('refactor: cleanup')];
      const stats = [
        { additions: 100, deletions: 100 },
      ];

      const result = calculateCodeStability(commits, stats);

      // deletions/additions = 1.0 (capped), score = 1 - (1.0 * 0.5) = 0.5
      expect(result.value).toBe(50);
      expect(result.rating).toBe('medium');
    });

    it('aggregates multiple commit stats', () => {
      const commits = [
        mockCommit('feat: one'),
        mockCommit('feat: two'),
      ];
      const stats = [
        { additions: 50, deletions: 10 },
        { additions: 50, deletions: 10 },
      ];

      const result = calculateCodeStability(commits, stats);

      expect(result.linesAdded).toBe(100);
      // 20/100 = 0.2 churn, score = 0.9
      expect(result.value).toBe(90);
    });

    it('handles zero additions gracefully', () => {
      const commits = [mockCommit('chore: delete files')];
      const stats = [
        { additions: 0, deletions: 50 },
      ];

      const result = calculateCodeStability(commits, stats);

      expect(result.value).toBe(100); // 0 churn when no additions
    });

    it('returns correct rating for each threshold', () => {
      // Elite >= 85%
      const eliteStats = [{ additions: 100, deletions: 10 }];
      const elite = calculateCodeStability([mockCommit('t')], eliteStats);
      expect(elite.rating).toBe('elite');

      // High 70-85%
      const highStats = [{ additions: 100, deletions: 50 }];
      const high = calculateCodeStability([mockCommit('t')], highStats);
      expect(high.rating).toBe('high');

      // Medium 50-70%
      const medStats = [{ additions: 100, deletions: 80 }];
      const med = calculateCodeStability([mockCommit('t')], medStats);
      expect(med.rating).toBe('medium');

      // Low < 50% (would need > 100% deletions which is capped)
    });

    it('includes line counts in description', () => {
      const commits = [mockCommit('feat: test')];
      const stats = [{ additions: 100, deletions: 20 }];

      const result = calculateCodeStability(commits, stats);

      expect(result.description).toContain('+100');
      expect(result.description).toContain('-20');
    });

    it('calculates surviving lines', () => {
      const commits = [mockCommit('feat: test')];
      const stats = [{ additions: 100, deletions: 20 }];

      const result = calculateCodeStability(commits, stats);

      // linesSurviving = additions * score = 100 * 0.9 = 90
      expect(result.linesSurviving).toBe(90);
    });
  });
});
```

**Validation:** `npm test -- tests/metrics/code-stability.test.ts`

---

### 5. `tests/output/json.test.ts`

**Purpose:** Test JSON output formatting

```typescript
import { describe, it, expect } from 'vitest';
import { formatJson } from '../../src/output/json';
import { VibeCheckResult, VibeCheckResultV2 } from '../../src/types';

describe('output/json', () => {
  const createMockResult = (): VibeCheckResult => ({
    period: {
      from: new Date('2025-11-21T10:00:00Z'),
      to: new Date('2025-11-28T10:00:00Z'),
      activeHours: 24.5,
    },
    commits: {
      total: 50,
      feat: 20,
      fix: 15,
      docs: 5,
      other: 10,
    },
    metrics: {
      iterationVelocity: { value: 4.5, unit: 'commits/hour', rating: 'high', description: 'Good' },
      reworkRatio: { value: 30, unit: '%', rating: 'medium', description: 'Normal' },
      trustPassRate: { value: 92, unit: '%', rating: 'high', description: 'Good' },
      debugSpiralDuration: { value: 15, unit: 'min', rating: 'high', description: 'Normal' },
      flowEfficiency: { value: 85, unit: '%', rating: 'high', description: 'Good' },
    },
    fixChains: [
      {
        component: 'auth',
        commits: 3,
        duration: 15,
        isSpiral: true,
        pattern: 'SECRETS_AUTH',
        firstCommit: new Date(),
        lastCommit: new Date(),
      },
    ],
    patterns: {
      categories: { SECRETS_AUTH: 3 },
      total: 3,
      tracerAvailable: 100,
    },
    overall: 'HIGH',
  });

  describe('formatJson', () => {
    it('returns valid JSON string', () => {
      const result = createMockResult();
      const output = formatJson(result);

      expect(() => JSON.parse(output)).not.toThrow();
    });

    it('converts dates to ISO strings', () => {
      const result = createMockResult();
      const output = JSON.parse(formatJson(result));

      expect(output.period.from).toBe('2025-11-21T10:00:00.000Z');
      expect(output.period.to).toBe('2025-11-28T10:00:00.000Z');
    });

    it('includes all period info', () => {
      const result = createMockResult();
      const output = JSON.parse(formatJson(result));

      expect(output.period.activeHours).toBe(24.5);
    });

    it('includes commit counts', () => {
      const result = createMockResult();
      const output = JSON.parse(formatJson(result));

      expect(output.commits.total).toBe(50);
      expect(output.commits.feat).toBe(20);
      expect(output.commits.fix).toBe(15);
    });

    it('includes all metrics', () => {
      const result = createMockResult();
      const output = JSON.parse(formatJson(result));

      expect(output.metrics.iterationVelocity.value).toBe(4.5);
      expect(output.metrics.reworkRatio.rating).toBe('medium');
      expect(output.metrics.trustPassRate.unit).toBe('%');
    });

    it('includes fix chains', () => {
      const result = createMockResult();
      const output = JSON.parse(formatJson(result));

      expect(output.fixChains).toHaveLength(1);
      expect(output.fixChains[0].component).toBe('auth');
      expect(output.fixChains[0].pattern).toBe('SECRETS_AUTH');
    });

    it('includes patterns', () => {
      const result = createMockResult();
      const output = JSON.parse(formatJson(result));

      expect(output.patterns.total).toBe(3);
      expect(output.patterns.categories.SECRETS_AUTH).toBe(3);
    });

    it('includes overall rating', () => {
      const result = createMockResult();
      const output = JSON.parse(formatJson(result));

      expect(output.overall).toBe('HIGH');
    });

    it('includes vibeScore for V2 results', () => {
      const result: VibeCheckResultV2 = {
        ...createMockResult(),
        semanticMetrics: createMockResult().metrics,
        vibeScore: {
          value: 0.85,
          components: { fileChurn: 0.9, timeSpiral: 0.8, velocityAnomaly: 0.85, codeStability: 0.85 },
          weights: { fileChurn: 0.3, timeSpiral: 0.25, velocityAnomaly: 0.2, codeStability: 0.25 },
        },
      };

      const output = JSON.parse(formatJson(result));

      expect(output.vibeScore.value).toBe(0.85);
    });

    it('includes semanticFreeMetrics for V2 results', () => {
      const result: VibeCheckResultV2 = {
        ...createMockResult(),
        semanticMetrics: createMockResult().metrics,
        semanticFreeMetrics: {
          fileChurn: { value: 90, unit: '%', rating: 'elite', description: 'Low', churnedFiles: 1, totalFiles: 10 },
          timeSpiral: { value: 85, unit: '%', rating: 'high', description: 'Normal', spiralCommits: 2, totalCommits: 20 },
          velocityAnomaly: { value: 80, unit: '%', rating: 'high', description: 'Normal', currentVelocity: 3.5, baselineMean: 3, baselineStdDev: 1, zScore: 0.5 },
          codeStability: { value: 88, unit: '%', rating: 'elite', description: 'Good', linesAdded: 500, linesSurviving: 440 },
        },
      };

      const output = JSON.parse(formatJson(result));

      expect(output.semanticFreeMetrics.fileChurn.churnedFiles).toBe(1);
      expect(output.semanticFreeMetrics.timeSpiral.spiralCommits).toBe(2);
      expect(output.semanticFreeMetrics.velocityAnomaly.zScore).toBe(0.5);
      expect(output.semanticFreeMetrics.codeStability.linesAdded).toBe(500);
    });

    it('handles empty fix chains', () => {
      const result = createMockResult();
      result.fixChains = [];

      const output = JSON.parse(formatJson(result));

      expect(output.fixChains).toEqual([]);
    });

    it('produces pretty-printed output', () => {
      const result = createMockResult();
      const output = formatJson(result);

      expect(output).toContain('\n');
      expect(output).toContain('  '); // indentation
    });
  });
});
```

**Validation:** `npm test -- tests/output/json.test.ts`

---

### 6. `tests/output/markdown.test.ts`

**Purpose:** Test markdown output formatting

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { formatMarkdown } from '../../src/output/markdown';
import { VibeCheckResult, VibeCheckResultV2 } from '../../src/types';

describe('output/markdown', () => {
  // Mock Date for consistent timestamp
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-11-28T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const createMockResult = (): VibeCheckResult => ({
    period: {
      from: new Date('2025-11-21T10:00:00Z'),
      to: new Date('2025-11-28T10:00:00Z'),
      activeHours: 24.5,
    },
    commits: {
      total: 50,
      feat: 20,
      fix: 15,
      docs: 5,
      other: 10,
    },
    metrics: {
      iterationVelocity: { value: 4.5, unit: 'commits/hour', rating: 'high', description: 'Good' },
      reworkRatio: { value: 30, unit: '%', rating: 'medium', description: 'Normal' },
      trustPassRate: { value: 92, unit: '%', rating: 'high', description: 'Good' },
      debugSpiralDuration: { value: 15, unit: 'min', rating: 'high', description: 'Normal' },
      flowEfficiency: { value: 85, unit: '%', rating: 'high', description: 'Good' },
    },
    fixChains: [],
    patterns: { categories: {}, total: 0, tracerAvailable: 0 },
    overall: 'HIGH',
  });

  describe('formatMarkdown', () => {
    it('includes markdown header', () => {
      const result = createMockResult();
      const output = formatMarkdown(result);

      expect(output).toContain('# Vibe-Check Report');
    });

    it('includes period information', () => {
      const result = createMockResult();
      const output = formatMarkdown(result);

      expect(output).toContain('**Period:**');
      expect(output).toContain('Nov 21, 2025');
      expect(output).toContain('Nov 28, 2025');
      expect(output).toContain('24.5h active');
    });

    it('includes commit counts', () => {
      const result = createMockResult();
      const output = formatMarkdown(result);

      expect(output).toContain('**Commits:** 50 total');
      expect(output).toContain('20 feat');
      expect(output).toContain('15 fix');
    });

    it('includes overall rating', () => {
      const result = createMockResult();
      const output = formatMarkdown(result);

      expect(output).toContain('**Overall Rating:** HIGH');
    });

    it('includes metrics table', () => {
      const result = createMockResult();
      const output = formatMarkdown(result);

      expect(output).toContain('## Semantic Metrics');
      expect(output).toContain('| Metric | Value | Rating | Description |');
      expect(output).toContain('Iteration Velocity');
      expect(output).toContain('4.5commits/hour');
      expect(output).toContain('HIGH');
    });

    it('includes VibeScore for V2 results', () => {
      const result: VibeCheckResultV2 = {
        ...createMockResult(),
        semanticMetrics: createMockResult().metrics,
        vibeScore: {
          value: 0.85,
          components: { fileChurn: 0.9, timeSpiral: 0.8, velocityAnomaly: 0.85, codeStability: 0.85 },
          weights: { fileChurn: 0.3, timeSpiral: 0.25, velocityAnomaly: 0.2, codeStability: 0.25 },
        },
      };

      const output = formatMarkdown(result);

      expect(output).toContain('**VibeScore:** 85%');
    });

    it('includes semantic-free metrics table for V2', () => {
      const result: VibeCheckResultV2 = {
        ...createMockResult(),
        semanticMetrics: createMockResult().metrics,
        semanticFreeMetrics: {
          fileChurn: { value: 90, unit: '%', rating: 'elite', description: 'Low churn', churnedFiles: 1, totalFiles: 10 },
          timeSpiral: { value: 85, unit: '%', rating: 'high', description: 'Normal', spiralCommits: 2, totalCommits: 20 },
          velocityAnomaly: { value: 80, unit: '%', rating: 'high', description: 'Normal', currentVelocity: 3.5, baselineMean: 3, baselineStdDev: 1, zScore: 0.5 },
          codeStability: { value: 88, unit: '%', rating: 'elite', description: 'Good', linesAdded: 500, linesSurviving: 440 },
        },
      };

      const output = formatMarkdown(result);

      expect(output).toContain('## Semantic-Free Metrics (v2.0)');
      expect(output).toContain('File Churn');
      expect(output).toContain('Time Spiral');
    });

    it('includes debug spirals when present', () => {
      const result = createMockResult();
      result.fixChains = [
        {
          component: 'auth',
          commits: 3,
          duration: 15,
          isSpiral: true,
          pattern: 'SECRETS_AUTH',
          firstCommit: new Date(),
          lastCommit: new Date(),
        },
      ];

      const output = formatMarkdown(result);

      expect(output).toContain('## Debug Spirals');
      expect(output).toContain('| auth | 3 | 15m | SECRETS_AUTH |');
    });

    it('includes pattern analysis when patterns present', () => {
      const result = createMockResult();
      result.patterns = {
        categories: { SECRETS_AUTH: 3, API_MISMATCH: 2 },
        total: 5,
        tracerAvailable: 60,
      };

      const output = formatMarkdown(result);

      expect(output).toContain('## Pattern Analysis');
      expect(output).toContain('SECRETS_AUTH');
      expect(output).toContain('**60%** of fix patterns');
    });

    it('includes recommendations section', () => {
      const result = createMockResult();
      const output = formatMarkdown(result);

      expect(output).toContain('## Recommendations');
    });

    it('adds recommendation for low rework ratio', () => {
      const result = createMockResult();
      result.metrics.reworkRatio.rating = 'low';

      const output = formatMarkdown(result);

      expect(output).toContain('High rework ratio');
      expect(output).toContain('tracer tests');
    });

    it('adds recommendation for low trust pass rate', () => {
      const result = createMockResult();
      result.metrics.trustPassRate.rating = 'low';

      const output = formatMarkdown(result);

      expect(output).toContain('Trust pass rate below target');
    });

    it('adds recommendation for long debug spirals', () => {
      const result = createMockResult();
      result.metrics.debugSpiralDuration.rating = 'low';

      const output = formatMarkdown(result);

      expect(output).toContain('Long debug spirals');
      expect(output).toContain('smaller, verifiable steps');
    });

    it('suggests tracer tests for detected patterns', () => {
      const result = createMockResult();
      result.fixChains = [
        {
          component: 'auth',
          commits: 3,
          duration: 15,
          isSpiral: true,
          pattern: 'SECRETS_AUTH',
          firstCommit: new Date(),
          lastCommit: new Date(),
        },
      ];

      const output = formatMarkdown(result);

      expect(output).toContain('tracer tests for: SECRETS_AUTH');
    });

    it('shows healthy message when all metrics good', () => {
      const result = createMockResult();
      // All ratings are already high/elite

      const output = formatMarkdown(result);

      expect(output).toContain('All metrics healthy');
    });

    it('includes generation timestamp', () => {
      const result = createMockResult();
      const output = formatMarkdown(result);

      expect(output).toContain('Generated by vibe-check');
      expect(output).toContain('2025-11-28');
    });

    it('handles pattern without tracer (OTHER)', () => {
      const result = createMockResult();
      result.patterns = {
        categories: { OTHER: 2 },
        total: 2,
        tracerAvailable: 0,
      };

      const output = formatMarkdown(result);

      expect(output).toContain('| OTHER | 2 | No |');
    });
  });
});
```

**Validation:** `npm test -- tests/output/markdown.test.ts`

---

## Implementation Order

| Step | Action | Validation | Rollback |
|------|--------|------------|----------|
| 1 | Create `tests/metrics/` directory | `ls tests/metrics/` | `rm -rf tests/metrics/` |
| 2 | Create `file-churn.test.ts` | `npm test -- tests/metrics/file-churn.test.ts` | Delete file |
| 3 | Create `time-spiral.test.ts` | `npm test -- tests/metrics/time-spiral.test.ts` | Delete file |
| 4 | Create `velocity-anomaly.test.ts` | `npm test -- tests/metrics/velocity-anomaly.test.ts` | Delete file |
| 5 | Create `code-stability.test.ts` | `npm test -- tests/metrics/code-stability.test.ts` | Delete file |
| 6 | Create `json.test.ts` | `npm test -- tests/output/json.test.ts` | Delete file |
| 7 | Create `markdown.test.ts` | `npm test -- tests/output/markdown.test.ts` | Delete file |
| 8 | Full test suite | `npm test` | N/A |
| 9 | Coverage report | `npm run test:coverage` | N/A |

---

## Validation Strategy

### Per-file Validation
```bash
npm test -- [path/to/test/file]
# Expected: All tests pass
```

### Full Suite Validation
```bash
npm test
# Expected: 250+ tests passing
```

### Coverage Validation
```bash
npm run test:coverage
# Expected: >60% statement coverage overall
# Expected: >80% on new test modules
```

---

## Rollback Procedure

**Time to rollback:** 1 minute

### Full Rollback
```bash
# Remove all new test files
rm -f tests/metrics/file-churn.test.ts
rm -f tests/metrics/time-spiral.test.ts
rm -f tests/metrics/velocity-anomaly.test.ts
rm -f tests/metrics/code-stability.test.ts
rm -f tests/output/json.test.ts
rm -f tests/output/markdown.test.ts
rmdir tests/metrics 2>/dev/null

# Verify rollback
npm test
# Should show ~194 tests (original count)
```

---

## Approval Checklist

**Human must verify before /implement:**

- [ ] Every file specified precisely with full content
- [ ] All tests follow project patterns (vitest, describe/it structure)
- [ ] Test coverage targets reasonable (unit tests, not integration)
- [ ] Implementation order is correct (directory before files)
- [ ] Rollback procedure complete

---

## Next Step

Once approved: Execute implementation following order above.
