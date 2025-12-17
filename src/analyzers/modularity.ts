/**
 * Modularity Analyzer
 *
 * Pattern-aware modularity assessment that goes beyond simple LOC counting.
 * Recognizes that a well-organized 2,500-line file can be more maintainable
 * than a poorly-structured 300-line file.
 *
 * Based on research into:
 * - K8s-style controller patterns
 * - Cohesion metrics (LCOM)
 * - Coupling analysis (CBO, fan-in/fan-out)
 * - Single Responsibility Principle indicators
 */

import * as fs from 'fs';
import * as path from 'path';
import { scanDirectory } from './audit.js';

// ============================================================================
// TYPES
// ============================================================================

export interface ModularityResult {
  files: FileModularity[];
  summary: ModularitySummary;
  exempted: ExemptedFile[];
}

export interface FileModularity {
  file: string;
  lines: number;
  pattern: FilePattern | null;
  score: number;              // 0-10
  rating: ModularityRating;
  flags: ModularityFlag[];
  details: ModularityDetails;
}

export interface ModularityDetails {
  hasSections: boolean;
  sectionCount: number;
  exportCount: number;
  importCount: number;
  hasNestedClasses: boolean;
  methodCount: number;
}

export interface ModularitySummary {
  totalFiles: number;
  totalLines: number;
  avgScore: number;
  distribution: {
    elite: number;    // 9-10
    good: number;     // 7-8
    acceptable: number; // 5-6
    needsWork: number;  // 3-4
    poor: number;     // 0-2
  };
  largestFiles: { file: string; lines: number; score: number }[];
}

export interface ExemptedFile {
  file: string;
  lines: number;
  reason: string;
}

export type ModularityRating = 'elite' | 'good' | 'acceptable' | 'needs-work' | 'poor';

export type ModularityFlag =
  | 'no-single-responsibility'
  | 'no-internal-structure'
  | 'high-coupling'
  | 'low-cohesion'
  | 'missing-tests'
  | 'god-class'
  | 'utility-grab-bag';

export type FilePattern =
  | 'controller'      // K8s-style controller
  | 'store'           // Data access layer
  | 'routes'          // HTTP route handlers
  | 'types'           // Type definitions
  | 'state-machine'   // Lifecycle/state machines
  | 'test'            // Test files
  | 'generated'       // Auto-generated
  | 'component'       // React component
  | 'middleware'      // Express middleware
  | 'utility';        // Utility module

// ============================================================================
// PATTERN DETECTION
// ============================================================================

const PATTERN_MATCHERS: { pattern: FilePattern; test: (file: string, content: string) => boolean }[] = [
  { pattern: 'test', test: (f) => /\.(test|spec)\.(ts|tsx|js|jsx)$/.test(f) },
  { pattern: 'generated', test: (f) => /\.generated\.(ts|tsx)$/.test(f) },
  { pattern: 'types', test: (f, c) => /types?\.(ts|d\.ts)$/.test(f) || (c.match(/^export (type|interface)/gm)?.length || 0) > 10 },
  { pattern: 'controller', test: (f, c) => /Controller\.(ts|tsx)$/.test(f) || c.includes('reconcile') && c.includes('class') },
  { pattern: 'store', test: (f) => /(Store|Repository)\.(ts|tsx)$/.test(f) },
  { pattern: 'routes', test: (f, c) => /routes?\.(ts|tsx)$/.test(f) || (c.includes('router.') && c.includes('app.')) },
  { pattern: 'state-machine', test: (f, c) => /Lifecycle\.(ts|tsx)$/.test(f) || c.includes('transition') && c.includes('state') },
  { pattern: 'middleware', test: (f) => /middleware/i.test(f) },
  { pattern: 'component', test: (f, c) => /\.(tsx|jsx)$/.test(f) && c.includes('export') && (c.includes('function') || c.includes('const')) },
  { pattern: 'utility', test: (f) => /(utils?|helpers?|lib)\.(ts|js)$/.test(f) },
];

function detectPattern(file: string, content: string): FilePattern | null {
  for (const { pattern, test } of PATTERN_MATCHERS) {
    if (test(file, content)) return pattern;
  }
  return null;
}

// ============================================================================
// PATTERN-SPECIFIC THRESHOLDS
// ============================================================================

const PATTERN_THRESHOLDS: Record<FilePattern | 'default', { yellow: number; red: number }> = {
  controller: { yellow: 800, red: 1200 },
  store: { yellow: 1500, red: 2500 },
  routes: { yellow: 1000, red: 1500 },
  types: { yellow: 800, red: 1200 },
  'state-machine': { yellow: 600, red: 900 },
  test: { yellow: Infinity, red: Infinity }, // Tests exempt
  generated: { yellow: Infinity, red: Infinity }, // Generated exempt
  component: { yellow: 250, red: 400 },
  middleware: { yellow: 400, red: 600 },
  utility: { yellow: 150, red: 250 },
  default: { yellow: 300, red: 500 },
};

// ============================================================================
// ANALYSIS FUNCTIONS
// ============================================================================

function countSections(content: string): number {
  // Look for section dividers: // ==== or /* ==== or // ----
  const sectionMatches = content.match(/\/\/\s*={4,}|\/\*\s*={4,}|\/\/\s*-{4,}/g);
  return sectionMatches?.length || 0;
}

function countExports(content: string): number {
  const exportMatches = content.match(/^export\s+(const|function|class|interface|type|enum|default)/gm);
  return exportMatches?.length || 0;
}

function countImports(content: string): number {
  const importMatches = content.match(/^import\s+/gm);
  return importMatches?.length || 0;
}

function hasNestedClasses(content: string): boolean {
  // Look for class definitions that aren't at the top level
  const classCount = (content.match(/\bclass\s+\w+/g) || []).length;
  return classCount > 1;
}

function countMethods(content: string): number {
  // Count method-like patterns
  const methodMatches = content.match(/^\s+(async\s+)?(private\s+|public\s+|protected\s+)?\w+\s*\([^)]*\)\s*[:{]/gm);
  return methodMatches?.length || 0;
}

function hasSingleResponsibility(content: string, file: string): boolean {
  // Heuristic: if there are multiple unrelated concepts, it's probably not SRP
  // Look for warning signs: multiple "Manager", "Handler", "Service" in one file
  const concepts = (content.match(/class\s+\w*(Manager|Handler|Service|Controller|Store)/g) || []).length;
  if (concepts > 1) return false;

  // Check file name for warning signs
  if (/(utils?|helpers?|misc|common)\.ts$/i.test(file)) return false;

  return true;
}

function analyzeFile(filePath: string, rootDir: string): FileModularity | ExemptedFile {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n').length;
  const relPath = path.relative(rootDir, filePath);
  const pattern = detectPattern(relPath, content);

  // Check for exemptions
  if (pattern === 'test') {
    return { file: relPath, lines, reason: 'Test files are exempt' };
  }
  if (pattern === 'generated') {
    return { file: relPath, lines, reason: 'Generated files are exempt' };
  }

  // Analyze structure
  const details: ModularityDetails = {
    hasSections: countSections(content) > 0,
    sectionCount: countSections(content),
    exportCount: countExports(content),
    importCount: countImports(content),
    hasNestedClasses: hasNestedClasses(content),
    methodCount: countMethods(content),
  };

  // Calculate score
  const { score, flags } = calculateScore(lines, pattern, details, content, relPath);

  return {
    file: relPath,
    lines,
    pattern,
    score,
    rating: scoreToRating(score),
    flags,
    details,
  };
}

function calculateScore(
  lines: number,
  pattern: FilePattern | null,
  details: ModularityDetails,
  content: string,
  file: string
): { score: number; flags: ModularityFlag[] } {
  let score = 10;
  const flags: ModularityFlag[] = [];
  const thresholds = PATTERN_THRESHOLDS[pattern || 'default'];

  // 1. Size penalty (relative to pattern threshold)
  if (lines > thresholds.red) {
    score -= 3;
  } else if (lines > thresholds.yellow) {
    score -= 1;
  }

  // 2. Single Responsibility (+2 if yes, -2 if no)
  if (!hasSingleResponsibility(content, file)) {
    score -= 2;
    flags.push('no-single-responsibility');
  }

  // 3. Internal Structure (+2 if organized)
  if (lines > 300) {
    if (details.hasSections || details.hasNestedClasses) {
      score += 1; // Bonus for organization in large files
    } else {
      score -= 2;
      flags.push('no-internal-structure');
    }
  }

  // 4. Coupling check (high imports = high coupling)
  if (details.importCount > 15) {
    score -= 1;
    flags.push('high-coupling');
  } else if (details.importCount > 25) {
    score -= 2;
  }

  // 5. Export surface (bloated API)
  if (details.exportCount > 20 && pattern !== 'types') {
    score -= 1;
    flags.push('low-cohesion');
  }

  // 6. Pattern bonus (recognized patterns get benefit of the doubt)
  if (pattern && ['controller', 'store', 'routes', 'state-machine'].includes(pattern)) {
    score += 1; // These patterns legitimately tend to be larger
  }

  // 7. Utility grab-bag detection
  if (/(utils?|helpers?)\.ts$/i.test(file) && details.exportCount > 10) {
    score -= 2;
    flags.push('utility-grab-bag');
  }

  // Clamp score
  return { score: Math.max(0, Math.min(10, score)), flags };
}

function scoreToRating(score: number): ModularityRating {
  if (score >= 9) return 'elite';
  if (score >= 7) return 'good';
  if (score >= 5) return 'acceptable';
  if (score >= 3) return 'needs-work';
  return 'poor';
}

// ============================================================================
// MAIN ANALYSIS
// ============================================================================

export interface ModularityOptions {
  minLines?: number;       // Only analyze files above this threshold (default: 100)
  includeAll?: boolean;    // Include all files, not just large ones
  patterns?: FilePattern[]; // Filter to specific patterns
}

export function analyzeModularity(
  rootDir: string,
  options: ModularityOptions = {}
): ModularityResult {
  const { minLines = 100, includeAll = false, patterns } = options;

  const allFiles = scanDirectory(rootDir);
  const files: FileModularity[] = [];
  const exempted: ExemptedFile[] = [];
  let totalLines = 0;

  for (const filePath of allFiles) {
    const result = analyzeFile(filePath, rootDir);

    if ('reason' in result) {
      // Exempted file
      exempted.push(result);
      totalLines += result.lines;
    } else {
      totalLines += result.lines;

      // Apply filters
      if (!includeAll && result.lines < minLines) continue;
      if (patterns && result.pattern && !patterns.includes(result.pattern)) continue;

      files.push(result);
    }
  }

  // Sort by score (worst first) then by lines (largest first)
  files.sort((a, b) => {
    if (a.score !== b.score) return a.score - b.score;
    return b.lines - a.lines;
  });

  // Calculate summary
  const summary = calculateSummary(files, allFiles.length, totalLines);

  return { files, summary, exempted };
}

function calculateSummary(
  files: FileModularity[],
  totalFiles: number,
  totalLines: number
): ModularitySummary {
  const distribution = { elite: 0, good: 0, acceptable: 0, needsWork: 0, poor: 0 };
  let scoreSum = 0;

  for (const file of files) {
    scoreSum += file.score;
    switch (file.rating) {
      case 'elite': distribution.elite++; break;
      case 'good': distribution.good++; break;
      case 'acceptable': distribution.acceptable++; break;
      case 'needs-work': distribution.needsWork++; break;
      case 'poor': distribution.poor++; break;
    }
  }

  return {
    totalFiles,
    totalLines,
    avgScore: files.length > 0 ? Math.round((scoreSum / files.length) * 10) / 10 : 10,
    distribution,
    largestFiles: files
      .sort((a, b) => b.lines - a.lines)
      .slice(0, 5)
      .map(f => ({ file: f.file, lines: f.lines, score: f.score })),
  };
}
