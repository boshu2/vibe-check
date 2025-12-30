# Complexity Drivers

Drivers wrap language-specific complexity tools to produce standard JSON output conforming to vibe-check's `ComplexityReport` schema.

## Architecture

```
vibe-check (kernel) ← reads .vibe-check/complexity.json
    ↑
    │ Standard JSON schema
    │
Drivers (python.sh, javascript.sh, etc.)
    ↑
    │ Tool-specific format
    │
Language tools (radon, complexity-report, gocyclo, etc.)
```

## Standard Schema

All drivers must output JSON matching this schema:

```typescript
{
  tool: string;           // "radon", "complexity-report", etc.
  language: string;       // "python", "javascript", etc.
  generatedAt: string;    // ISO timestamp
  files: {
    [filepath: string]: {
      functions: Array<{
        name: string;
        complexity: number;
        grade: 'A' | 'B' | 'C' | 'D' | 'E' | 'F';
        line: number;
        endLine?: number;
      }>;
      avgComplexity: number;
      maxComplexity: number;
      grade: 'A' | 'B' | 'C' | 'D' | 'E' | 'F';
    };
  };
  summary: {
    totalFiles: number;
    totalFunctions: number;
    avgComplexity: number;
    gradeDistribution: Record<'A'|'B'|'C'|'D'|'E'|'F', number>;
  };
}
```

## Grade Thresholds

All drivers normalize complexity scores to these grades:

| Grade | Complexity | Meaning |
|-------|------------|---------|
| A | 1-5 | Simple, low risk |
| B | 6-10 | Slightly complex, acceptable |
| C | 11-20 | Complex, consider refactoring |
| D | 21-30 | Very complex, refactor |
| E | 31-40 | Extremely complex, high risk |
| F | 41+ | Unmaintainable, must refactor |

## Available Drivers

### Python (`python.sh`)

Wraps [radon](https://radon.readthedocs.io/) for Python cyclomatic complexity.

**Requirements:**
```bash
pip install radon
```

**Usage:**
```bash
./drivers/python.sh ./src
./drivers/python.sh ./src > .vibe-check/complexity.json
```

**Example Output:**
```json
{
  "tool": "radon",
  "language": "python",
  "files": {
    "src/main.py": {
      "functions": [
        {"name": "process", "complexity": 7, "grade": "B", "line": 10, "endLine": 25}
      ],
      "avgComplexity": 7,
      "maxComplexity": 7,
      "grade": "B"
    }
  }
}
```

### JavaScript/TypeScript (`javascript.sh`)

Wraps [cyclomatic-complexity](https://github.com/pilotpirxie/cyclomatic-complexity) for JavaScript and TypeScript.

**Requirements:**
```bash
# npx automatically installs on first run
# No manual installation needed
```

**Usage:**
```bash
./drivers/javascript.sh ./src
./drivers/javascript.sh ./src > .vibe-check/complexity.json
```

**Example Output:**
```json
{
  "tool": "cyclomatic-complexity",
  "language": "javascript",
  "files": {
    "src/app.ts": {
      "functions": [
        {"name": "handleRequest", "complexity": 12, "grade": "C", "line": 15, "endLine": null}
      ],
      "avgComplexity": 12,
      "maxComplexity": 12,
      "grade": "C"
    }
  }
}
```

### Go (`go.sh`)

Wraps [gocyclo](https://github.com/fzipp/gocyclo) for Go cyclomatic complexity.

**Requirements:**
```bash
go install github.com/fzipp/gocyclo/cmd/gocyclo@latest
```

**Usage:**
```bash
./drivers/go.sh ./src
./drivers/go.sh ./cmd > .vibe-check/complexity.json
```

**Example Output:**
```json
{
  "tool": "gocyclo",
  "language": "go",
  "files": {
    "cmd/main.go": {
      "functions": [
        {"name": "handleRequest", "complexity": 8, "grade": "B", "line": 25, "endLine": null}
      ],
      "avgComplexity": 8,
      "maxComplexity": 8,
      "grade": "B"
    }
  }
}
```

### Rust (`rust.sh`)

Wraps [rust-code-analysis](https://mozilla.github.io/rust-code-analysis/) for Rust cyclomatic complexity.

**Requirements:**
```bash
cargo install rust-code-analysis-cli
```

**Usage:**
```bash
./drivers/rust.sh ./src
./drivers/rust.sh ./src > .vibe-check/complexity.json
```

**Example Output:**
```json
{
  "tool": "rust-code-analysis",
  "language": "rust",
  "files": {
    "src/main.rs": {
      "functions": [
        {"name": "process_data", "complexity": 6, "grade": "B", "line": 12, "endLine": 45}
      ],
      "avgComplexity": 6,
      "maxComplexity": 6,
      "grade": "B"
    }
  }
}
```

### PHP (`php.sh`)

Wraps [PHPMD](https://phpmd.org/) (PHP Mess Detector) for PHP cyclomatic complexity.

**Requirements:**
```bash
composer global require phpmd/phpmd
```

**Usage:**
```bash
./drivers/php.sh ./src
./drivers/php.sh ./src > .vibe-check/complexity.json
```

**Example Output:**
```json
{
  "tool": "phpmd",
  "language": "php",
  "files": {
    "src/Controller.php": {
      "functions": [
        {"name": "handleRequest", "complexity": 15, "grade": "C", "line": 23, "endLine": 67}
      ],
      "avgComplexity": 15,
      "maxComplexity": 15,
      "grade": "C"
    }
  }
}
```

### Java (`java.sh`)

Wraps [PMD](https://pmd.github.io/) for Java cyclomatic complexity.

**Requirements:**
```bash
# Download PMD from https://pmd.github.io/
# Requires JRE (Java Runtime Environment)
```

**Usage:**
```bash
./drivers/java.sh ./src
./drivers/java.sh ./src > .vibe-check/complexity.json
```

**Example Output:**
```json
{
  "tool": "pmd",
  "language": "java",
  "files": {
    "src/main/java/Service.java": {
      "functions": [
        {"name": "processRequest", "complexity": 18, "grade": "C", "line": 42, "endLine": 89}
      ],
      "avgComplexity": 18,
      "maxComplexity": 18,
      "grade": "C"
    }
  }
}
```

## Driver Contract

Each driver script must:

1. **Accept directory path** as first argument (default: current directory)
2. **Check tool availability** and exit 1 with JSON error if missing
3. **Output valid JSON** to stdout conforming to schema
4. **Exit 0 on success**, non-zero on failure
5. **Handle empty directories** gracefully (empty `files` object)

## Error Format

On error, write JSON to stderr and exit non-zero:

```json
{"error": "radon not installed. Run: pip install radon"}
```

## Writing a New Driver

Example template:

```bash
#!/bin/bash
set -euo pipefail

TARGET_DIR="${1:-.}"

# Check tool is installed
if ! command -v your-tool &> /dev/null; then
    echo '{"error": "your-tool not installed"}' >&2
    exit 1
fi

# Run tool and transform to standard schema
your-tool "$TARGET_DIR" --json | jq '{
  tool: "your-tool",
  language: "your-language",
  generatedAt: (now | todate),
  files: ...,
  summary: ...
}'
```

See `python.sh` for a complete example with jq transformation.

## Integration with vibe-check

Drivers are used via CLI:

```bash
# Run driver before analysis
vibe-check --with-complexity python

# Use existing complexity data
vibe-check --complexity-file .vibe-check/complexity.json

# Driver-only mode (outputs to stdout)
vibe-check driver python ./src > complexity.json
```

See main README for usage details.
