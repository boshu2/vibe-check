#!/bin/bash
# drivers/java.sh
# Wraps PMD to produce standard complexity JSON
#
# Usage: ./drivers/java.sh [directory]
#        directory: Path to Java code to analyze (default: current directory)
#
# Output: JSON conforming to ComplexityReport schema
# Exit codes: 0 = success, 1 = error (pmd not installed or other failure)

set -euo pipefail

TARGET_DIR="${1:-.}"

# Check pmd is installed
if ! command -v pmd &> /dev/null; then
    echo '{"error": "pmd not installed. Download from: https://pmd.github.io/"}' >&2
    exit 1
fi

# Check if target directory exists
if [ ! -d "$TARGET_DIR" ]; then
    echo "{\"error\": \"Directory not found: $TARGET_DIR\"}" >&2
    exit 1
fi

# Check if there are any Java files
if ! find "$TARGET_DIR" -name "*.java" ! -path "*/target/*" ! -path "*/build/*" -print -quit 2>/dev/null | grep -q .; then
    # No Java files found, output empty result
    echo '{"tool":"pmd","language":"java","generatedAt":"'$(date -u +"%Y-%m-%dT%H:%M:%SZ")'","files":{},"summary":{"totalFiles":0,"totalFunctions":0,"avgComplexity":0,"gradeDistribution":{"A":0,"B":0,"C":0,"D":0,"E":0,"F":0}}}'
    exit 0
fi

# Run PMD and transform output
# PMD outputs JSON with violations grouped by file
# We filter for CyclomaticComplexity rule violations
# Using --no-cache to avoid caching issues
# --ignore-violations to ensure exit 0 even with violations found

pmd check -d "$TARGET_DIR" \
  -R category/java/design.xml/CyclomaticComplexity \
  -f json \
  --no-cache \
  --ignore-violations-on-exit 2>/dev/null | jq -c '
# Helper function for complexity to grade conversion
def complexity_to_grade:
  if . <= 5 then "A"
  elif . <= 10 then "B"
  elif . <= 20 then "C"
  elif . <= 30 then "D"
  elif . <= 40 then "E"
  else "F"
  end;

# Process PMD violations format
# PMD JSON format has .files array with violations
(.files // []) |
map(
  select(.violations | length > 0) |
  {
    path: .filename,
    violations: [
      .violations[] |
      # PMD description format: "The {class|method} {name} has a {Cyclomatic|Standard} Complexity of {X}."
      # or "The {class|method} '{name}' has a {Cyclomatic|Standard} cyclomatic complexity of {X}."
      {
        description: .description,
        method: (.description | capture("method .(?<name>[^']+).") | .name),
        beginLine: .beginLine,
        endLine: .endLine,
        # Extract complexity number from description
        complexity: (
          .description |
          capture("complexity of (?<num>[0-9]+)") |
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
  tool: "pmd",
  language: "java",
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
