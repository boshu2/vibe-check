# vibe-check Development Guide

## npm Publishing Standards

### When to Publish

| Change Type | Version Bump | Publish? |
|-------------|--------------|----------|
| **Breaking changes** | MAJOR (1.0.0 → 2.0.0) | Yes |
| **New features** (backward compatible) | MINOR (1.0.0 → 1.1.0) | Yes |
| **Bug fixes** | PATCH (1.0.0 → 1.0.1) | Yes |
| **Docs only (README, CHANGELOG)** | None | **No** |
| **Tests only** | None | **No** |
| **CI/tooling only** | None | **No** |

### GitHub README vs npm README

- **GitHub README**: Always shows latest from repo
- **npm README**: Snapshot from last publish - only updates when you `npm publish`

**Docs-only changes don't need a publish.** Just commit and push to GitHub.

### Version Commands

```bash
# Check current version
npm version

# Bump and publish (creates git tag automatically)
npm version patch   # 1.0.1 → 1.0.2 (bug fixes)
npm version minor   # 1.0.1 → 1.1.0 (new features)
npm version major   # 1.0.1 → 2.0.0 (breaking changes)

# Then publish
npm publish --access=public
```

### How Users Consume Versions

```bash
npm install @boshu2/vibe-check        # Gets "latest"
npm install @boshu2/vibe-check@1.0.2  # Exact version
npm install @boshu2/vibe-check@^1.0.0 # Any 1.x.x (common default)
npm install @boshu2/vibe-check@~1.0.0 # Any 1.0.x only
```

Most users have `^` (caret) in their package.json, meaning they'll auto-update to latest minor/patch.

## Development Workflow

### Running Locally

```bash
npm run dev           # Run with ts-node
npm run build         # Compile TypeScript
npm test              # Run Vitest tests
npm run test:coverage # Tests with coverage
```

### Testing the CLI

```bash
# Run against a repo
node dist/cli.js --repo /path/to/repo --since "1 week ago"

# Test different output formats
node dist/cli.js --format json
node dist/cli.js --format markdown
```

### Before Publishing

1. Ensure tests pass: `npm test`
2. Update CHANGELOG.md with changes
3. Bump version appropriately (see table above)
4. Commit version bump
5. `npm publish --access=public`

## Architecture

```
src/
├── cli.ts           # CLI entry point (Commander.js)
├── git.ts           # Git operations (simple-git)
├── types.ts         # TypeScript interfaces
├── metrics/
│   ├── index.ts     # Orchestrates all metrics
│   ├── velocity.ts  # Iteration velocity calculation
│   ├── rework.ts    # Rework ratio calculation
│   ├── trust.ts     # Trust pass rate calculation
│   ├── spirals.ts   # Debug spiral detection
│   └── flow.ts      # Flow efficiency calculation
└── output/
    ├── index.ts     # Output format router
    ├── terminal.ts  # Colored terminal output
    ├── json.ts      # JSON output
    └── markdown.ts  # Markdown output
```

## The 5 Metrics

| Metric | Measures | Threshold |
|--------|----------|-----------|
| Iteration Velocity | Commits/hour | >5 = Elite |
| Rework Ratio | % fix commits | <30% = Elite |
| Trust Pass Rate | % commits without immediate fix | >95% = Elite |
| Debug Spiral Duration | Avg time in fix chains | <15m = Elite |
| Flow Efficiency | % time building vs debugging | >90% = Elite |

## Debug Spiral Detection

A "debug spiral" is detected when 3+ consecutive fix commits target the same component. Patterns are categorized:

- `SECRETS_AUTH` - OAuth/credentials issues
- `API_MISMATCH` - API version/schema problems
- `VOLUME_CONFIG` - Mount/permission issues
- `SSL_TLS` - Certificate problems
- `IMAGE_REGISTRY` - Container pull issues
- `GITOPS_DRIFT` - Sync/reconciliation issues
