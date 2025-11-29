export type Rating = 'elite' | 'high' | 'medium' | 'low';
export type OutputFormat = 'terminal' | 'json' | 'markdown';
export type OverallRating = 'ELITE' | 'HIGH' | 'MEDIUM' | 'LOW';

export interface Commit {
  hash: string;
  date: Date;
  message: string;
  type: 'feat' | 'fix' | 'docs' | 'chore' | 'refactor' | 'test' | 'style' | 'other';
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

export interface CliOptions {
  since?: string;
  until?: string;
  format: OutputFormat;
  repo: string;
  verbose: boolean;
  score?: boolean;
}

// ============================================
// SEMANTIC-FREE METRICS (v2.0.0)
// ============================================

export interface FileChurnResult extends MetricResult {
  churnedFiles: number;
  totalFiles: number;
}

export interface TimeSpiralResult extends MetricResult {
  spiralCommits: number;
  totalCommits: number;
}

export interface VelocityAnomalyResult extends MetricResult {
  currentVelocity: number;
  baselineMean: number;
  baselineStdDev: number;
  zScore: number;
}

export interface CodeStabilityResult extends MetricResult {
  linesAdded: number;
  linesSurviving: number;
}

export interface VibeScore {
  value: number;           // 0.0 - 1.0
  components: {
    fileChurn: number;
    timeSpiral: number;
    velocityAnomaly: number;
    codeStability: number;
  };
  weights: {
    fileChurn: number;
    timeSpiral: number;
    velocityAnomaly: number;
    codeStability: number;
  };
}

export interface VibeCheckResultV2 extends VibeCheckResult {
  vibeScore?: VibeScore;
  semanticMetrics: {
    iterationVelocity: MetricResult;
    reworkRatio: MetricResult;
    trustPassRate: MetricResult;
    debugSpiralDuration: MetricResult;
    flowEfficiency: MetricResult;
  };
  semanticFreeMetrics?: {
    fileChurn: FileChurnResult;
    timeSpiral: TimeSpiralResult;
    velocityAnomaly: VelocityAnomalyResult;
    codeStability: CodeStabilityResult;
  };
}
