/**
 * Custom error classes for vibe-check CLI
 *
 * Error hierarchy:
 *   VibeCheckError (base)
 *   ├── GitError (git operations)
 *   ├── ValidationError (input/option validation)
 *   ├── ConfigError (configuration issues)
 *   └── AnalysisError (metrics calculation)
 *
 * Exit codes:
 *   0: Success
 *   1: General error (analysis shows LOW rating)
 *   2: Git error (not a repo, git command failed)
 *   3: Validation error (invalid options, bad input)
 *   5: Config error (invalid configuration)
 *   6: Analysis error (metrics calculation failed)
 */

export enum ExitCode {
  SUCCESS = 0,
  GENERAL_ERROR = 1,
  GIT_ERROR = 2,
  VALIDATION_ERROR = 3,
  CONFIG_ERROR = 5,
  ANALYSIS_ERROR = 6,
}

/**
 * Granular error codes for programmatic error handling.
 */
export enum ErrorCode {
  // Git errors
  GIT_NOT_A_REPO = 'GIT_NOT_A_REPO',
  GIT_LOG_FAILED = 'GIT_LOG_FAILED',
  GIT_COMMIT_NOT_FOUND = 'GIT_COMMIT_NOT_FOUND',
  GIT_DIFF_FAILED = 'GIT_DIFF_FAILED',

  // Validation errors
  VALIDATION_INVALID_FORMAT = 'VALIDATION_INVALID_FORMAT',
  VALIDATION_INVALID_DATE_RANGE = 'VALIDATION_INVALID_DATE_RANGE',
  VALIDATION_MISSING_REQUIRED = 'VALIDATION_MISSING_REQUIRED',
  VALIDATION_INVALID_OPTION = 'VALIDATION_INVALID_OPTION',

  // Config errors
  CONFIG_INVALID = 'CONFIG_INVALID',

  // Analysis errors
  ANALYSIS_NO_COMMITS = 'ANALYSIS_NO_COMMITS',
  ANALYSIS_INSUFFICIENT_DATA = 'ANALYSIS_INSUFFICIENT_DATA',
  ANALYSIS_CALCULATION_FAILED = 'ANALYSIS_CALCULATION_FAILED',

  // General errors
  GENERAL_UNKNOWN = 'GENERAL_UNKNOWN',
}

/**
 * Base error class for all vibe-check errors.
 */
export class VibeCheckError extends Error {
  public readonly exitCode: ExitCode;
  public readonly errorCode: ErrorCode;
  public readonly context: Record<string, unknown>;

  /** @deprecated Use exitCode instead */
  public get code(): ExitCode {
    return this.exitCode;
  }

  constructor(
    message: string,
    exitCode: ExitCode = ExitCode.GENERAL_ERROR,
    errorCode: ErrorCode = ErrorCode.GENERAL_UNKNOWN,
    context: Record<string, unknown> = {}
  ) {
    super(message);
    this.name = 'VibeCheckError';
    this.exitCode = exitCode;
    this.errorCode = errorCode;
    this.context = context;

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  toJSON(): Record<string, unknown> {
    return {
      error: this.name,
      message: this.message,
      exitCode: this.exitCode,
      errorCode: this.errorCode,
      ...this.context,
    };
  }
}

/**
 * Error thrown when git operations fail.
 */
export class GitError extends VibeCheckError {
  constructor(
    message: string,
    errorCode: ErrorCode = ErrorCode.GIT_LOG_FAILED,
    context: Record<string, unknown> = {}
  ) {
    super(message, ExitCode.GIT_ERROR, errorCode, context);
    this.name = 'GitError';
  }

  static notARepo(path: string): GitError {
    return new GitError(
      `Not a git repository: ${path}`,
      ErrorCode.GIT_NOT_A_REPO,
      { path }
    );
  }

  static logFailed(reason: string): GitError {
    return new GitError(
      `Failed to read git log: ${reason}`,
      ErrorCode.GIT_LOG_FAILED,
      { reason }
    );
  }
}

/**
 * Error thrown when input validation fails.
 */
export class ValidationError extends VibeCheckError {
  constructor(
    message: string,
    errorCode: ErrorCode = ErrorCode.VALIDATION_INVALID_OPTION,
    context: Record<string, unknown> = {}
  ) {
    super(message, ExitCode.VALIDATION_ERROR, errorCode, context);
    this.name = 'ValidationError';
  }

  static invalidFormat(format: string, validFormats: string[]): ValidationError {
    return new ValidationError(
      `Invalid format: ${format}. Valid formats: ${validFormats.join(', ')}`,
      ErrorCode.VALIDATION_INVALID_FORMAT,
      { format, validFormats }
    );
  }

  static invalidDateRange(since?: string, until?: string): ValidationError {
    return new ValidationError(
      `Invalid date range: since="${since}" until="${until}"`,
      ErrorCode.VALIDATION_INVALID_DATE_RANGE,
      { since, until }
    );
  }

  static missingRequired(option: string): ValidationError {
    return new ValidationError(
      `Missing required option: ${option}`,
      ErrorCode.VALIDATION_MISSING_REQUIRED,
      { option }
    );
  }

  static invalidOption(option: string, value: unknown, reason: string): ValidationError {
    return new ValidationError(
      `Invalid value for ${option}: ${reason}`,
      ErrorCode.VALIDATION_INVALID_OPTION,
      { option, value, reason }
    );
  }
}

/**
 * Error thrown when configuration is invalid.
 */
export class ConfigError extends VibeCheckError {
  constructor(
    message: string,
    errorCode: ErrorCode = ErrorCode.CONFIG_INVALID,
    context: Record<string, unknown> = {}
  ) {
    super(message, ExitCode.CONFIG_ERROR, errorCode, context);
    this.name = 'ConfigError';
  }

  static invalidConfig(path: string, reason: string): ConfigError {
    return new ConfigError(
      `Invalid configuration in ${path}: ${reason}`,
      ErrorCode.CONFIG_INVALID,
      { path, reason }
    );
  }
}

/**
 * Error thrown when analysis/metrics calculation fails.
 */
export class AnalysisError extends VibeCheckError {
  constructor(
    message: string,
    errorCode: ErrorCode = ErrorCode.ANALYSIS_CALCULATION_FAILED,
    context: Record<string, unknown> = {}
  ) {
    super(message, ExitCode.ANALYSIS_ERROR, errorCode, context);
    this.name = 'AnalysisError';
  }

  static noCommits(since?: string, until?: string): AnalysisError {
    return new AnalysisError(
      'No commits found in the specified range',
      ErrorCode.ANALYSIS_NO_COMMITS,
      { since, until }
    );
  }

  static insufficientData(required: number, actual: number): AnalysisError {
    return new AnalysisError(
      `Insufficient data: need ${required} commits, found ${actual}`,
      ErrorCode.ANALYSIS_INSUFFICIENT_DATA,
      { required, actual }
    );
  }

  static calculationFailed(metric: string, reason: string): AnalysisError {
    return new AnalysisError(
      `Failed to calculate ${metric}: ${reason}`,
      ErrorCode.ANALYSIS_CALCULATION_FAILED,
      { metric, reason }
    );
  }
}

// Type guards
export function isVibeCheckError(error: unknown): error is VibeCheckError {
  return error instanceof VibeCheckError;
}

export function isGitError(error: unknown): error is GitError {
  return error instanceof GitError;
}

export function isValidationError(error: unknown): error is ValidationError {
  return error instanceof ValidationError;
}

export function isConfigError(error: unknown): error is ConfigError {
  return error instanceof ConfigError;
}

export function isAnalysisError(error: unknown): error is AnalysisError {
  return error instanceof AnalysisError;
}

// Utility functions
export function getExitCode(error: unknown): ExitCode {
  if (isVibeCheckError(error)) {
    return error.exitCode;
  }
  return ExitCode.GENERAL_ERROR;
}

export function getErrorCode(error: unknown): ErrorCode {
  if (isVibeCheckError(error)) {
    return error.errorCode;
  }
  return ErrorCode.GENERAL_UNKNOWN;
}

export function formatError(error: unknown, verbose = false): string {
  if (isVibeCheckError(error)) {
    const base = verbose
      ? `[${error.errorCode}] ${error.message}`
      : error.message;

    if (verbose && error.stack) {
      return `${base}\n${error.stack}`;
    }
    return base;
  }

  if (error instanceof Error) {
    if (verbose && error.stack) {
      return `${error.message}\n${error.stack}`;
    }
    return error.message;
  }

  return String(error);
}

export function wrapError(
  error: unknown,
  exitCode: ExitCode = ExitCode.GENERAL_ERROR,
  errorCode: ErrorCode = ErrorCode.GENERAL_UNKNOWN
): VibeCheckError {
  if (isVibeCheckError(error)) {
    return error;
  }

  if (error instanceof Error) {
    return new VibeCheckError(error.message, exitCode, errorCode, {
      originalError: error.name,
      stack: error.stack,
    });
  }

  return new VibeCheckError(String(error), exitCode, errorCode);
}
