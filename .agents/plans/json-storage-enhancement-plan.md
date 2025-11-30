# JSON Storage Enhancement Plan

**Type:** Plan
**Created:** 2025-11-30
**Depends On:** docs/DATA-ARCHITECTURE.md, docs/JSON-STORAGE-PATTERNS.md
**Loop:** Middle (bridges research to implementation)
**Tags:** storage, json, ndjson, event-sourcing

---

## Overview

Enhance vibe-check's JSON storage layer to follow best practices:
1. Add NDJSON append-only log for commits (source of truth)
2. Implement atomic writes to prevent corruption
3. Add schema versioning with migrations
4. Create utility module for common storage patterns

**Scope:** Storage layer only. No changes to commands or output.

---

## Approach Selected

**Hybrid Pattern (Pattern 5 from research):**
- `commits.ndjson` = append-only source of truth
- `timeline.json` = computed view (existing, enhanced)
- Atomic writes via temp file + rename

**Rationale:**
- Git-friendly (NDJSON diffs show only new lines)
- Resilient (can regenerate timeline.json from commits.ndjson)
- Backward compatible (existing timeline.json format preserved)

---

## PDC Strategy

### Prevent
- [x] Research completed (DATA-ARCHITECTURE.md, JSON-STORAGE-PATTERNS.md)
- [ ] Write tracer test for atomic write
- [ ] Verify NDJSON append works

### Detect
- [ ] Test corruption recovery
- [ ] Test backward compatibility with existing timeline.json

### Correct
- [ ] Rollback procedure documented below
- [ ] Old files preserved (not deleted)

---

## Files to Create

### 1. `src/storage/atomic.ts`

**Purpose:** Atomic write utilities to prevent corruption

```typescript
/**
 * Atomic file operations for safe JSON storage
 */
import * as fs from 'fs';
import * as path from 'path';
import { randomBytes } from 'crypto';

/**
 * Write data atomically using temp file + rename pattern.
 * This prevents corruption if the process is killed mid-write.
 */
export function atomicWriteSync(filePath: string, data: string): void {
  const dir = path.dirname(filePath);
  const tempPath = path.join(dir, `.${path.basename(filePath)}.${randomBytes(6).toString('hex')}.tmp`);

  // Ensure directory exists
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // Write to temp file
  fs.writeFileSync(tempPath, data, 'utf-8');

  // Atomic rename (POSIX guarantees atomicity)
  fs.renameSync(tempPath, filePath);
}

/**
 * Append a line to a file (for NDJSON).
 * Creates file if it doesn't exist.
 */
export function appendLineSync(filePath: string, line: string): void {
  const dir = path.dirname(filePath);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // Append with newline
  fs.appendFileSync(filePath, line + '\n', 'utf-8');
}

/**
 * Read NDJSON file and parse each line.
 * Returns empty array if file doesn't exist.
 */
export function readNdjsonSync<T>(filePath: string): T[] {
  if (!fs.existsSync(filePath)) {
    return [];
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n').filter(line => line.trim().length > 0);

  return lines.map(line => JSON.parse(line) as T);
}

/**
 * Safely read and parse JSON with fallback.
 * Returns fallback if file doesn't exist or is corrupted.
 */
export function safeReadJsonSync<T>(filePath: string, fallback: T): T {
  if (!fs.existsSync(filePath)) {
    return fallback;
  }

  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content) as T;
  } catch (error) {
    // Log corruption but don't crash
    console.warn(`Warning: Could not parse ${filePath}, using fallback`);

    // Backup corrupted file for debugging
    const backupPath = `${filePath}.corrupted.${Date.now()}`;
    try {
      fs.renameSync(filePath, backupPath);
      console.warn(`Corrupted file backed up to: ${backupPath}`);
    } catch {
      // Ignore backup failures
    }

    return fallback;
  }
}
```

**Validation:**
```bash
npm run build
# Should compile without errors
```

---

### 2. `src/storage/commit-log.ts`

**Purpose:** NDJSON commit log (append-only source of truth)

```typescript
/**
 * Append-only commit log using NDJSON format.
 * This is the source of truth - timeline.json is derived from this.
 */
import * as path from 'path';
import { Commit } from '../types';
import { appendLineSync, readNdjsonSync } from './atomic';

const STORE_DIR = '.vibe-check';
const COMMIT_LOG_FILE = 'commits.ndjson';

/**
 * Stored commit format (minimal for storage efficiency)
 */
export interface StoredCommit {
  h: string;      // hash (7 char)
  d: string;      // date (ISO string)
  m: string;      // message (first line)
  t: string;      // type
  s: string | null; // scope
  a: string;      // author
}

/**
 * Get commit log file path
 */
export function getCommitLogPath(repoPath: string = process.cwd()): string {
  return path.join(repoPath, STORE_DIR, COMMIT_LOG_FILE);
}

/**
 * Convert Commit to StoredCommit (compressed format)
 */
function toStoredCommit(commit: Commit): StoredCommit {
  return {
    h: commit.hash,
    d: commit.date.toISOString(),
    m: commit.message,
    t: commit.type,
    s: commit.scope,
    a: commit.author,
  };
}

/**
 * Convert StoredCommit back to Commit
 */
function fromStoredCommit(stored: StoredCommit): Commit {
  return {
    hash: stored.h,
    date: new Date(stored.d),
    message: stored.m,
    type: stored.t as Commit['type'],
    scope: stored.s,
    author: stored.a,
  };
}

/**
 * Append new commits to the log.
 * Skips commits that already exist (by hash).
 */
export function appendCommits(commits: Commit[], repoPath: string = process.cwd()): number {
  const logPath = getCommitLogPath(repoPath);

  // Load existing hashes to prevent duplicates
  const existingHashes = new Set(
    readNdjsonSync<StoredCommit>(logPath).map(c => c.h)
  );

  let appendedCount = 0;

  for (const commit of commits) {
    if (!existingHashes.has(commit.hash)) {
      const stored = toStoredCommit(commit);
      appendLineSync(logPath, JSON.stringify(stored));
      existingHashes.add(commit.hash);
      appendedCount++;
    }
  }

  return appendedCount;
}

/**
 * Read all commits from the log.
 */
export function readCommitLog(repoPath: string = process.cwd()): Commit[] {
  const logPath = getCommitLogPath(repoPath);
  const stored = readNdjsonSync<StoredCommit>(logPath);
  return stored.map(fromStoredCommit);
}

/**
 * Get the most recent commit hash from the log.
 * Returns empty string if log is empty.
 */
export function getLastLoggedCommitHash(repoPath: string = process.cwd()): string {
  const commits = readCommitLog(repoPath);
  if (commits.length === 0) return '';

  // Sort by date descending and return most recent
  const sorted = commits.sort((a, b) => b.date.getTime() - a.date.getTime());
  return sorted[0].hash;
}

/**
 * Get commit count in the log.
 */
export function getCommitLogCount(repoPath: string = process.cwd()): number {
  const logPath = getCommitLogPath(repoPath);
  const commits = readNdjsonSync<StoredCommit>(logPath);
  return commits.length;
}
```

**Validation:**
```bash
npm run build
# Should compile without errors
```

---

### 3. `src/storage/schema.ts`

**Purpose:** Schema versioning and migration utilities

```typescript
/**
 * Schema versioning and migration utilities
 */

export type SchemaVersion = '1.0.0' | '1.1.0' | '2.0.0';

export const CURRENT_SCHEMA_VERSION: SchemaVersion = '2.0.0';

/**
 * Base interface for all versioned stores
 */
export interface VersionedStore {
  version: SchemaVersion;
  lastUpdated: string;
}

/**
 * Migration function type
 */
export type MigrationFn<T> = (store: T) => T;

/**
 * Migration registry
 */
export interface MigrationRegistry<T> {
  '1.0.0_to_1.1.0'?: MigrationFn<T>;
  '1.1.0_to_2.0.0'?: MigrationFn<T>;
}

/**
 * Apply migrations to bring store to current version
 */
export function migrateStore<T extends VersionedStore>(
  store: T,
  migrations: MigrationRegistry<T>
): T {
  let currentStore = store;

  // Migration path
  const migrationPath: Array<keyof MigrationRegistry<T>> = [
    '1.0.0_to_1.1.0',
    '1.1.0_to_2.0.0',
  ];

  for (const migrationKey of migrationPath) {
    const [fromVersion] = (migrationKey as string).split('_to_');

    if (currentStore.version === fromVersion) {
      const migration = migrations[migrationKey];
      if (migration) {
        currentStore = migration(currentStore);
      }
    }
  }

  return currentStore;
}

/**
 * Check if store needs migration
 */
export function needsMigration(store: VersionedStore): boolean {
  return store.version !== CURRENT_SCHEMA_VERSION;
}
```

**Validation:**
```bash
npm run build
# Should compile without errors
```

---

## Files to Modify

### 1. `src/storage/timeline-store.ts:189-199`

**Purpose:** Use atomic write instead of direct writeFileSync

**Before:**
```typescript
export function saveStore(store: TimelineStore, repoPath: string = process.cwd()): void {
  const dirPath = getStoreDir(repoPath);
  const filePath = getStorePath(repoPath);

  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }

  store.lastUpdated = new Date().toISOString();
  fs.writeFileSync(filePath, JSON.stringify(store, null, 2));
}
```

**After:**
```typescript
export function saveStore(store: TimelineStore, repoPath: string = process.cwd()): void {
  const filePath = getStorePath(repoPath);

  store.lastUpdated = new Date().toISOString();

  // Use atomic write to prevent corruption
  atomicWriteSync(filePath, JSON.stringify(store, null, 2));
}
```

**Reason:** Prevents file corruption if process is killed mid-write
**Validation:** `npm test` should still pass

---

### 2. `src/storage/timeline-store.ts:170-184`

**Purpose:** Use safe read with corruption recovery

**Before:**
```typescript
export function loadStore(repoPath: string = process.cwd()): TimelineStore {
  const filePath = getStorePath(repoPath);

  if (fs.existsSync(filePath)) {
    try {
      const data = fs.readFileSync(filePath, 'utf-8');
      const store = JSON.parse(data) as TimelineStore;
      return migrateStore(store);
    } catch {
      return createInitialStore();
    }
  }

  return createInitialStore();
}
```

**After:**
```typescript
export function loadStore(repoPath: string = process.cwd()): TimelineStore {
  const filePath = getStorePath(repoPath);
  const initialStore = createInitialStore();

  const store = safeReadJsonSync<TimelineStore>(filePath, initialStore);

  // Always migrate (handles both old versions and fresh stores)
  return migrateTimelineStore(store);
}
```

**Reason:** Centralized corruption handling with backup
**Validation:** `npm test` should still pass

---

### 3. `src/storage/timeline-store.ts:1-10`

**Purpose:** Add imports for new utilities

**Before:**
```typescript
import * as fs from 'fs';
import * as path from 'path';
import {
  TimelineResult,
  TimelineSession,
  TimelineDay,
  TimelineEvent,
} from '../types';
```

**After:**
```typescript
import * as path from 'path';
import {
  TimelineResult,
  TimelineSession,
  TimelineDay,
  TimelineEvent,
} from '../types';
import { atomicWriteSync, safeReadJsonSync } from './atomic';
```

**Reason:** Use new atomic utilities
**Validation:** `npm run build` should compile

---

### 4. `src/storage/timeline-store.ts:557-575` (rename function)

**Purpose:** Rename migrateStore to migrateTimelineStore to avoid conflict

**Before:**
```typescript
function migrateStore(store: TimelineStore): TimelineStore {
```

**After:**
```typescript
function migrateTimelineStore(store: TimelineStore): TimelineStore {
```

**Reason:** Avoid naming conflict with schema.ts migrateStore
**Validation:** `npm run build` should compile

---

### 5. `src/storage/index.ts`

**Purpose:** Export new modules

**Before:**
```typescript
export {
  TimelineStore,
  StoredSession,
  StoredInsight,
  PatternStats,
  TrendData,
  WeekTrend,
  MonthTrend,
  loadStore,
  saveStore,
  createInitialStore,
  updateStore,
  getLastCommitHash,
  getStorePath,
  getStoreDir,
} from './timeline-store';
```

**After:**
```typescript
// Timeline store (computed view)
export {
  TimelineStore,
  StoredSession,
  StoredInsight,
  PatternStats,
  TrendData,
  WeekTrend,
  MonthTrend,
  loadStore,
  saveStore,
  createInitialStore,
  updateStore,
  getLastCommitHash,
  getStorePath,
  getStoreDir,
} from './timeline-store';

// Atomic file operations
export {
  atomicWriteSync,
  appendLineSync,
  readNdjsonSync,
  safeReadJsonSync,
} from './atomic';

// Commit log (NDJSON source of truth)
export {
  StoredCommit,
  getCommitLogPath,
  appendCommits,
  readCommitLog,
  getLastLoggedCommitHash,
  getCommitLogCount,
} from './commit-log';

// Schema versioning
export {
  SchemaVersion,
  CURRENT_SCHEMA_VERSION,
  VersionedStore,
  migrateStore,
  needsMigration,
} from './schema';
```

**Reason:** Expose new modules through barrel export
**Validation:** `npm run build` should compile

---

## Files NOT to Modify (Yet)

These files will use the new storage in a future PR:

- `src/commands/timeline.ts` - Will use commit-log.ts
- `src/gamification/profile.ts` - Will use atomic.ts

**Rationale:** Keep this PR focused on storage layer only. Integration comes next.

---

## Implementation Order

**CRITICAL: Sequence matters. Do not reorder.**

| Step | Action | Validation | Rollback |
|------|--------|------------|----------|
| 1 | Create `src/storage/atomic.ts` | `npm run build` | Delete file |
| 2 | Create `src/storage/schema.ts` | `npm run build` | Delete file |
| 3 | Create `src/storage/commit-log.ts` | `npm run build` | Delete file |
| 4 | Modify `src/storage/timeline-store.ts` imports | `npm run build` | Revert |
| 5 | Rename migrateStore → migrateTimelineStore | `npm run build` | Revert |
| 6 | Update loadStore() | `npm run build` | Revert |
| 7 | Update saveStore() | `npm run build` | Revert |
| 8 | Update `src/storage/index.ts` | `npm run build` | Revert |
| 9 | Run full test suite | `npm test` | Revert all |
| 10 | Manual test timeline | `npm run dev timeline` | Revert all |

---

## Validation Strategy

### Syntax Validation
```bash
npm run build
# Expected: Compiled successfully
```

### Unit Tests
```bash
npm test
# Expected: All tests pass (existing tests should not break)
```

### Manual Integration Test
```bash
# Test timeline with new storage
npm run dev timeline --since "1 week ago"
# Expected: Timeline output displays correctly

# Verify .vibe-check/timeline.json was updated
cat .vibe-check/timeline.json | head -5
# Expected: JSON with version field

# Test corruption recovery (optional)
echo "corrupted" > .vibe-check/timeline.json
npm run dev timeline --since "1 week ago"
# Expected: Warning about corruption, creates fresh store
ls .vibe-check/timeline.json.corrupted.*
# Expected: Backup file exists
```

---

## Rollback Procedure

**Time to rollback:** ~2 minutes

### Full Rollback
```bash
# Step 1: Revert all changes
git checkout src/storage/

# Step 2: Remove new files
rm -f src/storage/atomic.ts
rm -f src/storage/schema.ts
rm -f src/storage/commit-log.ts

# Step 3: Verify
npm run build
npm test

# Step 4: Clean up any corrupted backup files
rm -f .vibe-check/*.corrupted.*
```

---

## Failure Pattern Risks

| Pattern | Risk | Prevention in Plan |
|---------|------|-------------------|
| Tests Passing Lie | LOW | Manual integration test required |
| Instruction Drift | LOW | Precise file:line specs |
| Bridge Torching | LOW | Backward compatible (same JSON format) |

---

## Risk Assessment

### Medium Risk: Import Ordering
- **What:** Circular imports between storage modules
- **Mitigation:** atomic.ts has no imports from project, schema.ts has no imports
- **Detection:** Build fails with circular dependency error
- **Recovery:** Inline the problematic function

### Low Risk: Path Handling
- **What:** Windows path separators in NDJSON
- **Mitigation:** Using path.join() consistently
- **Detection:** Tests fail on Windows CI
- **Recovery:** Add path normalization

---

## Approval Checklist

**Human must verify before /implement:**

- [ ] Every file specified precisely (file:line)
- [ ] All templates complete (no placeholders)
- [ ] Validation commands provided
- [ ] Rollback procedure complete
- [ ] Implementation order is correct
- [ ] Risks identified and mitigated
- [ ] Scope limited to storage layer only

---

## Progress Files

This plan does not require `feature-list.json` or `claude-progress.json` as it's a focused enhancement, not a multi-day project.

---

## Next Step

Once approved: `/implement json-storage-enhancement-plan.md`

---

## Future Work (Not in This Plan)

1. **Integration PR:** Use commit-log.ts in timeline.ts
2. **Profile atomic writes:** Use atomic.ts in profile.ts
3. **Weekly cache:** Add cache/ directory for precomputed views
4. **Cross-repo aggregation:** Central SQLite for multi-repo (separate plan)
