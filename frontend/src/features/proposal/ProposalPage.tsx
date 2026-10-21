import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { Check, Copy, Download, LoaderCircle, Save } from 'lucide-react';
import { api, download } from '../../lib/api';
import type { Proposal } from '../../types/api';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/surfaces';
import { Dialog, DialogContent, DialogDescription, DialogTitle, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../../components/ui/radix';
import { useToast } from '../../components/ui/toast';
import { ErrorState, LoadingState, PageHeader, SectionEditor } from '../../components/shared/workbench';

type Section = { key: string; heading: string; content: string; metadata: 'ai-draft' | 'edited'; updated_at?: string | null };
type ProposalData = Omit<Proposal, 'sections'> & { sections: Section[] };

export default function ProposalPage() {
  const { id = '' } = useParams();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const proposal = useQuery({ queryKey: ['proposal', id], queryFn: () => api<ProposalData>(`/proposals/${id}`), enabled: Boolean(id) });
  const [sections, setSections] = useState<Section[]>([]);
  const [status, setStatus] = useState<'saved' | 'unsaved' | 'saving' | 'error'>('saved');
  const [regenerate, setRegenerate] = useState<Section | null>(null);
  const [exporting, setExporting] = useState<string | null>(null);
  const lastSaved = useRef('');
  const initialized = useRef(false);
  const sectionsJson = useMemo(() => JSON.stringify(sections), [sections]);
  const isDirty = Boolean(sections.length && sectionsJson !== lastSaved.current);

  useEffect(() => {
    if (proposal.data && !initialized.current) {
      setSections(proposal.data.sections);
      lastSaved.current = JSON.stringify(proposal.data.sections);
      initialized.current = true;
    }
  }, [proposal.data]);

  const persist = useCallback(async (manual = false) => {
    if (!sections.length || sectionsJson === lastSaved.current) return;
    const previous = lastSaved.current;
    const snapshot = sections;
    setStatus('saving');
    try {
      const updated = await api<ProposalData>(`/proposals/${id}`, { method: 'PATCH', body: JSON.stringify({ sections: snapshot }) });
      lastSaved.current = JSON.stringify(updated.sections);
      setSections(updated.sections);
      queryClient.setQueryData(['proposal', id], updated);
      setStatus('saved');
      if (manual) toast('Proposal saved.');
    } catch (error) {
      setStatus('error');
      try { setSections(JSON.parse(previous) as Section[]); } catch { /* previous state is retained */ }
      if (manual) {
        toast(error instanceof Error ? error.message : 'Save failed. Your last saved version was restored.', 'error');
      }
    }
  }, [id, sections, sectionsJson, queryClient, toast]);

  useEffect(() => {
    if (!isDirty || status === 'saving') return;
    setStatus('unsaved');
    const timer = window.setTimeout(() => { void persist(false); }, 10_000);
    return () => window.clearTimeout(timer);
  }, [sectionsJson, isDirty, status, persist]);

  async function exportFile(format: 'markdown' | 'docx' | 'pdf') {
    setExporting(format);
    try { await download(`/proposals/${id}/export?format=${format}`, `proposal.${format === 'markdown' ? 'md' : format}`); }
    catch (error) { toast(error instanceof Error ? error.message : `Could not export ${format.toUpperCase()}.`, 'error'); }
    finally { setExporting(null); }
  }
  async function copyAll() {
    try { await navigator.clipboard.writeText(sections.map((section) => `# ${section.heading}\n\n${section.content}`).join('\n\n')); toast('Proposal copied to clipboard.'); }
    catch { toast('Clipboard access was unavailable.', 'error'); }
  }
  async function confirmRegeneration() {
    if (!regenerate) return;
    try {
      const updated = await api<ProposalData>(`/analyses/${proposal.data?.analysis_id ?? id}/regenerate-section`, { method: 'POST', body: JSON.stringify({ section_key: regenerate.key, confirmed: true }) });
      lastSaved.current = JSON.stringify(updated.sections);
      setSections(updated.sections); setRegenerate(null); setStatus('saved'); toast('Section regenerated.');
    } catch (error) { toast(error instanceof Error ? error.message : 'Could not regenerate this section.', 'error'); }
  }

  if (proposal.isLoading) return <><PageHeader title="Proposal editor" description="Loading the saved draft." /><LoadingState label="Loading proposal" /></>;
  if (proposal.error) return <><PageHeader title="Proposal editor" /><ErrorState message={proposal.error instanceof Error ? proposal.error.message : 'Could not load proposal.'} onRetry={() => void proposal.refetch()} /></>;
  return <>
    <div className="proposal-toolbar sticky z-10 -mx-4 mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-line bg-paper px-4 py-3 sm:-mx-6 sm:px-6">
      <div><h1 className="text-xl font-semibold text-emphasis">Proposal editor</h1><p className="mt-1 flex items-center gap-1 text-xs text-muted-copy" role="status">{status === 'saving' ? <><LoaderCircle className="animate-spin" size={14} />Saving…</> : status === 'saved' ? <><Check size={14} />Saved</> : status === 'error' ? 'Save failed · previous saved version restored' : 'Unsaved changes'}</p></div>
      <div className="flex flex-wrap items-center gap-2"><DropdownMenu><DropdownMenuTrigger asChild><Button variant="outline" disabled={Boolean(exporting)}><Download size={14} />{exporting ? `Generating ${exporting.toUpperCase()}…` : 'Export'}</Button></DropdownMenuTrigger><DropdownMenuContent align="end">{(['markdown','docx','pdf'] as const).map((format) => <DropdownMenuItem key={format} onSelect={() => void exportFile(format)} disabled={Boolean(exporting)}>{exporting === format && <LoaderCircle size={14} className="mr-2 animate-spin" />}{format.toUpperCase()}</DropdownMenuItem>)}</DropdownMenuContent></DropdownMenu><Button variant="outline" onClick={() => void copyAll()}><Copy size={14} />Copy all</Button><Button onClick={() => void persist(true)} disabled={!isDirty || status === 'saving'}><Save size={14} />{status === 'saving' ? 'Saving…' : 'Save'}</Button></div>
    </div>
    <Card className="mb-4 bg-soft p-3 text-sm"><strong>Evidence note.</strong> Proposal text does not carry sentence-level source citations in this prototype. Treat document-specific statements as unverified; no supporting evidence is established unless the matching requirement or risk shows a verbatim snippet and source page. Review every claim before sharing or exporting.</Card>
    <div className="proposal-editor-layout">
      <aside className="proposal-outline"><Card className="p-3"><h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-copy">Sections · {sections.length}</h2><nav aria-label="Proposal sections" className="section-outline-list space-y-1">{sections.map((section, index) => <a key={section.key} href={`#section-${section.key}`} className="flex items-center gap-2 rounded-control px-2 py-2 text-xs hover:bg-soft"><span className="font-mono text-muted-copy">{String(index + 1).padStart(2, '0')}</span><span className="min-w-0 flex-1 truncate">{section.heading}</span>{section.content.trim() ? <Check size={14} aria-label="Complete" /> : null}</a>)}</nav></Card></aside>
      <div className="space-y-3">{sections.map((section) => <div id={`section-${section.key}`} key={section.key} className="proposal-section"><SectionEditor title={section.heading} content={section.content} edited={section.metadata === 'edited'} onChange={(content) => setSections((current) => current.map((item) => item.key === section.key ? { ...item, content, metadata: 'edited' } : item))} onRegenerate={() => setRegenerate(section)} /></div>)}</div>
    </div>
    <Dialog open={Boolean(regenerate)} onOpenChange={(open) => !open && setRegenerate(null)}><DialogContent><DialogTitle>Regenerate section?</DialogTitle><DialogDescription>Regenerating will replace your edits to this section. Continue?</DialogDescription><div className="mt-6 flex justify-end gap-2"><Button variant="outline" onClick={() => setRegenerate(null)}>Cancel</Button><Button onClick={() => void confirmRegeneration()}>Continue</Button></div></DialogContent></Dialog>
  </>;
}
