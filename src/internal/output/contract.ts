/**
 * Standardized Output Contract
 *
 * All commands should use this format when --json is set.
 * This provides consistent structure for agent consumption:
 * - success: boolean indicating command success
 * - data: the actual command output (type varies by command)
 * - metadata: command context (name, timestamp, version)
 * - error: optional error message if success is false
 *
 * Usage:
 *   import { wrapOutput, outputJson } from '@/internal/output/contract';
 *
 *   // In command:
 *   const result = { spiraling: false, ... };
 *   outputJson(wrapOutput('spiral', result));
 */

import { getContext, hasContext } from '../context/index.js';

/**
 * Standard metadata included in all outputs
 */
export interface OutputMetadata {
  command: string;
  timestamp: string;
  version: string;
  repo?: string;
}

/**
 * Standard output contract for all commands
 */
export interface CommandOutput<T> {
  success: boolean;
  data: T;
  metadata: OutputMetadata;
  error?: string;
}

/**
 * Wrap command output in the standard contract format
 *
 * @param command - The command name (e.g., 'spiral', 'diagnose')
 * @param data - The command's output data
 * @param error - Optional error message (sets success to false)
 * @returns Wrapped output in standard format
 */
export function wrapOutput<T>(
  command: string,
  data: T,
  error?: string
): CommandOutput<T> {
  let version = '0.0.0';
  let repo: string | undefined;

  try {
    if (hasContext()) {
      const ctx = getContext();
      version = ctx.version;
      repo = ctx.repo;
    }
  } catch {
    // Context not available
  }

  return {
    success: !error,
    data,
    metadata: {
      command,
      timestamp: new Date().toISOString(),
      version,
      repo,
    },
    error,
  };
}

/**
 * Create an error output in standard format
 *
 * @param command - The command name
 * @param error - The error message
 * @param partialData - Optional partial data to include
 * @returns Error output in standard format
 */
export function wrapError<T>(
  command: string,
  error: string,
  partialData?: Partial<T>
): CommandOutput<Partial<T> | null> {
  return wrapOutput(command, partialData || null, error);
}

/**
 * Output JSON to stdout in standard format
 *
 * @param output - The wrapped command output
 * @param pretty - Whether to pretty-print (default: true)
 */
export function outputJson<T>(output: CommandOutput<T>, pretty = true): void {
  if (pretty) {
    console.log(JSON.stringify(output, null, 2));
  } else {
    console.log(JSON.stringify(output));
  }
}

/**
 * Check if we should use standard contract output
 *
 * Returns true if:
 * - Global --json flag is set
 * - Context is initialized with json output mode
 */
export function shouldUseContract(): boolean {
  try {
    if (hasContext()) {
      const ctx = getContext();
      return ctx.outputMode === 'json';
    }
  } catch {
    // Context not available
  }
  return false;
}

/**
 * Higher-order function to wrap command output in contract
 *
 * Usage:
 *   const result = await runSpiral(options);
 *   withContract('spiral', result); // Outputs wrapped if --json
 *
 * @param command - The command name
 * @param data - The command's output data
 * @param error - Optional error message
 */
export function withContract<T>(
  command: string,
  data: T,
  error?: string
): void {
  if (shouldUseContract()) {
    outputJson(wrapOutput(command, data, error));
  }
}
