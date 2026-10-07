import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { Filters } from '@/components/reui/filters/filters';
import { createFilterQuery, flattenFilterConditions, isFilterQueryEmpty, type FilterCondition } from '@/components/reui/filters/filters-query';
import type { FilterField, FilterQuery } from '@/components/reui/filters/filters-types';

/** One filterable attribute of a list item. */
export interface FieldDef<T> {
  id: string;
  label: string;
  type: 'text' | 'select' | 'number';
  get: (item: T) => string | number | null | undefined;
  options?: { value: string; label: string }[];
}

const text = (v: unknown) => String(v ?? '').toLowerCase();

/** Does one item satisfy one condition? Covers the operators ReUI Filters offers for text, select and number fields. */
export function matches(value: string | number | null | undefined, c: FilterCondition): boolean {
  const [a, b] = c.values;
  const s = text(value);
  const n = Number(value);
  let ok: boolean;
  switch (c.operator) {
    case 'contains': ok = s.includes(text(a)); break;
    case 'not_contains': ok = !s.includes(text(a)); break;
    case 'starts_with': ok = s.startsWith(text(a)); break;
    case 'ends_with': ok = s.endsWith(text(a)); break;
    case 'is': case 'eq': ok = s === text(a); break;
    case 'is_not': case 'neq': ok = s !== text(a); break;
    case 'is_any_of': ok = c.values.some((v) => s === text(v)); break;
    case 'is_none_of': ok = !c.values.some((v) => s === text(v)); break;
    case 'gt': ok = n > Number(a); break;
    case 'gte': ok = n >= Number(a); break;
    case 'lt': ok = n < Number(a); break;
    case 'lte': ok = n <= Number(a); break;
    case 'between': ok = n >= Number(a) && n <= Number(b); break;
    case 'not_between': ok = !(n >= Number(a) && n <= Number(b)); break;
    case 'empty': ok = s === ''; break;
    case 'not_empty': ok = s !== ''; break;
    default: ok = true;
  }
  return c.negated ? !ok : ok;
}

/** Rules that say something yet: a rule still waiting for its value must not hide everything. */
export function activeConditions(query: FilterQuery): FilterCondition[] {
  return flattenFilterConditions(query).filter((c) => c.values.length > 0 || c.operator === 'empty' || c.operator === 'not_empty');
}
export const isOr = (query: FilterQuery) => (query as { combinator?: string }).combinator === 'or';

/**
 * ReUI Filters for any list. Declare the filterable fields once; `apply(items)` narrows a list and `bar` is the chip UI.
 *
 *   const f = useFieldFilters<Chart>([{ id: 'type', label: 'Type', type: 'select', get: (c) => c.spec.type, options }]);
 *   const shown = f.apply(charts);   …   {f.bar}
 */
export function useFieldFilters<T>(defs: FieldDef<T>[]) {
  const [query, setQuery] = useState<FilterQuery>(() => createFilterQuery([]));
  const fields = useMemo<FilterField[]>(() => defs.map((d) => ({
    id: d.id, label: d.label,
    type: d.type === 'select' ? 'select' : d.type === 'number' ? 'number' : 'text',
    ...(d.options ? { options: d.options } : {}),
  })) as FilterField[], [defs]);

  const apply = useCallback((items: T[]): T[] => {
    if (isFilterQueryEmpty(query)) return items;
    const conds = activeConditions(query);
    if (conds.length === 0) return items;
    const any = isOr(query);
    return items.filter((it) => {
      const test = (c: FilterCondition) => {
        const def = defs.find((d) => d.id === c.field);
        return def ? matches(def.get(it), c) : true;
      };
      return any ? conds.some(test) : conds.every(test);
    });
  }, [query, defs]);

  const bar: ReactNode = <Filters fields={fields} query={query} onQueryChange={setQuery} showClear />;
  return { apply, bar, active: !isFilterQueryEmpty(query) };
}
