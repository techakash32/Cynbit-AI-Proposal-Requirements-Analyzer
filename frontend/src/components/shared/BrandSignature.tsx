export function BrandSignature({ inverse = false }: { inverse?: boolean }) {
  return <span className="brand-lockup"><span className={`brand-mark${inverse ? ' brand-mark-inverse' : ''}`} aria-hidden="true" /><span className="brand-name">Cynbit Analyzer</span></span>;
}
