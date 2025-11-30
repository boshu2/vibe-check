import { Command } from 'commander';
import chalk from 'chalk';
import * as fs from 'fs';
import * as path from 'path';
import { getStoreDir, getStorePath, getCommitLogPath, readNdjsonWithErrors } from '../storage';
import { StoredCommit } from '../storage/commit-log';

export interface CacheOptions {
  repo: string;
}

export function createCacheCommand(): Command {
  const cmd = new Command('cache')
    .description('Manage local vibe-check cache and storage')
    .option('-r, --repo <path>', 'Repository path', process.cwd());

  cmd
    .command('status')
    .description('Show cache status and storage statistics')
    .action(async () => {
      const options = cmd.opts() as CacheOptions;
      await runCacheStatus(options);
    });

  cmd
    .command('clear')
    .description('Clear all cached data (sessions, commits, insights)')
    .option('--force', 'Skip confirmation prompt')
    .action(async (clearOptions) => {
      const options = cmd.opts() as CacheOptions;
      await runCacheClear(options, clearOptions.force);
    });

  return cmd;
}

async function runCacheStatus(options: CacheOptions): Promise<void> {
  const { repo } = options;
  const storeDir = getStoreDir(repo);
  const timelinePath = getStorePath(repo);
  const commitLogPath = getCommitLogPath(repo);

  console.log('');
  console.log(chalk.bold.cyan('Cache Status'));
  console.log(chalk.gray('─'.repeat(40)));

  // Check if store directory exists
  if (!fs.existsSync(storeDir)) {
    console.log(chalk.yellow('No cache found. Run `vibe-check timeline` to create one.'));
    return;
  }

  console.log(chalk.white(`Location: ${storeDir}`));
  console.log('');

  // Timeline store
  if (fs.existsSync(timelinePath)) {
    const stats = fs.statSync(timelinePath);
    const sizeKb = (stats.size / 1024).toFixed(1);

    try {
      const content = fs.readFileSync(timelinePath, 'utf-8');
      const store = JSON.parse(content);

      console.log(chalk.bold.white('Timeline Store:'));
      console.log(`  Version: ${store.version || 'unknown'}`);
      console.log(`  Sessions: ${store.sessions?.length || 0}`);
      console.log(`  Insights: ${store.insights?.length || 0}`);
      console.log(`  Size: ${sizeKb} KB`);
      console.log(`  Last updated: ${store.lastUpdated || 'unknown'}`);
    } catch {
      console.log(chalk.yellow(`  Timeline store exists but couldn't be read (${sizeKb} KB)`));
    }
  } else {
    console.log(chalk.gray('Timeline Store: not found'));
  }

  console.log('');

  // Commit log (NDJSON)
  if (fs.existsSync(commitLogPath)) {
    const stats = fs.statSync(commitLogPath);
    const sizeKb = (stats.size / 1024).toFixed(1);

    const result = readNdjsonWithErrors<StoredCommit>(commitLogPath);

    console.log(chalk.bold.white('Commit Log (NDJSON):'));
    console.log(`  Commits: ${result.items.length}`);
    if (result.errors > 0) {
      console.log(chalk.yellow(`  Malformed lines: ${result.errors}`));
    }
    console.log(`  Size: ${sizeKb} KB`);

    // Show date range
    if (result.items.length > 0) {
      const sorted = [...result.items].sort((a, b) =>
        new Date(a.d).getTime() - new Date(b.d).getTime()
      );
      const oldest = new Date(sorted[0].d).toLocaleDateString();
      const newest = new Date(sorted[sorted.length - 1].d).toLocaleDateString();
      console.log(`  Date range: ${oldest} - ${newest}`);
    }
  } else {
    console.log(chalk.gray('Commit Log: not found'));
  }

  console.log('');

  // Check for .gitignore
  const gitignorePath = path.join(storeDir, '.gitignore');
  if (fs.existsSync(gitignorePath)) {
    console.log(chalk.green('.gitignore: present'));
  } else {
    console.log(chalk.yellow('.gitignore: missing (data may be committed!)'));
  }

  console.log('');
}

async function runCacheClear(options: CacheOptions, force: boolean): Promise<void> {
  const { repo } = options;
  const storeDir = getStoreDir(repo);

  if (!fs.existsSync(storeDir)) {
    console.log(chalk.yellow('No cache found to clear.'));
    return;
  }

  if (!force) {
    console.log(chalk.yellow('Warning: This will delete all cached vibe-check data.'));
    console.log(chalk.gray(`Location: ${storeDir}`));
    console.log('');
    console.log(chalk.white('Run with --force to confirm, or press Ctrl+C to cancel.'));
    return;
  }

  // Delete all files except .gitignore
  const files = fs.readdirSync(storeDir);
  let deleted = 0;

  for (const file of files) {
    if (file === '.gitignore') continue;

    const filePath = path.join(storeDir, file);
    try {
      fs.unlinkSync(filePath);
      deleted++;
    } catch (error) {
      console.error(chalk.red(`Failed to delete: ${file}`));
    }
  }

  console.log(chalk.green(`Cleared ${deleted} file(s) from cache.`));
  console.log(chalk.gray('Run `vibe-check timeline` to rebuild.'));
}
