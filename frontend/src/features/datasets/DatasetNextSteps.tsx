import { useNavigate } from 'react-router-dom';
import { FlaskConical, LayoutDashboard, Workflow } from 'lucide-react';
import { Button } from '@/components/ui/kit';
import { useAsyncAction } from '@/hooks/useAsyncAction';
import { sendToBuilder } from '@/features/query-builder/qbHandoff';
import { appendNotebookCell } from '@/features/workbench/notebookModel';
import type { Dataset } from '@/lib/types';

/** "What next?" for a dataset: the same three exits every data page offers (build a query, write SQL, make a dashboard). */
export function DatasetNextSteps({ dataset }: { dataset: Dataset }) {
  const nav = useNavigate();
  const sql = `SELECT * FROM "${dataset.name.replace(/"/g, '""')}"`;
  const [toBuilder, builder] = useAsyncAction(async () => { await sendToBuilder(sql); nav('/builder'); });
  return (
    <>
      <Button size="sm" variant="outline" icon={<Workflow className="size-4" />} label="Open in builder" isDisabled={builder.busy} onClick={() => toBuilder()} />
      <Button size="sm" variant="outline" icon={<FlaskConical className="size-4" />} label="Query in Workbench" onClick={() => { appendNotebookCell(`${sql}\nLIMIT 100`); nav('/workbench'); }} />
      <Button size="sm" variant="primary" icon={<LayoutDashboard className="size-4" />} label="Build dashboard" onClick={() => nav(`/dashboards/generate?dataset=${encodeURIComponent(dataset.id)}`)} />
    </>
  );
}
