import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '../../lib/utils';

type BadgeProps = HTMLAttributes<HTMLSpanElement> & { dark?: boolean; muted?: boolean };
export function Badge({ className, dark = false, muted = false, ...props }: BadgeProps) {
  return <span className={cn('badge', dark && 'badge-dark', muted && 'badge-muted', className)} {...props} />;
}
export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const normalized = status.toLowerCase();
  const complete = normalized === 'complete' || normalized === 'completed';
  const label = normalized === 'completed' ? 'Complete' : status.slice(0, 1).toUpperCase() + status.slice(1);
  return <Badge dark={complete} muted={!complete} className={className}>{label}</Badge>;
}
export function SeverityBadge({ severity, className }: { severity: string; className?: string }) {
  const normalized = severity.toLowerCase();
  const safe = ['low', 'medium', 'high', 'critical'].includes(normalized) ? normalized : 'low';
  const label = safe.slice(0, 1).toUpperCase() + safe.slice(1);
  return <Badge className={cn(`severity-${safe}`, className)}>{label}</Badge>;
}
export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) { return <div className={cn('card', className)} {...props} />; }
export function EmptyState({ title, description, action, className }: { title: string; description: string; action?: ReactNode; className?: string }) {
  return <section className={cn('card flex flex-col items-center justify-center gap-3 p-8 text-center', className)}><div aria-hidden="true" className="empty-state-icon grid place-items-center rounded-control border border-line"><span className="h-3 w-3 rotate-45 border border-action" /></div><h2 className="text-xl font-semibold text-emphasis">{title}</h2><p className="max-w-prose text-sm text-muted-copy">{description}</p>{action}</section>;
}
