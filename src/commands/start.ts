import { Command } from 'commander';
import chalk from 'chalk';
import * as fs from 'fs';
import * as path from 'path';

interface Session {
  level: number;
  startedAt: string;
  startCommit: string | null;
  repoPath: string;
}

const LEVEL_INFO: Record<number, { name: string; trust: string; expectRework: string; expectTrust: string }> = {
  5: { name: 'Full Automation', trust: '95%', expectRework: '<5%', expectTrust: '>90%' },
  4: { name: 'High Trust', trust: '80%', expectRework: '<15%', expectTrust: '>80%' },
  3: { name: 'Balanced', trust: '60%', expectRework: '<30%', expectTrust: '>65%' },
  2: { name: 'Careful', trust: '40%', expectRework: '<45%', expectTrust: '>50%' },
  1: { name: 'Skeptical', trust: '20%', expectRework: '<60%', expectTrust: '>30%' },
  0: { name: 'Manual', trust: '0%', expectRework: 'any', expectTrust: 'any' },
};

export function getVibeCheckDir(repoPath: string = process.cwd()): string {
  return path.join(repoPath, '.vibe-check');
}

export function getSessionPath(repoPath: string = process.cwd()): string {
  return path.join(getVibeCheckDir(repoPath), 'session.json');
}

export function loadSession(repoPath: string = process.cwd()): Session | null {
  const sessionPath = getSessionPath(repoPath);
  if (!fs.existsSync(sessionPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(sessionPath, 'utf-8'));
  } catch {
    return null;
  }
}

export function saveSession(session: Session): void {
  const dir = getVibeCheckDir(session.repoPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(getSessionPath(session.repoPath), JSON.stringify(session, null, 2));
}

export function clearSession(repoPath: string = process.cwd()): void {
  const sessionPath = getSessionPath(repoPath);
  if (fs.existsSync(sessionPath)) {
    fs.unlinkSync(sessionPath);
  }
}

async function getHeadCommit(repoPath: string): Promise<string | null> {
  try {
    const { execSync } = await import('child_process');
    return execSync('git rev-parse HEAD', { cwd: repoPath, encoding: 'utf-8' }).trim();
  } catch {
    return null;
  }
}

export function createStartCommand(): Command {
  const cmd = new Command('start')
    .description('Start a session with a declared vibe level')
    .requiredOption('-l, --level <n>', 'Vibe level (0-5)', parseInt)
    .option('-r, --repo <path>', 'Repository path', process.cwd())
    .action(async (options) => {
      const level = options.level;

      if (level < 0 || level > 5 || isNaN(level)) {
        console.error(chalk.red('Level must be 0-5'));
        process.exit(1);
      }

      const existing = loadSession(options.repo);
      if (existing) {
        console.log(chalk.yellow('Session already active (started ' + existing.startedAt + ')'));
        console.log(chalk.gray('Run `vibe-check` to end and compare, or `vibe-check start --level N` to restart'));
        console.log('');
      }

      const info = LEVEL_INFO[level];
      const startCommit = await getHeadCommit(options.repo);

      const session: Session = {
        level,
        startedAt: new Date().toISOString(),
        startCommit,
        repoPath: options.repo,
      };

      saveSession(session);

      console.log('');
      console.log(chalk.bold.cyan('SESSION STARTED'));
      console.log('');
      console.log(`  Level: ${chalk.bold(level)} - ${info.name}`);
      console.log(`  Trust: ${info.trust}`);
      console.log('');
      console.log(chalk.gray('  Expectations for this level:'));
      console.log(chalk.gray(`  - Trust pass rate: ${info.expectTrust}`));
      console.log(chalk.gray(`  - Rework ratio: ${info.expectRework}`));
      console.log('');
      console.log(chalk.gray('  When done, run: vibe-check'));
      console.log('');
    });

  return cmd;
}

export { LEVEL_INFO };
