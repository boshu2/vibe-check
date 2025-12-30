#!/bin/bash
# drivers/rust.sh
# Wraps rust-code-analysis-cli to produce standard complexity JSON
#
# Usage: ./drivers/rust.sh [directory]
#        directory: Path to Rust code to analyze (default: current directory)
#
# Output: JSON conforming to ComplexityReport schema
# Exit codes: 0 = success, 1 = error (rust-code-analysis-cli not installed or other failure)

set -euo pipefail

TARGET_DIR="${1:-.}"

# Check rust-code-analysis-cli is installed
if ! command -v rust-code-analysis-cli &> /dev/null; then
    echo '{"error": "rust-code-analysis-cli not installed. Run: cargo install rust-code-analysis-cli"}' >&2
    exit 1
fi

# Check if target directory exists
if [ ! -d "$TARGET_DIR" ]; then
    echo "{\"error\": \"Directory not found: $TARGET_DIR\"}" >&2
    exit 1
fi

# Check if there are any Rust files
if ! find "$TARGET_DIR" -name "*.rs" ! -path "*/target/*" -print -quit 2>/dev/null | grep -q .; then
    # No Rust files found, output empty result
    echo '{"tool":"rust-code-analysis","language":"rust","generatedAt":"'$(date -u +"%Y-%m-%dT%H:%M:%SZ")'","files":{},"summary":{"totalFiles":0,"totalFunctions":0,"avgComplexity":0,"gradeDistribution":{"A":0,"B":0,"C":0,"D":0,"E":0,"F":0}}}'
    exit 0
fi

# Run rust-code-analysis-cli and transform output
# The tool outputs JSON with metrics for each file analyzed
# We need to transform this to match our ComplexityReport schema

# Create temp directory for JSON outputs
TEMP_DIR=$(mktemp -d)
trap "rm -rf $TEMP_DIR" EXIT

# Run rust-code-analysis-cli on the directory
# -m: enable metrics computation
# -O json: output format JSON
# -p: path to analyze
# Output goes to current directory with .json extension added to original filename
(cd "$TEMP_DIR" && rust-code-analysis-cli -m -p "$TARGET_DIR" -O json 2>/dev/null) || {
    echo '{"error": "rust-code-analysis-cli failed to analyze code"}' >&2
    exit 1
}

# Find all generated JSON files and merge them
# rust-code-analysis creates one JSON per source file
find "$TEMP_DIR" -name "*.json" -type f 2>/dev/null | jq -s -c '
# Helper function for complexity to grade conversion
def complexity_to_grade:
  if . <= 5 then "A"
  elif . <= 10 then "B"
  elif . <= 20 then "C"
  elif . <= 30 then "D"
  elif . <= 40 then "E"
  else "F"
  end;

# Process each file'\''s metrics
map(
  # Extract the original file path from name field
  .name as $filepath |

  # Get cyclomatic complexity for functions
  (.spaces // []) |

  # Find all functions and their complexity
  [.. | select(.kind? == "function" or .kind? == "method") | {
    name: .name.name,
    complexity: (.metrics.cyclomatic.sum // 0),
    line: .start_line,
    endLine: .end_line
  }] as $functions |

  # Calculate file-level metrics
  {
    key: $filepath,
    value: {
      functions: ($functions | map(
        . + {grade: (.complexity | complexity_to_grade)}
      )),
      avgComplexity: (
        if ($functions | length) > 0 then
          (($functions | map(.complexity) | add) / ($functions | length))
        else 0 end
      ),
      maxComplexity: (
        if ($functions | length) > 0 then
          ($functions | map(.complexity) | max)
        else 0 end
      ),
      grade: (
        if ($functions | length) > 0 then
          ((($functions | map(.complexity) | add) / ($functions | length)) | complexity_to_grade)
        else "A" end
      )
    }
  }
) |

# Convert to object with file paths as keys
from_entries as $files |

# Build final output
{
  tool: "rust-code-analysis",
  language: "rust",
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
