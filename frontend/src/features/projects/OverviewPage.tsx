import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { FilePlus2 } from 'lucide-react';
import { api } from '../../lib/api';
import { normalizeStatus } from '../../lib/normalize';
import { formatDate } from '../../lib/utils';
import type { Overview, RecentAnalysis } from '../../types/api';
import { Button } from '../../components/ui/button';
import { Card, EmptyState, StatusBadge } from '../../components/ui/surfaces';
import { ErrorState, LoadingState, PageHeader, StatCard } from '../../components/shared/workbench';

export default function OverviewPage() {
  const navigate = useNavigate();
  const overview = useQuery({ queryKey: ['overview'], queryFn: async () => {
    const raw = await api<Overview>('/overview');
    return { ...raw, recent_analyses: raw.recent_analyses.map((row) => ({ ...row, status: normalizeStatus(row.status) } as RecentAnalysis)) };
  } });
  if (overview.isLoading) return <><PageHeader title="Overview" description="A live view of your projects and analyses." /><LoadingState label="Loading workspace overview" /></>;
  if (overview.error) return <><PageHeader title="Overview" description="A live view of your projects and analyses." /><ErrorState message={overview.error instanceof Error ? overview.error.message : 'Could not load the workspace overview.'} onRetry={() => void overview.refetch()} /></>;
  const data = overview.data!;
  const stats = [
    ['Total Projects', data.total_projects, data.deltas?.projects],
    ['Analyses Completed', data.analyses_completed, data.deltas?.analyses],
    ['Requirements Extracted', data.requirements_extracted, data.deltas?.requirements],
    ['High-Severity Risks', data.high_severity_risks, data.deltas?.risks],
  ] as const;
  return <>
    <PageHeader title="Overview" description="A live view of your projects and analyses." />
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{stats.map(([label, value, delta]) => <StatCard key={label} label={label} value={value} delta={delta} />)}</div>
    <div className="mt-6 overview-layout">
      <section><div className="mb-3 flex items-center justify-between"><h2 className="text-base font-semibold">Recent analyses</h2><Link className="text-sm underline underline-offset-4" to="/projects">All projects</Link></div>
        {data.recent_analyses.length === 0 ? <EmptyState title="No analyses yet" description="Upload a customer brief to extract requirements, examine risks, and prepare a proposal for review." action={<Button onClick={() => navigate('/projects/new')}><FilePlus2 size={16} />Start a new analysis</Button>} /> : <div className="table-wrap"><table><caption className="visually-hidden">Recent project analyses from the workspace API</caption><thead><tr><th scope="col">Project</th><th scope="col">Status</th><th scope="col">Requirements</th><th scope="col">Risks</th><th scope="col">Created</th></tr></thead><tbody>{data.recent_analyses.map((row) => <tr key={row.id}><td className="font-medium"><Link className="underline decoration-transparent underline-offset-4 hover:decoration-copy" to={`/analyses/${row.id}`}>{row.name}</Link></td><td><StatusBadge status={row.status} /></td><td>{row.requirements_count}</td><td>{row.risks_count}</td><td>{formatDate(row.created_at)}</td></tr>)}</tbody></table></div>}
      </section>
      <Card className="h-fit p-4"><p className="font-semibold">Start a new analysis</p><p className="mt-2 text-sm text-muted-copy">Bring a PDF, DOCX, TXT, or pasted requirements brief into the workspace.</p><Button className="mt-4 w-full" onClick={() => navigate('/projects/new')}><FilePlus2 size={16} />New analysis</Button></Card>
    </div>
    <p className="mt-4 text-xs text-muted-copy">Values shown are returned by the workspace API. Comparison deltas are omitted when an earlier comparison period is unavailable.</p>
  </>;
}
