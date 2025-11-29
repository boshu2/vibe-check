# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.2.0] - 2025-11-29

### Added
- **Git Hook** - `vibe-check init-hook` command to install pre-push hook
  - Runs vibe-check automatically before every git push
  - `--block-low` option to reject pushes with LOW rating
  - Configurable via environment variables
- Pre-push hook script in `hooks/pre-push` for manual installation

## [1.1.0] - 2025-11-29

### Added
- **Gamification System** - XP, levels, streaks, and achievements to make vibe-checking more engaging
  - 18 achievements across streak, score, sessions, and special categories
  - XP rewards for sessions, streaks, scores, and achievements
  - Level progression from "Newbie" (1) to "Legend" (10)
  - Daily streaks with weekly goals
  - 2 hidden achievements to discover
- **Profile Command** - `vibe-check profile` to view your stats, achievements, and progress
  - `--achievements` flag to see all achievements
  - `--stats` flag for detailed statistics
  - `--json` flag for machine-readable output
- **GitHub Action** - Automated vibe-check on PRs with comment posting
  - Configurable thresholds for pass/fail
  - JSON artifact output option
  - Full PR comment with metrics and recommendations
- **JSON File Output** - `--output <file>` flag to save results to a JSON file
- **Dashboard Shell** - Static HTML dashboard for viewing profile (in `dashboard/` directory)
- **Simple Mode** - `--simple` flag for compact output showing only essential metrics
- **UX Improvements**
  - Summary section with top strength and focus area
  - Opportunities section with actionable tips for low/medium metrics
  - Date period context in output header
  - Confidence display for level recommendations
- **Anti-Gaming** - XP deduplication prevents multiple rewards for same time period
- **Comprehensive Tests** - 108 tests covering gamification, metrics, and scoring

### Changed
- Requires Node.js 20+ (for Vitest 4.x compatibility)
- Updated all dependencies to November 2025 stable versions
- Improved CLI output clarity with better terminology
- Renamed internal "FAAFO metrics" to "vibe metrics" (user-facing term unchanged)

### Fixed
- Grammar issues in CLI output
- Level recommendation confidence display

## [1.0.2] - 2025-11-28

### Changed
- Complete README rewrite with problem-first structure
- Added "The Problem" and "The Insight" sections
- Added practical "When to Run" guidance
- Added prevention tips for debug spiral patterns

## [1.0.1] - 2025-11-28

### Added
- LICENSE file (MIT)
- CHANGELOG.md
- .npmignore for cleaner package
- Jest test suite
- GitHub Actions CI

### Fixed
- Version now imported from package.json (was hardcoded)

## [1.0.0] - 2025-11-28

### Added
- Initial release
- 5 FAAFO metrics: Iteration Velocity, Rework Ratio, Trust Pass Rate, Debug Spiral Duration, Flow Efficiency
- Terminal, JSON, and Markdown output formats
- Debug spiral detection with pattern categorization
- Conventional commit parsing
