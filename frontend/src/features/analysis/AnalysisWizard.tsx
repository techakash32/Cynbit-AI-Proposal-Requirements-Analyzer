import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { z } from 'zod';
import { FileText, Upload, X } from 'lucide-react';
import { api } from '../../lib/api';
import { normalizeProject } from '../../lib/normalize';
import { formatBytes } from '../../lib/utils';
import { Button } from '../../components/ui/button';
import { Input, Label, Textarea } from '../../components/ui/fields';
import { Card } from '../../components/ui/surfaces';
import { Switch } from '../../components/ui/radix';
import { useToast } from '../../components/ui/toast';
import { AnalysisProgress, ErrorState, LoadingState, PageHeader } from '../../components/shared/workbench';

type AnalysisStart = { id: string; status: string; ocr_used?: boolean };
type StatusResponse = { id: string; status: string; stage?: string; error?: string | null; progress_percent?: number };
const nameSchema = z.string().trim().min(2, 'Add a project name.').max(120, 'Project names must be 120 characters or fewer.');
const allowedTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'];
const statusStages = ['Extraction', 'Gap Analysis', 'Risk Assessment', 'Proposal Draft'];
const stageOrder: Record<string, number> = { queued: 0, requirements: 0, extraction: 0, gaps_questions: 1, 'gap analysis': 1, risks: 2, 'risk assessment': 2, services_architecture: 2, proposal_outline: 3, 'proposal draft': 3, complete: 4 };

export default function AnalysisWizard() {
  const { id: routeProjectId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState(1);
  const [activeTab, setActiveTab] = useState<'upload' | 'paste'>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState('');
  const [name, setName] = useState('');
  const [formError, setFormError] = useState('');
  const [dragging, setDragging] = useState(false);
  const [includeArchitecture, setIncludeArchitecture] = useState(true);
  const [includeCost, setIncludeCost] = useState(true);
  const [includeQuestions, setIncludeQuestions] = useState(true);
  const [analysisId, setAnalysisId] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState('');
  const { toast } = useToast();
  const status = useQuery({ queryKey: ['analysis-status', analysisId], queryFn: () => api<StatusResponse>(`/analyses/${analysisId}/status`), enabled: Boolean(analysisId), refetchInterval: (query) => ['completed', 'failed'].includes(query.state.data?.status.toLowerCase() ?? '') ? false : 2000, retry: 1 });
  const project = useQuery({ queryKey: ['project', routeProjectId], queryFn: async () => normalizeProject(await api<unknown>(`/projects/${routeProjectId}`)), enabled: Boolean(routeProjectId) });

  useEffect(() => { if (status.data?.status.toLowerCase() === 'completed') navigate(`/analyses/${analysisId}`, { replace: true }); }, [analysisId, navigate, status.data?.status]);
  function chooseFile(candidate?: File) {
    if (!candidate) return;
    const valid = allowedTypes.includes(candidate.type) || /\.(pdf|docx|txt)$/i.test(candidate.name);
    if (!valid) { setFormError('Choose a PDF, DOCX, or TXT file.'); return; }
    if (candidate.size > 15 * 1024 * 1024) { setFormError('Choose a file smaller than 15 MB.'); return; }
    setFormError(''); setFile(candidate); setText('');
  }
  async function submit() {
    if (!file && text.trim().length < 20) { setFormError('Upload a file or paste at least 20 characters of requirements.'); return; }
    let projectId = routeProjectId;
    if (!projectId) {
      const validName = nameSchema.safeParse(name);
      if (!validName.success) { setFormError(validName.error.issues[0]?.message ?? 'Add a project name.'); setStep(1); return; }
      try {
        const created = normalizeProject(await api<unknown>('/projects', { method: 'POST', body: JSON.stringify({ name: validName.data }) }));
        projectId = created.id;
        await queryClient.invalidateQueries({ queryKey: ['projects'] });
      } catch (error) { setStartError(error instanceof Error ? error.message : 'Could not create project.'); return; }
    }
    if (!projectId) return;
    setStarting(true); setStartError(''); setFormError('');
    const settings = { architecture: includeArchitecture, cost_estimate: includeCost, clarification_questions: includeQuestions };
    try {
      let result: AnalysisStart;
      if (file) {
        const body = new FormData(); body.append('file', file); body.append('settings', JSON.stringify(settings));
        result = await api<AnalysisStart>(`/projects/${projectId}/analyze`, { method: 'POST', body });
      } else {
        result = await api<AnalysisStart>(`/projects/${projectId}/analyze`, { method: 'POST', body: JSON.stringify({ source_text: text, filename: 'pasted-requirements.txt', content_type: 'text/plain', ...settings }) });
      }
      setAnalysisId(result.id);
      toast(result.ocr_used ? 'Analysis started. OCR was attempted on a low-text PDF page; review extracted claims against the source.' : 'Analysis started. You can leave this page and return to the project.', 'info');
    } catch (error) { setStartError(error instanceof Error ? error.message : 'Could not start the analysis.'); }
    finally { setStarting(false); }
  }
  const activeIndex = Math.max(0, Math.min(3, stageOrder[(status.data?.stage ?? 'queued').toLowerCase()] ?? 0));
  const activeStage = statusStages[activeIndex];
  const terminalComplete = status.data?.status.toLowerCase() === 'completed';
  const stageList = statusStages.map((label, index) => ({ name: label, complete: terminalComplete || index < activeIndex }));

  if (analysisId) return <><PageHeader title="Analysis in progress" description="Analysis runs in the background. You can navigate away and return to this project." />{status.error ? <ErrorState message={status.error instanceof Error ? status.error.message : 'Could not refresh analysis status.'} onRetry={() => void status.refetch()} /> : status.isLoading ? <LoadingState label="Connecting to analysis status" /> : status.data?.status.toLowerCase() === 'failed' ? <div className="max-w-2xl space-y-3"><ErrorState message={status.data.error ?? 'The analysis could not be completed.'} /><Link to={routeProjectId ? `/projects/${routeProjectId}/analyze` : '/projects'} className="btn btn-outline">Return to project</Link></div> : <div className="max-w-2xl space-y-4"><AnalysisProgress stages={stageList} active={activeStage} /><Card className="p-4 text-sm text-muted-copy">Current stage: <span className="font-medium text-copy">{activeStage}</span>. Status is checked every two seconds.</Card></div>}</>;

  return <>
    <PageHeader title="New Analysis" description="Start from a customer brief and keep the evidence available for review." />
    <ol className="mb-6 grid grid-cols-3 gap-2" aria-label="Analysis setup steps">{['Input', 'Configure', 'Review'].map((label, index) => <li key={label} className="flex items-center gap-2"><span className={`grid h-8 w-8 place-items-center rounded-pill border text-sm ${step >= index + 1 ? 'border-action bg-action text-paper' : 'border-line text-muted-copy'}`}>{index + 1}</span><span className={`text-sm ${step === index + 1 ? 'font-semibold' : 'text-muted-copy'}`}>{label}</span>{index < 2 && <span className="hidden h-px flex-1 bg-line sm:block" />}</li>)}</ol>
    {step === 1 && <div className="max-w-3xl space-y-4">
      {!routeProjectId && <div><Label htmlFor="project-name">Project name</Label><Input id="project-name" className="mt-1" placeholder="e.g. Customer support platform" value={name} onChange={(event) => setName(event.target.value)} aria-invalid={Boolean(formError)} /></div>}
      {routeProjectId && project.data && <Card className="p-3 text-sm"><span className="text-muted-copy">Project:</span> <strong>{project.data.name}</strong></Card>}
      {routeProjectId && project.error && <ErrorState message={project.error instanceof Error ? project.error.message : 'Could not load this project.'} onRetry={() => void project.refetch()} />}
      <div className="flex gap-2 border-b border-line"><button className={`border-b-2 px-3 py-2 text-sm ${activeTab === 'upload' ? 'border-action font-semibold' : 'border-transparent text-muted-copy'}`} onClick={() => setActiveTab('upload')} type="button" aria-pressed={activeTab === 'upload'}>Upload a file</button><button className={`border-b-2 px-3 py-2 text-sm ${activeTab === 'paste' ? 'border-action font-semibold' : 'border-transparent text-muted-copy'}`} onClick={() => setActiveTab('paste')} type="button" aria-pressed={activeTab === 'paste'}>Or paste text</button></div>
      {activeTab === 'upload' ? <div className={`flex min-h-60 flex-col items-center justify-center rounded-card border border-dashed p-6 text-center transition-colors ${dragging ? 'border-action bg-soft' : 'border-line'}`} onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={(event) => { event.preventDefault(); setDragging(false); chooseFile(event.dataTransfer.files[0]); }}>
        {file ? <div className="flex items-center gap-3 rounded-control border border-line p-3 text-left"><FileText size={20} /><div><p className="max-w-xs truncate text-sm font-medium">{file.name}</p><p className="text-xs text-muted-copy">{formatBytes(file.size)}</p></div><Button size="icon" variant="ghost" aria-label="Remove selected file" onClick={() => setFile(null)}><X size={16} /></Button></div> : <><Upload size={24} aria-hidden="true" /><p className="mt-3 font-medium">Drop your requirements document here</p><p className="mt-1 text-sm text-muted-copy">or choose a file from your device</p><Button className="mt-4" variant="outline" type="button" onClick={() => inputRef.current?.click()}>Choose file</Button><input ref={inputRef} type="file" className="visually-hidden" accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain" onChange={(event) => chooseFile(event.target.files?.[0])} /><p className="mt-3 text-xs text-muted-copy">PDF, DOCX, or TXT · up to 15 MB · scanned PDF pages may use OCR</p></>}
      </div> : <div><Label htmlFor="requirements-text">Requirements text</Label><Textarea id="requirements-text" className="mt-1 min-h-60" placeholder="Paste the customer brief or requirements here…" value={text} onChange={(event) => { setText(event.target.value); setFile(null); }} /><p className="mt-1 text-xs text-muted-copy">Pasted source text is treated as untrusted input during analysis.</p></div>}
      {formError && <p className="text-xs text-error" role="alert">{formError}</p>}
      <div className="flex justify-end"><Button disabled={Boolean(project.error)} onClick={() => { if (!file && text.trim().length < 20) { setFormError('Upload a file or paste at least 20 characters of requirements.'); return; } if (!routeProjectId && !nameSchema.safeParse(name).success) { setFormError('Add a project name before continuing.'); return; } setFormError(''); setStep(2); }}>Continue</Button></div>
    </div>}
    {step === 2 && <div className="max-w-2xl"><Card className="divide-y divide-line"><SettingToggle label="Include architecture recommendation" description="Suggest a technology stack and diagram from the supplied brief." checked={includeArchitecture} onCheckedChange={setIncludeArchitecture} /><SettingToggle label="Include cost estimate" description="Create a preliminary range using visible editable assumptions." checked={includeCost} onCheckedChange={setIncludeCost} /><SettingToggle label="Include clarification questions" description="Prepare questions for missing or ambiguous requirements." checked={includeQuestions} onCheckedChange={setIncludeQuestions} /></Card><div className="mt-4 flex justify-between"><Button variant="outline" onClick={() => setStep(1)}>Back</Button><Button onClick={() => setStep(3)}>Continue</Button></div></div>}
    {step === 3 && <div className="max-w-2xl"><Card className="space-y-4 p-4"><div><p className="text-xs font-semibold uppercase tracking-wide text-muted-copy">Project</p><p className="mt-1 font-medium">{project.data?.name ?? name}</p></div><div><p className="text-xs font-semibold uppercase tracking-wide text-muted-copy">Source</p><p className="mt-1 break-all text-sm">{file ? `${file.name} · ${formatBytes(file.size)}` : `${text.trim().length} characters of pasted text`}</p></div><div><p className="text-xs font-semibold uppercase tracking-wide text-muted-copy">Pipeline options</p><ul className="mt-1 space-y-1 text-sm">{[['Architecture recommendation', includeArchitecture], ['Cost estimate', includeCost], ['Clarification questions', includeQuestions]].map(([label, enabled]) => <li key={String(label)}>{enabled ? 'Included' : 'Skipped'} · {label}</li>)}</ul></div><p className="border-t border-line pt-3 text-xs text-muted-copy">Analysis output is a draft. Document claims are grounded only where evidence is available; estimates are preliminary and require human review.</p></Card>
      {startError && <p className="mt-3 text-sm text-error" role="alert">{startError}</p>}
      <div className="mt-4 flex justify-between"><Button variant="outline" onClick={() => setStep(2)}>Back</Button><Button onClick={() => void submit()} disabled={starting}>{starting ? 'Starting analysis…' : 'Run Analysis'}</Button></div></div>}
  </>;
}
function SettingToggle({ label, description, checked, onCheckedChange }: { label: string; description: string; checked: boolean; onCheckedChange: (value: boolean) => void }) { return <div className="flex items-center justify-between gap-4 p-4"><div><p className="text-sm font-medium">{label}</p><p className="mt-1 text-xs text-muted-copy">{description}</p></div><Switch checked={checked} onCheckedChange={onCheckedChange} aria-label={label} /></div>; }
