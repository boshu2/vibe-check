/**
 * Atomic file operations for safe JSON storage
 */
import * as fs from 'fs';
import * as path from 'path';
import { randomBytes } from 'crypto';

const GITIGNORE_CONTENT = `# vibe-check local data
# This directory contains personal productivity data
# Do NOT commit to version control

*
!.gitignore
`;

/**
 * Ensure .gitignore exists in a directory.
 * Creates one if missing to prevent accidental commits.
 */
export function ensureGitignore(dir: string): void {
  const gitignorePath = path.join(dir, '.gitignore');

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  if (!fs.existsSync(gitignorePath)) {
    fs.writeFileSync(gitignorePath, GITIGNORE_CONTENT, 'utf-8');
  }
}

/**
 * Write data atomically using temp file + rename pattern.
 * This prevents corruption if the process is killed mid-write.
 */
export function atomicWriteSync(filePath: string, data: string): void {
  const dir = path.dirname(filePath);
  const tempPath = path.join(dir, `.${path.basename(filePath)}.${randomBytes(6).toString('hex')}.tmp`);

  // Ensure directory exists with .gitignore
  ensureGitignore(dir);

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

  // Ensure directory exists with .gitignore
  ensureGitignore(dir);

  // Append with newline
  fs.appendFileSync(filePath, line + '\n', 'utf-8');
}

/**
 * Result of reading NDJSON with error info
 */
export interface NdjsonReadResult<T> {
  items: T[];
  errors: number;
  total: number;
}

/**
 * Read NDJSON file and parse each line.
 * Returns empty array if file doesn't exist.
 * Skips malformed lines gracefully instead of failing.
 */
export function readNdjsonSync<T>(filePath: string): T[] {
  const result = readNdjsonWithErrors<T>(filePath);
  return result.items;
}

/**
 * Read NDJSON file with detailed error reporting.
 * Use this when you need to know about parse failures.
 */
export function readNdjsonWithErrors<T>(filePath: string): NdjsonReadResult<T> {
  if (!fs.existsSync(filePath)) {
    return { items: [], errors: 0, total: 0 };
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n').filter(line => line.trim().length > 0);

  const items: T[] = [];
  let errors = 0;

  for (const line of lines) {
    try {
      items.push(JSON.parse(line) as T);
    } catch {
      // Skip malformed lines - they may be from interrupted writes
      errors++;
    }
  }

  if (errors > 0) {
    console.warn(`Warning: Skipped ${errors}/${lines.length} malformed lines in ${filePath}`);
  }

  return { items, errors, total: lines.length };
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
