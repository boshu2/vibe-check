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
} from './timeline-store.js';

// Atomic file operations
export {
  atomicWriteSync,
  appendLineSync,
  readNdjsonSync,
  readNdjsonWithErrors,
  safeReadJsonSync,
  ensureGitignore,
  NdjsonReadResult,
} from './atomic.js';

// Commit log (NDJSON source of truth)
export {
  StoredCommit,
  getCommitLogPath,
  appendCommits,
  readCommitLog,
  getLastLoggedCommitHash,
  getCommitLogCount,
} from './commit-log.js';

// Schema versioning
export {
  SchemaVersion,
  CURRENT_SCHEMA_VERSION,
  VersionedStore,
  migrateStore,
  needsMigration,
} from './schema.js';

// Spiral history (coaching feature)
export {
  SpiralRecord,
  SpiralResolution,
  SpiralAdvice,
  getSpiralHistoryPath,
  appendSpiral,
  resolveSpiral,
  readSpiralHistory,
  getAdvice,
  getPatternStats,
  getPatternDisplayName,
  getResolutionDisplayName,
} from './spiral-history.js';
