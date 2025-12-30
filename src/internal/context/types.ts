/**
 * Global CLI Context Types
 *
 * This module defines the shared context available across all commands.
 * The context is initialized at CLI startup and can be accessed by hooks and commands.
 */

/**
 * Output configuration
 */
export interface OutputConfig {
  /** Default output format */
  format?: 'terminal' | 'json' | 'markdown';
  /** Use simple output by default */
  simple?: boolean;
  /** Enable verbose output by default */
  verbose?: boolean;
  /** Suppress non-essential output */
  quiet?: boolean;
}

/**
 * Minimal configuration for CLI context
 */
export interface VibeCheckConfig {
  /** Output preferences */
  output?: OutputConfig;
}

/**
 * Main CLI context interface
 *
 * Contains global state and configuration that persists across command execution:
 * - Repository information
 * - Output formatting preferences
 * - Verbosity settings
 * - CLI version
 */
export interface CLIContext {
  /** Repository path (absolute) */
  repo: string;

  /** Output format mode */
  outputMode: 'terminal' | 'json';

  /** Enable verbose logging */
  verbose: boolean;

  /** Suppress non-essential output */
  quiet: boolean;

  /** Enable debug logging (--debug flag or DEBUG=1 env var) */
  debug: boolean;

  /** Timeout for git operations in seconds */
  timeout?: number;

  /** Maximum number of commits to analyze */
  maxCommits?: number;

  /** CLI version */
  version: string;

  /** Whether the current directory is a git repository */
  isGitRepo: boolean;

  /** Loaded configuration (minimal) */
  config: Required<VibeCheckConfig>;
}

/**
 * Options for creating a new context
 *
 * All fields are optional - defaults will be applied.
 */
export interface CreateContextOptions {
  repo?: string;
  outputMode?: 'terminal' | 'json';
  verbose?: boolean;
  quiet?: boolean;
  debug?: boolean;
  timeout?: number;
  maxCommits?: number;
  version?: string;
  isGitRepo?: boolean;
  config?: Required<VibeCheckConfig>;
}
