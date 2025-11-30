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
