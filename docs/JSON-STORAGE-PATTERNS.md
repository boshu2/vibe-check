# JSON Storage Patterns for CLI Tools

## Overview

JSON is an excellent choice for CLI tool storage when done right. This document covers the patterns, anti-patterns, and best practices for building a robust JSON-based data layer.

---

## Why JSON for CLI Tools?

| Advantage | Description |
|-----------|-------------|
| **Zero dependencies** | No database drivers to install |
| **Git-friendly** | Diffable, mergeable, human-readable |
| **Portable** | Works on any platform with Node.js |
| **Debuggable** | Open in any editor to inspect |
| **Offline-first** | No network required |
| **Embeddable** | Easy to include in reports/exports |

---

## The 5 JSON Storage Patterns

### Pattern 1: Single Document Store

**When to use:** Small datasets (<1MB), simple read/write patterns

```
.vibe-check/
└── data.json          # Everything in one file
```

```typescript
interface Store {
  version: string;
  lastUpdated: string;
  data: Record<string, unknown>;
}

// Read
const store = JSON.parse(fs.readFileSync('data.json', 'utf-8'));

// Write (atomic)
fs.writeFileSync('data.json', JSON.stringify(store, null, 2));
```

**Pros:** Simple, atomic writes
**Cons:** Load entire file for any operation

---

### Pattern 2: Collection Files

**When to use:** Multiple entity types, need to load subsets

```
.vibe-check/
├── sessions.json      # TimelineSession[]
├── insights.json      # StoredInsight[]
├── profile.json       # User profile
└── settings.json      # Configuration
```

```typescript
// Load only what you need
const sessions = JSON.parse(fs.readFileSync('sessions.json', 'utf-8'));

// Update single collection
fs.writeFileSync('sessions.json', JSON.stringify(sessions, null, 2));
```

**Pros:** Selective loading, smaller writes
**Cons:** No cross-file transactions

---

### Pattern 3: NDJSON (Newline Delimited JSON)

**When to use:** Append-only logs, streaming data, large datasets

```
.vibe-check/
└── commits.ndjson     # One JSON object per line
```

```jsonl
{"hash":"abc1234","date":"2025-11-30T10:00:00Z","type":"feat"}
{"hash":"def5678","date":"2025-11-30T10:15:00Z","type":"fix"}
{"hash":"ghi9012","date":"2025-11-30T10:30:00Z","type":"feat"}
```

```typescript
// Append (fast, no parse)
fs.appendFileSync('commits.ndjson', JSON.stringify(commit) + '\n');

// Read (stream for large files)
const lines = fs.readFileSync('commits.ndjson', 'utf-8').split('\n');
const commits = lines.filter(l => l).map(l => JSON.parse(l));

// Tail (last N entries)
// Use readline or stream for efficiency
```

**Pros:**
- O(1) appends
- Git diffs show only new lines
- Streamable for large files
- Natural event sourcing

**Cons:**
- No random access by key
- Need to read entire file for queries

---

### Pattern 4: Directory-per-Entity

**When to use:** Large individual records, need direct access by ID

```
.vibe-check/
├── sessions/
│   ├── 2025-11-28.json
│   ├── 2025-11-29.json
│   └── 2025-11-30.json
├── insights/
│   ├── late-night-pattern.json
│   └── peak-flow-hour.json
└── index.json         # Metadata, pointers
```

```typescript
// Load specific day
const daySessions = JSON.parse(
  fs.readFileSync(`sessions/${date}.json`, 'utf-8')
);

// List all days
const days = fs.readdirSync('sessions').map(f => f.replace('.json', ''));
```

**Pros:**
- Fast access by key
- Parallel writes to different files
- Natural sharding

**Cons:**
- More filesystem overhead
- Need index for queries

---

### Pattern 5: Hybrid (Index + Data)

**When to use:** Need both queries and detail access

```
.vibe-check/
├── index.json         # Lightweight index for queries
├── sessions.ndjson    # Full session data (append-only)
└── cache/
    ├── weekly/        # Precomputed aggregates
    └── monthly/
```

```typescript
// index.json - small, frequently updated
interface Index {
  sessionCount: number;
  dateRange: { from: string; to: string };
  sessionIndex: {
    id: string;
    date: string;
    rating: string;
    lineOffset: number;  // Pointer into sessions.ndjson
  }[];
}

// Query the index
const eliteSessions = index.sessionIndex.filter(s => s.rating === 'ELITE');

// Load full session data only when needed
const session = readNdjsonLine('sessions.ndjson', offset);
```

**Pros:**
- Fast queries via index
- Full data accessible
- Scales well

**Cons:**
- Index must stay in sync
- More complex implementation

---

## Best Practices

### 1. Atomic Writes

Never write directly to the target file. Use write-rename pattern:

```typescript
import { writeFileSync, renameSync } from 'fs';
import { randomBytes } from 'crypto';

function atomicWrite(path: string, data: string): void {
  const tempPath = `${path}.${randomBytes(6).toString('hex')}.tmp`;
  writeFileSync(tempPath, data, 'utf-8');
  renameSync(tempPath, path);  // Atomic on POSIX
}
```

### 2. Schema Versioning

Always include version for migrations:

```typescript
interface Store {
  version: '1.0.0' | '1.1.0' | '2.0.0';  // Explicit versions
  // ...data
}

function migrateStore(store: Store): Store {
  if (store.version === '1.0.0') {
    // Migrate to 1.1.0
    store = migrateV1ToV1_1(store);
  }
  if (store.version === '1.1.0') {
    // Migrate to 2.0.0
    store = migrateV1_1ToV2(store);
  }
  return store;
}
```

### 3. Bounded Growth

Set limits to prevent unbounded file growth:

```typescript
const MAX_SESSIONS = 500;      // ~1 year of daily coding
const MAX_INSIGHTS = 20;       // Top insights only
const MAX_WEEKS = 12;          // 3 months of weekly trends

function pruneStore(store: TimelineStore): TimelineStore {
  store.sessions = store.sessions.slice(-MAX_SESSIONS);
  store.insights = store.insights.slice(0, MAX_INSIGHTS);
  store.trends.weekly = store.trends.weekly.slice(-MAX_WEEKS);
  return store;
}
```

### 4. Deduplication

Prevent duplicate entries:

```typescript
function sessionExists(store: TimelineStore, commitHashes: string[]): boolean {
  const hashSet = new Set(commitHashes);

  for (const session of store.sessions) {
    // 80% overlap = duplicate
    const matchCount = session.commitHashes.filter(h => hashSet.has(h)).length;
    const overlapRatio = matchCount / Math.max(session.commitHashes.length, commitHashes.length);
    if (overlapRatio > 0.8) return true;
  }
  return false;
}
```

### 5. Incremental Sync

Track last known state for efficient updates:

```typescript
interface Store {
  lastCommitHash: string;  // Resume point
  lastUpdated: string;     // Timestamp
}

// Only fetch new commits
const newCommits = await getCommitsSince(repoPath, store.lastCommitHash);
```

### 6. Graceful Corruption Handling

Always handle parse failures:

```typescript
function loadStore(path: string): Store {
  if (!fs.existsSync(path)) {
    return createInitialStore();
  }

  try {
    const data = fs.readFileSync(path, 'utf-8');
    const store = JSON.parse(data);
    return migrateStore(store);
  } catch (error) {
    console.warn(`Warning: Could not parse ${path}, creating fresh store`);
    // Optionally backup corrupted file
    fs.renameSync(path, `${path}.corrupted.${Date.now()}`);
    return createInitialStore();
  }
}
```

### 7. Compression for Large Data

For large historical data:

```typescript
import { gzipSync, gunzipSync } from 'zlib';

// Write compressed
const data = JSON.stringify(store);
fs.writeFileSync('store.json.gz', gzipSync(data));

// Read compressed
const compressed = fs.readFileSync('store.json.gz');
const store = JSON.parse(gunzipSync(compressed).toString());
```

---

## Recommended Architecture for vibe-check

Based on the data patterns identified:

```
.vibe-check/
├── timeline.json          # Pattern 1: Single store for current state
│                          #   - Last 500 sessions (compressed)
│                          #   - Aggregated patterns/trends
│                          #   - Compounding insights
│
├── commits.ndjson         # Pattern 3: Append-only commit log
│                          #   - Raw commit data (source of truth)
│                          #   - Git-friendly diffs
│                          #   - Regenerate timeline.json if needed
│
├── profile.json           # Pattern 1: Single store for gamification
│                          #   - XP, streaks, achievements
│                          #   - Small, frequently updated
│
└── cache/                 # Pattern 4: Precomputed views
    ├── weekly/
    │   ├── 2025-W48.json
    │   └── 2025-W49.json
    └── monthly/
        ├── 2025-11.json
        └── 2025-10.json
```

### Data Flow

```
                    ┌─────────────────────┐
                    │      Git Log        │
                    └──────────┬──────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────┐
│                     commits.ndjson                            │
│                    (Append-Only Log)                          │
│                                                               │
│  {"hash":"abc","date":"...","type":"feat",...}               │
│  {"hash":"def","date":"...","type":"fix",...}                │
│  {"hash":"ghi","date":"...","type":"feat",...}               │
│                                                               │
│  ✓ Source of truth                                           │
│  ✓ Never modified, only appended                             │
│  ✓ Git diffs show only new commits                           │
└──────────────────────────────────────────────────────────────┘
                               │
                    Compute on demand
                               │
                               ▼
┌──────────────────────────────────────────────────────────────┐
│                     timeline.json                             │
│                    (Computed View)                            │
│                                                               │
│  {                                                            │
│    "version": "2.0.0",                                       │
│    "lastCommitHash": "ghi1234",                              │
│    "sessions": [...],    // Derived from commits.ndjson      │
│    "insights": [...],    // Aggregated patterns              │
│    "patterns": {...},    // Statistics                       │
│    "trends": {...}       // Time-series                      │
│  }                                                            │
│                                                               │
│  ✓ Regenerable from commits.ndjson                           │
│  ✓ Caches expensive computations                             │
│  ✓ Bounded size (500 sessions max)                           │
└──────────────────────────────────────────────────────────────┘
```

### Benefits of This Architecture

1. **Source of Truth Separation**
   - `commits.ndjson` = immutable log (append-only)
   - `timeline.json` = computed view (regenerable)

2. **Git-Friendly**
   - Appending to NDJSON shows clean diffs
   - Only new lines appear in git log

3. **Resilient**
   - If `timeline.json` corrupts, regenerate from commits
   - Append-only log is harder to corrupt

4. **Efficient**
   - Cache computations in `timeline.json`
   - Only recompute when commits change

5. **Queryable**
   - Load `timeline.json` for most queries
   - Stream `commits.ndjson` for historical analysis

---

## Implementation Checklist

- [ ] Migrate to NDJSON for raw commit storage
- [ ] Keep JSON for computed views
- [ ] Add atomic write helper
- [ ] Implement schema versioning
- [ ] Add corruption recovery
- [ ] Set bounded growth limits
- [ ] Add deduplication checks
- [ ] Track last sync point

---

## Anti-Patterns to Avoid

### 1. Reading Entire File for Small Updates
```typescript
// BAD: Parse entire file to append one item
const data = JSON.parse(fs.readFileSync('data.json'));
data.items.push(newItem);
fs.writeFileSync('data.json', JSON.stringify(data));

// GOOD: Use NDJSON for append-only data
fs.appendFileSync('data.ndjson', JSON.stringify(newItem) + '\n');
```

### 2. Storing Computed Values as Source of Truth
```typescript
// BAD: Store derived data without source
{ "trustPassRate": 85 }  // How was this calculated?

// GOOD: Store source data, compute on read
{ "fixCommits": 3, "totalCommits": 20 }  // Can verify: 17/20 = 85%
```

### 3. Unbounded Arrays
```typescript
// BAD: Array grows forever
sessions.push(newSession);

// GOOD: Bound the array
sessions.push(newSession);
sessions = sessions.slice(-MAX_SESSIONS);
```

### 4. No Version Field
```typescript
// BAD: No way to migrate
{ "data": [...] }

// GOOD: Always version
{ "version": "1.0.0", "data": [...] }
```

### 5. Timestamps as Keys
```typescript
// BAD: Collisions, hard to query
{ "2025-11-30T10:00:00Z": {...} }

// GOOD: Stable IDs with timestamp field
{ "id": "session-123", "timestamp": "2025-11-30T10:00:00Z", ... }
```

---

## Performance Characteristics

| Operation | Pattern 1 (Single) | Pattern 3 (NDJSON) | Pattern 5 (Hybrid) |
|-----------|-------------------|-------------------|-------------------|
| Read all | O(n) | O(n) | O(n) |
| Read one | O(n) | O(n) | O(1) with index |
| Append | O(n) rewrite | O(1) | O(1) + index update |
| Query | O(n) scan | O(n) scan | O(log n) with index |
| Delete | O(n) | O(n) rewrite | O(1) soft delete |
| File size | Compact | Larger (no dedup) | Medium |
| Git diff | Full file | New lines only | Index + new lines |

---

## Conclusion

For vibe-check:

1. **Use NDJSON** for the raw commit log (append-only, git-friendly)
2. **Use JSON** for computed views (sessions, insights, trends)
3. **Implement bounds** to prevent unbounded growth
4. **Version everything** for future migrations
5. **Separate source from derived** for resilience

This gives you the simplicity of JSON with the scalability patterns of event sourcing.
