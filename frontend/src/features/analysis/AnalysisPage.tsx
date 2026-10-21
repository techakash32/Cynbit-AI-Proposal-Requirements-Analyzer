import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Copy, ExternalLink, Search } from 'lucide-react';
import { api } from '../../lib/api';
import { calculateEstimateDisplay } from '../../lib/estimate';
import { normalizeAnalysis } from '../../lib/normalize';
import { useUIStore } from '../../stores/ui';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/fields';
import { Badge, Card, EmptyState } from '../../components/ui/surfaces';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/radix';
import { useToast } from '../../components/ui/toast';
import { ClarificationTable, ComplexityGauge, ErrorState, EstimateTable, GapCard, LoadingState, PageHeader, RequirementTable, RiskCard, ServiceCard } from '../../components/shared/workbench';
import MermaidDiagram from './MermaidDiagram';

const tabs = ['requirements', 'gaps', 'risks', 'complexity', 'services', 'architecture', 'estimate', 'proposal'] as const;

export default function AnalysisPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const analysis = useQuery({ queryKey: ['analysis', id], queryFn: async () => normalizeAnalysis(await api<unknown>(`/analyses/${id}`)), enabled: Boolean(id), refetchInterval: (query) => query.state.data?.status === 'Analyzing' ? 2000 : false, retry: 1 });
  const [requirementSearch, setRequirementSearch] = useState('');
  const sortDesc = useUIStore((state) => state.requirementSortDescending);
  const setSortDesc = useUIStore((state) => state.setRequirementSortDescending);
  const severityFilter = useUIStore((state) => state.riskSeverity);
  const setSeverityFilter = useUIStore((state) => state.setRiskSeverity);
  const riskCategory = useUIStore((state) => state.riskCategory);
  const setRiskCategory = useUIStore((state) => state.setRiskCategory);
  const [hourlyRate, setHourlyRate] = useState<number | null>(null);
  const [contingency, setContingency] = useState<number | null>(null);
  const [teamSize, setTeamSize] = useState<number | null>(null);
  const requirements = useMemo(() => (analysis.data?.requirements ?? []).filter((item) => `${item.id} ${item.category} ${item.description}`.toLowerCase().includes(requirementSearch.toLowerCase())).sort((a, b) => sortDesc ? b.id.localeCompare(a.id) : a.id.localeCompare(b.id)), [analysis.data?.requirements, requirementSearch, sortDesc]);
  const risks = useMemo(() => (analysis.data?.risks ?? []).filter((risk) => (severityFilter === 'All' || risk.severity === severityFilter) && (riskCategory === 'All' || risk.category === riskCategory)), [analysis.data?.risks, severityFilter, riskCategory]);

  if (analysis.isLoading) return <><PageHeader title="Analysis" description="Loading analysis results." /><LoadingState label="Loading analysis" /></>;
  if (analysis.error) return <><PageHeader title="Analysis" /><ErrorState message={analysis.error instanceof Error ? analysis.error.message : 'Could not load analysis.'} onRetry={() => void analysis.refetch()} /></>;
  const data = analysis.data!;
  if (data.status === 'Analyzing') return <><PageHeader title="Analysis in progress" description="The background pipeline is still running. This page refreshes automatically." /><div className="max-w-2xl"><div className="loading-line" /><p className="mt-3 text-sm text-muted-copy">Current stage: {data.stage ?? 'Analysis'}</p></div></>;
  if (data.status === 'Failed') return <><PageHeader title="Analysis failed" /><ErrorState message={data.error ?? 'This analysis did not complete.'} onRetry={() => navigate('/projects')} /></>;
  const estimate = data.estimate;
  const assumptions = { hourly_rate: hourlyRate ?? estimate.assumptions.hourly_rate, contingency_percent: contingency ?? estimate.assumptions.contingency_percent, team_size: teamSize ?? estimate.assumptions.team_size };
  const estimateView = calculateEstimateDisplay(estimate.phases, assumptions);
  const { phases, totalLow, totalHigh, durationLowDays, durationHighDays } = estimateView;
  const categories = ['All', ...Array.from(new Set(data.risks.map((risk) => risk.category)))];
  const blocking = data.clarification_questions.filter((item) => item.priority === 'Blocking');
  const proposalId = data.proposal_id ?? data.id;

  async function copyBlocking() {
    try { await navigator.clipboard.writeText(blocking.map((item) => item.question).join('\n')); toast(`${blocking.length} blocking question${blocking.length === 1 ? '' : 's'} copied.`); }
    catch { toast('Clipboard access was unavailable.', 'error'); }
  }

  return <>
    <PageHeader title="Analysis results" description="Review outputs alongside their evidence and assumptions." actions={<Link to={`/projects/${data.project_id}/analyze`} className="btn btn-outline"><ExternalLink size={14} />Open project</Link>} />
    <Tabs defaultValue="requirements">
      <TabsList aria-label="Analysis result sections">{tabs.map((tab) => <TabsTrigger key={tab} value={tab} className="capitalize">{tab === 'gaps' ? 'Gaps & Clarifications' : tab}</TabsTrigger>)}</TabsList>
      <TabsContent value="requirements"><div className="mb-3 max-w-xl"><div className="relative"><Search size={16} className="absolute left-3 top-3 text-muted-copy" /><Input className="pl-8" aria-label="Search requirements" placeholder="Search requirements" value={requirementSearch} onChange={(event) => setRequirementSearch(event.target.value)} /></div></div><RequirementTable items={requirements} sortDesc={sortDesc} onSort={() => setSortDesc(!sortDesc)} /></TabsContent>
      <TabsContent value="gaps"><div className="space-y-6"><section><h2 className="mb-3 font-semibold">Gaps</h2>{data.gaps.length ? <div className="grid gap-3 lg:grid-cols-2">{data.gaps.map((gap, index) => <GapCard key={`${gap.suggested_question}-${index}`} gap={gap} />)}</div> : <EmptyState title="No gaps returned" description="The analysis did not identify gaps to show." />}</section><section><div className="mb-3 flex flex-wrap items-center justify-between gap-2"><h2 className="font-semibold">Clarification question set</h2><Button variant="outline" size="sm" onClick={() => void copyBlocking()} disabled={!blocking.length}><Copy size={14} />Copy all blocking questions</Button></div><ClarificationTable questions={data.clarification_questions} /></section></div></TabsContent>
      <TabsContent value="risks"><div className="mb-4 flex flex-wrap gap-2" aria-label="Risk filters"><div className="flex flex-wrap gap-1">{['All', 'Low', 'Medium', 'High', 'Critical'].map((value) => <button type="button" key={value} onClick={() => setSeverityFilter(value)} aria-pressed={severityFilter === value} className={`rounded-pill border px-3 py-1 text-xs ${severityFilter === value ? 'border-action bg-action text-paper' : 'border-line hover:bg-soft'}`}>{value}</button>)}</div><select className="select risk-filter text-sm" value={riskCategory} onChange={(event) => setRiskCategory(event.target.value)} aria-label="Filter by risk category">{categories.map((category) => <option key={category}>{category}</option>)}</select></div>{risks.length ? <div className="grid gap-3 lg:grid-cols-2">{risks.map((risk) => <RiskCard key={risk.id} risk={risk} />)}</div> : <EmptyState title="No risks in this filter" description="No matching risks were returned by this analysis." />}</TabsContent>
      <TabsContent value="complexity"><div className="space-y-4"><ComplexityGauge score={data.complexity.score} /><div className="table-wrap"><table><caption className="visually-hidden">Complexity score contributing factors</caption><thead><tr><th scope="col">Factor</th><th scope="col">Weight</th><th scope="col">Contribution</th></tr></thead><tbody>{data.complexity.factors.map((factor) => <tr key={factor.name}><td>{factor.name}</td><td>{factor.weight}</td><td>{factor.contribution}</td></tr>)}</tbody></table></div></div></TabsContent>
      <TabsContent value="services">{data.services.length ? <div className="grid gap-3 lg:grid-cols-2">{data.services.map((service, index) => <ServiceCard key={`${service.name}-${index}`} service={service} />)}</div> : <EmptyState title="No service lines identified" description="No service lines were returned for this analysis." />}</TabsContent>
      <TabsContent value="architecture">{Object.keys(data.architecture.stack).length ? <div className="grid gap-4 xl:grid-cols-2"><Card className="p-4"><h2 className="font-semibold">Recommended stack by layer</h2><dl className="mt-4 divide-y divide-line">{Object.entries(data.architecture.stack).map(([layer, value]) => <div key={layer} className="architecture-item py-3"><dt className="text-sm font-medium">{layer}</dt><dd className="text-sm text-muted-copy">{value}<details className="mt-2"><summary className="cursor-pointer text-xs font-medium text-copy">Why this fits</summary><p className="mt-1 text-xs text-muted-copy">{data.architecture.rationale?.[layer] ?? 'No rationale provided by the analysis.'}</p></details><details className="mt-1"><summary className="cursor-pointer text-xs font-medium text-copy">Trade-off</summary><p className="mt-1 text-xs text-muted-copy">{data.architecture.tradeoffs?.[layer] ?? 'No trade-off provided by the analysis.'}</p></details></dd></div>)}</dl></Card><Card className="min-w-0 p-4"><h2 className="font-semibold">Architecture diagram</h2><p className="mt-1 text-xs text-muted-copy">Diagram rendered from the analysis recommendation.</p><MermaidDiagram source={data.architecture.mermaid} /></Card></div> : <EmptyState title="Architecture was not included" description="This analysis returned no architecture recommendations." />}</TabsContent>
      <TabsContent value="estimate">{!estimate.included ? <EmptyState title="Estimate not included" description="The estimate option was disabled for this analysis. No hours or cost ranges were calculated." /> : <div className="space-y-4"><div className="border border-line bg-soft p-3 text-sm font-medium">Preliminary estimate — requires human review. Not a quote.</div><Card className="p-4"><h2 className="font-semibold">Assumptions</h2><div className="mt-3 grid gap-3 sm:grid-cols-3"><NumberAssumption label="Hourly rate" value={assumptions.hourly_rate} onChange={setHourlyRate} min={0} prefix="$" /><NumberAssumption label="Contingency %" value={assumptions.contingency_percent} onChange={setContingency} min={0} max={100} suffix="%" /><NumberAssumption label="Team size" value={assumptions.team_size} onChange={setTeamSize} min={1} max={100} /></div><p className="mt-3 text-xs text-muted-copy">{estimate.formula_note} These edited assumptions are temporary and are not saved to the analysis.</p></Card><EstimateTable phases={phases} assumptions={assumptions} /><Card className="flex flex-wrap items-center justify-between gap-3 p-4"><div><p className="text-xs uppercase tracking-wide text-muted-copy">Total preliminary cost range</p><p className="mt-1 text-xl font-semibold">${totalLow.toLocaleString()}–${totalHigh.toLocaleString()}</p><p className="mt-2 text-sm text-muted-copy">Estimated sequential schedule: {durationLowDays}–{durationHighDays} workdays</p></div><Badge>Human review required</Badge></Card></div>}</TabsContent>
      <TabsContent value="proposal"><Card className="flex flex-col items-start gap-3 p-4"><h2 className="font-semibold">Proposal draft</h2><p className="text-sm text-muted-copy">Review and edit the proposal sections generated from this analysis.</p><Button onClick={() => navigate(`/proposals/${proposalId}`)}>Open proposal editor <ExternalLink size={14} /></Button></Card></TabsContent>
    </Tabs>
  </>;
}
function NumberAssumption({ label, value, onChange, min, max, prefix, suffix }: { label: string; value: number; onChange: (value: number) => void; min: number; max?: number; prefix?: string; suffix?: string }) { return <label className="block text-sm"><span className="font-medium">{label}</span><span className="relative mt-1 block"><Input type="number" min={min} max={max} value={value} onChange={(event) => onChange(Math.max(min, Number(event.target.value) || min))} className="pr-8" />{(prefix || suffix) && <span className="absolute right-3 top-2 text-muted-copy">{suffix ?? prefix}</span>}</span></label>; }
