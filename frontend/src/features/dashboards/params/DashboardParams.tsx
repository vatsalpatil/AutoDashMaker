import { createContext, useContext, useMemo, useState } from 'react';
import { useApi } from '@/hooks/useApi';

/** One control generated from a `{{name|default}}` placeholder in the dashboard's SQL. */
export interface ParamControl { name: string; label: string; default: string; kind: 'choice' | 'number' | 'text'; options?: string[] }

/** The values every widget below runs its query with ('' key = all defaults, so caches stay shared). */
export const DashboardParamsContext = createContext<{ values: Record<string, string>; key: string }>({ values: {}, key: '' });
export const useDashboardParams = () => useContext(DashboardParamsContext);

/** Controls + current values for one dashboard. Only values that differ from the defaults are sent. */
export function useDashboardParamState(dashboardId: string) {
  const controls = useApi<ParamControl[]>(`/dashboards/${dashboardId}/params`).data ?? [];
  const [values, setValues] = useState<Record<string, string>>({});
  const changed = useMemo(() => Object.fromEntries(Object.entries(values).filter(([k, v]) => controls.find((c) => c.name === k)?.default !== v && v !== '')), [values, controls]);
  const key = Object.keys(changed).length ? JSON.stringify(Object.entries(changed).sort()) : '';
  return { controls, values, set: (name: string, v: string) => setValues((s) => ({ ...s, [name]: v })), reset: () => setValues({}), ctx: { values: changed, key } };
}
