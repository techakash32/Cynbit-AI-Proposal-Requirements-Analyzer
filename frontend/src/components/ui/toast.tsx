import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Check, CircleAlert, X } from 'lucide-react';
import { Button } from './button';

type ToastEntry = { id: number; message: string; kind: 'success' | 'error' | 'info' };
type ToastContextValue = { toast: (message: string, kind?: ToastEntry['kind']) => void };
const ToastContext = createContext<ToastContextValue | null>(null);
let idCounter = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastEntry[]>([]);
  const dismiss = useCallback((id: number) => setItems((old) => old.filter((item) => item.id !== id)), []);
  const toast = useCallback((message: string, kind: ToastEntry['kind'] = 'success') => {
    const id = ++idCounter; setItems((old) => [...old, { id, message, kind }]);
  }, []);
  const value = useMemo(() => ({ toast }), [toast]);
  return <ToastContext.Provider value={value}>{children}<div className="toast-region" aria-live="polite">{items.map((item) => <ToastItem key={item.id} item={item} onDismiss={dismiss} />)}</div></ToastContext.Provider>;
}
function ToastItem({ item, onDismiss }: { item: ToastEntry; onDismiss: (id: number) => void }) {
  const [paused, setPaused] = useState(false);
  useEffect(() => { if (paused) return; const timer = window.setTimeout(() => onDismiss(item.id), 4000); return () => window.clearTimeout(timer); }, [paused, item.id, onDismiss]);
  return <div className="toast-enter flex items-center gap-3 rounded-control border border-line bg-paper p-3" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} role="status">
    {item.kind === 'success' ? <Check aria-hidden="true" size={16} /> : <CircleAlert aria-hidden="true" size={16} />}
    <span className="min-w-0 flex-1 text-sm">{item.message}</span>
    <Button type="button" variant="ghost" size="icon" aria-label="Dismiss notification" onClick={() => onDismiss(item.id)}><X size={16} /></Button>
  </div>;
}
export function useToast(): ToastContextValue { const value = useContext(ToastContext); if (!value) throw new Error('useToast must be used inside ToastProvider'); return value; }
