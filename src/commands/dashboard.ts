import { Command } from 'commander';
import chalk from 'chalk';
import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { buildDashboardData } from '../insights';

export interface DashboardOptions {
  repo: string;
  open: boolean;
  output?: string;
}

export function createDashboardCommand(): Command {
  const cmd = new Command('dashboard')
    .description('Open the vibe-check dashboard with your stats')
    .option('-r, --repo <path>', 'Repository path', process.cwd())
    .option('--no-open', 'Export data without opening browser')
    .option('-o, --output <file>', 'Custom output path for dashboard-data.json')
    .action(async (options) => {
      await runDashboard(options);
    });

  return cmd;
}

async function runDashboard(options: DashboardOptions): Promise<void> {
  const { repo, open, output } = options;

  console.log(chalk.cyan('Building dashboard data...'));

  try {
    // Build dashboard data
    const data = buildDashboardData(repo);

    // Determine output path - use the dashboard directory in the package
    const dashboardDir = path.join(__dirname, '../../dashboard');
    const outputPath = output || path.join(dashboardDir, 'dashboard-data.json');

    // Ensure dashboard directory exists
    if (!fs.existsSync(dashboardDir)) {
      console.error(chalk.red('Dashboard directory not found'));
      process.exit(1);
    }

    // Write data as JSON
    fs.writeFileSync(outputPath, JSON.stringify(data, null, 2));

    // Also write as JS for file:// compatibility (bypasses CORS)
    const jsPath = path.join(dashboardDir, 'dashboard-data.js');
    fs.writeFileSync(jsPath, `window.VIBE_CHECK_DATA = ${JSON.stringify(data, null, 2)};`);

    console.log(chalk.green(`Data exported to ${outputPath}`));

    // Show summary
    console.log('');
    console.log(chalk.bold('Dashboard Summary:'));
    console.log(`  Level: ${data.profile.levelIcon} ${data.profile.level} ${data.profile.levelName}`);
    console.log(`  Streak: 🔥 ${data.profile.streak.current} days`);
    console.log(`  Sessions: ${data.stats.totals.sessions}`);
    console.log(`  Insights: ${data.insights.length} generated`);
    console.log('');

    // Open browser
    if (open) {
      const htmlPath = path.join(dashboardDir, 'index.html');
      const url = `file://${htmlPath}`;

      console.log(chalk.cyan('Opening dashboard...'));

      // Cross-platform open command
      const openCmd = process.platform === 'darwin' ? 'open' :
                      process.platform === 'win32' ? 'start' : 'xdg-open';

      exec(`${openCmd} "${url}"`, (error) => {
        if (error) {
          console.log(chalk.yellow('Could not open browser automatically.'));
          console.log(chalk.gray(`Open manually: ${url}`));
        }
      });
    } else {
      const htmlPath = path.join(dashboardDir, 'index.html');
      console.log(chalk.gray(`Open dashboard: file://${htmlPath}`));
    }
  } catch (error) {
    if (error instanceof Error) {
      console.error(chalk.red(`Error: ${error.message}`));
    }
    process.exit(1);
  }
}
