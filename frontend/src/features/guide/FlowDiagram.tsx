

interface FlowNode {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
  sub?: string;
  tone?: 'default' | 'ai' | 'alert';
}

interface FlowEdge {
  from: string;
  to: string;
  label?: string;
}

export function FlowDiagram({ nodes, edges, width, height }: { nodes: FlowNode[]; edges: FlowEdge[]; width: number; height: number }) {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const boxFill: Record<string, string> = {
    default: 'fill-card stroke-border',
    ai: 'fill-primary/10 stroke-primary/40',
    alert: 'fill-warning/10 stroke-warning/50',
  };
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" role="img">
      <defs>
        <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M 0 1 L 9 5 L 0 9 z" className="fill-muted-foreground " />
        </marker>
      </defs>
      {edges.map((e, i) => {
        const a = byId.get(e.from)!;
        const b = byId.get(e.to)!;
        const x1 = a.x + a.w;
        const y1 = a.y + a.h / 2;
        const x2 = b.x;
        const y2 = b.y + b.h / 2;
        const midX = (x1 + x2) / 2;
        return (
          <g key={i}>
            <path
              d={`M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2 - 4} ${y2}`}
              fill="none"
              className="stroke-muted-foreground "
              strokeWidth="1.5"
              markerEnd="url(#arrow)"
            />
            {e.label && (
              <text
                x={midX}
                y={(y1 + y2) / 2 - 6}
                textAnchor="middle"
                className="fill-muted-foreground text-[10px] "
              >
                {e.label}
              </text>
            )}
          </g>
        );
      })}
      {nodes.map((n) => (
        <g key={n.id}>
          <rect
            x={n.x}
            y={n.y}
            width={n.w}
            height={n.h}
            rx="8"
            className={boxFill[n.tone ?? 'default']}
            strokeWidth="1.5"
          />
          <text
            x={n.x + n.w / 2}
            y={n.y + (n.sub ? n.h / 2 - 4 : n.h / 2 + 4)}
            textAnchor="middle"
            className="fill-foreground text-[11px] font-semibold "
          >
            {n.label}
          </text>
          {n.sub && (
            <text
              x={n.x + n.w / 2}
              y={n.y + n.h / 2 + 12}
              textAnchor="middle"
              className="fill-muted-foreground text-[9px] "
            >
              {n.sub}
            </text>
          )}
        </g>
      ))}
    </svg>
  );
}
