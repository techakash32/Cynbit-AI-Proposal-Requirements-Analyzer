import { describe, expect, it } from 'vitest';
import { normalizeAnalysis } from './normalize';

const base = {
  id: 'analysis-1',
  project_id: 'project-1',
  status: 'completed',
  result: {
    requirements: [{ id: 'R-1', category: 'Functional', description: 'Export data', evidence: 'Export a report', source_page: 2 }],
    gaps: [{ description: 'Retention period', why_it_matters: 'Defines storage policy', suggested_question: 'How long?', evidence: null, source_page: null }],
    clarification_questions: [{ question: 'Who owns the data?', priority: 'blocking', audience: 'business', source: 'No supporting evidence found', evidence: null, source_page: null }],
    risks: [],
    complexity: { score: 40, factors: [] },
    services: [],
    architecture: [],
    estimate: {
      included: true,
      assumptions: { hourly_rate: 100, contingency_percent: 20, team_size: 2 },
      phases: [{ name: 'Discovery', hours_low: 10, hours_high: 20, cost_low: 1200, cost_high: 2400 }],
      total_cost_low: 1200,
      total_cost_high: 2400,
      formula_note: 'Hours × rate × (1 + contingency).',
    },
    proposal_outline: { sections: [] },
  },
};

describe('normalizeAnalysis', () => {
  it('preserves verbatim evidence, source pages, and explicit missing evidence', () => {
    const result = normalizeAnalysis(base);
    expect(result.requirements[0]).toMatchObject({ evidence: 'Export a report', source_page: 2 });
    expect(result.gaps[0]).toMatchObject({ evidence: null, source_page: null });
    expect(result.clarification_questions[0]).toMatchObject({ evidence: null, source_page: null, source: 'No supporting evidence found' });
  });

  it('retains estimate assumptions and ranges for client recalculation', () => {
    const result = normalizeAnalysis(base);
    expect(result.estimate).toMatchObject({ included: true, formula_note: 'Hours × rate × (1 + contingency).', total_low: 1200, total_high: 2400 });
    expect(result.estimate.phases[0]).toMatchObject({ hours_low: 10, hours_high: 20, low: 1200, high: 2400 });
  });

  it('does not display a fabricated estimate when the option was disabled', () => {
    const raw = {
      ...base,
      result: {
        ...base.result,
        estimate: {
          included: false,
          assumptions: { hourly_rate: 150, contingency_percent: 15, team_size: 2 },
          phases: [],
          total_cost_low: 0,
          total_cost_high: 0,
          formula_note: 'No estimate was calculated because the estimate option was disabled.',
        },
      },
    };
    const result = normalizeAnalysis(raw);
    expect(result.estimate.included).toBe(false);
    expect(result.estimate.phases).toEqual([]);
    expect(result.estimate.total_low).toBe(0);
  });
});
