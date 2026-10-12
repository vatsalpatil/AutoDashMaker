import { ChartView } from '@/features/charts/render/ChartView';
import { DataGrid } from '@/components/common/DataGrid';
import { DataTable } from '@/components/common/DataTable';
import { Loading } from '@/components/common/Loading';
import { useCallback, useEffect, useMemo } from 'react';
import { ContentBody, isContent } from './ContentCards';
import type { Widget } from '@/lib/types';
import { useDashboardFilters } from './dashboardFilters';
import { useWidgetData } from './useWidgetData';

interface WidgetContentProps {
  widget: Widget;
  height?: number;
}

export function WidgetBody({
  widget,
  height,
  view = 'chart',
  fit = true,
  print = false,
}: WidgetContentProps & { view?: 'chart' | 'table'; fit?: boolean; print?: boolean }) {
  const { chart, data: raw, error } = useWidgetData(isContent(widget) ? null : widget.chart_id);
  const filters = useDashboardFilters();
  const crossFilter = useCallback((field: string, value: string) => filters?.pick(field, value), [filters]);
  useEffect(() => { if (raw) filters?.register(widget.chart_id, raw); }, [raw, filters, widget.chart_id]);
  const data = useMemo(() => (raw && filters ? filters.apply(raw) : raw), [raw, filters]);
  const s = widget.settings ?? {};
  if (isContent(widget)) return <ContentBody widget={widget} />;
  if (error) return <p className="text-xs text-destructive">{error}</p>;
  if (!chart || !data) return <Loading compact />;
  if (view === 'table')
    return print ? (
      <DataTable columns={data.columns} rows={data.rows} maxRows={60} fontSize={(s.tableFontSize as 'xs' | 'sm' | 'md') ?? 'sm'}
        density={(s.tableDensity as 'compact' | 'comfortable') ?? 'compact'} striped={s.tableStriped === true} />
    ) : (
      <DataGrid columns={data.columns} rows={data.rows as Record<string, unknown>[]} bare expandable maxHeight={`${Math.max(height ?? 300, 160)}px`} />
    );
  // fit: exactly the measured container height; scroll: natural grid height
  const natural = Math.max(widget.position.h * 80 - 60, 160);
  const h = fit && height ? Math.max(height, 120) : natural;
  return <ChartView spec={chart.spec} result={data} height={h} options={print ? { ...s, animate: false } : s} plain={print} onPick={filters && s.crossFilter !== false ? crossFilter : undefined} />;
}
