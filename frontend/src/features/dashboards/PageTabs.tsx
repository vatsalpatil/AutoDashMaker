import { Plus } from 'lucide-react';
import { UnderlineTabs } from '@/components/common/ListControls';
import { IconButton } from '@/components/common/IconButton';

/** Dashboard pages as tabs, with an inline "add page" input. */
export function PageTabs({ pages, active, onSelect, adding, onAddingChange, name, onNameChange, onAdd }: {
  pages: { id: string; name: string }[];
  active: string;
  onSelect: (id: string) => void;
  adding: boolean;
  onAddingChange: (adding: boolean) => void;
  name: string;
  onNameChange: (name: string) => void;
  onAdd: () => void;
}) {
  return (
    <div className="flex items-center gap-1 border-b">
      <UnderlineTabs value={active} onChange={onSelect} tabs={pages.map((p) => ({ id: p.id, label: p.name }))} />
      {adding ? (
        <span className="flex items-center gap-1 px-2 py-1">
          <input
            autoFocus
            value={name}
            placeholder="Page name"
            onChange={(e) => onNameChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onAdd();
              if (e.key === 'Escape') { onAddingChange(false); onNameChange(''); }
            }}
            className="w-32 rounded-sm border border-input bg-card px-2 py-0.5 text-sm focus:border-ring focus:outline-hidden"
          />
          <button onClick={onAdd} className="text-xs font-semibold text-primary hover:underline">Add</button>
        </span>
      ) : (
        <IconButton title="Add page" onClick={() => onAddingChange(true)}><Plus className="h-4 w-4" /></IconButton>
      )}
    </div>
  );
}
