import type { BuildingKind } from '@kervan/shared';
import { tint } from '../themes';

export const INK = '#141a2a';

/**
 * Player pieces as small SVG drawings centred on a board corner (≈ 30 units wide).
 * Outpost = yurt tent, keep = crenellated tower, market = domed bazaar. Player colour + gold trim.
 */
export function PieceShape({ kind, color, gold }: { kind: BuildingKind; color: string; gold: string }) {
  const hi = tint(color, 0.22);
  const lo = tint(color, -0.28);
  const line = { stroke: INK, strokeWidth: 1.7, strokeLinejoin: 'round' as const };
  if (kind === 'outpost') {
    return (
      <g>
        <ellipse cx="0" cy="9" rx="13" ry="3.2" fill="rgba(0,0,0,.35)" />
        <path d="M-11 8.5V-.5c0-1.5 1-2.5 2.5-2.5h17c1.5 0 2.5 1 2.5 2.5v9z" fill={color} {...line} />
        <path d="M-12.5 -1.5Q-6 -14 0 -14.5Q6 -14 12.5 -1.5z" fill={hi} {...line} />
        <path d="M-6 -9.5Q0 -11.5 6 -9.5" stroke={lo} strokeWidth="1.2" fill="none" />
        <path d="M-11 1.2h22" stroke={gold} strokeWidth="1.8" />
        <path d="M-3.2 8.5V4.2Q0 1.2 3.2 4.2v4.3z" fill={INK} opacity=".7" />
        <circle cx="0" cy="-14.6" r="2" fill={gold} stroke={INK} strokeWidth=".9" />
      </g>
    );
  }
  if (kind === 'keep') {
    return (
      <g>
        <ellipse cx="0" cy="12" rx="13" ry="3.2" fill="rgba(0,0,0,.35)" />
        <path d="M-9 11.5V-7h18v18.5z" fill={color} {...line} />
        <path d="M9 -7v18.5" stroke={lo} strokeWidth="3" />
        <path d="M-11.5 -6V-15h5v3.6h4.2V-15h4.6v3.6h4.2V-15h5V-6z" fill={hi} {...line} />
        <path d="M-9.5 -5.2h19" stroke={gold} strokeWidth="2" />
        <rect x="-1.2" y="-2.4" width="2.4" height="5" rx="1.2" fill={INK} opacity=".8" />
        <path d="M-3.6 11.5V6.6a3.6 3.6 0 017.2 0v4.9z" fill={INK} opacity=".72" />
      </g>
    );
  }
  return (
    <g>
      <ellipse cx="0" cy="11" rx="17" ry="3.4" fill="rgba(0,0,0,.35)" />
      <path d="M-14.5 10.5V-1h29v11.5z" fill={color} {...line} />
      <path d="M-14.5 -1a3.6 3.6 0 017.2 0zM7.3 -1a3.6 3.6 0 017.2 0z" fill={hi} {...line} />
      <path d="M-6.5 -1v-3.4h13V-1z" fill={color} {...line} />
      <path d="M-7.6 -4.4a7.6 7.6 0 0115.2 0z" fill={hi} {...line} />
      <path d="M-14.5 1.2h29" stroke={gold} strokeWidth="1.8" />
      {[-8.5, 0, 8.5].map((x) => (
        <path key={x} d={`M${x - 2.6} 10.5V6.2a2.6 2.6 0 015.2 0v4.3z`} fill={INK} opacity=".7" />
      ))}
      <path d="M0 -12v-3" stroke={gold} strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="0" cy="-16" r="1.7" fill={gold} stroke={INK} strokeWidth=".8" />
    </g>
  );
}

/** A piece drawn standalone, e.g. in the build dialog. `kind: 'road'` draws a paved strip. */
export function PieceIcon({ kind, color, gold, size = 36 }: { kind: BuildingKind | 'road'; color: string; gold: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="-18 -19 36 36" aria-hidden>
      {kind === 'road' ? (
        <g transform="rotate(-30)" strokeLinecap="round">
          <line x1="-13" y1="0" x2="13" y2="0" stroke={INK} strokeWidth="9.5" />
          <line x1="-13" y1="0" x2="13" y2="0" stroke={color} strokeWidth="6" />
          <line x1="-11" y1="0" x2="11" y2="0" stroke={tint(color, 0.35)} strokeWidth="1.6" strokeDasharray="3 3.4" />
        </g>
      ) : (
        <PieceShape kind={kind} color={color} gold={gold} />
      )}
    </svg>
  );
}
