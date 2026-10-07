import { Fragment, type ReactNode } from 'react';

/** `code`, **bold** and *italic* inside one line of text. */
function inline(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*\s][^*]*\*)/g;
  let last = 0;
  for (const m of text.matchAll(re)) {
    if (m.index! > last) out.push(text.slice(last, m.index));
    const t = m[0];
    out.push(t.startsWith('`')
      ? <code key={m.index} className="mono rounded bg-muted px-1 py-0.5 text-[0.85em]">{t.slice(1, -1)}</code>
      : t.startsWith('**') ? <strong key={m.index}>{t.slice(2, -2)}</strong> : <em key={m.index}>{t.slice(1, -1)}</em>);
    last = m.index! + t.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

type Block = { kind: 'table'; head: string[]; rows: string[][] } | { kind: 'code'; lang: string; code: string } | { kind: 'ul' | 'ol'; items: string[] } | { kind: 'h'; text: string } | { kind: 'p'; text: string };

function blocks(src: string): Block[] {
  const out: Block[] = [];
  const lines = src.replace(/\r/g, '').split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const fence = line.match(/^\s*```(\w*)\s*$/);
    if (fence) {
      const code: string[] = [];
      for (i++; i < lines.length && !/^\s*```\s*$/.test(lines[i]); i++) code.push(lines[i]);
      out.push({ kind: 'code', lang: fence[1].toLowerCase(), code: code.join('\n') });
    } else if (/^\s*\|.*\|\s*$/.test(line) && i + 1 < lines.length && /^\s*\|?[\s:|-]+\|[\s:|-]*$/.test(lines[i + 1])) {
      const cells = (l: string) => l.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
      const rows: string[][] = [];
      for (i += 2; i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i]); i++) rows.push(cells(lines[i]));
      i--;
      out.push({ kind: 'table', head: cells(line), rows });
    } else if (/^\s*([-*•])\s+/.test(line) || /^\s*\d+[.)]\s+/.test(line)) {
      const ordered = /^\s*\d+[.)]\s+/.test(line);
      const items: string[] = [];
      for (; i < lines.length && /^\s*([-*•]|\d+[.)])\s+/.test(lines[i]); i++) items.push(lines[i].replace(/^\s*([-*•]|\d+[.)])\s+/, ''));
      i--;
      out.push({ kind: ordered ? 'ol' : 'ul', items });
    } else if (/^#{1,4}\s+/.test(line)) {
      out.push({ kind: 'h', text: line.replace(/^#{1,4}\s+/, '') });
    } else if (line.trim()) {
      const para = [line];
      while (i + 1 < lines.length && lines[i + 1].trim() && !/^\s*(```|[-*•]\s|\d+[.)]\s|#{1,4}\s)/.test(lines[i + 1])) para.push(lines[++i]);
      out.push({ kind: 'p', text: para.join(' ') });
    }
  }
  return out;
}

/** Small Markdown renderer (paragraphs, lists, headings, **bold**, `code`, fenced code) with a hook to decorate code blocks. */
export function Markdown({ text, renderCode, className }: {
  text: string;
  renderCode?: (code: string, lang: string) => ReactNode;
  className?: string;
}) {
  return (
    <div className={className ?? 'space-y-2 text-sm leading-relaxed'}>
      {blocks(text).map((b, i) => (
        <Fragment key={i}>
          {b.kind === 'code' && (renderCode ? renderCode(b.code, b.lang) : <pre className="mono overflow-auto rounded-md bg-muted p-2 text-xs">{b.code}</pre>)}
          {b.kind === 'table' && (
            <div className="overflow-auto rounded-md border">
              <table className="min-w-full text-xs">
                <thead className="bg-muted"><tr>{b.head.map((h, j) => <th key={j} className="px-2 py-1 text-left font-semibold">{inline(h)}</th>)}</tr></thead>
                <tbody className="divide-y">{b.rows.map((r, j) => <tr key={j}>{r.map((c, k) => <td key={k} className="px-2 py-1">{inline(c)}</td>)}</tr>)}</tbody>
              </table>
            </div>
          )}
          {b.kind === 'ul' && <ul className="list-disc space-y-0.5 pl-5">{b.items.map((t, j) => <li key={j}>{inline(t)}</li>)}</ul>}
          {b.kind === 'ol' && <ol className="list-decimal space-y-0.5 pl-5">{b.items.map((t, j) => <li key={j}>{inline(t)}</li>)}</ol>}
          {b.kind === 'h' && <p className="font-semibold">{inline(b.text)}</p>}
          {b.kind === 'p' && <p>{inline(b.text)}</p>}
        </Fragment>
      ))}
    </div>
  );
}
