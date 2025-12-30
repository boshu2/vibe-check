#!/bin/bash
# drivers/python.sh
# Wraps radon to produce standard complexity JSON
#
# Usage: ./drivers/python.sh [directory]
#        directory: Path to Python code to analyze (default: current directory)
#
# Output: JSON conforming to ComplexityReport schema
# Exit codes: 0 = success, 1 = error (radon not installed or other failure)

set -euo pipefail

TARGET_DIR="${1:-.}"

# Check radon is installed
if ! command -v radon &> /dev/null; then
    echo '{"error": "radon not installed. Run: pip install radon"}' >&2
    exit 1
fi

# Check if target directory exists
if [ ! -d "$TARGET_DIR" ]; then
    echo "{\"error\": \"Directory not found: $TARGET_DIR\"}" >&2
    exit 1
fi

# Run radon and transform output
# radon cc outputs JSON like:
# {
#   "file.py": [
#     {"name": "func", "complexity": 5, "rank": "A", "lineno": 10, ...}
#   ]
# }
radon cc "$TARGET_DIR" -j --total-average 2>/dev/null | jq -c '
(to_entries | map({
  key: .key,
  value: {
    functions: (.value | map({
      name: .name,
      complexity: .complexity,
      grade: .rank,
      line: .lineno,
      endLine: .endline
    })),
    avgComplexity: (
      if (.value | length) > 0 then
        ((.value | map(.complexity) | add) / (.value | length))
      else 0 end
    ),
    maxComplexity: (
      if (.value | length) > 0 then
        (.value | map(.complexity) | max)
      else 0 end
    ),
    grade: (
      if (.value | length) > 0 then
        ((.value | map(.complexity) | add) / (.value | length)) as $avg |
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
}) | from_entries) as $files |
{
  tool: "radon",
  language: "python",
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
