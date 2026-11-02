import { Check, Copy } from 'lucide-react';
import { useState } from 'react';

/** A monospace block with a copy button (connector URLs, CLI commands, config JSON). */
export function Snippet({ text, masked }: { text: string; masked?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* clipboard blocked: the text is still selectable */ }
  };
  return (
    <div className="relative rounded-md border bg-muted/50">
      <pre className="overflow-x-auto whitespace-pre-wrap break-all p-3 pr-10 font-mono text-xs">{masked ?? text}</pre>
      <button type="button" onClick={copy} aria-label="Copy" title="Copy"
        className="absolute right-2 top-2 rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground">
        {copied ? <Check className="size-4 text-success" /> : <Copy className="size-4" />}
      </button>
    </div>
  );
}
