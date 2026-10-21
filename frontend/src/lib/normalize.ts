import type { Analysis, Project } from '../types/api';

type Json = Record<string, unknown>;
const object = (value: unknown): Json => value && typeof value === 'object' ? value as Json : {};
const array = (value: unknown): Json[] => Array.isArray(value) ? value.map(object) : [];
const str = (value: unknown, fallback = ''): string => typeof value === 'string' ? value : fallback;
const num = (value: unknown, fallback = 0): number => typeof value === 'number' && Number.isFinite(value) ? value : fallback;
const capitalize = (value: unknown): string => str(value, 'Unknown').replaceAll('-', ' ').replace(/\b\w/g, (character) => character.toUpperCase());

export function normalizeStatus(value: unknown): Project['status'] {
  const state = str(value).toLowerCase();
  if (state === 'complete' || state === 'completed') return 'Complete';
  if (state === 'analyzing' || state === 'running' || state === 'queued') return 'Analyzing';
  if (state === 'failed') return 'Failed';
  return 'Draft';
}

export function normalizeProject(value: unknown): Project {
  const raw = object(value);
  return {
    id: str(raw.id), name: str(raw.name), status: normalizeStatus(raw.status),
    created_at: str(raw.created_at), updated_at: str(raw.updated_at),
    requirements_count: num(raw.requirements_count), risks_count: num(raw.risks_count),
    owner_id: str(raw.owner_id), description: typeof raw.description === 'string' ? raw.description : null,
  };
}

function mermaidFromArchitecture(items: Json[]): string {
  const rows = items.map((item) => ({ area: str(item.area, 'Layer'), recommendation: str(item.recommendation) })).filter((item) => item.recommendation.trim());
  if (!rows.length) return '';
  const safe = (value: string) => value.replace(/[\[\]{}<>"'`|#;]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 90);
  const nodes = rows.map((row, index) => `N${index}["${safe(row.area)}: ${safe(row.recommendation)}"]`);
  const links = rows.slice(1).map((_, index) => `N${index} --> N${index + 1}`);
  return ['flowchart LR', ...nodes, ...links].join('\n');
}

export function normalizeAnalysis(rawValue: unknown): Analysis {
  const raw = object(rawValue);
  const result = object(raw.result ?? raw);
  const complexity = object(result.complexity);
  const estimate = object(result.estimate);
  const assumptions = object(estimate.assumptions);
  const architecture = array(result.architecture);
  const outline = object(result.proposal_outline);
  const sections = array(outline.sections ?? result.proposal_outline);
  const proposal = object(raw.proposal);
  const proposalId = str(raw.proposal_id || proposal.id) || undefined;
  const state = str(raw.status).toLowerCase();
  const status: Analysis['status'] = state === 'completed' || state === 'complete' ? 'Complete' : state === 'failed' ? 'Failed' : 'Analyzing';
  return {
    id: str(raw.id), project_id: str(raw.project_id), status,
    stage: str(raw.stage), stages: object(raw.stages) as Record<string, string>, error: typeof raw.error === 'string' ? raw.error : null,
    requirements: array(result.requirements).map((r) => ({
      id: str(r.id), category: str(r.category, 'Uncategorized'), description: str(r.description),
      priority: capitalize(r.priority), must_have: Boolean(r.must_have || r.priority === 'must'),
      evidence: typeof r.evidence === 'string' ? r.evidence : null,
      source_page: typeof r.source_page === 'number' ? r.source_page : null,
    })),
    gaps: array(result.gaps).map((g) => ({ what_is_missing: str(g.description ?? g.what_is_missing), why_it_matters: str(g.why_it_matters), suggested_question: str(g.suggested_question), source: typeof g.source === 'string' ? g.source : null, evidence: typeof g.evidence === 'string' ? g.evidence : null, source_page: typeof g.source_page === 'number' ? g.source_page : null })),
    clarification_questions: array(result.clarification_questions).map((q) => ({ question: str(q.question), priority: capitalize(q.priority) as 'Blocking' | 'Important' | 'Nice-to-know', audience: capitalize(q.audience) as 'Business' | 'Technical' | 'Either', source: str(q.source, 'No supporting evidence found'), evidence: typeof q.evidence === 'string' ? q.evidence : null, source_page: typeof q.source_page === 'number' ? q.source_page : null })),
    risks: array(result.risks).map((r, index) => ({ id: str(r.id, `R-${index + 1}`), name: str(r.description ?? r.name), category: str(r.category, 'Delivery'), severity: capitalize(r.severity) as 'Low' | 'Medium' | 'High' | 'Critical', likelihood: typeof r.likelihood === 'number' ? r.likelihood : (r.likelihood === 'high' ? 4 : r.likelihood === 'medium' ? 2 : 1), impact: typeof r.impact === 'number' ? r.impact : (r.impact === 'high' ? 4 : r.impact === 'medium' ? 2 : 1), mitigation: str(r.mitigation), evidence: typeof r.evidence === 'string' ? r.evidence : null, source_page: typeof r.source_page === 'number' ? r.source_page : null })),
    complexity: { score: num(complexity.score), factors: array(complexity.factors).map((f) => ({ name: str(f.name), weight: num(f.weight), contribution: num(f.contribution) })) },
    services: array(result.services).map((s) => ({ name: str(s.name), confidence: s.confidence === 'unverified' ? 'Low' : capitalize(s.confidence) as 'High' | 'Medium' | 'Low', rationale: str(s.rationale), requirement_ids: Array.isArray(s.supporting_requirement_ids) ? s.supporting_requirement_ids.map(String) : Array.isArray(s.requirement_ids) ? s.requirement_ids.map(String) : [], catalog_verified: Boolean(s.verified_catalog ?? s.catalog_verified) })),
    architecture: { stack: Object.fromEntries(architecture.map((item) => [str(item.area, 'Architecture'), str(item.recommendation)])), mermaid: mermaidFromArchitecture(architecture), rationale: Object.fromEntries(architecture.map((item) => [str(item.area, 'Architecture'), str(item.why_it_fits)])), tradeoffs: Object.fromEntries(architecture.map((item) => [str(item.area, 'Architecture'), str(item.trade_off)])) },
    estimate: {
      included: estimate.included === true,
      formula_note: str(estimate.formula_note, 'Estimate assumptions and formula were not provided.'),
      phases: array(estimate.phases).map((p) => ({ name: str(p.name), hours: (num(p.hours_low) + num(p.hours_high)) / 2, hours_low: num(p.hours_low), hours_high: num(p.hours_high), team_size: num(assumptions.team_size, 2), low: num(p.cost_low), high: num(p.cost_high) })),
      assumptions: { hourly_rate: num(assumptions.hourly_rate, 150), contingency_percent: num(assumptions.contingency_percent, 15), team_size: num(assumptions.team_size, 2) },
      total_low: num(estimate.total_cost_low), total_high: num(estimate.total_cost_high),
    },
    proposal_outline: sections.map((s) => ({ id: str(s.key ?? s.id), title: str(s.heading ?? s.title), content: str(s.content), edited: s.metadata === 'edited' || Boolean(s.edited) })),
    proposal_id: proposalId,
  };
}
