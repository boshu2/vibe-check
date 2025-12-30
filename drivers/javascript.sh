#!/bin/bash
# drivers/javascript.sh
# Wraps cyclomatic-complexity to produce standard complexity JSON
#
# Usage: ./drivers/javascript.sh [directory]
#        directory: Path to JavaScript/TypeScript code to analyze (default: current directory)
#
# Output: JSON conforming to ComplexityReport schema
# Exit codes: 0 = success, 1 = error (npx not available or other failure)

set -euo pipefail

TARGET_DIR="${1:-.}"

# Check if npx is available
if ! command -v npx &> /dev/null; then
    echo '{"error": "npx not found. Install Node.js and npm."}' >&2
    exit 1
fi

# Check if target directory exists
if [ ! -d "$TARGET_DIR" ]; then
    echo "{\"error\": \"Directory not found: $TARGET_DIR\"}" >&2
    exit 1
fi

# Find all JS/TS files (excluding common build/dep directories)
FILES=$(find "$TARGET_DIR" -type f \( -name "*.js" -o -name "*.ts" -o -name "*.jsx" -o -name "*.tsx" \) \
  ! -path "*/node_modules/*" \
  ! -path "*/dist/*" \
  ! -path "*/build/*" \
  ! -path "*/.next/*" \
  ! -path "*/coverage/*" 2>/dev/null)

# If no files found, output empty result
if [ -z "$FILES" ]; then
  echo '{"tool":"cyclomatic-complexity","language":"javascript","generatedAt":"'$(date -u +"%Y-%m-%dT%H:%M:%SZ")'","files":{},"summary":{"totalFiles":0,"totalFunctions":0,"avgComplexity":0,"gradeDistribution":{"A":0,"B":0,"C":0,"D":0,"E":0,"F":0}}}'
  exit 0
fi

# Build glob pattern for cyclomatic-complexity
# It expects quoted glob patterns like 'src/**/*.ts'
PATTERN="${TARGET_DIR}/**/*.{js,ts,jsx,tsx}"

# Run cyclomatic-complexity and transform output
# cyclomatic-complexity outputs JSON like:
# [
#   {
#     "file": "path/to/file.js",
#     "functionComplexities": [
#       {"name": "func", "complexity": 5, "line": 10}
#     ],
#     "complexitySum": 5,
#     "complexityLevel": "ok"
#   }
# ]

npx --yes cyclomatic-complexity "$PATTERN" --json 2>/dev/null | jq -c '
# Filter out empty files and global scope functions
map(
  select(.functionComplexities | length > 0) |
  . + {functionComplexities: [.functionComplexities[] | select(.name != "global")]}
) |
map(select(.functionComplexities | length > 0)) |

# Transform to standard schema
(
  map({
    key: .file,
    value: {
      functions: (
        .functionComplexities | map({
          name: .name,
          complexity: .complexity,
          grade: (
            if .complexity <= 5 then "A"
            elif .complexity <= 10 then "B"
            elif .complexity <= 20 then "C"
            elif .complexity <= 30 then "D"
            elif .complexity <= 40 then "E"
            else "F"
            end
          ),
          line: .line,
          endLine: null
        })
      ),
      avgComplexity: (
        if (.functionComplexities | length) > 0 then
          ((.functionComplexities | map(.complexity) | add) / (.functionComplexities | length))
        else 0 end
      ),
      maxComplexity: (
        if (.functionComplexities | length) > 0 then
          (.functionComplexities | map(.complexity) | max)
        else 0 end
      ),
      grade: (
        if (.functionComplexities | length) > 0 then
          ((.functionComplexities | map(.complexity) | add) / (.functionComplexities | length)) as $avg |
          if $avg <= 5 then "A"
          elif $avg <= 10 then "B"
          elif $avg <= 20 then "C"
          elif $avg <= 30 then "D"
          elif $avg <= 40 then "E"
          else "F"
          end
        else "A" end
      )
    }
  }) | from_entries
) as $files |
{
  tool: "cyclomatic-complexity",
  language: "javascript",
  generatedAt: (now | todate),
  files: $files,
  summary: {
    totalFiles: ($files | to_entries | length),
    totalFunctions: ([$files | to_entries[].value.functions | length] | add // 0),
    avgComplexity: (
      [$files | to_entries[].value.avgComplexity] |
      if length > 0 then (add / length) else 0 end
    ),
    gradeDistribution: (
      [$files | to_entries[].value.grade] |
      reduce .[] as $grade (
        {A: 0, B: 0, C: 0, D: 0, E: 0, F: 0};
        .[$grade] += 1
      )
    )
  }
}
'
