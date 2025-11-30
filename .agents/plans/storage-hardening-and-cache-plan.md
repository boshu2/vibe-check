# Storage Hardening & Cache Command Plan

**Type:** Plan
**Created:** 2025-11-30
**Depends On:** storage-enhancement-research-2025-11-30.md
**Loop:** Middle (bridges research to implementation)
**Tags:** security, storage, cache, hardening

---

## Overview

Implement Phase 1 (hardening) and partial Phase 2 (cache command) from the storage enhancement research:

1. **Fix schema versioning** - Use CURRENT_SCHEMA_VERSION instead of hardcoded '1.0.0'
2. **Improve NDJSON error handling** - Skip bad lines instead of failing entire file
3. **Add .gitignore enforcement** - Warn if .vibe-check/ not in .gitignore
4. **Add cache command** - `vibe-check cache status` and `vibe-check cache clear`

**Scope:** Security hardening + cache management UX. No analytics features yet.

---

## Approach Selected

From research, implement these quick wins:
- Schema version fix (5 min)
- NDJSON error recovery (15 min)
- Cache status/clear commands (30 min)
- .gitignore warning (10 min)

**Total estimated:** ~1 hour

---

## PDC Strategy

### Prevent
- [x] Research completed (3-agent synthesis)
- [ ] All changes are additive (backward compatible)

### Detect
- [ ] Build passes after each change
- [ ] Tests pass after all changes
- [ ] Manual test of cache commands

### Correct
- [ ] Rollback procedure documented
- [ ] No breaking changes to existing data

---

## Files to Create

### 1. `src/commands/cache.ts`

**Purpose:** Cache management commands (status, clear)

```typescript
import { Command } from 'commander';
import chalk from 'chalk';
import * as fs from 'fs';
import * as path from 'path';
import { getStoreDir, getStorePath, loadStore } from '../storage';
import { getCommitLogPath } from '../storage/commit-log';

export interface CacheOptions {
  repo: string;
}

export function createCacheCommand(): Command {
  const cmd = new Command('cache')
    .description('Manage vibe-check cache (.vibe-check/ directory)')
    .option('-r, --repo <path>', 'Repository path', process.cwd());

  // Subcommand: status
  cmd
    .command('status')
    .description('Show cache status and size')
    .action(async () => {
      const options = cmd.opts() as CacheOptions;
      await showCacheStatus(options);
    });

  // Subcommand: clear
  cmd
    .command('clear')
    .description('Clear all cached data')
    .option('--force', 'Skip confirmation prompt')
    .action(async (clearOptions) => {
      const options = cmd.opts() as CacheOptions;
      await clearCache(options, clearOptions.force);
    });

  // Default action: show status
  cmd.action(async () => {
    const options = cmd.opts() as CacheOptions;
    await showCacheStatus(options);
  });

  return cmd;
}

async function showCacheStatus(options: CacheOptions): Promise<void> {
  const { repo } = options;
  const storeDir = getStoreDir(repo);

  console.log('');
  console.log(chalk.bold.cyan('═'.repeat(50)));
  console.log(chalk.bold.cyan('  VIBE-CHECK CACHE STATUS'));
  console.log(chalk.bold.cyan('═'.repeat(50)));
  console.log('');

  if (!fs.existsSync(storeDir)) {
    console.log(chalk.yellow('  No cache directory found.'));
    console.log(chalk.gray(`  Run 'vibe-check timeline' to create cache.`));
    console.log('');
    return;
  }

  // Calculate directory size
  const files = fs.readdirSync(storeDir);
  let totalSize = 0;
  const fileInfo: { name: string; size: number }[] = [];

  for (const file of files) {
    const filePath = path.join(storeDir, file);
    const stats = fs.statSync(filePath);
    if (stats.isFile()) {
      totalSize += stats.size;
      fileInfo.push({ name: file, size: stats.size });
    }
  }

  console.log(chalk.white(`  📁 Location: ${storeDir}`));
  console.log(chalk.white(`  📊 Total size: ${formatBytes(totalSize)}`));
  console.log('');

  // Show file breakdown
  console.log(chalk.gray('  Files:'));
  for (const file of fileInfo) {
    console.log(chalk.gray(`    ${file.name}: ${formatBytes(file.size)}`));
  }
  console.log('');

  // Show store details if timeline.json exists
  const storePath = getStorePath(repo);
  if (fs.existsSync(storePath)) {
    try {
      const store = loadStore(repo);
      console.log(chalk.white('  📈 Timeline data:'));
      console.log(chalk.gray(`    Sessions: ${store.sessions.length}`));
      console.log(chalk.gray(`    Insights: ${store.insights.length}`));
      console.log(chalk.gray(`    Last updated: ${store.lastUpdated}`));
      console.log(chalk.gray(`    Last commit: ${store.lastCommitHash || 'none'}`));

      if (store.sessions.length > 0) {
        const dates = store.sessions.map(s => s.date).sort();
        console.log(chalk.gray(`    Date range: ${dates[0]} to ${dates[dates.length - 1]}`));
      }
    } catch {
      console.log(chalk.yellow('  ⚠ Could not read timeline data'));
    }
  }

  // Check .gitignore status
  console.log('');
  const gitignorePath = path.join(repo, '.gitignore');
  if (fs.existsSync(gitignorePath)) {
    const gitignore = fs.readFileSync(gitignorePath, 'utf-8');
    if (gitignore.includes('.vibe-check')) {
      console.log(chalk.green('  ✓ .vibe-check/ is in .gitignore'));
    } else {
      console.log(chalk.yellow('  ⚠ .vibe-check/ is NOT in .gitignore'));
      console.log(chalk.gray('    Add ".vibe-check/" to .gitignore to avoid committing cache'));
    }
  } else {
    console.log(chalk.yellow('  ⚠ No .gitignore file found'));
  }

  console.log('');
}

async function clearCache(options: CacheOptions, force: boolean): Promise<void> {
  const { repo } = options;
  const storeDir = getStoreDir(repo);

  if (!fs.existsSync(storeDir)) {
    console.log(chalk.yellow('No cache to clear.'));
    return;
  }

  if (!force) {
    // Show what will be deleted
    const files = fs.readdirSync(storeDir);
    console.log('');
    console.log(chalk.yellow('The following files will be deleted:'));
    for (const file of files) {
      console.log(chalk.gray(`  - ${file}`));
    }
    console.log('');
    console.log(chalk.yellow('Run with --force to confirm deletion.'));
    return;
  }

  // Delete all files in .vibe-check/
  const files = fs.readdirSync(storeDir);
  for (const file of files) {
    const filePath = path.join(storeDir, file);
    fs.unlinkSync(filePath);
  }

  // Remove directory
  fs.rmdirSync(storeDir);

  console.log(chalk.green('✓ Cache cleared successfully.'));
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
```

**Validation:**
```bash
npm run build
npm run dev -- cache status
npm run dev -- cache clear
```

---

## Files to Modify

### 1. `src/storage/timeline-store.ts:139`

**Purpose:** Use CURRENT_SCHEMA_VERSION instead of hardcoded '1.0.0'

**Before:**
```typescript
export function createInitialStore(): TimelineStore {
  return {
    version: '1.0.0',
```

**After:**
```typescript
import { CURRENT_SCHEMA_VERSION } from './schema';

// ... (in createInitialStore)
export function createInitialStore(): TimelineStore {
  return {
    version: CURRENT_SCHEMA_VERSION,
```

**Reason:** Schema versioning exists but isn't used correctly
**Validation:** `npm run build`

---

### 2. `src/storage/timeline-store.ts:1-8` (add import)

**Purpose:** Import CURRENT_SCHEMA_VERSION

**Before:**
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
import { CURRENT_SCHEMA_VERSION } from './schema';
```

**Reason:** Need schema version constant
**Validation:** `npm run build`

---

### 3. `src/storage/atomic.ts:47-56`

**Purpose:** Improve NDJSON error handling - skip bad lines instead of failing

**Before:**
```typescript
export function readNdjsonSync<T>(filePath: string): T[] {
  if (!fs.existsSync(filePath)) {
    return [];
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n').filter(line => line.trim().length > 0);

  return lines.map(line => JSON.parse(line) as T);
}
```

**After:**
```typescript
export function readNdjsonSync<T>(filePath: string): T[] {
  if (!fs.existsSync(filePath)) {
    return [];
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n').filter(line => line.trim().length > 0);

  const results: T[] = [];
  for (const line of lines) {
    try {
      results.push(JSON.parse(line) as T);
    } catch {
      // Skip malformed lines instead of failing entire file
      console.warn(`Warning: Skipping malformed NDJSON line: ${line.substring(0, 50)}...`);
    }
  }
  return results;
}
```

**Reason:** One bad line shouldn't corrupt entire file read
**Validation:** `npm run build`

---

### 4. `src/commands/index.ts`

**Purpose:** Export cache command

**Before:**
```typescript
export { createAnalyzeCommand, runAnalyze, AnalyzeOptions } from './analyze';
export { createStartCommand } from './start';
export { createProfileCommand } from './profile';
export { createInitHookCommand } from './init-hook';
export { createWatchCommand } from './watch';
export { createInterveneCommand } from './intervene';
export { createTimelineCommand, runTimeline, TimelineOptions } from './timeline';
```

**After:**
```typescript
export { createAnalyzeCommand, runAnalyze, AnalyzeOptions } from './analyze';
export { createStartCommand } from './start';
export { createProfileCommand } from './profile';
export { createInitHookCommand } from './init-hook';
export { createWatchCommand } from './watch';
export { createInterveneCommand } from './intervene';
export { createTimelineCommand, runTimeline, TimelineOptions } from './timeline';
export { createCacheCommand } from './cache';
```

**Reason:** Register new cache command
**Validation:** `npm run build`

---

### 5. `src/cli.ts:4`

**Purpose:** Import cache command

**Before:**
```typescript
import { createAnalyzeCommand, createStartCommand, createProfileCommand, createInitHookCommand, createWatchCommand, createInterveneCommand, createTimelineCommand, runAnalyze } from './commands';
```

**After:**
```typescript
import { createAnalyzeCommand, createStartCommand, createProfileCommand, createInitHookCommand, createWatchCommand, createInterveneCommand, createTimelineCommand, createCacheCommand, runAnalyze } from './commands';
```

**Reason:** Import new command
**Validation:** `npm run build`

---

### 6. `src/cli.ts:25` (add command registration)

**Purpose:** Register cache command with CLI

**Before:**
```typescript
program.addCommand(createTimelineCommand());

// Default behavior: if no subcommand, run analyze with passed options
```

**After:**
```typescript
program.addCommand(createTimelineCommand());
program.addCommand(createCacheCommand());

// Default behavior: if no subcommand, run analyze with passed options
```

**Reason:** Make cache command available
**Validation:** `npm run dev -- cache --help`

---

### 7. `src/commands/timeline.ts:43-52`

**Purpose:** Improve help text for --no-cache and --insights flags

**Before:**
```typescript
export function createTimelineCommand(): Command {
  const cmd = new Command('timeline')
    .description('View your coding journey as a timeline with sessions and patterns')
    .option('--since <date>', 'Start date for analysis (default: "1 week ago")', '1 week ago')
    .option('--until <date>', 'End date for analysis (default: now)')
    .option('-f, --format <type>', 'Output format: terminal, json, markdown, html', 'terminal')
    .option('-r, --repo <path>', 'Repository path', process.cwd())
    .option('-v, --verbose', 'Show verbose output', false)
    .option('--expand [date]', 'Expand day details (all or specific date like "Nov-29")')
    .option('--no-cache', 'Skip cache and fetch fresh data from git')
    .option('--insights', 'Show compounding insights from historical data')
```

**After:**
```typescript
export function createTimelineCommand(): Command {
  const cmd = new Command('timeline')
    .description('View your coding journey as a timeline with sessions and patterns')
    .option('--since <date>', 'Start date for analysis (default: "1 week ago")', '1 week ago')
    .option('--until <date>', 'End date for analysis (default: now)')
    .option('-f, --format <type>', 'Output format: terminal, json, markdown, html', 'terminal')
    .option('-r, --repo <path>', 'Repository path', process.cwd())
    .option('-v, --verbose', 'Show verbose output', false)
    .option('--expand [date]', 'Expand day details (all or specific date like "Nov-29")')
    .option('--no-cache', 'Force fresh git analysis (bypass .vibe-check/ cache)')
    .option('--insights', 'Show compounding insights (patterns detected over 3+ sessions)')
```

**Reason:** Better documentation of features
**Validation:** `npm run dev -- timeline --help`

---

## Implementation Order

**CRITICAL: Sequence matters. Do not reorder.**

| Step | Action | Validation | Rollback |
|------|--------|------------|----------|
| 1 | Modify `timeline-store.ts` imports | `npm run build` | Revert |
| 2 | Fix schema version in `createInitialStore` | `npm run build` | Revert |
| 3 | Improve NDJSON error handling in `atomic.ts` | `npm run build` | Revert |
| 4 | Create `src/commands/cache.ts` | `npm run build` | Delete |
| 5 | Update `src/commands/index.ts` exports | `npm run build` | Revert |
| 6 | Update `src/cli.ts` imports | `npm run build` | Revert |
| 7 | Register cache command in `cli.ts` | `npm run build` | Revert |
| 8 | Improve timeline help text | `npm run build` | Revert |
| 9 | Run full test suite | `npm test` | Revert all |
| 10 | Manual test cache commands | See below | Revert all |

---

## Validation Strategy

### Syntax Validation
```bash
npm run build
# Expected: No errors
```

### Unit Tests
```bash
npm test
# Expected: All 26 tests pass
```

### Manual Integration Tests
```bash
# Test cache status
npm run dev -- cache status
# Expected: Shows cache info or "no cache"

# Test cache status with existing cache
npm run dev -- timeline --since "1 week ago"
npm run dev -- cache status
# Expected: Shows sessions count, file sizes, date range

# Test cache clear (dry run)
npm run dev -- cache clear
# Expected: Lists files that would be deleted, asks for --force

# Test cache clear (actual)
npm run dev -- cache clear --force
# Expected: "Cache cleared successfully"
npm run dev -- cache status
# Expected: "No cache directory found"

# Test timeline help
npm run dev -- timeline --help
# Expected: Shows improved descriptions for --no-cache and --insights
```

---

## Rollback Procedure

**Time to rollback:** ~2 minutes

### Full Rollback
```bash
# Step 1: Revert all modifications
git checkout src/storage/timeline-store.ts
git checkout src/storage/atomic.ts
git checkout src/commands/index.ts
git checkout src/commands/timeline.ts
git checkout src/cli.ts

# Step 2: Remove new file
rm -f src/commands/cache.ts

# Step 3: Verify
npm run build
npm test
```

---

## Failure Pattern Risks

| Pattern | Risk | Prevention in Plan |
|---------|------|-------------------|
| Tests Passing Lie | LOW | Manual cache command tests |
| Instruction Drift | LOW | Precise file:line specs |
| Bridge Torching | LOW | Backward compatible changes |

---

## Risk Assessment

### Low Risk: Import Ordering
- **What:** Circular imports
- **Mitigation:** New cache.ts imports from storage (same as other commands)
- **Detection:** Build fails
- **Recovery:** Fix import order

### Low Risk: fs operations
- **What:** Permission errors on cache clear
- **Mitigation:** Only operates on .vibe-check/ we created
- **Detection:** Error message
- **Recovery:** User fixes permissions manually

---

## Approval Checklist

**Human must verify before /implement:**

- [ ] Every file specified precisely (file:line)
- [ ] All templates complete (no placeholders)
- [ ] Validation commands provided
- [ ] Rollback procedure complete
- [ ] Implementation order is correct
- [ ] Risks identified and mitigated
- [ ] Cache command is additive (no breaking changes)

---

## Next Step

Once approved: `/implement storage-hardening-and-cache-plan.md`

---

## Future Work (Not in This Plan)

1. **Cross-session queries** - `vibe-check analyze --all-time`
2. **Scope analysis** - `vibe-check analyze --scope auth`
3. **Regression detection** - Alert when spirals return
4. **Intervention effectiveness** - Score what breaks spirals
