# vibe-check Makefile
# All npm commands and development shortcuts

.PHONY: help build dev start test test-coverage lint clean install publish dashboard watch profile analyze session-start session-end

# Default target
help:
	@echo "vibe-check Development Commands"
	@echo "================================"
	@echo ""
	@echo "Build & Run:"
	@echo "  make build          - Compile TypeScript to dist/"
	@echo "  make dev            - Run with ts-node (no compile)"
	@echo "  make start          - Run compiled version"
	@echo "  make clean          - Remove dist/ directory"
	@echo ""
	@echo "Testing:"
	@echo "  make test           - Run all tests"
	@echo "  make test-coverage  - Run tests with coverage report"
	@echo "  make test-watch     - Run tests in watch mode"
	@echo ""
	@echo "Publishing:"
	@echo "  make install        - Install dependencies"
	@echo "  make publish        - Build, test, and publish to npm"
	@echo "  make version-patch  - Bump patch version (1.0.x)"
	@echo "  make version-minor  - Bump minor version (1.x.0)"
	@echo "  make version-major  - Bump major version (x.0.0)"
	@echo ""
	@echo "Vibe-Check Commands:"
	@echo "  make dashboard      - Open visual dashboard"
	@echo "  make watch          - Real-time spiral detection"
	@echo "  make profile        - Show XP, streaks, achievements"
	@echo "  make analyze        - Analyze last week"
	@echo "  make analyze-today  - Analyze today only"
	@echo "  make timeline       - Show coding timeline"
	@echo ""
	@echo "Session Commands:"
	@echo "  make session-start  - Start session (prompts for level)"
	@echo "  make session-end    - End session and get metrics"
	@echo "  make session-status - Show active session info"
	@echo ""

# ============================================
# Build & Run
# ============================================

build:
	npm run build

dev:
	npm run dev

start:
	npm run start

clean:
	rm -rf dist/

# ============================================
# Testing
# ============================================

test:
	npm test

test-coverage:
	npm run test:coverage

test-watch:
	npx vitest watch

# ============================================
# Publishing
# ============================================

install:
	npm install

publish: build test
	npm publish --access=public

version-patch:
	npm version patch

version-minor:
	npm version minor

version-major:
	npm version major

# ============================================
# Vibe-Check Commands
# ============================================

dashboard:
	node dist/cli.js dashboard

watch:
	node dist/cli.js watch

profile:
	node dist/cli.js profile

analyze:
	node dist/cli.js --since "1 week ago" --score

analyze-today:
	node dist/cli.js --since "today" --score

analyze-json:
	node dist/cli.js --since "1 week ago" --score --format json

timeline:
	node dist/cli.js timeline --since "1 week ago"

timeline-expand:
	node dist/cli.js timeline --since "1 week ago" --expand

# ============================================
# Session Commands
# ============================================

session-start:
	@read -p "Vibe Level (0-5): " level; \
	node dist/cli.js session start --level $$level

session-start-json:
	@read -p "Vibe Level (0-5): " level; \
	node dist/cli.js session start --level $$level --format json

session-end:
	node dist/cli.js session end

session-end-json:
	node dist/cli.js session end --format json

session-status:
	node dist/cli.js session status

# ============================================
# Shortcuts
# ============================================

# Quick check (alias for analyze)
check: analyze

# Full analysis with all features
full:
	node dist/cli.js --since "1 week ago" --score --verbose

# Export dashboard data without opening browser
export-dashboard:
	node dist/cli.js dashboard --no-open

# Cache management
cache-stats:
	node dist/cli.js cache --stats

cache-clear:
	node dist/cli.js cache --clear
