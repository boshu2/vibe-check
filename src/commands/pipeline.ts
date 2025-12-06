import { Command } from 'commander';
import chalk from 'chalk';
import * as fs from 'fs';
import * as path from 'path';

interface PipelineConfig {
  type: 'github' | 'gitlab' | 'vercel' | 'netlify' | 'circleci' | 'jenkins' | 'unknown';
  file: string;
  triggers: string[];
  jobs: PipelineJob[];
  gates: GateCheck[];
  issues: PipelineIssue[];
  score: number;
}

interface PipelineJob {
  name: string;
  runs: string[];
  hasTests: boolean;
  hasLint: boolean;
  hasBuild: boolean;
  hasTypeCheck: boolean;
}

interface GateCheck {
  name: string;
  present: boolean;
  blocking: boolean;
}

interface PipelineIssue {
  severity: 'critical' | 'warning' | 'info';
  message: string;
  fix?: string;
}

const GATE_CHECKS = [
  { name: 'Type checking', patterns: ['type-check', 'tsc', 'typescript', 'mypy', 'pyright'] },
  { name: 'Linting', patterns: ['lint', 'eslint', 'prettier', 'ruff', 'flake8', 'pylint', 'golangci-lint'] },
  { name: 'Unit tests', patterns: ['test', 'vitest', 'jest', 'pytest', 'go test', 'cargo test'] },
  { name: 'E2E tests', patterns: ['e2e', 'playwright', 'cypress', 'selenium'] },
  { name: 'Security scan', patterns: ['security', 'snyk', 'dependabot', 'trivy', 'codeql'] },
  { name: 'Build verification', patterns: ['build', 'compile', 'next build', 'vite build'] },
];

export function createPipelineCommand(): Command {
  const cmd = new Command('pipeline')
    .description('Audit CI/CD pipeline for deployment safety')
    .option('-r, --repo <path>', 'Repository path', process.cwd())
    .option('-f, --format <type>', 'Output format: terminal, json', 'terminal')
    .option('--fix', 'Show fix suggestions', false)
    .action(async (options) => {
      await runPipelineAudit(options);
    });

  return cmd;
}

async function runPipelineAudit(options: {
  repo: string;
  format: string;
  fix: boolean;
}): Promise<void> {
  const repoPath = path.resolve(options.repo);
  const configs = detectPipelines(repoPath);

  if (options.format === 'json') {
    console.log(JSON.stringify({
      repo: repoPath,
      pipelines: configs,
      overall_score: configs.length > 0
        ? Math.round(configs.reduce((sum, c) => sum + c.score, 0) / configs.length)
        : 0,
    }, null, 2));
    return;
  }

  // Terminal output
  console.log('');
  console.log(chalk.bold.cyan('═'.repeat(64)));
  console.log(chalk.bold.cyan('  PIPELINE AUDIT'));
  console.log(chalk.bold.cyan('═'.repeat(64)));
  console.log('');

  if (configs.length === 0) {
    console.log(chalk.red.bold('  ⚠️  NO CI/CD PIPELINE DETECTED'));
    console.log('');
    console.log(chalk.gray('  Your deployments have no safety gates.'));
    console.log(chalk.gray('  Broken code goes straight to production.'));
    console.log('');
    printNoPipelineSuggestions(repoPath, options.fix);
    return;
  }

  for (const config of configs) {
    printPipelineConfig(config, options.fix);
  }

  // Overall assessment
  const avgScore = Math.round(configs.reduce((sum, c) => sum + c.score, 0) / configs.length);
  const rating = getScoreRating(avgScore);

  console.log('');
  console.log(chalk.bold.white('  OVERALL PIPELINE HEALTH'));
  console.log('');
  console.log(`  Score: ${colorScore(avgScore)}  ${rating}`);
  console.log('');
  console.log(chalk.cyan('═'.repeat(64)));
  console.log('');
}

function detectPipelines(repoPath: string): PipelineConfig[] {
  const configs: PipelineConfig[] = [];

  // GitHub Actions
  const ghWorkflowsPath = path.join(repoPath, '.github', 'workflows');
  if (fs.existsSync(ghWorkflowsPath)) {
    const files = fs.readdirSync(ghWorkflowsPath).filter(f => f.endsWith('.yml') || f.endsWith('.yaml'));
    for (const file of files) {
      const filePath = path.join(ghWorkflowsPath, file);
      const config = parseGitHubWorkflow(filePath, file);
      if (config) configs.push(config);
    }
  }

  // GitLab CI
  const gitlabPath = path.join(repoPath, '.gitlab-ci.yml');
  if (fs.existsSync(gitlabPath)) {
    const config = parseGitLabCI(gitlabPath);
    if (config) configs.push(config);
  }

  // Vercel
  const vercelPath = path.join(repoPath, 'vercel.json');
  if (fs.existsSync(vercelPath)) {
    configs.push(parseVercelConfig(vercelPath, repoPath));
  }

  // Check for Vercel via package.json (common setup)
  const packageJsonPath = path.join(repoPath, 'package.json');
  if (fs.existsSync(packageJsonPath) && configs.length === 0) {
    const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
    if (pkg.dependencies?.['@vercel/analytics'] || pkg.dependencies?.['@vercel/speed-insights']) {
      configs.push(createVercelImplicitConfig(repoPath));
    }
  }

  // CircleCI
  const circlePath = path.join(repoPath, '.circleci', 'config.yml');
  if (fs.existsSync(circlePath)) {
    const config = parseCircleCI(circlePath);
    if (config) configs.push(config);
  }

  // Netlify
  const netlifyPath = path.join(repoPath, 'netlify.toml');
  if (fs.existsSync(netlifyPath)) {
    configs.push(parseNetlifyConfig(netlifyPath, repoPath));
  }

  return configs;
}

function parseGitHubWorkflow(filePath: string, fileName: string): PipelineConfig | null {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const config: PipelineConfig = {
      type: 'github',
      file: `.github/workflows/${fileName}`,
      triggers: [],
      jobs: [],
      gates: [],
      issues: [],
      score: 0,
    };

    // Parse triggers
    if (content.includes('pull_request')) config.triggers.push('pull_request');
    if (content.includes('push:')) config.triggers.push('push');

    // Parse jobs (simple regex for now)
    const jobMatches = content.matchAll(/^\s{2}(\w+[-\w]*):\s*$/gm);
    const contentLower = content.toLowerCase();

    for (const match of jobMatches) {
      const jobName = match[1];
      const job: PipelineJob = {
        name: jobName,
        runs: [],
        hasTests: false,
        hasLint: false,
        hasBuild: false,
        hasTypeCheck: false,
      };

      // Check what this job does
      if (contentLower.includes('test') || contentLower.includes('vitest') || contentLower.includes('jest')) {
        job.hasTests = true;
      }
      if (contentLower.includes('lint') || contentLower.includes('eslint')) {
        job.hasLint = true;
      }
      if (contentLower.includes('build')) {
        job.hasBuild = true;
      }
      if (contentLower.includes('type-check') || contentLower.includes('tsc')) {
        job.hasTypeCheck = true;
      }

      config.jobs.push(job);
    }

    // Check gates
    for (const gate of GATE_CHECKS) {
      const present = gate.patterns.some(p => contentLower.includes(p.toLowerCase()));
      config.gates.push({
        name: gate.name,
        present,
        blocking: present && !content.includes('continue-on-error: true'),
      });
    }

    // Check for issues
    if (!config.triggers.includes('pull_request')) {
      config.issues.push({
        severity: 'critical',
        message: 'No PR trigger - broken code can merge without checks',
        fix: 'Add "on: pull_request" to run checks before merge',
      });
    }

    if (content.includes('continue-on-error: true')) {
      config.issues.push({
        severity: 'warning',
        message: 'Some steps use continue-on-error - failures may be ignored',
      });
    }

    if (!config.gates.some(g => g.name === 'Unit tests' && g.present)) {
      config.issues.push({
        severity: 'warning',
        message: 'No test step detected',
        fix: 'Add a test step: npm test, vitest, jest, etc.',
      });
    }

    // Calculate score
    config.score = calculateScore(config);

    return config;
  } catch {
    return null;
  }
}

function parseGitLabCI(filePath: string): PipelineConfig | null {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const contentLower = content.toLowerCase();

    const config: PipelineConfig = {
      type: 'gitlab',
      file: '.gitlab-ci.yml',
      triggers: ['merge_request', 'push'],
      jobs: [],
      gates: [],
      issues: [],
      score: 0,
    };

    // Check gates
    for (const gate of GATE_CHECKS) {
      const present = gate.patterns.some(p => contentLower.includes(p.toLowerCase()));
      config.gates.push({
        name: gate.name,
        present,
        blocking: present,
      });
    }

    config.score = calculateScore(config);
    return config;
  } catch {
    return null;
  }
}

function parseVercelConfig(filePath: string, repoPath: string): PipelineConfig {
  const config: PipelineConfig = {
    type: 'vercel',
    file: 'vercel.json',
    triggers: ['push'],
    jobs: [{ name: 'build', runs: ['build'], hasTests: false, hasLint: false, hasBuild: true, hasTypeCheck: false }],
    gates: [],
    issues: [],
    score: 0,
  };

  // Vercel only runs build - check if package.json has pre-build checks
  const packageJsonPath = path.join(repoPath, 'package.json');
  if (fs.existsSync(packageJsonPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
      const scripts = pkg.scripts || {};

      // Check if build script includes validation
      const buildScript = scripts.build || '';
      if (buildScript.includes('lint') || buildScript.includes('type-check')) {
        config.gates.push({ name: 'Build includes checks', present: true, blocking: true });
      }
    } catch { /* ignore */ }
  }

  config.issues.push({
    severity: 'critical',
    message: 'Vercel only runs build - no pre-merge validation',
    fix: 'Add GitHub Actions or another CI to run tests/lint before merge',
  });

  config.gates.push({ name: 'Pre-merge checks', present: false, blocking: false });

  config.score = 25; // Low score for build-only
  return config;
}

function createVercelImplicitConfig(repoPath: string): PipelineConfig {
  const config: PipelineConfig = {
    type: 'vercel',
    file: '(detected from @vercel/* packages)',
    triggers: ['push'],
    jobs: [{ name: 'build', runs: ['build'], hasTests: false, hasLint: false, hasBuild: true, hasTypeCheck: false }],
    gates: [{ name: 'Pre-merge checks', present: false, blocking: false }],
    issues: [{
      severity: 'critical',
      message: 'Vercel deploys on push with no CI/CD gates',
      fix: 'Add .github/workflows/ci.yml with tests, lint, and type-check',
    }],
    score: 15,
  };

  return config;
}

function parseCircleCI(filePath: string): PipelineConfig | null {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const contentLower = content.toLowerCase();

    const config: PipelineConfig = {
      type: 'circleci',
      file: '.circleci/config.yml',
      triggers: ['push', 'pull_request'],
      jobs: [],
      gates: [],
      issues: [],
      score: 0,
    };

    for (const gate of GATE_CHECKS) {
      const present = gate.patterns.some(p => contentLower.includes(p.toLowerCase()));
      config.gates.push({ name: gate.name, present, blocking: present });
    }

    config.score = calculateScore(config);
    return config;
  } catch {
    return null;
  }
}

function parseNetlifyConfig(filePath: string, repoPath: string): PipelineConfig {
  const config: PipelineConfig = {
    type: 'netlify',
    file: 'netlify.toml',
    triggers: ['push'],
    jobs: [{ name: 'build', runs: ['build'], hasTests: false, hasLint: false, hasBuild: true, hasTypeCheck: false }],
    gates: [{ name: 'Pre-merge checks', present: false, blocking: false }],
    issues: [{
      severity: 'critical',
      message: 'Netlify only runs build - no pre-merge validation',
      fix: 'Add GitHub Actions for tests and lint before merge',
    }],
    score: 25,
  };

  return config;
}

function calculateScore(config: PipelineConfig): number {
  let score = 0;

  // Trigger score (max 20)
  if (config.triggers.includes('pull_request')) score += 20;
  else if (config.triggers.includes('push')) score += 5;

  // Gates score (max 60)
  const gateScore = config.gates.filter(g => g.present && g.blocking).length * 10;
  score += Math.min(gateScore, 60);

  // No critical issues bonus (max 20)
  const criticalCount = config.issues.filter(i => i.severity === 'critical').length;
  if (criticalCount === 0) score += 20;
  else if (criticalCount === 1) score += 10;

  return Math.min(score, 100);
}

function getScoreRating(score: number): string {
  if (score >= 80) return chalk.green.bold('SOLID');
  if (score >= 60) return chalk.yellow.bold('DECENT');
  if (score >= 40) return chalk.yellow('WEAK');
  return chalk.red.bold('YOLO');
}

function colorScore(score: number): string {
  if (score >= 80) return chalk.green.bold(`${score}/100`);
  if (score >= 60) return chalk.yellow.bold(`${score}/100`);
  if (score >= 40) return chalk.yellow(`${score}/100`);
  return chalk.red.bold(`${score}/100`);
}

function printPipelineConfig(config: PipelineConfig, showFix: boolean): void {
  const typeLabel = config.type.toUpperCase();
  const typeColor = config.type === 'github' ? chalk.white : chalk.gray;

  console.log(typeColor(`  ${typeLabel}: ${config.file}`));
  console.log('');

  // Gates
  console.log(chalk.bold.white('  Gates:'));
  for (const gate of config.gates) {
    const status = gate.present
      ? (gate.blocking ? chalk.green('✓ blocking') : chalk.yellow('✓ non-blocking'))
      : chalk.red('✗ missing');
    console.log(`    ${gate.name}: ${status}`);
  }
  console.log('');

  // Triggers
  console.log(chalk.bold.white('  Triggers:'));
  for (const trigger of config.triggers) {
    const triggerColor = trigger === 'pull_request' ? chalk.green : chalk.yellow;
    console.log(`    ${triggerColor(trigger)}`);
  }
  console.log('');

  // Issues
  if (config.issues.length > 0) {
    console.log(chalk.bold.white('  Issues:'));
    for (const issue of config.issues) {
      const severityColor = issue.severity === 'critical' ? chalk.red
        : issue.severity === 'warning' ? chalk.yellow
        : chalk.gray;
      console.log(`    ${severityColor(`[${issue.severity.toUpperCase()}]`)} ${issue.message}`);
      if (showFix && issue.fix) {
        console.log(chalk.gray(`      Fix: ${issue.fix}`));
      }
    }
    console.log('');
  }

  // Score
  console.log(`  Score: ${colorScore(config.score)}`);
  console.log('');
}

function printNoPipelineSuggestions(repoPath: string, showFix: boolean): void {
  // Check what kind of project this is
  const packageJsonPath = path.join(repoPath, 'package.json');
  let projectType = 'unknown';

  if (fs.existsSync(packageJsonPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
      if (pkg.dependencies?.next) projectType = 'nextjs';
      else if (pkg.dependencies?.react) projectType = 'react';
      else if (pkg.dependencies?.vue) projectType = 'vue';
      else projectType = 'node';
    } catch { /* ignore */ }
  }

  console.log(chalk.bold.white('  SUGGESTIONS:'));
  console.log('');

  if (showFix) {
    console.log(chalk.cyan('  Create .github/workflows/ci.yml with:'));
    console.log('');

    if (projectType === 'nextjs') {
      console.log(chalk.gray(`    name: CI
    on: [push, pull_request]
    jobs:
      validate:
        runs-on: ubuntu-latest
        steps:
          - uses: actions/checkout@v4
          - uses: actions/setup-node@v4
          - run: npm ci
          - run: npm run type-check
          - run: npm run lint
          - run: npm test
          - run: npm run build`));
    } else {
      console.log(chalk.gray(`    name: CI
    on: [push, pull_request]
    jobs:
      test:
        runs-on: ubuntu-latest
        steps:
          - uses: actions/checkout@v4
          - run: npm ci
          - run: npm test`));
    }
    console.log('');
  } else {
    console.log(chalk.gray('  Run with --fix to see suggested workflow'));
  }

  console.log(chalk.cyan('═'.repeat(64)));
  console.log('');
}
