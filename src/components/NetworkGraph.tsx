/* ScholarAI — co-authorship network (deterministic radial SVG layout). */

import { useMemo, useState } from "react";
import type { NetEdge, NetNode } from "../lib/analytics";

interface Props {
  nodes: NetNode[];
  edges: NetEdge[];
  selected: string | null;
  onSelect: (id: string | null) => void;
}

export default function NetworkGraph({ nodes, edges, selected, onSelect }: Props) {
  const [hover, setHover] = useState<string | null>(null);
  const W = 640, H = 430, CX = W / 2, CY = H / 2;

  const pos = useMemo(() => {
    const faculty = nodes.filter((n) => n.kind === "faculty");
    const external = nodes.filter((n) => n.kind === "external");
    const map = new Map<string, { x: number; y: number }>();
    faculty.forEach((n, i) => {
      const a = (i / faculty.length) * Math.PI * 2 - Math.PI / 2;
      map.set(n.id, { x: CX + Math.cos(a) * 118, y: CY + Math.sin(a) * 108 });
    });
    external.forEach((n, i) => {
      const a = (i / external.length) * Math.PI * 2 - Math.PI / 2 + 0.35;
      map.set(n.id, { x: CX + Math.cos(a) * 196, y: CY + Math.sin(a) * 172 });
    });
    return map;
  }, [nodes]);

  const maxW = Math.max(1, ...edges.map((e) => e.weight));
  const active = hover ?? selected;
  const neighbors = useMemo(() => {
    if (!active) return new Set<string>();
    const s = new Set<string>([active]);
    edges.forEach((e) => {
      if (e.a === active) s.add(e.b);
      if (e.b === active) s.add(e.a);
    });
    return s;
  }, [active, edges]);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto select-none" role="img" aria-label="Co-authorship network">
      {edges.map((e, i) => {
        const pa = pos.get(e.a), pb = pos.get(e.b);
        if (!pa || !pb) return null;
        const isActive = active && (e.a === active || e.b === active);
        return (
          <path key={i}
            d={`M ${pa.x} ${pa.y} Q ${CX + (pa.x + pb.x - 2 * CX) * 0.3} ${CY + (pa.y + pb.y - 2 * CY) * 0.3} ${pb.x} ${pb.y}`}
            fill="none"
            stroke={isActive ? "#0e8172" : "#cbd6e1"}
            strokeWidth={0.8 + (e.weight / maxW) * 3}
            opacity={active ? (isActive ? 0.85 : 0.18) : 0.5}
            style={{ transition: "opacity .2s, stroke .2s" }}
          />
        );
      })}
      {nodes.map((n) => {
        const p = pos.get(n.id);
        if (!p) return null;
        const r = n.kind === "faculty" ? 10 + Math.min(10, n.papers / 5) : 6 + Math.min(5, n.papers / 3);
        const dim = active && !neighbors.has(n.id);
        const isSel = selected === n.id;
        return (
          <g key={n.id} transform={`translate(${p.x}, ${p.y})`}
            className="cursor-pointer"
            opacity={dim ? 0.25 : 1}
            style={{ transition: "opacity .2s" }}
            onMouseEnter={() => setHover(n.id)}
            onMouseLeave={() => setHover(null)}
            onClick={() => onSelect(isSel ? null : n.id)}>
            {isSel && <circle r={r + 5} fill="none" stroke="#0e8172" strokeWidth={1.5} strokeDasharray="3 3" />}
            <circle r={r}
              fill={n.kind === "faculty" ? "#0e8172" : "#f2b33d"}
              stroke="#fff" strokeWidth={2}
              opacity={n.kind === "faculty" ? 0.92 : 0.9} />
            <text y={r + 13} textAnchor="middle" fontSize={10.5} fontWeight={600}
              fontFamily="Public Sans" fill={dim ? "#a7b7c9" : "#29405c"}>
              {n.label.length > 20 ? n.label.slice(0, 19) + "…" : n.label}
            </text>
            {n.kind === "faculty" && (
              <text y={4} textAnchor="middle" fontSize={9.5} fontWeight={700} fontFamily="Spline Sans Mono" fill="#fff">
                {n.papers}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
