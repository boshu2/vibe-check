#!/bin/bash
# drivers/go.sh
# Wraps gocyclo to produce standard complexity JSON
#
# Usage: ./drivers/go.sh [directory]
#        directory: Path to Go code to analyze (default: current directory)
#
# Output: JSON conforming to ComplexityReport schema
# Exit codes: 0 = success, 1 = error (gocyclo not installed or other failure)

set -euo pipefail

TARGET_DIR="${1:-.}"

# Check gocyclo is installed
if ! command -v gocyclo &> /dev/null; then
    echo '{"error": "gocyclo not installed. Run: go install github.com/fzipp/gocyclo/cmd/gocyclo@latest"}' >&2
    exit 1
fi

# Check if target directory exists
if [ ! -d "$TARGET_DIR" ]; then
    echo "{\"error\": \"Directory not found: $TARGET_DIR\"}" >&2
    exit 1
fi

# Check if there are any Go files
if ! find "$TARGET_DIR" -name "*.go" ! -path "*/vendor/*" -print -quit 2>/dev/null | grep -q .; then
    # No Go files found, output empty result
    echo '{"tool":"gocyclo","language":"go","generatedAt":"'$(date -u +"%Y-%m-%dT%H:%M:%SZ")'","files":{},"summary":{"totalFiles":0,"totalFunctions":0,"avgComplexity":0,"gradeDistribution":{"A":0,"B":0,"C":0,"D":0,"E":0,"F":0}}}'
    exit 0
fi

# Run gocyclo and transform output
# gocyclo outputs lines like:
#   8 main complex /tmp/go-test/main.go:16:1
#   <complexity> <package> <function> <file:row:column>

gocyclo "$TARGET_DIR" 2>/dev/null | awk -v target_dir="$TARGET_DIR" '
BEGIN {
    # Initialize
    file_count = 0
    func_count = 0
    total_complexity = 0
    grade_a = 0; grade_b = 0; grade_c = 0; grade_d = 0; grade_e = 0; grade_f = 0
}

function complexity_to_grade(c) {
    if (c <= 5) return "A"
    else if (c <= 10) return "B"
    else if (c <= 20) return "C"
    else if (c <= 30) return "D"
    else if (c <= 40) return "E"
    else return "F"
}

function increment_grade(g) {
    if (g == "A") grade_a++
    else if (g == "B") grade_b++
    else if (g == "C") grade_c++
    else if (g == "D") grade_d++
    else if (g == "E") grade_e++
    else grade_f++
}

{
    # Parse: complexity package function file:line:col
    complexity = $1
    pkg = $2
    func_name = $3
    file_line = $4

    # Split file:line:col
    split(file_line, parts, ":")
    file = parts[1]
    line = parts[2]

    # Track functions per file
    if (!(file in files)) {
        files[file] = 1
        file_count++
        file_functions[file] = ""
        file_complexities[file] = ""
        file_total[file] = 0
        file_max[file] = 0
        file_func_count[file] = 0
    }

    func_count++
    total_complexity += complexity

    grade = complexity_to_grade(complexity)

    # Append function data (JSON format)
    sep = (file_functions[file] == "") ? "" : ","
    file_functions[file] = file_functions[file] sep sprintf("{\"name\":\"%s\",\"complexity\":%d,\"grade\":\"%s\",\"line\":%d,\"endLine\":null}", func_name, complexity, grade, line)

    # Track file stats
    file_total[file] += complexity
    file_func_count[file]++
    if (complexity > file_max[file]) {
        file_max[file] = complexity
    }
}

END {
    # Output JSON
    printf "{\"tool\":\"gocyclo\",\"language\":\"go\",\"generatedAt\":\""
    # Get current timestamp
    cmd = "date -u +\"%Y-%m-%dT%H:%M:%SZ\""
    cmd | getline timestamp
    close(cmd)
    printf "%s\",\"files\":{", timestamp

    first_file = 1
    for (file in files) {
        if (!first_file) printf ","
        first_file = 0

        avg = (file_func_count[file] > 0) ? file_total[file] / file_func_count[file] : 0
        file_grade = complexity_to_grade(avg)
        increment_grade(file_grade)

        printf "\"%s\":{\"functions\":[%s],\"avgComplexity\":%.2f,\"maxComplexity\":%d,\"grade\":\"%s\"}", file, file_functions[file], avg, file_max[file], file_grade
    }

    avg_complexity = (func_count > 0) ? total_complexity / func_count : 0

    printf "},\"summary\":{\"totalFiles\":%d,\"totalFunctions\":%d,\"avgComplexity\":%.2f,\"gradeDistribution\":{\"A\":%d,\"B\":%d,\"C\":%d,\"D\":%d,\"E\":%d,\"F\":%d}}}", file_count, func_count, avg_complexity, grade_a, grade_b, grade_c, grade_d, grade_e, grade_f
}
'
