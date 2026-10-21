import { useEffect, useState } from 'react';
import DOMPurify from 'dompurify';
import { Card } from '../../components/ui/surfaces';

let mermaidModulePromise: Promise<typeof import('mermaid')> | undefined;
let initialized = false;
export default function MermaidDiagram({ source }: { source?: string | null }) {
  const [svg, setSvg] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    let active = true;
    if (!source?.trim()) { setSvg(''); setError('No diagram source was provided by the analysis.'); setLoading(false); return () => { active = false; }; }
    setSvg('');
    setError('');
    setLoading(true);
    async function render() {
      try {
        const module = await (mermaidModulePromise ??= import('mermaid'));
        const mermaid = module.default;
        if (!initialized) { mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme: 'neutral', themeVariables: { fontFamily: 'Geist, sans-serif' } }); initialized = true; }
        const { svg: rendered } = await mermaid.render(`architecture-${crypto.randomUUID()}`, source as string);
        const safe = DOMPurify.sanitize(rendered, { USE_PROFILES: { svg: true, svgFilters: true } });
        if (active) { setSvg(safe); setError(''); setLoading(false); }
      } catch {
        if (active) { setSvg(''); setError('The analysis returned a diagram that could not be rendered safely.'); setLoading(false); }
      }
    }
    void render();
    return () => { active = false; };
  }, [source]);
  if (loading) return <Card className="mt-3 p-4 text-sm text-muted-copy" aria-live="polite">Loading architecture diagram…</Card>;
  if (error) return <Card className="mt-3 p-4 text-sm text-muted-copy">{error}{source && <details className="mt-3"><summary className="cursor-pointer font-medium">View Mermaid source</summary><pre className="mt-2 overflow-x-auto whitespace-pre-wrap font-mono text-xs">{source}</pre></details>}</Card>;
  return <div className="mt-3 max-w-full overflow-x-auto rounded-control border border-line p-3" role="img" aria-label="Mermaid architecture diagram" dangerouslySetInnerHTML={{ __html: svg }} />;
}
