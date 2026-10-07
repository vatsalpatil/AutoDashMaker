import { Copy, FileText, LayoutGrid, Pencil, Play, Plus, Printer, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/kit';

/** Actions in the dashboard header. Toggle buttons turn primary while their panel is open. */
export function DashboardToolbar({ editing, onToggleEdit, showBrief, briefBusy, onBrief, showLineage, onLineage, onPresent, onAdd, onAi, onDuplicate, refresh }: {
  editing: boolean;
  onToggleEdit: () => void;
  showBrief: boolean;
  briefBusy: boolean;
  onBrief: () => void;
  showLineage: boolean;
  onLineage: () => void;
  onPresent: () => void;
  onAdd: () => void;
  onAi: () => void;
  onDuplicate: () => void;
  refresh: React.ReactNode;
}) {
  return (
    <>
      <Button variant={editing ? 'primary' : 'secondary'} icon={<Pencil className="h-4 w-4" />} label={editing ? 'Done editing' : 'Edit layout'} onClick={onToggleEdit} />
      <Button variant={showBrief ? 'primary' : 'secondary'} icon={<FileText className="h-4 w-4" />} label={showBrief ? 'Hide brief' : briefBusy ? 'Loading…' : 'Brief'} onClick={onBrief} isDisabled={briefBusy} />
      <Button variant={showLineage ? 'primary' : 'secondary'} icon={<LayoutGrid className="h-4 w-4" />} label={showLineage ? 'Hide lineage' : 'View lineage'} onClick={onLineage} />
      {refresh}
      <Button variant="secondary" icon={<Copy className="h-4 w-4" />} label="Duplicate" onClick={onDuplicate} />
      <Button variant="secondary" icon={<Printer className="h-4 w-4" />} label="Print / PDF" onClick={() => window.print()} />
      <Button variant="secondary" icon={<Play className="h-4 w-4" />} label="Present" onClick={onPresent} />
      <Button variant="secondary" icon={<Sparkles className="h-4 w-4 text-primary" />} label="Edit with AI" onClick={onAi} />
      <Button variant="primary" icon={<Plus className="h-4 w-4" />} label="Add widget" onClick={onAdd} />
    </>
  );
}
