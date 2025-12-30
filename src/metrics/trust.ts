import { differenceInMinutes } from 'date-fns';
import { Commit, MetricResult, Rating } from '../types.js';

const FOLLOWUP_WINDOW_MINUTES = 30;

/**
 * Stopwords to exclude from component matching.
 * These are common commit message words that don't indicate component similarity.
 */
const COMPONENT_STOPWORDS = new Set([
  // Commit type words
  'fix',
  'feat',
  'chore',
  'docs',
  'style',
  'test',
  'tests',
  'refactor',
  // Common verbs
  'add',
  'adds',
  'added',
  'update',
  'updates',
  'updated',
  'change',
  'changes',
  'changed',
  'remove',
  'removes',
  'removed',
  'delete',
  'deletes',
  'deleted',
  'improve',
  'improves',
  'improved',
  'handle',
  'handles',
  'handling',
  'use',
  'uses',
  'using',
  'make',
  'makes',
  'making',
  'move',
  'moves',
  'moved',
  'rename',
  'renames',
  'renamed',
  // Common nouns
  'function',
  'functions',
  'method',
  'methods',
  'file',
  'files',
  'module',
  'modules',
  'code',
  'error',
  'errors',
  'issue',
  'issues',
  'bug',
  'bugs',
  'type',
  'types',
  // Articles/pronouns
  'the',
  'this',
  'that',
  'for',
  'and',
  'with',
  'from',
  'into',
]);

/**
 * Calculate trust pass rate as percentage of commits that don't need immediate fixes.
 *
 * Trust pass rate measures how often code "sticks" without requiring immediate
 * follow-up fixes. Higher rates indicate more autonomous, reliable work.
 *
 * Edge cases:
 * - 0 commits: Returns 'medium' (neutral) - insufficient data, not elite
 */
export function calculateTrustPassRate(commits: Commit[]): MetricResult {
  if (commits.length === 0) {
    return {
      value: 0,
      unit: '%',
      rating: 'medium',
      description: 'Insufficient data - no commits to analyze',
    };
  }

  // Sort by date ascending
  const sorted = [...commits].sort((a, b) => a.date.getTime() - b.date.getTime());

  let trustedCommits = 0;

  for (let i = 0; i < sorted.length; i++) {
    const commit = sorted[i];
    const nextCommit = sorted[i + 1];

    // Check if next commit is a fix to same component within 30 min
    const needsFollowup =
      nextCommit &&
      nextCommit.type === 'fix' &&
      sameComponent(commit, nextCommit) &&
      differenceInMinutes(nextCommit.date, commit.date) < FOLLOWUP_WINDOW_MINUTES;

    if (!needsFollowup) {
      trustedCommits++;
    }
  }

  const rate = (trustedCommits / commits.length) * 100;
  const rating = getRating(rate);

  return {
    value: Math.round(rate),
    unit: '%',
    rating,
    description: getDescription(rating),
  };
}

/**
 * Determine if two commits are targeting the same component.
 *
 * Heuristics used (in order of confidence):
 * 1. Scope match: If both have conventional commit scopes, compare them
 * 2. File overlap: If file info available (not implemented here)
 * 3. Message content: Look for meaningful shared words (not stopwords)
 *
 * The message heuristic requires:
 * - Word length > 4 chars (to avoid "the", "fix", "add")
 * - Word not in COMPONENT_STOPWORDS (to avoid "update", "change")
 */
function sameComponent(a: Commit, b: Commit): boolean {
  // If both have scopes, compare them (most reliable)
  if (a.scope && b.scope) {
    return a.scope.toLowerCase() === b.scope.toLowerCase();
  }

  // If one has scope and other doesn't, they likely differ
  if (a.scope || b.scope) {
    return false;
  }

  // Neither has scope - check if messages reference same area
  // Extract meaningful words (not stopwords, length > 4)
  const extractMeaningfulWords = (msg: string): string[] =>
    msg
      .toLowerCase()
      .split(/\s+/)
      .slice(0, 5) // Look at first 5 words
      .filter((word) => word.length > 4 && !COMPONENT_STOPWORDS.has(word));

  const aWords = new Set(extractMeaningfulWords(a.message));
  const bWords = extractMeaningfulWords(b.message);

  // Require at least one meaningful word overlap
  return bWords.some((word) => aWords.has(word));
}

function getRating(rate: number): Rating {
  if (rate > 95) return 'elite';
  if (rate >= 80) return 'high';
  if (rate >= 60) return 'medium';
  return 'low';
}

function getDescription(rating: Rating): string {
  switch (rating) {
    case 'elite':
      return 'Code sticks on first try, high AI trust';
    case 'high':
      return 'Occasional fixes needed, mostly autonomous';
    case 'medium':
      return 'Regular intervention required';
    case 'low':
      return 'Heavy oversight needed, run tracer tests before implementation';
  }
}
