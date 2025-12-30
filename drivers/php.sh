#!/bin/bash
# drivers/php.sh
# Wraps PHPMD to produce standard complexity JSON
#
# Usage: ./drivers/php.sh [directory]
#        directory: Path to PHP code to analyze (default: current directory)
#
# Output: JSON conforming to ComplexityReport schema
# Exit codes: 0 = success, 1 = error (phpmd not installed or other failure)

set -euo pipefail

TARGET_DIR="${1:-.}"

# Check phpmd is installed
if ! command -v phpmd &> /dev/null; then
    echo '{"error": "phpmd not installed. Run: composer global require phpmd/phpmd"}' >&2
    exit 1
fi

# Check if target directory exists
if [ ! -d "$TARGET_DIR" ]; then
    echo "{\"error\": \"Directory not found: $TARGET_DIR\"}" >&2
    exit 1
fi

# Check if there are any PHP files
if ! find "$TARGET_DIR" -name "*.php" ! -path "*/vendor/*" -print -quit 2>/dev/null | grep -q .; then
    # No PHP files found, output empty result
    echo '{"tool":"phpmd","language":"php","generatedAt":"'$(date -u +"%Y-%m-%dT%H:%M:%SZ")'","files":{},"summary":{"totalFiles":0,"totalFunctions":0,"avgComplexity":0,"gradeDistribution":{"A":0,"B":0,"C":0,"D":0,"E":0,"F":0}}}'
    exit 0
fi

# Run PHPMD and transform output
# PHPMD outputs JSON violations, we need to extract cyclomatic complexity violations
# and transform them to our schema
# Using --ignore-violations-on-exit to ensure exit 0 even with violations

phpmd "$TARGET_DIR" json codesize --exclude vendor --ignore-violations-on-exit 2>/dev/null | jq -c '
# Helper function for complexity to grade conversion
def complexity_to_grade:
  if . <= 5 then "A"
  elif . <= 10 then "B"
  elif . <= 20 then "C"
  elif . <= 30 then "D"
  elif . <= 40 then "E"
  else "F"
  end;

# Process PHPMD violations format
# Extract only CyclomaticComplexity violations
.files |
map(
  select(.violations | length > 0) |
  {
    path: .file,
    violations: [
      .violations[] |
      select(.rule == "CyclomaticComplexity") |
      {
        # Parse complexity from description like "The method foo() has a Cyclomatic Complexity of 12."
        description: .description,
        method: .method,
        beginLine: .beginLine,
        endLine: .endLine,
        # Extract complexity number from description using regex
        complexity: (
          .description |
          capture("Cyclomatic Complexity of (?<num>[0-9]+)") |
          .num | tonumber
        )
      }
    ]
  } |
  select(.violations | length > 0)
) |

# Group by file and calculate metrics
map({
  key: .path,
  value: {
    functions: (
      .violations | map({
        name: .method,
        complexity: .complexity,
        grade: (.complexity | complexity_to_grade),
        line: .beginLine,
        endLine: .endLine
      })
    ),
    avgComplexity: (
      if (.violations | length) > 0 then
        ((.violations | map(.complexity) | add) / (.violations | length))
      else 0 end
    ),
    maxComplexity: (
      if (.violations | length) > 0 then
        (.violations | map(.complexity) | max)
      else 0 end
    ),
    grade: (
      if (.violations | length) > 0 then
        (((.violations | map(.complexity) | add) / (.violations | length)) | complexity_to_grade)
      else "A" end
    )
  }
}) |
from_entries as $files |

# Build final output
{
  tool: "phpmd",
  language: "php",
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
