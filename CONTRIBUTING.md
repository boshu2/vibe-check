# Contributing to vibe-check

Thanks for your interest in contributing to vibe-check! This document covers how to get started.

---

## Quick Start

```bash
# Clone the repo
git clone https://github.com/boshu2/vibe-check.git
cd vibe-check

# Install dependencies
npm install

# Run in development mode
npm run dev -- --since "1 week ago"

# Run tests
npm test
```

---

## Development Setup

### Prerequisites

- **Node.js** >= 20.0.0
- **npm** >= 9.0.0
- **Git** (for testing against repos)

### Project Structure

```
vibe-check/
├── src/
│   ├── cli.ts           # Entry point
│   ├── git.ts           # Git operations
│   ├── types.ts         # TypeScript interfaces
│   ├── commands/        # CLI commands
│   ├── metrics/         # Metric calculations
│   ├── score/           # VibeScore computation
│   ├── sessions/        # Session management
│   ├── gamification/    # XP, achievements, etc.
│   └── output/          # Formatters
├── tests/               # Test files
├── docs/                # Documentation
└── bin/                 # CLI wrapper
```

### Scripts

```bash
npm run build     # Compile TypeScript
npm run dev       # Run with ts-node
npm test          # Run tests
npm run test:coverage  # Tests with coverage
```

---

## How to Contribute

### Reporting Bugs

1. Check existing [issues](https://github.com/boshu2/vibe-check/issues)
2. Create a new issue with:
   - Clear title
   - Steps to reproduce
   - Expected vs actual behavior
   - Node version, OS

### Suggesting Features

1. Open an issue with `[Feature]` prefix
2. Describe the use case
3. Explain why it fits vibe-check's purpose

### Submitting Code

1. Fork the repo
2. Create a feature branch: `git checkout -b feat/my-feature`
3. Make changes
4. Add tests for new functionality
5. Ensure tests pass: `npm test`
6. Commit with conventional commits: `feat: add my feature`
7. Push and create PR

---

## Code Guidelines

### TypeScript

- Use strict typing (no `any` unless necessary)
- Export interfaces from `types.ts`
- Use descriptive variable names

### Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat(scope): add new feature
fix(scope): fix bug
docs: update documentation
test: add tests
chore: maintenance task
```

### Testing

- Add tests for new features
- Maintain test coverage
- Use descriptive test names

```typescript
describe('calculateTrustPassRate', () => {
  it('should return 100% when no immediate fixes', () => {
    // ...
  });
});
```

---

## Adding New Features

### Adding a Metric

1. Create `src/metrics/new-metric.ts`
2. Export function returning `MetricResult`
3. Add to `src/metrics/index.ts`
4. Update `types.ts` with new interfaces
5. Update `output/terminal.ts` to display
6. Add tests

### Adding an Achievement

1. Edit `src/gamification/achievements.ts`
2. Add to `ACHIEVEMENTS` array
3. Define condition function
4. Add test case

### Adding a Command

1. Create `src/commands/new-command.ts`
2. Export from `src/commands/index.ts`
3. Register in `src/cli.ts`
4. Document in README.md

---

## Testing Locally

### Against a Real Repo

```bash
# Point to any git repo
npm run dev -- --repo /path/to/repo --since "1 week ago"
```

### With Verbose Output

```bash
npm run dev -- --verbose --since "1 week ago"
```

### Testing Gamification

```bash
npm run dev -- profile
npm run dev -- profile --achievements
```

---

## Pull Request Process

1. **Title**: Use conventional commit format
2. **Description**: Explain what and why
3. **Tests**: Include tests for changes
4. **Docs**: Update docs if needed
5. **Review**: Address feedback promptly

### PR Checklist

- [ ] Tests pass (`npm test`)
- [ ] Code compiles (`npm run build`)
- [ ] No lint errors
- [ ] Docs updated if needed
- [ ] Commit messages follow convention

---

## Release Process

Maintainers only:

```bash
# Bump version (creates git tag)
npm version patch|minor|major

# Publish to npm
npm publish --access=public
```

---

## Code of Conduct

- Be respectful and inclusive
- Focus on constructive feedback
- Help others learn

---

## Questions?

- Open an [issue](https://github.com/boshu2/vibe-check/issues)
- Check existing docs in `/docs`

---

**Thanks for contributing!**
