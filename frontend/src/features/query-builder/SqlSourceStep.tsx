import { Code2 } from 'lucide-react';
import { CodeEditor } from '@/components/common/CodeEditor';
import { Step } from './ui';

/** First stage that is a whole SQL query (opened from the Workbench, or too rich for steps). Later stages build on its result. */
export function SqlSourceStep({ sql, onChange }: { sql: string; onChange: (v: string) => void }) {
  return (
    <Step icon={<Code2 />} title="Data (SQL)" tone="info" badge={<span className="text-xs text-muted-foreground">kept as written · add stages below to filter, group or sort it</span>}>
      <CodeEditor value={sql} onChange={onChange} language="sql" minHeight="6rem" maxHeight="18rem" />
    </Step>
  );
}
