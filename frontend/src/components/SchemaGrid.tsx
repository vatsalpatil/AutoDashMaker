import { useMemo } from 'react';
import { DataGrid } from '@/components/common/DataGrid';
import type { DatasetSchema } from '@/lib/types';

const COLUMNS = ['Column', 'Type', 'Null %', 'Distinct', 'Samples'];

/** A dataset's columns and profile in the shared data grid, so they can be searched, filtered and sorted. */
export function SchemaGrid({ schema }: { schema: DatasetSchema }) {
  const rows = useMemo(() => schema.columns.map((c) => ({
    Column: c.name,
    Type: c.dtype,
    'Null %': c.null_pct,
    Distinct: c.distinct_count,
    Samples: (c.sample_values ?? []).slice(0, 3).map(String).join(', '),
  })), [schema]);
  return <DataGrid columns={COLUMNS} rows={rows} maxHeight="70vh" leftAlign />;
}
