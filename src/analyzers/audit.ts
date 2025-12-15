
import * as fs from 'fs';
import * as path from 'path';
import { getFileStats } from '../git.js';

export interface AuditResult {
  monoliths: Monolith[];
  testGaps: TestGap[];
  todoDensity: TodoHotspot[];
  stats: {
    totalFiles: number;
    totalLines: number;
  };
}

export interface Monolith {
  file: string;
  lines: number;
}

export interface TestGap {
  file: string;
  testFile: string | null; // null if missing
  lastModified: Date;
}

export interface TodoHotspot {
  file: string;
  count: number;
}

const IGNORE_DIRS = ['node_modules', 'dist', 'coverage', '.git', '.vibe-check'];
const TEST_EXTENSIONS = ['.test.ts', '.spec.ts', '.test.js', '.spec.js'];

export function scanDirectory(dir: string, rootDir: string = dir): string[] {
  let results: string[] = [];
  const list = fs.readdirSync(dir);
  
  for (const file of list) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat && stat.isDirectory()) {
      if (!IGNORE_DIRS.includes(file)) {
        results = results.concat(scanDirectory(filePath, rootDir));
      }
    } else {
      // Only include source files
      if (file.match(/\.(ts|js|jsx|tsx)$/)) {
        results.push(filePath);
      }
    }
  }
  return results;
}

export function analyzeMonoliths(files: string[], limit: number = 600): Monolith[] {
  const monoliths: Monolith[] = [];
  
  for (const file of files) {
    const content = fs.readFileSync(file, 'utf-8');
    const lines = content.split('\n').length;
    if (lines > limit) {
      monoliths.push({ file, lines });
    }
  }
  
  return monoliths.sort((a, b) => b.lines - a.lines);
}

export function analyzeTodoDensity(files: string[], limit: number = 5): TodoHotspot[] {
  const hotspots: TodoHotspot[] = [];
  
  for (const file of files) {
    const content = fs.readFileSync(file, 'utf-8');
    const matches = content.match(/\/\/\s*(TODO|FIXME)/gi);
    if (matches && matches.length >= limit) {
      hotspots.push({ file, count: matches.length });
    }
  }
  
  return hotspots.sort((a, b) => b.count - a.count);
}

// Simple heuristic: if src/foo.ts exists, look for src/foo.test.ts or tests/foo.test.ts
export function analyzeTestGaps(files: string[], rootDir: string): TestGap[] {
  const gaps: TestGap[] = [];
  const sourceFiles = files.filter(f => !f.match(/\.(test|spec)\./) && !f.includes('/tests/'));
  
  for (const file of sourceFiles) {
    const fileName = path.basename(file, path.extname(file));
    const relativePath = path.relative(rootDir, file);
    
    // Potential test locations
    const candidates = [
      file.replace(/\.(ts|js|tsx|jsx)$/, '.test.$1'),
      file.replace(/\.(ts|js|tsx|jsx)$/, '.spec.$1'),
      path.join(rootDir, 'tests', `${fileName}.test.ts`),
      path.join(rootDir, 'tests', relativePath.replace(/\.(ts|js|tsx|jsx)$/, '.test.$1'))
    ];
    
    const hasTest = candidates.some(c => fs.existsSync(c));
    
    if (!hasTest) {
      gaps.push({
        file: relativePath,
        testFile: null,
        lastModified: fs.statSync(file).mtime
      });
    }
  }
  
  return gaps;
}

export function runAudit(rootDir: string): AuditResult {
  const files = scanDirectory(rootDir);
  const totalFiles = files.length;
  let totalLines = 0;
  
  files.forEach(f => {
    totalLines += fs.readFileSync(f, 'utf-8').split('\n').length;
  });
  
  return {
    monoliths: analyzeMonoliths(files),
    testGaps: analyzeTestGaps(files, rootDir),
    todoDensity: analyzeTodoDensity(files),
    stats: { totalFiles, totalLines }
  };
}
