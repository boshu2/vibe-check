import { Command } from 'commander';
import chalk from 'chalk';
import { writeFileSync, existsSync, mkdirSync, chmodSync } from 'fs';
import { join } from 'path';

const PRE_PUSH_HOOK = `#!/bin/bash
# vibe-check pre-push hook
# Runs vibe-check on commits being pushed and displays metrics

# Colors
RED='\\033[0;31m'
YELLOW='\\033[1;33m'
GREEN='\\033[0;32m'
CYAN='\\033[0;36m'
NC='\\033[0m' # No Color

# Configuration (set these env vars to customize)
VIBE_CHECK_BLOCK_LOW=\${VIBE_CHECK_BLOCK_LOW:-false}  # Set to "true" to block push on LOW rating
VIBE_CHECK_SIMPLE=\${VIBE_CHECK_SIMPLE:-true}         # Use simple output by default
VIBE_CHECK_SCORE=\${VIBE_CHECK_SCORE:-true}           # Include vibe score

echo -e "\${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\${NC}"
echo -e "\${CYAN}  🎯 Running vibe-check before push...\${NC}"
echo -e "\${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\${NC}"
echo

# Read stdin for push info
while read local_ref local_sha remote_ref remote_sha; do
    # Skip if deleting branch
    if [ "$local_sha" = "0000000000000000000000000000000000000000" ]; then
        continue
    fi

    # Determine the range of commits
    if [ "$remote_sha" = "0000000000000000000000000000000000000000" ]; then
        # New branch - check all commits
        RANGE="$local_sha"
        SINCE_FLAG=""
    else
        # Existing branch - check commits since last push
        RANGE="$remote_sha..$local_sha"
        # Get the date of the remote SHA
        SINCE_DATE=$(git log -1 --format=%ci "$remote_sha" 2>/dev/null)
        if [ -n "$SINCE_DATE" ]; then
            SINCE_FLAG="--since \\"$SINCE_DATE\\""
        else
            SINCE_FLAG=""
        fi
    fi

    # Count commits being pushed
    COMMIT_COUNT=$(git rev-list --count "$RANGE" 2>/dev/null || echo "0")

    if [ "$COMMIT_COUNT" = "0" ]; then
        echo -e "\${YELLOW}No new commits to analyze\${NC}"
        continue
    fi

    echo -e "Analyzing \${GREEN}$COMMIT_COUNT\${NC} commit(s) on \${CYAN}$local_ref\${NC}"
    echo

    # Build vibe-check command (use local if available, otherwise npx)
    if command -v vibe-check &> /dev/null; then
        VIBE_CMD="vibe-check"
    else
        VIBE_CMD="npx --yes @boshu2/vibe-check"
    fi

    if [ "$VIBE_CHECK_SIMPLE" = "true" ]; then
        VIBE_CMD="$VIBE_CMD --simple"
    fi

    if [ "$VIBE_CHECK_SCORE" = "true" ]; then
        VIBE_CMD="$VIBE_CMD --score"
    fi

    # Run vibe-check and capture output
    if [ -n "$SINCE_FLAG" ]; then
        OUTPUT=$(eval "$VIBE_CMD $SINCE_FLAG" 2>&1)
    else
        OUTPUT=$(eval "$VIBE_CMD --since '1 week ago'" 2>&1)
    fi

    EXIT_CODE=$?

    # Display output
    echo "$OUTPUT"
    echo

    # Check if we should block on LOW rating
    if [ "$VIBE_CHECK_BLOCK_LOW" = "true" ] && [ $EXIT_CODE -eq 1 ]; then
        echo -e "\${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\${NC}"
        echo -e "\${RED}  ⛔ Push blocked: LOW vibe rating\${NC}"
        echo -e "\${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\${NC}"
        echo
        echo -e "To push anyway, set: \${YELLOW}VIBE_CHECK_BLOCK_LOW=false git push\${NC}"
        exit 1
    fi
done

echo -e "\${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\${NC}"
echo -e "\${GREEN}  ✓ Vibe check complete, proceeding with push\${NC}"
echo -e "\${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\${NC}"
echo

exit 0
`;

export function createInitHookCommand(): Command {
  const cmd = new Command('init-hook')
    .description('Install vibe-check git hook in current repository')
    .option('-f, --force', 'Overwrite existing hook', false)
    .option('--block-low', 'Configure hook to block pushes on LOW rating', false)
    .action(async (options) => {
      await runInitHook(options);
    });

  return cmd;
}

async function runInitHook(options: { force: boolean; blockLow: boolean }): Promise<void> {
  const cwd = process.cwd();
  const gitDir = join(cwd, '.git');
  const hooksDir = join(gitDir, 'hooks');
  const hookPath = join(hooksDir, 'pre-push');

  // Check if we're in a git repo
  if (!existsSync(gitDir)) {
    console.error(chalk.red('Error: Not a git repository'));
    console.error(chalk.gray('Run this command from the root of a git repository'));
    process.exit(1);
  }

  // Check if hook already exists
  if (existsSync(hookPath) && !options.force) {
    console.error(chalk.yellow('pre-push hook already exists'));
    console.error(chalk.gray('Use --force to overwrite'));
    process.exit(1);
  }

  // Create hooks directory if needed
  if (!existsSync(hooksDir)) {
    mkdirSync(hooksDir, { recursive: true });
  }

  // Modify hook content if blocking is enabled
  let hookContent = PRE_PUSH_HOOK;
  if (options.blockLow) {
    hookContent = hookContent.replace(
      'VIBE_CHECK_BLOCK_LOW=${VIBE_CHECK_BLOCK_LOW:-false}',
      'VIBE_CHECK_BLOCK_LOW=${VIBE_CHECK_BLOCK_LOW:-true}'
    );
  }

  // Write the hook
  writeFileSync(hookPath, hookContent);
  chmodSync(hookPath, 0o755);

  console.log();
  console.log(chalk.green('✓ vibe-check pre-push hook installed'));
  console.log();
  console.log(chalk.gray('Location:'), hookPath);
  console.log();
  console.log(chalk.bold('Configuration:'));
  console.log(chalk.gray('  VIBE_CHECK_BLOCK_LOW=true   Block push on LOW rating'));
  console.log(chalk.gray('  VIBE_CHECK_SIMPLE=false     Show full output'));
  console.log(chalk.gray('  VIBE_CHECK_SCORE=false      Hide vibe score'));
  console.log();
  console.log(chalk.cyan('The hook will run automatically on every git push'));
  console.log();
}
