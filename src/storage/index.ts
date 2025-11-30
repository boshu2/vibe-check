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
