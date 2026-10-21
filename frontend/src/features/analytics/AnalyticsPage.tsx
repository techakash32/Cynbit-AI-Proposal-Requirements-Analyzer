import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { CartesianGrid, Line, LineChart, Bar, BarChart, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { api } from '../../lib/api';
import type { Analytics } from '../../types/api';
import { Button } from '../../components/ui/button';
import { Card, EmptyState } from '../../components/ui/surfaces';
import { ErrorState, LoadingState, PageHeader } from '../../components/shared/workbench';

const shades = ['var(--color-primary)', 'var(--color-chart-gray-2)', 'var(--color-chart-gray-3)', 'var(--color-chart-gray-4)'];
export default function AnalyticsPage() {
  const [tableMode, setTableMode] = useState(false);
  const navigate = useNavigate();
  const query = useQuery({ queryKey: ['analytics'], queryFn: () => api<Analytics>('/analytics') });
  const severityStack = useMemo(() => [Object.fromEntries((query.data?.risk_severity ?? []).map((row) => [row.severity, row.count]))], [query.data?.risk_severity]);
  if (query.isLoading) return <><PageHeader title="Analytics" description="Aggregates from your saved projects and completed analyses." /><LoadingState label="Loading analytics" /></>;
  if (query.error) return <><PageHeader title="Analytics" description="Aggregates from your saved projects and completed analyses." /><ErrorState message={query.error instanceof Error ? query.error.message : 'Could not load analytics.'} onRetry={() => void query.refetch()} /></>;
  const data = query.data!;
  const hasAny = data.analyses_over_time.length + data.requirements_by_category.length + data.risk_severity.length > 0;
  return <>
    <PageHeader title="Analytics" description="Aggregates from your saved projects and completed analyses." actions={<Button variant="outline" onClick={() => setTableMode((old) => !old)}>{tableMode ? 'Show charts' : 'Show data tables'}</Button>} />
    {!hasAny ? <EmptyState title="No analytics yet" description="Charts will appear after analyses have been completed in your workspace." action={<Button onClick={() => navigate('/projects/new')}>Start an analysis</Button>} /> : <div className="grid gap-4 xl:grid-cols-2">
      <ChartCard title="Analyses over time" summary={data.analyses_over_time.length ? `The workspace recorded ${data.analyses_over_time.reduce((sum, item) => sum + item.count, 0)} analyses across ${data.analyses_over_time.length} time periods.` : 'No analysis timeline data was returned.'} tableMode={tableMode} table={<DataTable rows={data.analyses_over_time.map((row) => [row.date, row.count])} headers={['Date', 'Analyses']} />}>
        <div role="img" aria-label="Line chart of analyses over time" className="chart-box"><ResponsiveContainer width="100%" height="100%"><LineChart data={data.analyses_over_time} margin={{ top: 8, right: 12, bottom: 8, left: 0 }}><CartesianGrid stroke="var(--color-border)" vertical={false} /><XAxis dataKey="date" tick={{ fill: 'var(--color-text-muted)', fontSize: 12 }} /><YAxis allowDecimals={false} tick={{ fill: 'var(--color-text-muted)', fontSize: 12 }} /><Tooltip contentStyle={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-control)', fontFamily: 'var(--font-fira-code)', fontSize: 'var(--font-size-xs)' }} /><Line type="monotone" dataKey="count" stroke="var(--color-primary)" strokeWidth={2} dot={{ fill: 'var(--color-primary)' }} /></LineChart></ResponsiveContainer></div>
      </ChartCard>
      <ChartCard title="Requirements by category" summary={data.requirements_by_category.length ? `${data.requirements_by_category.length} requirement categories are represented.` : 'No category data was returned.'} tableMode={tableMode} table={<DataTable rows={data.requirements_by_category.map((row) => [row.category, row.count])} headers={['Category', 'Requirements']} />}>
        <div role="img" aria-label="Bar chart of extracted requirements by category" className="chart-box"><ResponsiveContainer width="100%" height="100%"><BarChart data={data.requirements_by_category} layout="vertical" margin={{ top: 8, right: 16, bottom: 8, left: 8 }}><CartesianGrid stroke="var(--color-border)" horizontal={false} /><XAxis type="number" allowDecimals={false} tick={{ fill: 'var(--color-text-muted)', fontSize: 12 }} /><YAxis type="category" dataKey="category" width={110} tick={{ fill: 'var(--color-text-muted)', fontSize: 12 }} /><Tooltip contentStyle={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-control)', fontFamily: 'var(--font-fira-code)', fontSize: 'var(--font-size-xs)' }} /><Bar dataKey="count" fill="var(--color-primary)" radius={[0, 2, 2, 0]} /></BarChart></ResponsiveContainer></div>
      </ChartCard>
      <ChartCard title="Risk severity distribution" summary={data.risk_severity.length ? data.risk_severity.map((row) => `${row.severity}: ${row.count}`).join('; ') : 'No risk severity data was returned.'} tableMode={tableMode} table={<DataTable rows={data.risk_severity.map((row) => [row.severity, row.count])} headers={['Severity', 'Risks']} />}>
        <div role="img" aria-label="Stacked bar chart of risks by severity" className="chart-box"><ResponsiveContainer width="100%" height="100%"><BarChart data={severityStack} margin={{ top: 24, right: 16, bottom: 24, left: 16 }}><XAxis hide /><YAxis hide /><Tooltip contentStyle={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-control)', fontFamily: 'var(--font-fira-code)', fontSize: 'var(--font-size-xs)' }} /><Legend />{data.risk_severity.map((row, index) => <Bar key={row.severity} dataKey={row.severity} stackId="risk-severity" fill={shades[index % shades.length]} />)}</BarChart></ResponsiveContainer></div>
      </ChartCard>
    </div>}
  </>;
}
function ChartCard({ title, summary, tableMode, table, children }: { title: string; summary: string; tableMode: boolean; table: React.ReactNode; children: React.ReactNode }) {
  return <Card className="min-w-0 p-4"><figure><figcaption className="text-sm font-medium text-muted-copy">{title}<span className="mt-1 block text-xs font-normal">{summary}</span></figcaption>{tableMode ? table : children}</figure></Card>;
}
function DataTable({ rows, headers }: { rows: Array<Array<string | number>>; headers: string[] }) {
  if (!rows.length) return <p className="mt-4 text-sm text-muted-copy">No data available for this chart.</p>;
  return <div className="mt-3 table-wrap"><table><caption className="visually-hidden">Chart data in tabular form</caption><thead><tr>{headers.map((header) => <th scope="col" key={header}>{header}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={index}>{row.map((cell, cellIndex) => <td key={cellIndex} className={typeof cell === 'number' ? 'font-mono text-xs' : ''}>{cell}</td>)}</tr>)}</tbody></table></div>;
}
