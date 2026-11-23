import { ErrorBanner } from '@/components/common/ErrorBanner';
import { PageHeader } from '@/components/common/PageHeader';
import { MemoryEditor } from '@/features/memory/MemoryEditor';
import { MemoryFileList } from '@/features/memory/MemoryFileList';
import { RememberBox } from '@/features/memory/RememberBox';
import { useMemory } from '@/features/memory/useMemory';

/** The user's AI memory: Markdown files the AI reads on every request (like CLAUDE.md), fully visible and editable. */
export default function MemoryPage() {
  const m = useMemory();
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="AI Memory"
        description={<>What the AI remembers about you, as Markdown files it reads on every request. Edit anything, add a file per topic,
          or type <code className="mono">remember …</code> in Ask or the notebook AI assistant.</>}
      />
      {m.error && <ErrorBanner message={m.error} />}
      <RememberBox m={m} />
      <div className="flex flex-col gap-4 md:flex-row">
        <MemoryFileList m={m} />
        <MemoryEditor m={m} />
      </div>
    </div>
  );
}
