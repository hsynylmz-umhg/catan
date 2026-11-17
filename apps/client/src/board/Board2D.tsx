import { useEffect, useMemo, useRef, useState, type PointerEvent as RPointerEvent } from 'react';
import type { BuildingKind, Terrain } from '@kervan/shared';
import { tint } from '../themes';
import { pips, type BoardProps } from './types';

const S = 60; // layout units -> svg units
const INK = '#1e1410';

function TerrainGlyph({ terrain, color }: { terrain: Terrain; color: string }) {
  const tri = (x: number, y: number, s = 1) => `M${x - 9 * s} ${y + 9 * s}L${x} ${y - 13 * s}L${x + 9 * s} ${y + 9 * s}Z`;
  switch (terrain) {
    case 'forest':
      return <path fill={color} d={tri(-20, -24) + tri(0, -32, 1.15) + tri(20, -24)} />;
    case 'quarry':
      return (
        <g fill={color}>
          <rect x="-22" y="-30" width="16" height="10" rx="2" />
          <rect x="-3" y="-30" width="20" height="10" rx="2" />
          <rect x="-13" y="-42" width="18" height="10" rx="2" />
        </g>
      );
    case 'field':
      return (
        <g stroke={color} strokeWidth="4" strokeLinecap="round">
          <path d="M-24 -20L-14 -38M-10 -20L0 -38M4 -20L14 -38M18 -20L28 -38" fill="none" />
        </g>
      );
    case 'pasture':
      return (
        <g fill={color}>
          <circle cx="-18" cy="-26" r="6.500" />
          <circle cx="-9" cy="-30" r="6.500" />
          <circle cx="12" cy="-28" r="6.500" />
          <circle cx="21" cy="-24" r="6.500" />
        </g>
      );
    case 'mine':
      return <path fill={color} d="M-30 -18L-14 -42L-4 -28L8 -46L28 -18Z" />;
    default:
      return (
        <g fill={color}>
          <circle cx="-16" cy="-6" r="4" />
          <circle cx="6" cy="-18" r="5" />
          <circle cx="18" cy="10" r="3.500" />
          <circle cx="-6" cy="16" r="3" />
        </g>
      );
  }
}

function Building({ kind, color }: { kind: BuildingKind; color: string }) {
  const common = { fill: color, stroke: INK, strokeWidth: 2.200, strokeLinejoin: 'round' as const };
  if (kind === 'outpost') return <path {...common} d="M-9 9V-3L0 -12L9 -3V9Z" />;
  if (kind === 'keep')
    return (
      <g>
        <path {...common} d="M-12 11V-12h5v4h4.500v-4h5v4H7v-4h5V11Z" />
        <rect x="-3" y="1" width="6" height="10" rx="3" fill={INK} opacity=".55" />
      </g>
    );
  return (
    <g>
      <path {...common} d="M-12 10V-2h24V10Z" />
      <path d="M-15 -2L-10 -12H10L15 -2Z" fill="#fff4dc" stroke={INK} strokeWidth="2.200" strokeLinejoin="round" />
      <path d="M-5 -12L-7 -2M5 -12L7 -2" stroke={color} strokeWidth="3" />
    </g>
  );
}

export default function Board2D({ view, theme, highlights, onPick, lastBuilt }: BoardProps) {
  const { board } = view;
  const pal = theme.palette;
  const svgRef = useRef<SVGSVGElement>(null);
  const [tf, setTf] = useState({ k: 1, x: 0, y: 0 });
  const ptrs = useRef(new Map<number, { x: number; y: number }>());
  const dragged = useRef(false);
  const moved = useRef(0);

  const vb = useMemo(() => {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const v of board.vertices) {
      minX = Math.min(minX, v.x); maxX = Math.max(maxX, v.x);
      minY = Math.min(minY, v.y); maxY = Math.max(maxY, v.y);
    }
    const pad = 0.75;
    return { x: (minX - pad) * S, y: (minY - pad) * S, w: (maxX - minX + 2 * pad) * S, h: (maxY - minY + 2 * pad) * S };
  }, [board]);
  const cx = vb.x + vb.w / 2;
  const cy = vb.y + vb.h / 2;

  const ratio = () => {
    const r = svgRef.current?.getBoundingClientRect();
    return r && r.width > 0 ? Math.max(vb.w / r.width, vb.h / r.height) : 1;
  };
  const clampTf = (t: { k: number; x: number; y: number }) => {
    const k = Math.max(0.7, Math.min(4, t.k));
    const lx = (vb.w * k) / 2;
    const ly = (vb.h * k) / 2;
    return { k, x: Math.max(-lx, Math.min(lx, t.x)), y: Math.max(-ly, Math.min(ly, t.y)) };
  };
  /** Zoom by `factor` keeping the client point (px,py) fixed. */
  const zoomAt = (factor: number, px: number, py: number) => {
    const r = svgRef.current?.getBoundingClientRect();
    if (!r) return;
    const q = ratio();
    const ox = (px - r.left - r.width / 2) * q; // offset from view centre, svg units
    const oy = (py - r.top - r.height / 2) * q;
    setTf((t) => {
      const k = Math.max(0.7, Math.min(4, t.k * factor));
      const f = k / t.k;
      return clampTf({ k, x: ox - (ox - t.x) * f, y: oy - (oy - t.y) * f });
    });
  };

  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      zoomAt(Math.exp(-e.deltaY * 0.0015), e.clientX, e.clientY);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vb]);

  const onDown = (e: RPointerEvent) => {
    ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (ptrs.current.size === 1) {
      dragged.current = false;
      moved.current = 0;
    }
  };
  const onMove = (e: RPointerEvent) => {
    const prev = ptrs.current.get(e.pointerId);
    if (!prev) return;
    const cur = { x: e.clientX, y: e.clientY };
    if (ptrs.current.size === 1) {
      const dx = cur.x - prev.x;
      const dy = cur.y - prev.y;
      moved.current += Math.abs(dx) + Math.abs(dy);
      if (moved.current > 8) dragged.current = true;
      if (dragged.current) {
        const q = ratio();
        setTf((t) => clampTf({ ...t, x: t.x + dx * q, y: t.y + dy * q }));
      }
    } else if (ptrs.current.size === 2) {
      const other = [...ptrs.current.entries()].find(([id]) => id !== e.pointerId)![1];
      const d0 = Math.hypot(prev.x - other.x, prev.y - other.y);
      const d1 = Math.hypot(cur.x - other.x, cur.y - other.y);
      dragged.current = true;
      if (d0 > 0) zoomAt(d1 / d0, (cur.x + other.x) / 2, (cur.y + other.y) / 2);
    }
    ptrs.current.set(e.pointerId, cur);
  };
  const onUp = (e: RPointerEvent) => {
    ptrs.current.delete(e.pointerId);
  };
  const pick = (kind: 'vertex' | 'edge' | 'hex', id: number) => () => {
    if (!dragged.current) onPick(kind, id);
  };

  const V = (id: number) => ({ x: board.vertices[id].x * S, y: board.vertices[id].y * S });
  const hexPoints = (ids: number[]) => ids.map((id) => `${V(id).x.toFixed(1)},${V(id).y.toFixed(1)}`).join(' ');
  const edgeLine = (id: number, shrink: number) => {
    const e = board.edges[id];
    const a = V(e.a);
    const b = V(e.b);
    return {
      x1: a.x + (b.x - a.x) * shrink, y1: a.y + (b.y - a.y) * shrink,
      x2: b.x + (a.x - b.x) * shrink, y2: b.y + (a.y - b.y) * shrink,
    };
  };
  const colorOf = (seat: number) => view.players.find((p) => p.seat === seat)?.color ?? '#888';
  const accent = theme.ui.accent;

  let builtPos: { x: number; y: number } | null = null;
  if (lastBuilt) {
    if (lastBuilt.kind === 'vertex' && board.vertices[lastBuilt.id]) builtPos = V(lastBuilt.id);
    else if (lastBuilt.kind === 'edge' && board.edges[lastBuilt.id]) {
      const e = board.edges[lastBuilt.id];
      builtPos = { x: (V(e.a).x + V(e.b).x) / 2, y: (V(e.a).y + V(e.b).y) / 2 };
    }
  }

  return (
    <svg
      ref={svgRef}
      className="board2d"
      viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}
      preserveAspectRatio="xMidYMid meet"
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
      onPointerLeave={onUp}
      style={{ background: `radial-gradient(circle at 50% 45%, ${pal.sea}, ${pal.backdrop})` }}
    >
      <g transform={`translate(${cx + tf.x} ${cy + tf.y}) scale(${tf.k}) translate(${-cx} ${-cy})`}>
        {/* coast / base slab */}
        <g fill={pal.base} stroke={pal.base} strokeWidth="22" strokeLinejoin="round">
          {board.hexes.map((h) => (
            <polygon key={h.id} points={hexPoints(h.vertices)} />
          ))}
        </g>
        <g fill="none" stroke={tint(pal.base, -0.35)} strokeWidth="2" strokeLinejoin="round" opacity=".5">
          {board.hexes.map((h) => (
            <polygon key={h.id} points={hexPoints(h.vertices)} />
          ))}
        </g>
        {board.hexes.map((h) => (
          <g key={h.id}>
            <polygon points={hexPoints(h.vertices)} fill={pal.terrain[h.terrain]} stroke={tint(pal.terrain[h.terrain], -0.3)} strokeWidth="3" strokeLinejoin="round" />
            <g transform={`translate(${h.x * S} ${h.y * S})`}>
              <TerrainGlyph terrain={h.terrain} color={pal.deco[h.terrain]} />
              {h.number !== null && (
                <g transform="translate(0 12)">
                  <circle r="17" fill={pal.token} stroke={h.number === 6 || h.number === 8 ? pal.tokenHot : tint(pal.tokenInk, 0.3)} strokeWidth={h.number === 6 || h.number === 8 ? 3 : 1.500} />
                  <text y="4" textAnchor="middle" fontSize="19" fontWeight="800" fontFamily="Georgia, serif" fill={h.number === 6 || h.number === 8 ? pal.tokenHot : pal.tokenInk}>
                    {h.number}
                  </text>
                  <g fill={h.number === 6 || h.number === 8 ? pal.tokenHot : pal.tokenInk}>
                    {Array.from({ length: pips(h.number) }, (_, i) => (
                      <circle key={i} cx={(i - (pips(h.number!) - 1) / 2) * 4.200} cy="10.500" r="1.400" />
                    ))}
                  </g>
                </g>
              )}
            </g>
          </g>
        ))}

        {/* roads */}
        {Object.entries(view.roads).map(([id, seat]) => {
          const l = edgeLine(Number(id), 0.16);
          return (
            <g key={id} strokeLinecap="round">
              <line {...l} stroke={INK} strokeWidth="12" />
              <line {...l} stroke={colorOf(seat)} strokeWidth="7.500" />
            </g>
          );
        })}

        {/* bandit */}
        {board.hexes[view.bandit] && (
          <g transform={`translate(${board.hexes[view.bandit].x * S + 27} ${board.hexes[view.bandit].y * S + 4})`}>
            <path d="M-9 14Q-10 -2 0 -4Q10 -2 9 14Z" fill={pal.bandit} stroke="#fff" strokeWidth="2" />
            <circle cy="-10" r="7" fill={pal.bandit} stroke="#fff" strokeWidth="2" />
            <rect x="-5" y="-12" width="10" height="3" rx="1.500" fill={pal.tokenHot} />
          </g>
        )}

        {/* buildings */}
        {Object.entries(view.buildings).map(([id, b]) => {
          const p = V(Number(id));
          return (
            <g key={id} transform={`translate(${p.x} ${p.y})`}>
              <Building kind={b.kind} color={colorOf(b.owner)} />
            </g>
          );
        })}

        {builtPos && <circle className="lastbuilt" cx={builtPos.x} cy={builtPos.y} r="19" fill="none" stroke={theme.ui.gold} strokeWidth="4" />}

        {/* pick markers */}
        {highlights.hexes.map((id) => {
          const h = board.hexes[id];
          if (!h) return null;
          return (
            <g key={`h${id}`} className="pick" onClick={pick('hex', id)}>
              <polygon points={hexPoints(h.vertices)} fill="transparent" />
              <circle className="hl" cx={h.x * S} cy={h.y * S} r="30" fill="rgba(255,255,255,.28)" stroke="#fff" strokeWidth="5" />
              <circle className="hl" cx={h.x * S} cy={h.y * S} r="34" fill="none" stroke={accent} strokeWidth="3" />
            </g>
          );
        })}
        {highlights.edges.map((id) => {
          if (!board.edges[id]) return null;
          const l = edgeLine(id, 0.2);
          return (
            <g key={`e${id}`} className="pick" strokeLinecap="round" onClick={pick('edge', id)}>
              <line {...edgeLine(id, 0.08)} stroke="transparent" strokeWidth="34" />
              <line className="hl" {...l} stroke={accent} strokeWidth="13" />
              <line className="hl" {...l} stroke="#fff" strokeWidth="7" />
            </g>
          );
        })}
        {highlights.vertices.map((id) => {
          if (!board.vertices[id]) return null;
          const p = V(id);
          return (
            <g key={`v${id}`} className="pick" onClick={pick('vertex', id)}>
              <circle cx={p.x} cy={p.y} r="25" fill="transparent" />
              <circle className="hl" cx={p.x} cy={p.y} r="11" fill="#fff" stroke={accent} strokeWidth="4.500" />
            </g>
          );
        })}
      </g>
    </svg>
  );
}
