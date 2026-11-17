import { useEffect, useId, useMemo, useRef, useState, type PointerEvent as RPointerEvent } from 'react';
import type { Terrain } from '@kervan/shared';
import { tint } from '../themes';
import { INK, PieceShape } from '../ui/Pieces';
import { pips, type BoardProps } from './types';

const S = 60; // layout units -> svg units (hex radius)

/* ---------- terrain illustrations (hex-local coords, token sits at 0,4 r≈20) ---------- */

function Conifer({ x, y, s = 1, c, hi }: { x: number; y: number; s?: number; c: string; hi: string }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <ellipse cx="0" cy="9" rx="7" ry="2.2" fill="rgba(0,0,0,.22)" />
      <rect x="-1.4" y="3" width="2.8" height="6" fill={INK} opacity=".55" />
      <path d="M0 -15L8 2H-8z" fill={c} />
      <path d="M0 -9L9.5 5.5H-9.5z" fill={c} />
      <path d="M0 -15L8 2H3zM0 -9L9.5 5.5H4.5z" fill={hi} opacity=".55" />
    </g>
  );
}

function Broadleaf({ x, y, s = 1, c, hi }: { x: number; y: number; s?: number; c: string; hi: string }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <ellipse cx="0" cy="9" rx="7" ry="2.2" fill="rgba(0,0,0,.22)" />
      <rect x="-1.4" y="1" width="2.8" height="8" fill={INK} opacity=".55" />
      <circle cx="0" cy="-3" r="7.5" fill={c} />
      <circle cx="2.5" cy="-5.5" r="3.6" fill={hi} opacity=".55" />
    </g>
  );
}

function Sheep({ x, y, s = 1, wool }: { x: number; y: number; s?: number; wool: string }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <ellipse cx="0" cy="5.5" rx="8" ry="2" fill="rgba(0,0,0,.22)" />
      <path d="M-4.5 2v3.5M3.5 2v3.5" stroke={INK} strokeWidth="1.6" strokeLinecap="round" />
      <path d="M-7 -1a3 3 0 013-3.5 3.2 3.2 0 015.2-.8A3 3 0 0114 0a3 3 0 01-3 3H-4a3 3 0 01-3-4z" transform="translate(-3 0)" fill={wool} stroke="rgba(0,0,0,.25)" strokeWidth=".8" />
      <ellipse cx="7.8" cy="-1.5" rx="2.6" ry="2" fill={INK} />
    </g>
  );
}

function Tuft({ x, y, c, s = 1 }: { x: number; y: number; c: string; s?: number }) {
  return <path transform={`translate(${x} ${y}) scale(${s})`} d="M-4 2Q-3 -3-5 -6M0 2V-7M4 2Q3 -3 5 -6" stroke={c} strokeWidth="1.6" fill="none" strokeLinecap="round" />;
}

function Wheat({ x, y, c, s = 1 }: { x: number; y: number; c: string; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} fill={c}>
      <path d="M0 8V-8" stroke={c} strokeWidth="1.3" />
      {[-7, -3.5, 0].map((yy) => (
        <g key={yy}>
          <ellipse cx="-2" cy={yy} rx="1.4" ry="2.6" transform={`rotate(-28 -2 ${yy})`} />
          <ellipse cx="2" cy={yy} rx="1.4" ry="2.6" transform={`rotate(28 2 ${yy})`} />
        </g>
      ))}
      <ellipse cx="0" cy="-10" rx="1.3" ry="2.4" />
    </g>
  );
}

function TerrainArt({ terrain, fill, deco }: { terrain: Terrain; fill: string; deco: string }) {
  const hi = tint(deco, 0.35);
  const dark = tint(fill, -0.22);
  switch (terrain) {
    case 'forest':
      return (
        <g>
          <Conifer x={-20} y={-32} c={deco} hi={hi} />
          <Conifer x={2} y={-42} s={1.15} c={deco} hi={hi} />
          <Broadleaf x={23} y={-29} c={tint(deco, 0.12)} hi={hi} />
          <Conifer x={-38} y={2} s={0.9} c={deco} hi={hi} />
          <Conifer x={38} y={4} s={0.85} c={deco} hi={hi} />
          <Broadleaf x={-17} y={36} s={0.9} c={tint(deco, 0.12)} hi={hi} />
          <Conifer x={18} y={36} s={0.95} c={deco} hi={hi} />
        </g>
      );
    case 'field':
      return (
        <g>
          <g stroke={dark} strokeWidth="5" opacity=".55">
            {[-80, -62, -44, -26, -8, 10, 28, 46, 64].map((o) => (
              <line key={o} x1={o - 40} y1={-70} x2={o + 40} y2={70} />
            ))}
          </g>
          <Wheat x={-22} y={-34} c={deco} />
          <Wheat x={-14} y={-38} c={deco} s={0.9} />
          <Wheat x={20} y={-34} c={deco} />
          <Wheat x={2} y={-44} c={deco} s={0.85} />
          <Wheat x={-36} y={6} c={deco} s={0.9} />
          <Wheat x={36} y={6} c={deco} s={0.9} />
          <Wheat x={-8} y={38} c={deco} />
          <Wheat x={10} y={40} c={deco} s={0.9} />
        </g>
      );
    case 'pasture':
      return (
        <g>
          <Tuft x={-30} y={-26} c={dark} />
          <Tuft x={8} y={-46} c={dark} s={0.8} />
          <Tuft x={34} y={-12} c={dark} />
          <Tuft x={-38} y={24} c={dark} s={0.9} />
          <Tuft x={26} y={40} c={dark} s={0.9} />
          <Sheep x={-14} y={-36} wool={deco} />
          <Sheep x={24} y={-26} s={0.85} wool={deco} />
          <Sheep x={-30} y={4} s={0.8} wool={deco} />
          <Sheep x={-4} y={38} s={0.9} wool={deco} />
        </g>
      );
    case 'quarry':
      return (
        <g>
          <path d="M-46 -26L-30 -46L-12 -40L2 -54L22 -44L40 -28L46 -14L-46 -14z" fill={deco} />
          <path d="M-30 -46L-24 -14M2 -54L-2 -14M22 -44L18 -14" stroke={tint(deco, -0.3)} strokeWidth="1.4" />
          <path d="M-30 -46L-12 -40L-24 -14H-46V-26zM2 -54L22 -44L18 -14H-2z" fill={hi} opacity=".28" />
          <g stroke={INK} strokeOpacity=".35" strokeWidth="1">
            <rect x="-40" y="16" width="14" height="9" rx="1" fill={hi} />
            <rect x="-26" y="16" width="14" height="9" rx="1" fill={deco} />
            <rect x="-34" y="7" width="14" height="9" rx="1" fill={hi} />
            <rect x="22" y="26" width="15" height="9" rx="1" fill={deco} />
            <rect x="12" y="35" width="15" height="9" rx="1" fill={hi} />
            <rect x="27" y="35" width="13" height="9" rx="1" fill={deco} />
          </g>
        </g>
      );
    case 'mine':
      return (
        <g>
          <path d="M-52 -10L-22 -52L-6 -30L10 -58L48 -10z" fill={deco} />
          <path d="M-22 -52L-6 -30L-12 -10H-52zM10 -58L48 -10H18z" fill={tint(deco, -0.25)} />
          <path d="M-22 -52L-15 -42L-20 -38L-28 -44zM10 -58L19 -46L13 -42L8 -46L2 -44z" fill={tint(fill, 0.8)} />
          <path d="M20 46V34a8 8 0 0116 0v12z" fill={INK} opacity=".8" />
          <path d="M18 46V33a10 10 0 0120 0v13" fill="none" stroke={tint(deco, 0.3)} strokeWidth="2.4" />
          <path d="M-38 30h18M-36 30l-2 8M-22 30l2 8" stroke={INK} strokeOpacity=".5" strokeWidth="1.6" strokeLinecap="round" />
          <circle cx="-34" cy="40" r="2.4" fill={INK} opacity=".5" />
          <circle cx="-24" cy="40" r="2.4" fill={INK} opacity=".5" />
          <path d="M-39 30l3-5h14l3 5z" fill={tint(deco, -0.2)} />
        </g>
      );
    default:
      return (
        <g>
          <g fill={deco}>
            <path d="M-26 -18V-40a12 12 0 0124 0v4h-5v-4a7 7 0 00-14 0v22z" />
            <rect x="-30" y="-20" width="12" height="3" rx="1" />
            <rect x="-8" y="-38" width="8" height="3" rx="1" transform="rotate(-12 -4 -36)" />
            <circle cx="10" cy="-26" r="3" />
            <circle cx="16" cy="-22" r="2" />
          </g>
          <Tuft x={30} y={-30} c={tint(deco, -0.2)} />
          <Tuft x={-38} y={14} c={tint(deco, -0.2)} />
          <Tuft x={34} y={22} c={tint(deco, -0.2)} s={0.9} />
          <Tuft x={-6} y={42} c={tint(deco, -0.2)} />
          <ellipse cx="-22" cy="34" rx="5" ry="3" fill={tint(deco, -0.1)} />
          <ellipse cx="22" cy="40" rx="3.5" ry="2.2" fill={tint(deco, -0.1)} />
        </g>
      );
  }
}

export default function Board2D({ view, theme, highlights, onPick, lastBuilt }: BoardProps) {
  const { board } = view;
  const pal = theme.palette;
  const uid = useId().replace(/:/g, '');
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
  const hexPoints = (ids: number[], cx0 = 0, cy0 = 0, k = 1) =>
    ids.map((id) => {
      const p = V(id);
      return `${(cx0 + (p.x - cx0) * k).toFixed(1)},${(cy0 + (p.y - cy0) * k).toFixed(1)}`;
    }).join(' ');
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
  const gold = theme.ui.gold;
  const space = pal.stars;
  const hot = (n: number | null) => n === 6 || n === 8;

  let builtPos: { x: number; y: number } | null = null;
  if (lastBuilt) {
    if (lastBuilt.kind === 'vertex' && board.vertices[lastBuilt.id]) builtPos = V(lastBuilt.id);
    else if (lastBuilt.kind === 'edge' && board.edges[lastBuilt.id]) {
      const e = board.edges[lastBuilt.id];
      builtPos = { x: (V(e.a).x + V(e.b).x) / 2, y: (V(e.a).y + V(e.b).y) / 2 };
    }
  }

  // Deterministic star field for the space theme (sea replaced by void).
  const stars = useMemo(() => {
    if (!space) return [];
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    return Array.from({ length: 140 }, () => ({ x: vb.x - vb.w + rnd() * vb.w * 3, y: vb.y - vb.h + rnd() * vb.h * 3, r: 0.6 + rnd() * 1.6, o: 0.25 + rnd() * 0.6 }));
  }, [space, vb]);

  const id = (s: string) => `${uid}-${s}`;
  const ref = (s: string) => `url(#${id(s)})`;

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
      role="img"
      style={{
        background: space
          ? `radial-gradient(circle at 50% 45%, ${tint(pal.sea, 0.12)}, ${pal.backdrop} 70%)`
          : `radial-gradient(circle at 50% 46%, ${tint(pal.sea, 0.1)} 0%, ${pal.sea} 38%, ${tint(pal.backdrop, -0.35)} 100%)`,
      }}
    >
      <defs>
        <radialGradient id={id('light')} cx="35%" cy="25%" r="80%">
          <stop offset="0" stopColor="#fff" stopOpacity=".22" />
          <stop offset=".55" stopColor="#fff" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity=".18" />
        </radialGradient>
        <pattern id={id('waves')} width="46" height="26" patternUnits="userSpaceOnUse">
          <path d="M2 18q7-7 14 0t14 0M25 6q7-6 14 0" fill="none" stroke="#fff" strokeOpacity=".09" strokeWidth="1.6" strokeLinecap="round" />
        </pattern>
        <filter id={id('glow')} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="4" />
        </filter>
        <filter id={id('shadow')} x="-20%" y="-20%" width="140%" height="160%">
          <feDropShadow dx="0" dy="2.5" stdDeviation="1.6" floodColor="#000" floodOpacity=".45" />
        </filter>
      </defs>

      <g transform={`translate(${cx + tf.x} ${cy + tf.y}) scale(${tf.k}) translate(${-cx} ${-cy})`}>
        {/* sea surface or star field */}
        {space ? (
          <g fill="#fff">
            {stars.map((s, i) => (
              <circle key={i} cx={s.x} cy={s.y} r={s.r} opacity={s.o} />
            ))}
          </g>
        ) : (
          <rect x={vb.x - vb.w} y={vb.y - vb.h} width={vb.w * 3} height={vb.h * 3} fill={ref('waves')} />
        )}

        {/* coast: foam, sand, then the slab under the tiles */}
        {!space && (
          <g fill="none" stroke="#fff" strokeLinejoin="round" opacity=".16">
            {board.hexes.map((h) => (
              <polygon key={h.id} points={hexPoints(h.vertices)} strokeWidth="58" />
            ))}
          </g>
        )}
        <g fill={pal.base} stroke={space ? tint(pal.base, 0.15) : pal.base} strokeWidth="30" strokeLinejoin="round">
          {board.hexes.map((h) => (
            <polygon key={h.id} points={hexPoints(h.vertices)} />
          ))}
        </g>
        {space && (
          <g fill="none" stroke={gold} strokeWidth="3" strokeLinejoin="round" opacity=".5" filter={ref('glow')}>
            {board.hexes.map((h) => (
              <polygon key={h.id} points={hexPoints(h.vertices)} strokeWidth="32" />
            ))}
          </g>
        )}
        <g fill={tint(pal.base, -0.3)}>
          {board.hexes.map((h) => (
            <polygon key={h.id} points={hexPoints(h.vertices)} />
          ))}
        </g>

        {/* tiles */}
        {board.hexes.map((h) => {
          const fill = pal.terrain[h.terrain];
          const hx = h.x * S;
          const hy = h.y * S;
          const pts = hexPoints(h.vertices, hx, hy, 0.955);
          return (
            <g key={h.id}>
              <polygon points={pts} fill={fill} stroke={space ? tint(fill, 0.45) : tint(fill, -0.38)} strokeWidth={space ? 2 : 2.4} strokeLinejoin="round" />
              <clipPath id={id(`hex${h.id}`)}>
                <polygon points={pts} />
              </clipPath>
              <g clipPath={ref(`hex${h.id}`)}>
                <g transform={`translate(${hx} ${hy})${h.id % 2 ? ' scale(-1 1)' : ''}`}>
                  <TerrainArt terrain={h.terrain} fill={fill} deco={pal.deco[h.terrain]} />
                </g>
                <polygon points={pts} fill={ref('light')} />
              </g>
              <polygon points={hexPoints(h.vertices, hx, hy, 0.9)} fill="none" stroke="#fff" strokeOpacity={space ? 0.12 : 0.16} strokeWidth="1.4" strokeLinejoin="round" />
              {h.number !== null && (
                <g transform={`translate(${hx} ${hy + 4})`} filter={ref('shadow')}>
                  <circle r="19.5" fill={tint(gold, -0.45)} />
                  <circle r="18" fill={pal.token} stroke={gold} strokeWidth="2.6" />
                  <circle r="14.6" fill="none" stroke={gold} strokeOpacity=".55" strokeWidth=".8" />
                  <text y="5.5" textAnchor="middle" fontSize={hot(h.number) ? 20 : 18} fontWeight="800" fill={hot(h.number) ? pal.tokenHot : pal.tokenInk}>
                    {h.number}
                  </text>
                  <g fill={hot(h.number) ? pal.tokenHot : pal.tokenInk}>
                    {Array.from({ length: pips(h.number) }, (_, i) => (
                      <circle key={i} cx={(i - (pips(h.number!) - 1) / 2) * 3.8} cy="11" r="1.25" />
                    ))}
                  </g>
                </g>
              )}
            </g>
          );
        })}

        {/* roads: paved strips */}
        {Object.entries(view.roads).map(([eid, seat]) => {
          const l = edgeLine(Number(eid), 0.17);
          const c = colorOf(seat);
          return (
            <g key={eid} strokeLinecap="round">
              <line {...l} stroke={INK} strokeWidth="11.5" />
              <line {...l} stroke={c} strokeWidth="7.5" />
              <line {...l} stroke={tint(c, 0.38)} strokeWidth="1.6" strokeDasharray="3 3.6" />
            </g>
          );
        })}

        {/* bandit: a hooded rider of the steppe */}
        {board.hexes[view.bandit] && (
          <g transform={`translate(${board.hexes[view.bandit].x * S + 30} ${board.hexes[view.bandit].y * S + 2})`} filter={ref('shadow')}>
            <ellipse cx="0" cy="15" rx="11" ry="3" fill="rgba(0,0,0,.4)" />
            <path d="M-10 15Q-11 -1 0 -5Q11 -1 10 15Z" fill={pal.bandit} stroke={tint(pal.bandit, 0.35)} strokeWidth="1.4" />
            <path d="M-7.5 -9a7.5 7.5 0 0115 0q0 5-7.5 7.5Q-7.5 -4-7.5 -9z" fill={pal.bandit} stroke={tint(pal.bandit, 0.35)} strokeWidth="1.4" />
            <path d="M-4.2 -9.5h8.4" stroke={pal.tokenHot} strokeWidth="2.4" strokeLinecap="round" />
            <path d="M-9.5 4.5Q0 8 9.5 4.5" stroke={pal.tokenHot} strokeWidth="2.6" fill="none" />
          </g>
        )}

        {/* buildings */}
        {Object.entries(view.buildings).map(([vid, b]) => {
          const p = V(Number(vid));
          return (
            <g key={vid} transform={`translate(${p.x} ${p.y})`}>
              <PieceShape kind={b.kind} color={colorOf(b.owner)} gold={gold} />
            </g>
          );
        })}

        {builtPos && <circle className="lastbuilt" cx={builtPos.x} cy={builtPos.y} r="20" fill="none" stroke={gold} strokeWidth="4" />}

        {/* pick markers: leaf rings glowing on the ground */}
        {highlights.hexes.map((hid) => {
          const h = board.hexes[hid];
          if (!h) return null;
          return (
            <g key={`h${hid}`} className="pick" onClick={pick('hex', hid)}>
              <polygon points={hexPoints(h.vertices)} fill="transparent" />
              <g className="ring">
                <circle cx={h.x * S} cy={h.y * S + 4} r="31" fill="none" stroke={gold} strokeWidth="14" opacity=".22" />
                <circle cx={h.x * S} cy={h.y * S + 4} r="31" fill={gold} fillOpacity=".12" stroke={gold} strokeWidth="3.2" />
              </g>
            </g>
          );
        })}
        {highlights.edges.map((eid) => {
          if (!board.edges[eid]) return null;
          const l = edgeLine(eid, 0.22);
          return (
            <g key={`e${eid}`} className="pick" strokeLinecap="round" onClick={pick('edge', eid)}>
              <line {...edgeLine(eid, 0.08)} stroke="transparent" strokeWidth="34" />
              <g className="ring">
                <line {...l} stroke={gold} strokeWidth="18" opacity=".2" />
                <line {...l} stroke={gold} strokeWidth="11" opacity=".3" />
                <line {...l} stroke={tint(gold, -0.5)} strokeWidth="8" opacity=".6" />
                <line {...l} stroke={gold} strokeWidth="4.5" />
              </g>
            </g>
          );
        })}
        {highlights.vertices.map((vid) => {
          if (!board.vertices[vid]) return null;
          const p = V(vid);
          return (
            <g key={`v${vid}`} className="pick" onClick={pick('vertex', vid)}>
              <circle cx={p.x} cy={p.y} r="25" fill="transparent" />
              <g className="ring">
                <circle cx={p.x} cy={p.y} r="13" fill="none" stroke={gold} strokeWidth="12" opacity=".22" />
                <circle cx={p.x} cy={p.y} r="11" fill={tint(gold, -0.6)} fillOpacity=".55" stroke={gold} strokeWidth="3.4" />
                <circle cx={p.x} cy={p.y} r="3.2" fill={gold} />
              </g>
            </g>
          );
        })}
      </g>
    </svg>
  );
}
