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
