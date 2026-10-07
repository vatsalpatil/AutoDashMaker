import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Braces, Database, GitMerge, Maximize2, Minimize2, Plus, Table2 } from 'lucide-react';
import { BlendDialog } from '@/components/BlendDialog';
import { ErrorBanner } from '@/components/common/ErrorBanner';
import { SearchBox, UnderlineTabs, ViewToggle } from '@/components/common/ListControls';
import { Loading } from '@/components/common/Loading';
import { useFieldFilters, type FieldDef } from '@/components/common/useFieldFilters';
import { PageHeader } from '@/components/common/PageHeader';
import { UploadDropzone } from '@/components/common/UploadDropzone';
import { Button } from '@/components/ui/kit';
import { ConnectionsTab } from '@/features/sources/ConnectionsTab';
import { DatasetsTab } from '@/features/sources/DatasetsTab';
import { ImportTablesDialog } from '@/features/sources/ImportTablesDialog';
import { SourcePanel } from '@/features/sources/SourcePanel';
import { useSources } from '@/features/sources/useSources';
import { useFullscreen } from '@/hooks/useFullscreen';
import { useListView } from '@/hooks/useListView';
import type { Dataset, Source } from '@/lib/types';

type Tab = 'datasets' | 'connections';

const DATASET_FIELDS: FieldDef<Dataset>[] = [
  { id: 'name', label: 'Name', type: 'text', get: (d) => d.name },
  { id: 'kind', label: 'Kind', type: 'text', get: (d) => d.kind },
  { id: 'rows', label: 'Rows', type: 'number', get: (d) => d.row_count },
];

/** Datasets (what you can query) and connections (where they come from). Thin: logic is in features/sources. */
export default function SourcesPage() {
  const s = useSources();
  const list = useListView();
  const filters = useFieldFilters(DATASET_FIELDS);
  const [tab, setTab] = useState<Tab>('datasets');
  const [dialog, setDialog] = useState<{ open: boolean; editing: Source | null }>({ open: false, editing: null });
  const [blendOpen, setBlendOpen] = useState(false);
  const [importing, setImporting] = useState<Source | null>(null);
  const full = useFullscreen<HTMLDivElement>();

  if (!s.sources || !s.datasets) return s.error ? <ErrorBanner message={s.error} /> : <Loading />;

  return (
    <div ref={full.ref} className={`flex flex-col gap-6 ${full.active ? 'h-screen overflow-auto bg-background p-6' : ''}`}>
      <PageHeader
        title="Data Sources"
        description="Manage your datasets, upload local files, or connect external databases and APIs."
        actions={
          <>
            <Button variant="ghost" icon={full.active ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />} aria-label={full.active ? 'Exit full screen' : 'Full screen'} onClick={full.toggle} />
            <Link to="/sources/studio" className="inline-flex h-8 items-center gap-1.5 rounded-lg border bg-card px-3 text-sm font-medium hover:bg-accent"><Braces className="h-4 w-4 text-primary" /> API Studio</Link>
            {s.datasets.length >= 2 && <Button variant="secondary" label="Blend datasets" icon={<GitMerge className="h-4 w-4" />} onClick={() => setBlendOpen(true)} />}
            <Button variant="primary" label="Add connection" icon={<Plus className="h-4 w-4" />} onClick={() => setDialog({ open: true, editing: null })} />
          </>
        }
      />
      <ErrorBanner message={s.error} />

      <SourcePanel open={dialog.open} editing={dialog.editing} onClose={() => setDialog({ open: false, editing: null })} onSaved={s.reload} />

      <UploadDropzone onFile={s.upload} busy={s.uploading} title="Drag a CSV, Parquet, Excel, or JSON file here" busyTitle="Uploading and ingesting dataset…" />

      <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3">
        <UnderlineTabs<Tab>
          value={tab}
          onChange={setTab}
          tabs={[
            { id: 'datasets', label: 'Datasets', icon: <Table2 className="h-4 w-4" />, count: s.datasets.length },
            { id: 'connections', label: 'Connected Sources', icon: <Database className="h-4 w-4" />, count: s.sources.length },
          ]}
        />
        <div className="flex items-center gap-3">
          <SearchBox value={list.query} onChange={list.setQuery} placeholder={`Search ${tab === 'datasets' ? 'datasets' : 'sources'}…`} />
          <ViewToggle value={list.view} onChange={list.setView} />
        </div>
      </div>

      {tab === 'datasets' && <div className="flex flex-wrap items-center gap-2">{filters.bar}</div>}
      {tab === 'datasets' ? (
        <DatasetsTab
          datasets={filters.apply(list.filter(s.datasets, (d) => [d.name, d.kind]))}
          view={list.view}
          refreshing={s.refreshing}
          onRefresh={s.refreshDataset}
          onRemove={s.removeDataset}
        />
      ) : (
        <ConnectionsTab
          sources={list.filter(s.sources, (x) => [x.name, x.type])}
          view={list.view}
          onEdit={(src) => setDialog({ open: true, editing: src })}
          onImport={setImporting}
          onRemove={s.removeSource}
        />
      )}

      <ImportTablesDialog source={importing} onClose={() => setImporting(null)} onImported={s.reload} />
      <BlendDialog isOpen={blendOpen} onClose={() => setBlendOpen(false)} datasets={s.datasets} />
    </div>
  );
}
