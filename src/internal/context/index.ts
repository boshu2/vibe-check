/**
 * Global CLI Context Module
 *
 * Manages shared state across all vibe-check commands.
 * This is the foundation for global hooks and cross-command coordination.
 *
 * Usage:
 *   import { createContext, getContext, setContext } from '@/internal/context';
 *
 *   // Create and set initial context
 *   const ctx = createContext({ repo: '/path/to/repo', verbose: true });
 *   setContext(ctx);
 *
 *   // Access context from anywhere
 *   const ctx = getContext();
 *   console.log(ctx.repo);
 */

import { existsSync } from 'fs';
import { join } from 'path';
import { CLIContext, CreateContextOptions, VibeCheckConfig } from './types.js';

// Export types
export * from './types.js';

/**
 * Default configuration values (minimal)
 */
const DEFAULT_CONFIG: Required<VibeCheckConfig> = {
  output: {
    format: 'terminal',
    simple: false,
    verbose: false,
    quiet: false,
  },
};

/**
 * Global context singleton
 * Initialized on first createContext() call or explicitly via setContext()
 */
let globalContext: CLIContext | null = null;

/**
 * Check if a directory is a git repository
 */
function isGitRepository(repoPath: string): boolean {
  try {
    const gitDir = join(repoPath, '.git');
    return existsSync(gitDir);
  } catch {
    return false;
  }
}

/**
 * Check if debug mode is enabled via environment variable
 */
function isDebugEnabled(): boolean {
  const debugEnv = process.env.DEBUG;
  return debugEnv === '1' || debugEnv === 'true' || debugEnv === 'vibe-check';
}

/**
 * Create a new CLI context with the given options
 *
 * Applies sensible defaults for any missing options.
 *
 * @param options - Context configuration options
 * @returns Fully initialized CLIContext
 */
export function createContext(options: CreateContextOptions = {}): CLIContext {
  const repo = options.repo ?? process.cwd();
  const isGitRepo = options.isGitRepo ?? isGitRepository(repo);

  // Use provided config or defaults (no file loading)
  const config = options.config ?? DEFAULT_CONFIG;

  // Apply config defaults to context options (CLI flags override config)
  // Debug mode: CLI flag takes precedence, then env var
  const debug = options.debug ?? isDebugEnabled();

  const context: CLIContext = {
    repo,
    outputMode: options.outputMode ?? (config.output?.format === 'json' ? 'json' : 'terminal'),
    verbose: options.verbose ?? config.output?.verbose ?? false,
    quiet: options.quiet ?? config.output?.quiet ?? false,
    debug,
    timeout: options.timeout,
    maxCommits: options.maxCommits,
    version: options.version ?? '0.0.0', // Will be overridden by CLI
    isGitRepo,
    config,
  };

  return context;
}

/**
 * Get the current global context
 *
 * @throws Error if context has not been initialized
 * @returns The global CLIContext
 */
export function getContext(): CLIContext {
  if (!globalContext) {
    throw new Error(
      'CLI context not initialized. Call createContext() or setContext() first.'
    );
  }
  return globalContext;
}

/**
 * Set the global context
 *
 * Used by hooks and the CLI bootstrap to establish global state.
 *
 * @param ctx - The context to set as global
 */
export function setContext(ctx: CLIContext): void {
  globalContext = ctx;
}

/**
 * Check if context has been initialized
 *
 * @returns true if context is available, false otherwise
 */
export function hasContext(): boolean {
  return globalContext !== null;
}

/**
 * Clear the global context
 *
 * Primarily used for testing or resetting state.
 */
export function clearContext(): void {
  globalContext = null;
}

/**
 * Debug logging utility
 *
 * Only logs when debug mode is enabled (--debug flag or DEBUG=1 env var).
 * Prefixes all output with [DEBUG] for easy filtering.
 *
 * @param ctx - CLI context (or just check ctx.debug)
 * @param args - Arguments to log (same as console.log)
 */
export function debugLog(ctx: CLIContext, ...args: unknown[]): void {
  if (ctx.debug) {
    console.log('[DEBUG]', ...args);
  }
}

/**
 * Debug logging utility that works without context
 *
 * Checks environment variable directly. Use when context is not available.
 *
 * @param args - Arguments to log (same as console.log)
 */
export function debugLogEnv(...args: unknown[]): void {
  if (isDebugEnabled()) {
    console.log('[DEBUG]', ...args);
  }
}
