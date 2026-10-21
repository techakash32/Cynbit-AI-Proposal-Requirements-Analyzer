import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { FileText } from 'lucide-react';
import { api } from '../../lib/api';
import type { Proposal } from '../../types/api';
import { EmptyState } from '../../components/ui/surfaces';
import { ErrorState, LoadingState, PageHeader } from '../../components/shared/workbench';

export default function ProposalLibraryPage() {
  const query = useQuery({ queryKey: ['proposals'], queryFn: () => api<Proposal[]>('/proposals') });
  if (query.isLoading) return <><PageHeader title="Proposal Library" description="Saved proposal drafts from completed analyses." /><LoadingState label="Loading proposals" /></>;
  if (query.error) return <><PageHeader title="Proposal Library" /><ErrorState message={query.error instanceof Error ? query.error.message : 'Could not load proposals.'} onRetry={() => void query.refetch()} /></>;
  if (!query.data?.length) return <><PageHeader title="Proposal Library" description="Saved proposal drafts from completed analyses." /><EmptyState title="No proposals yet" description="Complete an analysis to create its editable proposal draft." action={<Link className="btn btn-primary" to="/projects/new"><FileText size={16} />Start an analysis</Link>} /></>;
  return <><PageHeader title="Proposal Library" description="Saved proposal drafts from completed analyses." /><div className="table-wrap"><table><caption className="visually-hidden">Proposal drafts</caption><thead><tr><th scope="col">Proposal</th><th scope="col">Sections</th><th scope="col">Updated</th><th scope="col">Action</th></tr></thead><tbody>{query.data.map((proposal) => <tr key={proposal.id}><td className="font-medium">Proposal · {proposal.analysis_id.slice(0, 8)}</td><td>{proposal.sections.length}</td><td>{proposal.updated_at ? new Date(proposal.updated_at).toLocaleDateString() : '—'}</td><td><Link className="text-sm underline underline-offset-4" to={`/proposals/${proposal.id}`}>Open editor</Link></td></tr>)}</tbody></table></div></>;
}
