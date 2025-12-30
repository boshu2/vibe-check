export type Rating = 'elite' | 'high' | 'medium' | 'low';
export type OutputFormat = 'terminal' | 'json' | 'markdown';
export type OverallRating = 'ELITE' | 'HIGH' | 'MEDIUM' | 'LOW';

export interface Commit {
  hash: string;
  date: Date;
  message: string;
  type: 'feat' | 'fix' | 'docs' | 'chore' | 'refactor' | 'test' | 'style' | 'tracer' | 'other';
  scope: string | null;
  author: string;
}

export interface MetricResult {
  value: number;
  unit: string;
  rating: Rating;
  description: string;
}

export interface FixChain {
  component: string;
  commits: number;
  duration: number; // minutes
  isSpiral: boolean;
  pattern: string | null;
  firstCommit: Date;
  lastCommit: Date;
}

export interface PatternSummary {
  categories: Record<string, number>;
  total: number;
  tracerAvailable: number;
}

export interface VibeCheckResult {
  period: {
    from: Date;
    to: Date;
    activeHours: number;
  };
  commits: {
    total: number;
    feat: number;
    fix: number;
    docs: number;
    tracer: number;
    other: number;
  };
  metrics: {
    iterationVelocity: MetricResult;
    reworkRatio: MetricResult;
    trustPassRate: MetricResult;
    debugSpiralDuration: MetricResult;
    flowEfficiency: MetricResult;
  };
  fixChains: FixChain[];
  patterns: PatternSummary;
  overall: OverallRating;
}

/**
 * Extended result with semantic metrics alias for output formatting
 */
export interface VibeCheckResultV2 extends VibeCheckResult {
  semanticMetrics: VibeCheckResult['metrics'];
}

/**
 * Timeline event for inner-loop analysis
 */
export interface TimelineEvent {
  hash: string;
  timestamp: Date;
  author: string;
  subject: string;
  type: Commit['type'];
  scope: string | null;
}

// ============================================
// ERROR TYPES (re-exported from errors.ts)
// ============================================

export {
  ExitCode,
  ErrorCode,
  VibeCheckError,
  GitError,
  ValidationError,
  ConfigError,
  AnalysisError,
  isVibeCheckError,
  isGitError,
  isValidationError,
  isConfigError,
  isAnalysisError,
  getExitCode,
  getErrorCode,
  formatError,
  wrapError,
} from './errors.js';
