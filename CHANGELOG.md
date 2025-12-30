# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed

- **Session Module Refactor** - Split monolithic session.ts into focused modules
  - `session.ts` - Thin orchestrator with re-exports (139 lines)
  - `session-helpers.ts` - Storage, pattern detection, formatting (451 lines)
  - `session-start.ts` - Session initialization and baseline capture (149 lines)
  - `session-end.ts` - Metrics calculation, analysis, output (431 lines)
  - Removed dead `calculateEnhancedMetrics()` function
  - Refactored `runSessionEndCli()` to use shared helpers (DRY)
  - Added debug mode support (`--debug` flag, `DEBUG=1` env var)

- **CLI Rebrand** - CLI command name updated from `vibe-check` to `vc` for brevity
  - All commands now use `vc` prefix (e.g., `vc watch`, `vc session start`)
  - Storage directory remains `.vibe-check/` for backwards compatibility
  - npm package name remains `@boshu2/vibe-check`
  - Documentation updated to reflect new command name

- **New Agent Commands** - Added computed query commands for agent integration
  - `vc spiral` - "Am I spiraling?" boolean answer with escape actions
  - `vc diagnose` - "What's wrong?" top issue and recommended fix
  - `vc recommend` - "What should I focus on?" prioritized actions
  - `vc prime` - Context recovery after compaction
  - `vc onboard` - Output AGENTS.md snippet for agent integration
  - All commands support `--json` flag for machine-readable output

- **Package Structure** - Organized internal modules
  - `src/internal/` contains shared context and output utilities
  - `src/commands/` follows TypeScript CLI conventions (oclif, Commander.js)

## [2.4.0] - 2025-12-29

### Added

- **Complexity Driver Architecture** - Shell-based drivers for language-specific complexity analysis
  - **Python Driver** (`drivers/python.sh`) - Wraps [radon](https://radon.readthedocs.io/) for cyclomatic complexity
  - **JavaScript/TypeScript Driver** (`drivers/javascript.sh`) - Wraps [cyclomatic-complexity](https://github.com/pilotpirxie/cyclomatic-complexity)
  - **Go Driver** (`drivers/go.sh`) - Wraps [gocyclo](https://github.com/fzipp/gocyclo)
  - **Rust Driver** (`drivers/rust.sh`) - Wraps [rust-code-analysis](https://mozilla.github.io/rust-code-analysis/)
  - **PHP Driver** (`drivers/php.sh`) - Wraps [PHPMD](https://phpmd.org/)
  - **Java Driver** (`drivers/java.sh`) - Wraps [PMD](https://pmd.github.io/)
  - All drivers output unified `ComplexityReport` JSON schema
  - Grade thresholds: A (1-5), B (6-10), C (11-20), D (21-30), E (31-40), F (41+)

- **CLI Integration** - `vibe-check driver <language> [directory]` command
  - Runs any driver and outputs JSON
  - Helpful error messages when tools not installed

- **Modularity Integration** - `--with-complexity <driver>` flag for modularity command
  - Combines complexity data with module analysis
  - Weighted scoring includes complexity grades

### Developer

- 6 shell drivers in `drivers/` directory
- `drivers/README.md` with installation and usage docs

## [2.3.0] - 2025-12-28

### Added

- **AI Safety Detection Module** - Detects LLM-specific security antipatterns in commit history
  - **Secret Leakage Detector** - Scans commits for exposed credentials
    - 8 patterns: OpenAI API keys, GitHub PATs, GitLab PATs, AWS keys, Slack tokens, generic secrets
    - Two modes: full diff scanning (async) and message-only scanning (sync)
    - Masks secrets in output (first 8 chars + `***`)
    - Critical severity for high-value secrets (API keys, tokens)
  - **Scope Violation Detector** - Detects files modified outside declared scope
    - Configure via `.vibe-check/scope.yaml` with glob patterns
    - Supports allowed patterns, directories, and exceptions
    - Uses minimatch for flexible pattern matching
  - **Contract Drift Detector** - Tracks commit message format compliance
    - Scores commits against conventional commit format (0-100)
    - Detects issues: missing_type, invalid_type, vague_message, too_short, etc.
    - Calculates baseline vs current compliance with trend detection
    - Configurable drift threshold (default: 30%)
  - **Token Spiral Estimator** - Estimates token usage and detects explosions
    - Three estimation methods: char_count, lines, diff_size
    - Baseline from first 5 commits, explosion at >2x baseline
    - Indicators: large_diff, many_files, massive_additions, bulk_additions

- **Watch Mode Integration** - Real-time secret detection with severity-based alerts
  - Rate-limited alerts via commit:pattern:file tracking
  - Red/bold for critical secrets, yellow for warnings

- **Session Integration** - AI Safety included in session end metrics
  - New `ai_safety` section in JSON output
  - Terminal output with health status and recommendations

### Changed

- `analyzeAISafety()` orchestrator runs all 4 detectors and aggregates results
- Added `minimatch` and `js-yaml` dependencies for scope configuration

### Developer

- 31 new unit and integration tests for AI Safety module
- Updated CLAUDE.md with AI Safety documentation and architecture

## [2.2.1] - 2025-12-27

### Added

- **Enhanced Metrics** - Three new metrics for deeper insights into development habits
  - **Tracer Bullet Ratio** - Measures proactive validation via `tracer:` or `tb:` commits
    - Tracers before features = proactive validation (good!)
    - Tracers before fixes = reactive debugging (too late!)
    - Rating: ELITE >20% | HIGH >10% | MEDIUM >5% | LOW <5%
  - **Investigation Gap Detection** - Surfaces hidden debugging time
    - Detects gaps >15min followed by fix commits
    - Shows total investigation time and longest gap
    - Rating: ELITE 0min | HIGH <30min | MEDIUM <60min | LOW >60min
  - **Domain Cohesion Score** - Measures how focused changes are
    - Cohesive commits touch 1 domain
    - Scattered commits touch 3+ domains
    - Rating: ELITE >80% | HIGH >60% | MEDIUM >40% | LOW <40%

- **Eldritch Horror Detector** - Detects oversized functions in the `audit` command
  - Functions >200 lines = warning
  - Functions >500 lines = critical
  - Supports TypeScript, JavaScript, Python, Go

- **Tracer Commit Type** - New `tracer` commit type recognized
  - Use `tracer:` or `tb:` prefix for tracer bullet commits
  - Example: `tracer(auth): validate OAuth token refresh flow`
  - Tracers are counted separately from features/fixes

### Changed

- Enhanced metrics are calculated when using `--score` flag
- Audit command now includes function-level analysis

## [2.0.0] - 2025-12-15

### Added
- **Audit Command** - `vibe-check audit` for static analysis of code messes (monoliths, test gaps, TODOs)

### Changed
- **ESM Migration** - Package is now pure ESM (`type: module`). Requires Node.js 20+.
- **Dependencies** - Updated all dependencies to December 2025 latest versions.
- **Chalk v5** - Updated to `chalk` v5 (ESM only).

## [1.8.0] - 2025-12-05

### Added

- **Git Forensics** - `vibe-check forensics` command for deep pattern analysis (VIBE-045)
  - Detects debug spirals ("take N" patterns indicating fix-retry loops)
  - Detects vague commits (<20 characters)
  - Detects context amnesia (repeatedly revisiting same scope)
  - Quality metrics: conventional commit %, descriptive commit %
  - Recommendations: sweep, maintain, or celebrate
- **Session Detection** - `vibe-check sessions` command for work session analysis (VIBE-046)
  - Identifies sessions from commit timestamps (90-minute gap threshold)
  - Session statistics: avg duration, commits per session, longest/shortest
  - Proven algorithm from release-engineering retrospective
- **Brand Assets** - Professional logo and visual identity
  - SVG logo with spiral-to-checkmark concept
  - Light and dark mode variants
  - Tagline: "catch the spiral before it catches you"
- **Actionable Coaching** - Personalized coaching based on your spiral history
  - `vibe-check insights` - View your spiral patterns and what works for you
  - Watch mode shows personalized alerts
  - Session end shows coaching for spirals hit during the session
  - All spirals auto-recorded to `~/.vibe-check/spiral-history.ndjson`

### Changed

- **README Redesign** - Modern visual flow inspired by top npm packages
  - Centered hero section with logo and badges
  - Progressive disclosure structure
  - Cleaner section organization with horizontal rules
  - Scannable tables instead of prose
- **Security Policy Updated** - Added forensics and sessions to threat model

## [1.7.0] - 2025-12-02

### Added
- **Session Integration** - New `vibe-check session` command suite for Claude Code integration
  - `session start` - Capture baseline metrics at session start
  - `session end` - Get session metrics with failure pattern detection
  - `session status` - Show active session info
  - JSON output compatible with `claude-progress.json` format
  - Automatic failure pattern detection (Debug Spiral, Context Amnesia, Velocity Crash, Trust Erosion, Flow Disruption)
  - Auto-generated learnings based on metrics and patterns
  - Baseline comparison with last 7 days

### Changed
- Major cleanup: removed 20 files, -3900 lines of speculative features
- Removed learning system (zero adoption evidence)
- Removed advanced gamification (challenges, prestige, leaderboards)
- Simplified to core value: metrics, coaching, insights

## [1.6.0] - 2025-11-30

### Added
- **Dashboard Command** - `vibe-check dashboard` opens a visual dashboard in your browser
  - Score trend charts showing vibe score over time
  - Session rating distribution (Elite/High/Medium/Low)
  - Metrics radar chart
  - Recent sessions list
  - Achievement progress tracking
- **Insight Engine** - Generates actionable insights from your data
  - Peak productivity hours detection
  - Best coding day analysis
  - Improvement streak tracking
  - Problematic scope warnings (high fix ratios)
  - Streak risk alerts
  - Personal best celebrations
  - Level-up progress notifications
  - Late night coding warnings
  - Recent achievement highlights
- Dashboard exports data to `dashboard-data.json` for offline viewing
- `--no-open` flag to export data without opening browser
- `-o, --output` flag for custom output path

## [1.5.0] - 2025-11-30

### Added
- **Timeline Storage** - Persistent storage with schema versioning
- **Cross-session Queries** - Query patterns across all historical data
- **Regression Detection** - Detect when metrics are trending worse
- **Spiral Pattern Memory** - Track which patterns cause the most spirals

## [1.4.0] - 2025-11-29

### Added
- **Timeline Command** - `vibe-check timeline` for viewing coding journey
- **Pattern Memory** - Tracks spiral triggers over time
- **Intervention Memory** - Tracks what interventions break spirals
- **Weekly Challenges** - Gamified weekly goals

## [1.3.0] - 2025-11-29

### Added
- **Watch Mode** - `vibe-check watch` for real-time spiral detection
- **Intervene Command** - `vibe-check intervene` to record what broke a spiral
- **Cache Command** - `vibe-check cache` to manage local storage

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
