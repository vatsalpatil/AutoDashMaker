import { ChartView } from '@/features/charts/render/ChartView';
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
}: WidgetContentProps & { view?: 'chart' | 'table'; fit?: boolean }) {
  const { chart, data: raw, error } = useWidgetData(isContent(widget) ? null : widget.chart_id);
  const filters = useDashboardFilters();
  const crossFilter = useCallback((field: string, value: string) => filters?.pick(field, value), [filters]);
  useEffect(() => { if (raw) filters?.register(widget.chart_id, raw); }, [raw, filters, widget.chart_id]);
  const data = useMemo(() => (raw && filters ? filters.apply(raw) : raw), [raw, filters]);
  const s = widget.settings ?? {};
  if (isContent(widget)) return <ContentBody widget={widget} />;
  if (error) return <p className="text-xs text-destructive">{error}</p>;
  if (!chart || !data) return <Loading />;
  if (view === 'table')
    return (
      <DataTable
        columns={data.columns}
        rows={data.rows}
        fontSize={(s.tableFontSize as 'xs' | 'sm' | 'md') ?? 'sm'}
        density={(s.tableDensity as 'compact' | 'comfortable') ?? 'compact'}
        striped={s.tableStriped === true}
      />
    );
  // fit: exactly the measured container height; scroll: natural grid height
  const natural = Math.max(widget.position.h * 80 - 60, 160);
  const h = fit && height ? Math.max(height, 120) : natural;
  return <ChartView spec={chart.spec} result={data} height={h} options={s} onPick={filters && s.crossFilter !== false ? crossFilter : undefined} />;
}
