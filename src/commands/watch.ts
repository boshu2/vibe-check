import { Command } from 'commander';
import chalk from 'chalk';
import { getCommits, isGitRepo, getCommitStats } from '../git';
import { Commit, TimelineEvent } from '../types';
import {
  getAdvice,
  getPatternDisplayName,
  getResolutionDisplayName,
  appendSpiral,
  SpiralResolution,
} from '../storage/spiral-history';
import {
  quickInnerLoopCheck,
  analyzeInnerLoop,
  InnerLoopAnalysis,
} from '../inner-loop';

// Pattern detection regexes (same as metrics/spirals.ts)
const PATTERNS: Record<string, RegExp> = {
  VOLUME_CONFIG: /volume|mount|path|permission|readonly|pvc|storage/i,
  SECRETS_AUTH: /secret|auth|oauth|token|credential|password|key/i,
  API_MISMATCH: /api|version|field|spec|schema|crd|resource/i,
  SSL_TLS: /ssl|tls|cert|fips|handshake|https/i,
  IMAGE_REGISTRY: /image|pull|registry|docker|tag/i,
  GITOPS_DRIFT: /drift|sync|argocd|reconcil|outof/i,
};

function detectPattern(messages: string): string {
  for (const [pattern, regex] of Object.entries(PATTERNS)) {
    if (regex.test(messages)) {
      return pattern;
    }
  }
  return 'OTHER';
}

interface WatchState {
  lastCommitHash: string | null;
  recentCommits: Commit[];
  spiralWarnings: Map<string, number>; // component -> warning count
  lastInnerLoopWarning: string | null; // track which inner-loop warning was last shown
  innerLoopIssueCount: number; // track issue count to detect changes
}

const SPIRAL_THRESHOLD = 3; // commits before warning
const POLL_INTERVAL = 5000; // 5 seconds
const RECENT_WINDOW = 10; // track last N commits

export function createWatchCommand(): Command {
  const cmd = new Command('watch')
    .description('Watch for spiral patterns in real-time')
    .option('-r, --repo <path>', 'Repository path', process.cwd())
    .option('-i, --interval <ms>', 'Poll interval in milliseconds', '5000')
    .option('-q, --quiet', 'Only show warnings, not all commits', false)
    .action(async (options) => {
      await runWatch(options);
    });

  return cmd;
}

async function runWatch(options: {
  repo: string;
  interval: string;
  quiet: boolean;
}): Promise<void> {
  const interval = parseInt(options.interval, 10) || POLL_INTERVAL;

  if (!(await isGitRepo(options.repo))) {
    console.error(chalk.red(`Not a git repository: ${options.repo}`));
    process.exit(1);
  }

  console.log('');
  console.log(chalk.bold.cyan('VIBE-CHECK WATCH MODE'));
  console.log(chalk.gray(`Monitoring ${options.repo}`));
  console.log(chalk.gray(`Polling every ${interval / 1000}s - Ctrl+C to stop`));
  console.log('');
  console.log(chalk.cyan('─'.repeat(60)));

  const state: WatchState = {
    lastCommitHash: null,
    recentCommits: [],
    spiralWarnings: new Map(),
    lastInnerLoopWarning: null,
    innerLoopIssueCount: 0,
  };

  // Get initial state
  const initialCommits = await getCommits(options.repo, '1 hour ago');
  if (initialCommits.length > 0) {
    state.lastCommitHash = initialCommits[0].hash;
    state.recentCommits = initialCommits.slice(0, RECENT_WINDOW);

    if (!options.quiet) {
      console.log(chalk.gray(`  Loaded ${initialCommits.length} recent commits`));
      console.log('');
    }

    // Check for existing spirals
    checkForSpirals(state, options.quiet);

    // Check for inner-loop issues on initial load
    await checkForInnerLoopIssues(options.repo, state, options.quiet);
  }

  // Poll for new commits
  const poll = async () => {
    try {
      const commits = await getCommits(options.repo, '1 hour ago');

      if (commits.length === 0) return;

      const latestHash = commits[0].hash;

      // Check if there are new commits
      if (latestHash !== state.lastCommitHash) {
        // Find new commits
        const newCommits: Commit[] = [];
        for (const commit of commits) {
          if (commit.hash === state.lastCommitHash) break;
          newCommits.push(commit);
        }

        if (newCommits.length > 0) {
          // Add new commits to recent list
          state.recentCommits = [
            ...newCommits,
            ...state.recentCommits,
          ].slice(0, RECENT_WINDOW);

          state.lastCommitHash = latestHash;

          // Display new commits
          for (const commit of newCommits.reverse()) {
            displayCommit(commit, options.quiet);
          }

          // Check for spirals
          checkForSpirals(state, options.quiet);

          // Check for inner-loop issues
          await checkForInnerLoopIssues(options.repo, state, options.quiet);
        }
      }
    } catch (error) {
      // Silently ignore polling errors
    }
  };

  // Start polling
  setInterval(poll, interval);

  // Keep process alive
  process.on('SIGINT', () => {
    console.log('');
    console.log(chalk.gray('Watch mode stopped.'));
    process.exit(0);
  });
}

function displayCommit(commit: Commit, quiet: boolean): void {
  if (quiet && commit.type !== 'fix') return;

  const time = commit.date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit'
  });

  const typeColors: Record<string, (s: string) => string> = {
    feat: chalk.green,
    fix: chalk.yellow,
    docs: chalk.blue,
    chore: chalk.gray,
    refactor: chalk.magenta,
    test: chalk.cyan,
    style: chalk.gray,
    other: chalk.white,
  };

  const colorFn = typeColors[commit.type] || chalk.white;
  const scope = commit.scope ? `(${commit.scope})` : '';
  const shortMsg = commit.message.length > 50
    ? commit.message.slice(0, 47) + '...'
    : commit.message;

  console.log(
    `  ${chalk.gray(time)} ${colorFn(commit.type)}${chalk.gray(scope)} ${shortMsg}`
  );
}

function checkForSpirals(state: WatchState, quiet: boolean): void {
  // Group recent commits by component (scope or first word of message)
  const byComponent = new Map<string, Commit[]>();

  for (const commit of state.recentCommits) {
    if (commit.type !== 'fix') continue;

    const component = commit.scope || extractComponent(commit.message);
    if (!component) continue;

    const existing = byComponent.get(component) || [];
    existing.push(commit);
    byComponent.set(component, existing);
  }

  // Check for spirals (3+ consecutive fixes on same component)
  for (const [component, fixes] of byComponent) {
    if (fixes.length >= SPIRAL_THRESHOLD) {
      const prevWarnings = state.spiralWarnings.get(component) || 0;

      // Only warn if this is new or escalating
      if (fixes.length > prevWarnings) {
        state.spiralWarnings.set(component, fixes.length);
        displaySpiralWarning(component, fixes);
      }
    }
  }
}

function extractComponent(message: string): string | null {
  // Try to extract component from commit message
  // e.g., "fix auth flow" -> "auth"
  // e.g., "fix: handle null case" -> null (too generic)

  const words = message.toLowerCase()
    .replace(/^fix[:\s]*/, '')
    .split(/\s+/);

  const skipWords = new Set([
    'the', 'a', 'an', 'for', 'in', 'on', 'to', 'with', 'and', 'or',
    'bug', 'issue', 'error', 'problem', 'handle', 'add', 'remove',
    'update', 'change', 'null', 'undefined', 'case', 'typo'
  ]);

  for (const word of words) {
    if (word.length > 2 && !skipWords.has(word)) {
      return word;
    }
  }

  return null;
}

function displaySpiralWarning(component: string, fixes: Commit[]): void {
  const duration = fixes.length > 1
    ? Math.round((fixes[0].date.getTime() - fixes[fixes.length - 1].date.getTime()) / 60000)
    : 0;

  // Detect pattern from commit messages
  const allMessages = fixes.map(c => c.message).join(' ');
  const pattern = detectPattern(allMessages);
  const patternName = getPatternDisplayName(pattern);

  // Get personalized advice from history
  const advice = getAdvice(pattern, component);

  console.log('');
  console.log(chalk.bold.yellow('  ⚠️  SPIRAL FORMING'));
  console.log(chalk.yellow(`      ${component} component (${patternName})`));
  console.log(chalk.yellow(`      ${fixes.length} fixes${duration > 0 ? `, ${duration} min` : ''}`));
  console.log('');

  // Show personalized history if available
  if (advice && advice.yourHistory.times > 0) {
    console.log(chalk.white(`      Your history: ${advice.yourHistory.times} ${component} spirals, avg ${advice.yourHistory.avgDuration} min`));

    if (advice.whatWorked.length > 0) {
      const topFixes = advice.whatWorked.slice(0, 2)
        .map(w => `${getResolutionDisplayName(w.resolution).toLowerCase()} (${w.times}x)`)
        .join(', ');
      console.log(chalk.white(`      What worked: ${topFixes}`));
    }

    console.log('');
    console.log(chalk.bold.cyan(`      → ${advice.suggestion}`));
  } else {
    // Generic advice for first-time spirals
    console.log(chalk.gray('      Consider:'));
    console.log(chalk.gray('      • Step back and write a test'));
    console.log(chalk.gray('      • Check the docs or ask for help'));
    console.log(chalk.gray('      • Take a 5-minute break'));
  }

  console.log('');
  console.log(chalk.cyan('─'.repeat(60)));

  // Record this spiral to history
  appendSpiral(pattern, component, duration, fixes.length);
}

async function checkForInnerLoopIssues(
  repoPath: string,
  state: WatchState,
  quiet: boolean
): Promise<void> {
  if (state.recentCommits.length < 3) return;

  try {
    // Get commit stats for inner-loop analysis
    const commitStats = await getCommitStats(repoPath, '1 hour ago');

    // Convert commits to TimelineEvent format
    const events: TimelineEvent[] = state.recentCommits.map((c, idx) => ({
      hash: c.hash,
      timestamp: c.date,
      author: c.author,
      subject: c.message,
      type: c.type,
      scope: c.scope,
      sessionId: 'watch',
      sessionPosition: idx,
      gapMinutes: 0,
      isRefactor: c.type === 'refactor',
      spiralDepth: 0,
    }));

    // Run quick inner-loop check
    const check = quickInnerLoopCheck(
      events,
      commitStats.filesPerCommit,
      commitStats.lineStatsPerCommit
    );

    // Only show warning if issues changed
    if (check.hasIssues && check.issueCount > state.innerLoopIssueCount) {
      // Get full analysis for detailed warning
      const analysis = analyzeInnerLoop(
        events,
        commitStats.filesPerCommit,
        commitStats.lineStatsPerCommit
      );

      displayInnerLoopWarning(analysis);
      state.innerLoopIssueCount = check.issueCount;
      state.lastInnerLoopWarning = check.topIssue;
    }
  } catch {
    // Silently ignore errors
  }
}

function displayInnerLoopWarning(analysis: InnerLoopAnalysis): void {
  const healthEmoji = analysis.summary.overallHealth === 'critical' ? '🚨' :
                      analysis.summary.overallHealth === 'warning' ? '⚠️' : '✅';
  const healthColor = analysis.summary.overallHealth === 'critical' ? chalk.red :
                      analysis.summary.overallHealth === 'warning' ? chalk.yellow : chalk.green;

  console.log('');
  console.log(healthColor(`  ${healthEmoji} INNER LOOP ${analysis.summary.overallHealth.toUpperCase()}`));
  console.log('');

  // Show detected issues
  if (analysis.testsPassingLie.detected) {
    console.log(chalk.red(`      🤥 ${analysis.testsPassingLie.message}`));
  }
  if (analysis.contextAmnesia.detected) {
    console.log(chalk.yellow(`      🧠 ${analysis.contextAmnesia.message}`));
  }
  if (analysis.instructionDrift.detected) {
    console.log(chalk.yellow(`      🎯 ${analysis.instructionDrift.message}`));
  }
  if (analysis.loggingOnly.detected) {
    console.log(chalk.yellow(`      🔍 ${analysis.loggingOnly.message}`));
  }

  // Show top recommendation
  if (analysis.recommendations.length > 0) {
    console.log('');
    console.log(chalk.bold.cyan(`      → ${analysis.recommendations[0]}`));
  }

  // Emergency protocol for critical issues
  if (analysis.summary.overallHealth === 'critical') {
    console.log('');
    console.log(chalk.red.bold('      STOP → git status → backup → start simple'));
  }

  console.log('');
  console.log(chalk.cyan('─'.repeat(60)));
}
