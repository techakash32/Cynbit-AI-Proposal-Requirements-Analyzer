import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { FolderPlus, Search, Trash2 } from 'lucide-react';
import { z } from 'zod';
import { api } from '../../lib/api';
import { normalizeProject } from '../../lib/normalize';
import { formatDate } from '../../lib/utils';
import { useUIStore } from '../../stores/ui';
import type { Project } from '../../types/api';
import { Button } from '../../components/ui/button';
import { Input, Label } from '../../components/ui/fields';
import { EmptyState, StatusBadge } from '../../components/ui/surfaces';
import { Dialog, DialogContent, DialogDescription, DialogTitle, Select, SelectContent, SelectItem, SelectTrigger } from '../../components/ui/radix';
import { useToast } from '../../components/ui/toast';
import { ErrorState, LoadingState, PageHeader } from '../../components/shared/workbench';

const nameSchema = z.string().trim().min(2, 'Use at least 2 characters.').max(120, 'Use 120 characters or fewer.');
const emptyProject: Project = { id: '', name: '', status: 'Draft', requirements_count: 0, risks_count: 0, created_at: '', updated_at: '' };

export default function ProjectsPage() {
  const search = useUIStore((state) => state.projectSearch);
  const setSearch = useUIStore((state) => state.setProjectSearch);
  const status = useUIStore((state) => state.projectStatus);
  const setStatus = useUIStore((state) => state.setProjectStatus);
  const [renaming, setRenaming] = useState<Project | null>(null);
  const [deleting, setDeleting] = useState<Project | null>(null);
  const [newName, setNewName] = useState('');
  const [formError, setFormError] = useState('');
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { toast } = useToast();
  const projects = useQuery({ queryKey: ['projects'], queryFn: async () => (await api<unknown[]>('/projects')).map(normalizeProject) });
  const filtered = useMemo(() => (projects.data ?? []).filter((p) => p.name.toLowerCase().includes(search.toLowerCase()) && (status === 'all' || p.status.toLowerCase() === status)), [projects.data, search, status]);
  const create = useMutation({ mutationFn: async (name: string) => normalizeProject(await api<unknown>('/projects', { method: 'POST', body: JSON.stringify({ name }) })), onSuccess: async (project) => { await queryClient.invalidateQueries({ queryKey: ['projects'] }); toast('Project created.'); navigate(`/projects/${project.id}/analyze`); }, onError: (error) => toast(error instanceof Error ? error.message : 'Could not create project.', 'error') });
  const rename = useMutation({ mutationFn: async ({ id, name }: { id: string; name: string }) => normalizeProject(await api<unknown>(`/projects/${id}`, { method: 'PATCH', body: JSON.stringify({ name }) })), onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ['projects'] }); setRenaming(null); toast('Project name updated.'); }, onError: (error) => toast(error instanceof Error ? error.message : 'Could not rename project.', 'error') });
  const remove = useMutation({ mutationFn: (id: string) => api(`/projects/${id}`, { method: 'DELETE' }), onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ['projects'] }); setDeleting(null); toast('Project deleted.'); }, onError: (error) => toast(error instanceof Error ? error.message : 'Could not delete project.', 'error') });

  return <>
    <PageHeader title="My Projects" description="Projects and analyses saved to your workspace." actions={<Button onClick={() => { setNewName(''); setFormError(''); setRenaming(emptyProject); }}><FolderPlus size={16} />New project</Button>} />
    <div className="mb-4 flex flex-col gap-3 sm:flex-row"><div className="relative min-w-48 flex-1"><Search className="absolute left-3 top-3 text-muted-copy" size={16} /><Input className="pl-8" placeholder="Search by project name" aria-label="Search projects" value={search} onChange={(event) => setSearch(event.target.value)} /></div><Select value={status} onValueChange={setStatus}><SelectTrigger aria-label="Filter by status" className="sm:w-48" /><SelectContent><SelectItem value="all">All statuses</SelectItem>{['Draft', 'Analyzing', 'Complete', 'Failed'].map((value) => <SelectItem value={value.toLowerCase()} key={value}>{value}</SelectItem>)}</SelectContent></Select></div>
    {projects.isLoading ? <LoadingState label="Loading projects" /> : projects.error ? <ErrorState message={projects.error instanceof Error ? projects.error.message : 'Could not load projects.'} onRetry={() => void projects.refetch()} /> : !filtered.length ? <EmptyState title={search || status !== 'all' ? 'No matching projects' : 'No projects yet'} description={search || status !== 'all' ? 'Try adjusting your search or status filter.' : 'Create a project to upload a customer brief and start an analysis.'} action={!search && status === 'all' ? <Button onClick={() => navigate('/projects/new')}>Start a new analysis</Button> : undefined} /> : <div className="table-wrap"><table><caption className="visually-hidden">Saved projects and latest analysis summary</caption><thead><tr><th scope="col">Name</th><th scope="col">Status</th><th scope="col">Requirements</th><th scope="col">Risks</th><th scope="col">Created</th><th scope="col">Updated</th><th scope="col">Actions</th></tr></thead><tbody>{filtered.map((project) => <tr key={project.id}><td><Link className="font-medium underline decoration-transparent underline-offset-4 hover:decoration-copy" to={`/projects/${project.id}/analyze`}>{project.name}</Link></td><td><StatusBadge status={project.status} /></td><td>{project.requirements_count}</td><td>{project.risks_count}</td><td>{formatDate(project.created_at)}</td><td>{formatDate(project.updated_at)}</td><td><div className="flex gap-1"><Button size="sm" variant="ghost" onClick={() => navigate(`/projects/${project.id}/analyze`)}>Open</Button><Button size="sm" variant="ghost" onClick={() => { setRenaming(project); setNewName(project.name); setFormError(''); }}>Rename</Button><Button size="sm" variant="ghost" aria-label={`Delete ${project.name}`} onClick={() => setDeleting(project)}><Trash2 size={14} /></Button></div></td></tr>)}</tbody></table></div>}
    <Dialog open={Boolean(renaming)} onOpenChange={(open) => { if (!open) { setRenaming(null); setFormError(''); } }}><DialogContent><DialogTitle>{renaming?.id ? 'Rename project' : 'New project'}</DialogTitle><DialogDescription>{renaming?.id ? 'Update the project name.' : 'Give this project a name before uploading requirements.'}</DialogDescription><form className="mt-4 space-y-3" onSubmit={(event) => { event.preventDefault(); const parsed = nameSchema.safeParse(newName); if (!parsed.success) { setFormError(parsed.error.issues[0]?.message ?? 'Enter a valid project name.'); return; } setFormError(''); if (renaming?.id) rename.mutate({ id: renaming.id, name: parsed.data }); else create.mutate(parsed.data); }}><Label htmlFor="project-name">Project name</Label><Input id="project-name" autoFocus value={newName} onChange={(event) => setNewName(event.target.value)} aria-invalid={Boolean(formError)} />{formError && <p className="text-xs text-error" role="alert">{formError}</p>}<div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setRenaming(null)}>Cancel</Button><Button type="submit" disabled={create.isPending || rename.isPending}>{create.isPending || rename.isPending ? 'Saving…' : 'Save'}</Button></div></form></DialogContent></Dialog>
    <Dialog open={Boolean(deleting)} onOpenChange={(open) => !open && setDeleting(null)}><DialogContent><DialogTitle>Delete project?</DialogTitle><DialogDescription>This permanently deletes “{deleting?.name}” and its related analyses. This action cannot be undone.</DialogDescription><div className="mt-6 flex justify-end gap-2"><Button variant="outline" onClick={() => setDeleting(null)}>Cancel</Button><Button variant="danger" disabled={remove.isPending} onClick={() => deleting && remove.mutate(deleting.id)}>{remove.isPending ? 'Deleting…' : 'Delete project'}</Button></div></DialogContent></Dialog>
  </>;
}
