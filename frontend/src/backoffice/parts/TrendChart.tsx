import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Card } from '@/components/ui/kit';

/** Small daily trend (one or two series) in the theme's chart colours. */
export function TrendChart<T extends { day: string }>({ title, data, series }: {
  title: string; data: T[]; series: { key: string; label: string }[];
}) {
  return (
    <Card className="min-w-0">
      <div className="mb-2 text-sm font-medium">{title}</div>
      <div className="h-48">
        <ResponsiveContainer>
          <AreaChart data={data} margin={{ left: -16, right: 8, top: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis dataKey="day" tickFormatter={(d: string) => d.slice(5)} fontSize={11} stroke="var(--muted-foreground)" />
            <YAxis fontSize={11} stroke="var(--muted-foreground)" allowDecimals={false} />
            <Tooltip contentStyle={{ background: 'var(--popover)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
            {series.map((s, i) => (
              <Area key={s.key} dataKey={s.key as string} name={s.label} type="monotone" strokeWidth={2}
                stroke={`var(--chart-${i + 1})`} fill={`var(--chart-${i + 1})`} fillOpacity={0.15} />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
