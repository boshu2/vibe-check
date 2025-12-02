import { Command } from 'commander';
import chalk from 'chalk';
import * as fs from 'fs';
import * as path from 'path';
import { getCommits, isGitRepo, getFileStats } from '../git';
import { analyzeCommits } from '../metrics';
import { calculateFileChurn } from '../metrics/file-churn';
import { calculateTimeSpiral } from '../metrics/time-spiral';
import { calculateVelocityAnomaly } from '../metrics/velocity-anomaly';
import { calculateCodeStability } from '../metrics/code-stability';
import { calculateVibeScore } from '../score';
import { loadSessionHistory, compareToBaseline } from '../sessions';

// Session file stored in .vibe-check/active-session.json
const ACTIVE_SESSION_FILE = '.vibe-check/active-session.json';

export interface ActiveSession {
  id: string;
  startedAt: string;
  vibeLevel?: number;
  baseline: {
    trustPassRate: number;
    reworkRatio: number;
    iterationVelocity: number;
    debugSpiralDuration: number;
    flowEfficiency: number;
  } | null;
}

export interface SessionMetricsOutput {
  session_id: string;
  started_at: string;
  ended_at: string;
  vibe_level: number | null;
  metrics: {
    trust_pass_rate: number;
    rework_ratio: number;
    iteration_velocity: number;
    debug_spiral_duration_min: number;
    flow_efficiency: number;
    vibe_score?: number;
  };
  commits: number;
  retro: {
    failure_patterns_hit: string[];
    failure_patterns_avoided: string[];
    spirals_detected: number;
    learnings: string[];
  };
  baseline_comparison: {
    trust_delta: number;
    rework_delta: number;
    verdict: 'above' | 'below' | 'normal';
    message: string;
  } | null;
}

// Known failure patterns and their detection criteria
const FAILURE_PATTERNS = [
  {
    id: 'debug_spiral',
    name: 'Debug Spiral',
    detect: (metrics: SessionMetricsOutput['metrics'], spirals: number) => spirals >= 2,
    avoided: (metrics: SessionMetricsOutput['metrics'], spirals: number) => spirals === 0 && metrics.rework_ratio < 30,
  },
  {
    id: 'context_amnesia',
    name: 'Context Amnesia',
    detect: (metrics: SessionMetricsOutput['metrics']) => metrics.rework_ratio > 50,
    avoided: (metrics: SessionMetricsOutput['metrics']) => metrics.rework_ratio < 20,
  },
  {
    id: 'velocity_crash',
    name: 'Velocity Crash',
    detect: (metrics: SessionMetricsOutput['metrics']) => metrics.iteration_velocity < 1,
    avoided: (metrics: SessionMetricsOutput['metrics']) => metrics.iteration_velocity > 3,
  },
  {
    id: 'trust_erosion',
    name: 'Trust Erosion',
    detect: (metrics: SessionMetricsOutput['metrics']) => metrics.trust_pass_rate < 60,
    avoided: (metrics: SessionMetricsOutput['metrics']) => metrics.trust_pass_rate > 85,
  },
  {
    id: 'flow_disruption',
    name: 'Flow Disruption',
    detect: (metrics: SessionMetricsOutput['metrics']) => metrics.flow_efficiency < 50,
    avoided: (metrics: SessionMetricsOutput['metrics']) => metrics.flow_efficiency > 80,
  },
];

function getActiveSessionPath(repoPath: string): string {
  return path.join(repoPath, ACTIVE_SESSION_FILE);
}

function loadActiveSession(repoPath: string): ActiveSession | null {
  const sessionPath = getActiveSessionPath(repoPath);
  if (!fs.existsSync(sessionPath)) {
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(sessionPath, 'utf-8'));
  } catch {
    return null;
  }
}

function saveActiveSession(session: ActiveSession, repoPath: string): void {
  const sessionPath = getActiveSessionPath(repoPath);
  const dir = path.dirname(sessionPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(sessionPath, JSON.stringify(session, null, 2));
}

function clearActiveSession(repoPath: string): void {
  const sessionPath = getActiveSessionPath(repoPath);
  if (fs.existsSync(sessionPath)) {
    fs.unlinkSync(sessionPath);
  }
}

function generateSessionId(): string {
  const now = new Date();
  const date = now.toISOString().slice(0, 10);
  const seq = String(Math.floor(Math.random() * 1000)).padStart(3, '0');
  return `${date}-${seq}`;
}

function detectFailurePatterns(
  metrics: SessionMetricsOutput['metrics'],
  spiralCount: number
): { hit: string[]; avoided: string[] } {
  const hit: string[] = [];
  const avoided: string[] = [];

  for (const pattern of FAILURE_PATTERNS) {
    if (pattern.detect(metrics, spiralCount)) {
      hit.push(pattern.name);
    } else if (pattern.avoided(metrics, spiralCount)) {
      avoided.push(pattern.name);
    }
  }

  return { hit, avoided };
}

function generateLearnings(
  metrics: SessionMetricsOutput['metrics'],
  patternsHit: string[],
  patternsAvoided: string[],
  spiralCount: number
): string[] {
  const learnings: string[] = [];

  // Generate learnings based on what went well
  if (patternsAvoided.includes('Debug Spiral')) {
    learnings.push('Test-first approach prevented spirals');
  }
  if (patternsAvoided.includes('Context Amnesia')) {
    learnings.push('Good documentation/commit hygiene maintained context');
  }
  if (metrics.trust_pass_rate > 90) {
    learnings.push('High trust indicates appropriate vibe level choice');
  }
  if (metrics.flow_efficiency > 85) {
    learnings.push('Flow state maintained - environment was well-prepared');
  }

  // Generate learnings based on what went wrong
  if (patternsHit.includes('Debug Spiral')) {
    learnings.push('Consider adding tracer tests before next similar task');
  }
  if (patternsHit.includes('Context Amnesia')) {
    learnings.push('Break work into smaller, documented chunks');
  }
  if (spiralCount > 0) {
    learnings.push(`${spiralCount} spiral(s) detected - review trigger patterns`);
  }

  return learnings;
}

export function createSessionCommand(): Command {
  const cmd = new Command('session')
    .description('Session lifecycle integration for claude-progress.json');

  // vibe-check session start
  cmd
    .command('start')
    .description('Start a new session and capture baseline metrics')
    .option('-l, --level <number>', 'Declared vibe level (0-5)', parseInt)
    .option('-r, --repo <path>', 'Repository path', process.cwd())
    .option('-f, --format <type>', 'Output format: terminal, json', 'terminal')
    .action(async (options) => {
      await runSessionStart(options);
    });

  // vibe-check session end
  cmd
    .command('end')
    .description('End session and output metrics for claude-progress.json')
    .option('-r, --repo <path>', 'Repository path', process.cwd())
    .option('-f, --format <type>', 'Output format: terminal, json', 'json')
    .action(async (options) => {
      await runSessionEnd(options);
    });

  // vibe-check session status
  cmd
    .command('status')
    .description('Show current session status')
    .option('-r, --repo <path>', 'Repository path', process.cwd())
    .action(async (options) => {
      await runSessionStatus(options);
    });

  return cmd;
}

async function runSessionStart(options: {
  level?: number;
  repo: string;
  format: string;
}): Promise<void> {
  const { level, repo, format } = options;

  if (!(await isGitRepo(repo))) {
    console.error(chalk.red(`Not a git repository: ${repo}`));
    process.exit(1);
  }

  // Check for existing session
  const existing = loadActiveSession(repo);
  if (existing) {
    if (format === 'json') {
      console.log(JSON.stringify({ error: 'Session already active', session: existing }));
    } else {
      console.log(chalk.yellow(`\nSession already active since ${existing.startedAt}`));
      console.log(chalk.gray(`Run 'vibe-check session end' to complete it first.\n`));
    }
    process.exit(1);
  }

  // Capture baseline from last week
  const commits = await getCommits(repo, '1 week ago');
  let baseline: ActiveSession['baseline'] = null;

  if (commits.length >= 5) {
    const result = analyzeCommits(commits);
    baseline = {
      trustPassRate: result.metrics.trustPassRate.value,
      reworkRatio: result.metrics.reworkRatio.value,
      iterationVelocity: result.metrics.iterationVelocity.value,
      debugSpiralDuration: result.metrics.debugSpiralDuration.value,
      flowEfficiency: result.metrics.flowEfficiency.value,
    };
  }

  // Create new session
  const session: ActiveSession = {
    id: generateSessionId(),
    startedAt: new Date().toISOString(),
    vibeLevel: level,
    baseline,
  };

  saveActiveSession(session, repo);

  if (format === 'json') {
    console.log(JSON.stringify({
      session_id: session.id,
      started_at: session.startedAt,
      vibe_level: session.vibeLevel ?? null,
      baseline: session.baseline ? {
        trust_pass_rate: session.baseline.trustPassRate,
        rework_ratio: session.baseline.reworkRatio,
        iteration_velocity: session.baseline.iterationVelocity,
        debug_spiral_duration_min: session.baseline.debugSpiralDuration,
        flow_efficiency: session.baseline.flowEfficiency,
      } : null,
    }, null, 2));
  } else {
    console.log('');
    console.log(chalk.bold.cyan('SESSION STARTED'));
    console.log('');
    console.log(`  ID: ${session.id}`);
    console.log(`  Started: ${new Date(session.startedAt).toLocaleTimeString()}`);
    if (level !== undefined) {
      console.log(`  Vibe Level: ${level}`);
    }
    console.log('');

    if (baseline) {
      console.log(chalk.gray('  Baseline (last 7 days):'));
      console.log(chalk.gray(`    Trust: ${Math.round(baseline.trustPassRate)}%`));
      console.log(chalk.gray(`    Rework: ${Math.round(baseline.reworkRatio)}%`));
      console.log(chalk.gray(`    Velocity: ${baseline.iterationVelocity.toFixed(1)}/hr`));
    } else {
      console.log(chalk.gray('  No baseline yet (need 5+ commits from last week)'));
    }
    console.log('');
    console.log(chalk.gray(`  Run 'vibe-check session end' when done.\n`));
  }
}

async function runSessionEnd(options: {
  repo: string;
  format: string;
}): Promise<void> {
  const { repo, format } = options;

  if (!(await isGitRepo(repo))) {
    console.error(chalk.red(`Not a git repository: ${repo}`));
    process.exit(1);
  }

  // Load active session
  const session = loadActiveSession(repo);
  if (!session) {
    if (format === 'json') {
      console.log(JSON.stringify({ error: 'No active session' }));
    } else {
      console.log(chalk.yellow('\nNo active session found.'));
      console.log(chalk.gray(`Run 'vibe-check session start' first.\n`));
    }
    process.exit(1);
  }

  // Get commits since session start
  const commits = await getCommits(repo, session.startedAt);

  if (commits.length === 0) {
    if (format === 'json') {
      console.log(JSON.stringify({
        error: 'No commits in session',
        session_id: session.id,
        started_at: session.startedAt,
      }));
    } else {
      console.log(chalk.yellow('\nNo commits found during this session.'));
      console.log(chalk.gray(`Session started: ${session.startedAt}\n`));
    }
    // Clear the session anyway
    clearActiveSession(repo);
    process.exit(0);
  }

  // Analyze commits
  const result = analyzeCommits(commits);
  const spiralCount = result.fixChains.filter(fc => fc.isSpiral).length;

  // Get enhanced metrics if possible
  let vibeScoreValue: number | undefined;
  try {
    const fileStats = await getFileStats(repo, session.startedAt);
    const fileChurn = calculateFileChurn(commits, fileStats.filesPerCommit);
    const timeSpiral = calculateTimeSpiral(commits);
    const velocityAnomaly = calculateVelocityAnomaly(commits);
    const codeStability = calculateCodeStability(commits, fileStats.lineStats);
    const vibeScore = calculateVibeScore({
      fileChurn,
      timeSpiral,
      velocityAnomaly,
      codeStability,
    });
    vibeScoreValue = Math.round(vibeScore.value * 100);
  } catch {
    // Enhanced metrics not available
  }

  // Build metrics output
  const metrics: SessionMetricsOutput['metrics'] = {
    trust_pass_rate: Math.round(result.metrics.trustPassRate.value),
    rework_ratio: Math.round(result.metrics.reworkRatio.value),
    iteration_velocity: parseFloat(result.metrics.iterationVelocity.value.toFixed(1)),
    debug_spiral_duration_min: Math.round(result.metrics.debugSpiralDuration.value),
    flow_efficiency: Math.round(result.metrics.flowEfficiency.value),
  };
  if (vibeScoreValue !== undefined) {
    metrics.vibe_score = vibeScoreValue;
  }

  // Detect failure patterns
  const patterns = detectFailurePatterns(metrics, spiralCount);

  // Generate learnings
  const learnings = generateLearnings(metrics, patterns.hit, patterns.avoided, spiralCount);

  // Compare to baseline
  let baselineComparison: SessionMetricsOutput['baseline_comparison'] = null;
  if (session.baseline) {
    const trustDelta = metrics.trust_pass_rate - session.baseline.trustPassRate;
    const reworkDelta = metrics.rework_ratio - session.baseline.reworkRatio;

    let verdict: 'above' | 'below' | 'normal';
    let message: string;

    if (trustDelta > 5 && reworkDelta < 5) {
      verdict = 'above';
      message = 'Better than your baseline - great session!';
    } else if (trustDelta < -10 || reworkDelta > 10) {
      verdict = 'below';
      message = 'Rougher than usual - consider what caused friction';
    } else {
      verdict = 'normal';
      message = 'Typical session for you';
    }

    baselineComparison = {
      trust_delta: Math.round(trustDelta),
      rework_delta: Math.round(reworkDelta),
      verdict,
      message,
    };
  }

  // Build final output
  const output: SessionMetricsOutput = {
    session_id: session.id,
    started_at: session.startedAt,
    ended_at: new Date().toISOString(),
    vibe_level: session.vibeLevel ?? null,
    metrics,
    commits: commits.length,
    retro: {
      failure_patterns_hit: patterns.hit,
      failure_patterns_avoided: patterns.avoided,
      spirals_detected: spiralCount,
      learnings,
    },
    baseline_comparison: baselineComparison,
  };

  // Clear the session
  clearActiveSession(repo);

  if (format === 'json') {
    console.log(JSON.stringify(output, null, 2));
  } else {
    console.log('');
    console.log(chalk.bold.cyan('SESSION COMPLETE'));
    console.log('');
    console.log(`  ID: ${output.session_id}`);
    console.log(`  Duration: ${Math.round((new Date(output.ended_at).getTime() - new Date(output.started_at).getTime()) / 60000)} min`);
    console.log(`  Commits: ${output.commits}`);
    if (output.vibe_level !== null) {
      console.log(`  Vibe Level: ${output.vibe_level}`);
    }
    console.log('');

    console.log(chalk.bold('  Metrics:'));
    console.log(`    Trust Pass Rate: ${metrics.trust_pass_rate}%`);
    console.log(`    Rework Ratio: ${metrics.rework_ratio}%`);
    console.log(`    Iteration Velocity: ${metrics.iteration_velocity}/hr`);
    console.log(`    Flow Efficiency: ${metrics.flow_efficiency}%`);
    if (metrics.vibe_score !== undefined) {
      console.log(`    VibeScore: ${metrics.vibe_score}%`);
    }
    console.log('');

    if (patterns.hit.length > 0) {
      console.log(chalk.yellow('  ⚠ Failure Patterns Hit:'));
      for (const p of patterns.hit) {
        console.log(chalk.yellow(`    - ${p}`));
      }
      console.log('');
    }

    if (patterns.avoided.length > 0) {
      console.log(chalk.green('  ✓ Patterns Avoided:'));
      for (const p of patterns.avoided) {
        console.log(chalk.green(`    - ${p}`));
      }
      console.log('');
    }

    if (learnings.length > 0) {
      console.log(chalk.gray('  Learnings:'));
      for (const l of learnings) {
        console.log(chalk.gray(`    • ${l}`));
      }
      console.log('');
    }

    if (baselineComparison) {
      const verdictColor = baselineComparison.verdict === 'above' ? chalk.green :
                          baselineComparison.verdict === 'below' ? chalk.yellow :
                          chalk.gray;
      console.log(verdictColor(`  ${baselineComparison.message}`));
      console.log('');
    }

    console.log(chalk.gray('  Use --format json to get machine-readable output.\n'));
  }
}

async function runSessionStatus(options: { repo: string }): Promise<void> {
  const { repo } = options;

  const session = loadActiveSession(repo);
  if (!session) {
    console.log(chalk.gray('\nNo active session.\n'));
    return;
  }

  const duration = Math.round((Date.now() - new Date(session.startedAt).getTime()) / 60000);

  console.log('');
  console.log(chalk.bold.cyan('ACTIVE SESSION'));
  console.log('');
  console.log(`  ID: ${session.id}`);
  console.log(`  Started: ${new Date(session.startedAt).toLocaleString()}`);
  console.log(`  Duration: ${duration} min`);
  if (session.vibeLevel !== undefined) {
    console.log(`  Vibe Level: ${session.vibeLevel}`);
  }
  console.log('');

  // Show current commit count
  try {
    const commits = await getCommits(repo, session.startedAt);
    console.log(`  Commits so far: ${commits.length}`);
  } catch {
    // Ignore errors
  }
  console.log('');
}

export async function runSessionStartCli(options: {
  level?: number;
  repo: string;
  format: string;
}): Promise<void> {
  await runSessionStart(options);
}

export async function runSessionEndCli(options: {
  repo: string;
  format: string;
}): Promise<SessionMetricsOutput | null> {
  const { repo, format } = options;

  if (!(await isGitRepo(repo))) {
    return null;
  }

  const session = loadActiveSession(repo);
  if (!session) {
    return null;
  }

  const commits = await getCommits(repo, session.startedAt);
  if (commits.length === 0) {
    clearActiveSession(repo);
    return null;
  }

  const result = analyzeCommits(commits);
  const spiralCount = result.fixChains.filter(fc => fc.isSpiral).length;

  let vibeScoreValue: number | undefined;
  try {
    const fileStats = await getFileStats(repo, session.startedAt);
    const fileChurn = calculateFileChurn(commits, fileStats.filesPerCommit);
    const timeSpiral = calculateTimeSpiral(commits);
    const velocityAnomaly = calculateVelocityAnomaly(commits);
    const codeStability = calculateCodeStability(commits, fileStats.lineStats);
    const vibeScore = calculateVibeScore({
      fileChurn,
      timeSpiral,
      velocityAnomaly,
      codeStability,
    });
    vibeScoreValue = Math.round(vibeScore.value * 100);
  } catch {
    // Enhanced metrics not available
  }

  const metrics: SessionMetricsOutput['metrics'] = {
    trust_pass_rate: Math.round(result.metrics.trustPassRate.value),
    rework_ratio: Math.round(result.metrics.reworkRatio.value),
    iteration_velocity: parseFloat(result.metrics.iterationVelocity.value.toFixed(1)),
    debug_spiral_duration_min: Math.round(result.metrics.debugSpiralDuration.value),
    flow_efficiency: Math.round(result.metrics.flowEfficiency.value),
  };
  if (vibeScoreValue !== undefined) {
    metrics.vibe_score = vibeScoreValue;
  }

  const patterns = detectFailurePatterns(metrics, spiralCount);
  const learnings = generateLearnings(metrics, patterns.hit, patterns.avoided, spiralCount);

  let baselineComparison: SessionMetricsOutput['baseline_comparison'] = null;
  if (session.baseline) {
    const trustDelta = metrics.trust_pass_rate - session.baseline.trustPassRate;
    const reworkDelta = metrics.rework_ratio - session.baseline.reworkRatio;

    let verdict: 'above' | 'below' | 'normal';
    let message: string;

    if (trustDelta > 5 && reworkDelta < 5) {
      verdict = 'above';
      message = 'Better than your baseline - great session!';
    } else if (trustDelta < -10 || reworkDelta > 10) {
      verdict = 'below';
      message = 'Rougher than usual - consider what caused friction';
    } else {
      verdict = 'normal';
      message = 'Typical session for you';
    }

    baselineComparison = {
      trust_delta: Math.round(trustDelta),
      rework_delta: Math.round(reworkDelta),
      verdict,
      message,
    };
  }

  clearActiveSession(repo);

  return {
    session_id: session.id,
    started_at: session.startedAt,
    ended_at: new Date().toISOString(),
    vibe_level: session.vibeLevel ?? null,
    metrics,
    commits: commits.length,
    retro: {
      failure_patterns_hit: patterns.hit,
      failure_patterns_avoided: patterns.avoided,
      spirals_detected: spiralCount,
      learnings,
    },
    baseline_comparison: baselineComparison,
  };
}
