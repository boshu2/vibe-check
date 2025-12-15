
import { Command } from 'commander';
import chalk from 'chalk';
import * as path from 'path';
import { runAudit } from '../analyzers/audit.js';

export function createAuditCommand(): Command {
  const cmd = new Command('audit')
    .description('Scan codebase for AI-generated messes (monoliths, test gaps, TODOs)')
    .option('-r, --repo <path>', 'Repository path', process.cwd())
    .option('-v, --verbose', 'Show verbose output', false)
    .action(async (options) => {
      await runAuditCommand(options);
    });

  return cmd;
}

async function runAuditCommand(options: { repo: string; verbose: boolean }): Promise<void> {
  const { repo, verbose } = options;
  const rootDir = path.resolve(repo);
  
  if (verbose) {
    console.log(chalk.gray(`Scanning ${rootDir}...`));
  }
  
  try {
    const result = runAudit(rootDir);
    
    console.log('');
    console.log(chalk.bold.cyan('🔍 Vibe-Check Code Audit'));
    console.log(chalk.gray('─'.repeat(50)));
    console.log('');
    
    console.log(`Scanned ${result.stats.totalFiles} files (${result.stats.totalLines} lines)`);
    console.log('');
    
    // Monoliths
    if (result.monoliths.length > 0) {
      console.log(chalk.bold.red('⚠️  Monoliths (>600 lines):'));
      result.monoliths.slice(0, 5).forEach(m => {
        const relPath = path.relative(rootDir, m.file);
        console.log(`  ${chalk.white(relPath)}: ${chalk.yellow(m.lines + ' lines')}`);
      });
      if (result.monoliths.length > 5) console.log(chalk.gray(`  ...and ${result.monoliths.length - 5} more`));
      console.log('');
    } else {
      console.log(chalk.green('✅ No monoliths detected'));
      console.log('');
    }
    
    // Test Gaps
    if (result.testGaps.length > 0) {
      console.log(chalk.bold.yellow('⚠️  Untested Files (Test Gaps):'));
      // Sort by recent modification
      const recentGaps = result.testGaps.sort((a, b) => b.lastModified.getTime() - a.lastModified.getTime());
      
      recentGaps.slice(0, 5).forEach(g => {
        console.log(`  ${chalk.white(g.file)} ${chalk.gray('(last mod: ' + g.lastModified.toLocaleDateString() + ')')}`);
      });
      if (result.testGaps.length > 5) console.log(chalk.gray(`  ...and ${result.testGaps.length - 5} more`));
      console.log('');
    } else {
      console.log(chalk.green('✅ No obvious test gaps'));
      console.log('');
    }
    
    // TODOs
    if (result.todoDensity.length > 0) {
      console.log(chalk.bold.blue('📝 High TODO Density (>5):'));
      result.todoDensity.slice(0, 5).forEach(t => {
        const relPath = path.relative(rootDir, t.file);
        console.log(`  ${chalk.white(relPath)}: ${chalk.cyan(t.count + ' TODOs')}`);
      });
      console.log('');
    }
    
  } catch (error) {
    if (error instanceof Error) {
      console.error(chalk.red(`Error: ${error.message}`));
    }
    process.exit(1);
  }
}
