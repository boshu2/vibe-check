import { describe, it, expect } from 'vitest';
import {
  createInitialInterventionMemory,
  recordIntervention,
  formatInterventionMemory,
  getInterventionDisplayName,
  getInterventionIcon,
  getRecommendedIntervention,
  getAllInterventionTypes,
  INTERVENTION_INFO,
} from '../../src/gamification/intervention-memory';

describe('Intervention Memory', () => {
  describe('createInitialInterventionMemory', () => {
    it('creates empty intervention memory', () => {
      const memory = createInitialInterventionMemory();

      expect(memory.version).toBe('1.0.0');
      expect(memory.records).toEqual([]);
      expect(memory.typeCounts).toEqual({});
      expect(memory.effectiveByPattern).toEqual({});
      expect(memory.topInterventions).toEqual([]);
      expect(memory.avgTimeToIntervene).toBe(0);
      expect(memory.totalInterventions).toBe(0);
    });
  });

  describe('recordIntervention', () => {
    it('records a new intervention', () => {
      const memory = createInitialInterventionMemory();
      const updated = recordIntervention(memory, {
        type: 'TRACER_TEST',
        spiralPattern: 'SECRETS_AUTH',
        spiralDuration: 30,
      });

      expect(updated.records.length).toBe(1);
      expect(updated.totalInterventions).toBe(1);
      expect(updated.typeCounts['TRACER_TEST']).toBe(1);
      expect(updated.records[0].type).toBe('TRACER_TEST');
      expect(updated.records[0].spiralPattern).toBe('SECRETS_AUTH');
      expect(updated.records[0].spiralDuration).toBe(30);
    });

    it('handles undefined memory', () => {
      const updated = recordIntervention(undefined, {
        type: 'BREAK',
        spiralDuration: 45,
      });

      expect(updated.records.length).toBe(1);
      expect(updated.typeCounts['BREAK']).toBe(1);
    });

    it('accumulates interventions over time', () => {
      let memory = createInitialInterventionMemory();

      memory = recordIntervention(memory, {
        type: 'TRACER_TEST',
        spiralPattern: 'SECRETS_AUTH',
        spiralDuration: 30,
      });

      memory = recordIntervention(memory, {
        type: 'TRACER_TEST',
        spiralPattern: 'API_MISMATCH',
        spiralDuration: 20,
      });

      memory = recordIntervention(memory, {
        type: 'BREAK',
        spiralPattern: 'SECRETS_AUTH',
        spiralDuration: 60,
      });

      expect(memory.records.length).toBe(3);
      expect(memory.typeCounts['TRACER_TEST']).toBe(2);
      expect(memory.typeCounts['BREAK']).toBe(1);
      expect(memory.avgTimeToIntervene).toBe(37); // (30 + 20 + 60) / 3 = 36.67 → 37
    });

    it('tracks pattern-specific interventions', () => {
      let memory = createInitialInterventionMemory();

      memory = recordIntervention(memory, {
        type: 'TRACER_TEST',
        spiralPattern: 'SECRETS_AUTH',
        spiralDuration: 30,
      });

      memory = recordIntervention(memory, {
        type: 'DOCS',
        spiralPattern: 'SECRETS_AUTH',
        spiralDuration: 25,
      });

      expect(memory.effectiveByPattern['SECRETS_AUTH']).toContain('TRACER_TEST');
      expect(memory.effectiveByPattern['SECRETS_AUTH']).toContain('DOCS');
    });

    it('identifies top interventions by frequency', () => {
      let memory = createInitialInterventionMemory();

      // Add 5 TRACER_TEST, 3 BREAK, 2 DOCS
      for (let i = 0; i < 5; i++) {
        memory = recordIntervention(memory, { type: 'TRACER_TEST', spiralDuration: 10 });
      }
      for (let i = 0; i < 3; i++) {
        memory = recordIntervention(memory, { type: 'BREAK', spiralDuration: 10 });
      }
      for (let i = 0; i < 2; i++) {
        memory = recordIntervention(memory, { type: 'DOCS', spiralDuration: 10 });
      }

      expect(memory.topInterventions[0]).toBe('TRACER_TEST');
      expect(memory.topInterventions[1]).toBe('BREAK');
      expect(memory.topInterventions[2]).toBe('DOCS');
    });

    it('limits records to 100', () => {
      let memory = createInitialInterventionMemory();

      for (let i = 0; i < 110; i++) {
        memory = recordIntervention(memory, {
          type: 'TRACER_TEST',
          spiralDuration: 10,
        });
      }

      expect(memory.records.length).toBe(100);
      expect(memory.totalInterventions).toBe(100);
    });

    it('includes optional notes', () => {
      const memory = createInitialInterventionMemory();
      const updated = recordIntervention(memory, {
        type: 'OTHER',
        spiralDuration: 45,
        notes: 'Rubber duck debugging worked!',
      });

      expect(updated.records[0].notes).toBe('Rubber duck debugging worked!');
    });
  });

  describe('formatInterventionMemory', () => {
    it('returns hasData: false for empty memory', () => {
      const memory = createInitialInterventionMemory();
      const formatted = formatInterventionMemory(memory);

      expect(formatted.hasData).toBe(false);
      expect(formatted.summary).toBe('No interventions recorded yet');
    });

    it('returns hasData: false for undefined memory', () => {
      const formatted = formatInterventionMemory(undefined);

      expect(formatted.hasData).toBe(false);
    });

    it('formats intervention data correctly', () => {
      let memory = createInitialInterventionMemory();
      memory = recordIntervention(memory, {
        type: 'TRACER_TEST',
        spiralPattern: 'SECRETS_AUTH',
        spiralDuration: 30,
      });

      const formatted = formatInterventionMemory(memory);

      expect(formatted.hasData).toBe(true);
      expect(formatted.totalInterventions).toBe(1);
      expect(formatted.avgTimeToIntervene).toBe(30);
      expect(formatted.topInterventions[0].type).toBe('TRACER_TEST');
      expect(formatted.topInterventions[0].name).toBe('Tracer Test');
      expect(formatted.topInterventions[0].icon).toBe('🧪');
    });

    it('generates appropriate summary', () => {
      let memory = createInitialInterventionMemory();
      memory = recordIntervention(memory, {
        type: 'TRACER_TEST',
        spiralDuration: 30,
      });

      const formatted = formatInterventionMemory(memory);
      expect(formatted.summary).toBe('1 intervention recorded');
    });

    it('generates summary with top intervention for many records', () => {
      let memory = createInitialInterventionMemory();
      for (let i = 0; i < 10; i++) {
        memory = recordIntervention(memory, {
          type: 'BREAK',
          spiralDuration: 10,
        });
      }

      const formatted = formatInterventionMemory(memory);
      expect(formatted.summary).toContain('10 interventions');
      expect(formatted.summary).toContain('Take a Break');
      expect(formatted.summary).toContain('100%');
    });

    it('includes pattern recommendations', () => {
      let memory = createInitialInterventionMemory();
      memory = recordIntervention(memory, {
        type: 'TRACER_TEST',
        spiralPattern: 'SECRETS_AUTH',
        spiralDuration: 30,
      });

      const formatted = formatInterventionMemory(memory);
      expect(formatted.patternRecommendations.length).toBeGreaterThan(0);
      expect(formatted.patternRecommendations[0].pattern).toBe('SECRETS_AUTH');
      expect(formatted.patternRecommendations[0].interventions).toContain('Tracer Test');
    });
  });

  describe('getInterventionDisplayName', () => {
    it('returns human-readable names for all intervention types', () => {
      expect(getInterventionDisplayName('TRACER_TEST')).toBe('Tracer Test');
      expect(getInterventionDisplayName('BREAK')).toBe('Take a Break');
      expect(getInterventionDisplayName('DOCS')).toBe('Read Docs');
      expect(getInterventionDisplayName('REFACTOR')).toBe('Refactor');
      expect(getInterventionDisplayName('HELP')).toBe('Ask for Help');
      expect(getInterventionDisplayName('ROLLBACK')).toBe('Rollback');
      expect(getInterventionDisplayName('OTHER')).toBe('Other');
    });
  });

  describe('getInterventionIcon', () => {
    it('returns icons for all intervention types', () => {
      expect(getInterventionIcon('TRACER_TEST')).toBe('🧪');
      expect(getInterventionIcon('BREAK')).toBe('☕');
      expect(getInterventionIcon('DOCS')).toBe('📚');
      expect(getInterventionIcon('REFACTOR')).toBe('🔄');
      expect(getInterventionIcon('HELP')).toBe('🤝');
      expect(getInterventionIcon('ROLLBACK')).toBe('⏪');
      expect(getInterventionIcon('OTHER')).toBe('💡');
    });
  });

  describe('getRecommendedIntervention', () => {
    it('returns null for empty memory', () => {
      const memory = createInitialInterventionMemory();
      const recommended = getRecommendedIntervention(memory, 'SECRETS_AUTH');

      expect(recommended).toBeNull();
    });

    it('returns null for undefined memory', () => {
      const recommended = getRecommendedIntervention(undefined, 'SECRETS_AUTH');

      expect(recommended).toBeNull();
    });

    it('recommends pattern-specific intervention when available', () => {
      let memory = createInitialInterventionMemory();

      // TRACER_TEST works for SECRETS_AUTH
      memory = recordIntervention(memory, {
        type: 'TRACER_TEST',
        spiralPattern: 'SECRETS_AUTH',
        spiralDuration: 30,
      });
      memory = recordIntervention(memory, {
        type: 'TRACER_TEST',
        spiralPattern: 'SECRETS_AUTH',
        spiralDuration: 25,
      });

      // BREAK works for API_MISMATCH
      memory = recordIntervention(memory, {
        type: 'BREAK',
        spiralPattern: 'API_MISMATCH',
        spiralDuration: 45,
      });

      // Should recommend TRACER_TEST for SECRETS_AUTH
      expect(getRecommendedIntervention(memory, 'SECRETS_AUTH')).toBe('TRACER_TEST');

      // Should recommend BREAK for API_MISMATCH
      expect(getRecommendedIntervention(memory, 'API_MISMATCH')).toBe('BREAK');
    });

    it('falls back to overall top intervention for unknown patterns', () => {
      let memory = createInitialInterventionMemory();

      // TRACER_TEST is most common overall
      for (let i = 0; i < 5; i++) {
        memory = recordIntervention(memory, {
          type: 'TRACER_TEST',
          spiralPattern: 'SECRETS_AUTH',
          spiralDuration: 30,
        });
      }

      // Should recommend TRACER_TEST for unknown pattern
      expect(getRecommendedIntervention(memory, 'UNKNOWN_PATTERN')).toBe('TRACER_TEST');
    });
  });

  describe('getAllInterventionTypes', () => {
    it('returns all intervention types with metadata', () => {
      const types = getAllInterventionTypes();

      expect(types.length).toBe(7);
      expect(types.map(t => t.type)).toContain('TRACER_TEST');
      expect(types.map(t => t.type)).toContain('BREAK');
      expect(types.map(t => t.type)).toContain('DOCS');
      expect(types.map(t => t.type)).toContain('REFACTOR');
      expect(types.map(t => t.type)).toContain('HELP');
      expect(types.map(t => t.type)).toContain('ROLLBACK');
      expect(types.map(t => t.type)).toContain('OTHER');

      // Check metadata is present
      for (const type of types) {
        expect(type.name).toBeDefined();
        expect(type.icon).toBeDefined();
        expect(type.description).toBeDefined();
      }
    });
  });

  describe('INTERVENTION_INFO', () => {
    it('has info for all intervention types', () => {
      expect(Object.keys(INTERVENTION_INFO).length).toBe(7);

      for (const key of Object.keys(INTERVENTION_INFO)) {
        const info = INTERVENTION_INFO[key as keyof typeof INTERVENTION_INFO];
        expect(info.name).toBeDefined();
        expect(info.icon).toBeDefined();
        expect(info.description).toBeDefined();
      }
    });
  });
});
