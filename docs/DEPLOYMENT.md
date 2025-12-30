# Deployment Guide

This guide covers deploying vibe-check in CI/CD environments for automated code quality analysis.

## Table of Contents

- [GitHub Actions](#github-actions)
- [GitLab CI](#gitlab-ci)
- [Jenkins Pipeline](#jenkins-pipeline)
- [Docker Usage](#docker-usage)
- [Environment Variables](#environment-variables)
- [Exit Codes](#exit-codes)

---

## GitHub Actions

### Basic Usage

Add vibe-check to your workflow to analyze PR commits:

```yaml
name: Vibe Check

on:
  pull_request:
    branches: [main]

jobs:
  vibe-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0  # Fetch all history for complete analysis

      - uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install vibe-check
        run: npm install -g @boshu2/vibe-check

      - name: Run vibe-check
        run: vc --since "1 week ago" --format json --output results.json

      - name: Upload results
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: vibe-check-results
          path: results.json
```

### Advanced: Fail on Low Quality

```yaml
      - name: Run vibe-check with threshold
        run: |
          vc --since "1 week ago" --format json --output results.json
          # Exit code 1 = LOW rating, fail the build
          if [ $? -eq 1 ]; then
            echo "::error::Code quality below threshold"
            exit 1
          fi
```

### Structured Logging

```yaml
      - name: Run with JSON logging
        run: vc --log-json --since "1 week ago" 2> logs.jsonl
```

---

## GitLab CI

### Basic Pipeline

Add to `.gitlab-ci.yml`:

```yaml
vibe-check:
  stage: test
  image: node:20-alpine
  before_script:
    - apk add --no-cache git
    - npm install -g @boshu2/vibe-check
  script:
    - vc --since "1 week ago" --format json --output vibe-check.json
  artifacts:
    reports:
      dotenv: vibe-check.json
    when: always
    paths:
      - vibe-check.json
```

### Docker-based Pipeline

```yaml
vibe-check:
  stage: test
  image: docker:latest
  services:
    - docker:dind
  before_script:
    - docker build -t vibe-check -f Dockerfile.ci .
  script:
    - docker run --rm -v $CI_PROJECT_DIR:/repo vibe-check --repo /repo --since "1 week ago"
```

### Timeout Configuration

```yaml
vibe-check:
  stage: test
  timeout: 10m
  script:
    - vc --timeout 300 --max-commits 5000 --since "1 month ago"
```

---

## Jenkins Pipeline

### Declarative Pipeline

Add to `Jenkinsfile`:

```groovy
pipeline {
    agent {
        docker {
            image 'node:20-alpine'
            args '-u root:root'
        }
    }

    stages {
        stage('Setup') {
            steps {
                sh 'apk add --no-cache git'
                sh 'npm install -g @boshu2/vibe-check'
            }
        }

        stage('Vibe Check') {
            steps {
                sh '''
                    vc --since "1 week ago" \\
                       --format json \\
                       --output vibe-check.json \\
                       --log-json 2> vibe-check.log
                '''
            }
            post {
                always {
                    archiveArtifacts artifacts: 'vibe-check.json,vibe-check.log', allowEmptyArchive: true
                    publishHTML([
                        reportDir: '.',
                        reportFiles: 'vibe-check.json',
                        reportName: 'Vibe Check Report'
                    ])
                }
            }
        }
    }
}
```

### Scripted Pipeline

```groovy
node {
    stage('Checkout') {
        checkout scm
    }

    stage('Vibe Check') {
        docker.image('node:20-alpine').inside {
            sh 'apk add --no-cache git'
            sh 'npm install -g @boshu2/vibe-check'

            def exitCode = sh(
                script: 'vc --since "1 week ago" --format json',
                returnStatus: true
            )

            if (exitCode == 1) {
                unstable(message: "Code quality below threshold")
            } else if (exitCode != 0) {
                error("Vibe check failed with exit code ${exitCode}")
            }
        }
    }
}
```

---

## Docker Usage

### Building the Image

```bash
# Build from Dockerfile
docker build -t vibe-check .

# Or use pre-built image (when available)
docker pull boshu2/vibe-check:latest
```

### Running Analysis

```bash
# Analyze current directory
docker run --rm -v $(pwd):/repo vibe-check --repo /repo --since "1 week ago"

# With JSON output
docker run --rm -v $(pwd):/repo vibe-check \
  --repo /repo \
  --since "1 week ago" \
  --format json > results.json

# With structured logging
docker run --rm -v $(pwd):/repo vibe-check \
  --repo /repo \
  --log-json \
  --since "1 week ago" 2> logs.jsonl
```

### Performance Tuning

```bash
# Large repositories: set timeout and max commits
docker run --rm -v $(pwd):/repo vibe-check \
  --repo /repo \
  --timeout 600 \
  --max-commits 10000 \
  --since "1 month ago"
```

---

## Environment Variables

vibe-check respects the following environment variables:

| Variable | Description | Default |
|----------|-------------|---------|
| `DEBUG` | Enable debug logging (set to `1` or `true`) | `false` |
| `NO_COLOR` | Disable colored output | `false` |
| `CI` | Detected automatically in CI environments | auto-detected |

### Example

```bash
# Enable debug logging
export DEBUG=1
vc --since "1 week ago"

# Disable colors for log parsing
export NO_COLOR=1
vc --format json
```

---

## Exit Codes

vibe-check uses semantic exit codes for integration with CI/CD:

| Exit Code | Meaning | CI Action |
|-----------|---------|-----------|
| `0` | Success (GOOD or ELITE rating) | Pass ✅ |
| `1` | General error (LOW rating) | Fail ❌ |
| `2` | Git error (not a repo, git failed) | Fail ❌ |
| `3` | Validation error (invalid options) | Fail ❌ |
| `4` | Storage error (file I/O failed) | Fail ❌ |
| `5` | Config error (invalid config) | Fail ❌ |
| `6` | Analysis error (calculation failed) | Fail ❌ |

### Handling Exit Codes

**GitHub Actions:**
```yaml
- name: Run vibe-check
  run: vc --since "1 week ago"
  continue-on-error: true  # Don't fail build on LOW rating
```

**GitLab CI:**
```yaml
vibe-check:
  script:
    - vc --since "1 week ago"
  allow_failure: true  # Warning only
```

**Jenkins:**
```groovy
try {
    sh 'vc --since "1 week ago"'
} catch (err) {
    if (err.exitCode == 1) {
        unstable(message: "Code quality below threshold")
    } else {
        error("Vibe check failed: ${err}")
    }
}
```

---

## Pre-commit Hook

Integrate vibe-check with [pre-commit](https://pre-commit.com/):

### Add to `.pre-commit-config.yaml`:

```yaml
repos:
  - repo: https://github.com/boshu2/vibe-check
    rev: v2.6.0
    hooks:
      - id: vibe-check
        args: ['--since', '1 week ago']
```

### Manual Installation:

```bash
# Install pre-commit
pip install pre-commit

# Install hook
pre-commit install

# Run manually
pre-commit run vibe-check --all-files
```

---

## Troubleshooting

### Timeout Errors

```bash
# Increase timeout for large repos
vc --timeout 600 --max-commits 10000
```

### Memory Issues

```bash
# Limit commits analyzed
vc --max-commits 5000 --since "2 weeks ago"
```

### Shallow Clone Issues

```bash
# In CI, ensure full history is fetched
git fetch --unshallow
```

### Permission Errors

```bash
# Docker: run as current user
docker run --rm -u $(id -u):$(id -g) -v $(pwd):/repo vibe-check
```

---

## Best Practices

1. **Set Timeouts**: Always use `--timeout` for large repositories
2. **Limit Commits**: Use `--max-commits` for very active repos
3. **Structured Logging**: Use `--log-json` for log aggregation
4. **Artifact Storage**: Archive JSON results for trend analysis
5. **Fail Gracefully**: Use `allow_failure` for warnings vs errors
6. **Cache Results**: Store results between runs for comparison

---

## Support

- GitHub Issues: https://github.com/boshu2/vibe-check/issues
- Documentation: https://github.com/boshu2/vibe-check
- npm Package: https://www.npmjs.com/package/@boshu2/vibe-check
