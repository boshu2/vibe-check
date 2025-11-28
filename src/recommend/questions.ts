import { QuestionResponses } from '../types';

export interface Question {
  id: keyof QuestionResponses;
  text: string;
  options: { value: number; label: string; description: string }[];
}

/**
 * The 5 classification questions for vibe level determination.
 */
export const VIBE_QUESTIONS: Question[] = [
  {
    id: 'reversibility',
    text: 'How easy is it to undo this change?',
    options: [
      { value: 1, label: 'Easy', description: 'One command to revert (git revert, ctrl+z)' },
      { value: 0, label: 'Moderate', description: 'Some effort required' },
      { value: -1, label: 'Difficult', description: 'Significant work to undo' },
      { value: -2, label: 'Impossible', description: 'Cannot be undone (data loss, etc.)' },
    ],
  },
  {
    id: 'blastRadius',
    text: 'What breaks if this goes wrong?',
    options: [
      { value: 1, label: 'This file only', description: 'Isolated change' },
      { value: 0, label: 'This module', description: 'Affects related components' },
      { value: -1, label: 'Multiple systems', description: 'Cross-cutting impact' },
      { value: -2, label: 'Production/users', description: 'Customer-facing impact' },
    ],
  },
  {
    id: 'verificationCost',
    text: 'How hard is it to verify correctness?',
    options: [
      { value: 1, label: 'Instant', description: 'Obvious, compiler catches errors' },
      { value: 0, label: 'Run tests', description: 'Automated tests verify' },
      { value: -1, label: 'Manual testing', description: 'Need to manually verify' },
      { value: -2, label: 'Hard to verify', description: 'Difficult to fully validate' },
    ],
  },
  {
    id: 'domainComplexity',
    text: 'How much domain context is needed?',
    options: [
      { value: 1, label: 'Generic', description: 'Universal patterns, no special knowledge' },
      { value: 0, label: 'Standard', description: 'Common patterns in this domain' },
      { value: -1, label: 'Domain-specific', description: 'Requires specialized knowledge' },
      { value: -2, label: 'Novel/research', description: 'No established patterns' },
    ],
  },
  {
    id: 'aiTrackRecord',
    text: 'How has AI performed on similar tasks?',
    options: [
      { value: 1, label: 'Excellent', description: 'Consistently good results' },
      { value: 0, label: 'Generally good', description: 'Usually correct' },
      { value: -1, label: 'Mixed', description: 'Sometimes needs correction' },
      { value: -2, label: 'Poor/unknown', description: 'Unreliable or untested' },
    ],
  },
];

/**
 * Calculate base level from questions only (simple additive).
 */
export function calculateBaseLevel(responses: QuestionResponses): number {
  const base = 3;
  const score = base +
    responses.reversibility +
    responses.blastRadius +
    responses.verificationCost +
    responses.domainComplexity +
    responses.aiTrackRecord;

  return Math.max(0, Math.min(5, Math.round(score)));
}
