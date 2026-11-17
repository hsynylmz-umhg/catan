import type { ReactNode } from 'react';
import { COSTS, RESOURCES, type Buyable, type Resource, type ResourceBag } from '@kervan/shared';

const RES_GLYPH: Record<Resource, ReactNode> = {
  // stacked logs
  timber: (
    <>
      <rect x="5" y="13.5" width="14" height="4.6" rx="2.3" />
      <rect x="7" y="7.5" width="12" height="4.6" rx="2.3" />
      <circle cx="7.4" cy="15.8" r="1" fill="rgba(0,0,0,.35)" />
      <circle cx="9.4" cy="9.8" r="1" fill="rgba(0,0,0,.35)" />
    </>
  ),
  // masonry blocks
  stone: (
    <>
      <rect x="5" y="6.5" width="6.4" height="4.8" rx="1" />
      <rect x="12.6" y="6.5" width="6.4" height="4.8" rx="1" />
      <rect x="8.8" y="12.7" width="6.4" height="4.8" rx="1" />
    </>
  ),
  // ear of grain
  grain: (
    <>
      <rect x="11.3" y="6" width="1.4" height="13" rx=".7" />
      <ellipse cx="9" cy="8.5" rx="2.4" ry="1.3" transform="rotate(35 9 8.5)" />
      <ellipse cx="15" cy="8.5" rx="2.4" ry="1.3" transform="rotate(-35 15 8.5)" />
      <ellipse cx="9" cy="12.5" rx="2.4" ry="1.3" transform="rotate(35 9 12.5)" />
      <ellipse cx="15" cy="12.5" rx="2.4" ry="1.3" transform="rotate(-35 15 12.5)" />
      <ellipse cx="12" cy="5.4" rx="1.3" ry="2" />
    </>
  ),
  // spool of thread
  fiber: (
    <>
      <rect x="6" y="5.5" width="12" height="2.4" rx="1.2" />
      <rect x="6" y="16.1" width="12" height="2.4" rx="1.2" />
      <rect x="8" y="8.6" width="8" height="1.5" rx=".7" />
      <rect x="8" y="11.2" width="8" height="1.5" rx=".7" />
      <rect x="8" y="13.8" width="8" height="1.5" rx=".7" />
    </>
  ),
  // ingot
  ore: (
    <>
      <path d="M8.5 8h7l3.5 8.5h-14z" />
      <path d="M9.6 9.6h4.8l.9 2.2H8.7z" fill="rgba(0,0,0,.28)" />
    </>
  ),
};

export function ResIcon({ res, size = 26 }: { res: Resource; size?: number }) {
  return (
    <svg className="res-icon" width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <rect x="1" y="1" width="22" height="22" rx="7" fill={`var(--res-${res})`} />
      <rect x="1.6" y="1.6" width="20.8" height="20.8" rx="6.4" fill="none" stroke="rgba(255,255,255,.35)" strokeWidth="1" />
      <g fill="#fff">{RES_GLYPH[res]}</g>
    </svg>
  );
}

/** Row of small resource icons with counts, e.g. for costs and trade summaries. */
export function BagView({ bag, size = 20, empty = '—' }: { bag: Partial<ResourceBag>; size?: number; empty?: string }) {
  const items = RESOURCES.filter((r) => (bag[r] ?? 0) > 0);
  if (items.length === 0) return <span className="bag muted">{empty}</span>;
  return (
    <span className="bag">
      {items.map((r) => (
        <span key={r} className="bag-item">
          <ResIcon res={r} size={size} />
          <b>{bag[r]}</b>
        </span>
      ))}
    </span>
  );
}

export function CostView({ item, size = 18 }: { item: Buyable; size?: number }) {
  return <BagView bag={COSTS[item]} size={size} />;
}

const ICONS = {
  star: <path d="M12 2.8l2.7 5.9 6.4.7-4.8 4.3 1.4 6.3L12 16.8 6.3 20l1.4-6.3L2.9 9.4l6.4-.7z" />,
  hand: (
    <>
      <rect x="4" y="6" width="9" height="13" rx="1.6" transform="rotate(-10 8.5 12.5)" />
      <rect x="11" y="5" width="9" height="13" rx="1.6" transform="rotate(10 15.5 11.5)" opacity=".7" />
    </>
  ),
  scroll: <path d="M6 4h11a2 2 0 012 2v10h-3v2a2 2 0 01-2 2H5a2 2 0 01-2-2v-1h10V6a2 2 0 00-2-2H8v9H6zm3 3h2v1.5H9zm0 3h2v1.5H9z" />,
  shield: <path d="M12 2.5l8 3v6c0 5-3.4 8.6-8 10-4.6-1.400-8-5-8-10v-6z" />,
  route: <path d="M5 4a2.500 2.500 0 110 5 2.500 2.500 0 010-5zm14 11a2.500 2.500 0 110 5 2.500 2.500 0 010-5zM6 10.500h7.500a2.500 2.500 0 010 5H10v2h3.500a4.500 4.500 0 000-9H6z" />,
  menu: <path d="M3 5.500h18v2.400H3zm0 5.300h18v2.400H3zm0 5.300h18v2.400H3z" />,
  chat: <path d="M4 4h16a1.500 1.500 0 011.500 1.500v10A1.500 1.500 0 0120 17h-8l-5 4v-4H4a1.500 1.500 0 01-1.500-1.500v-10A1.500 1.500 0 014 4z" />,
  cube: <path d="M12 2l9 5v10l-9 5-9-5V7zm0 2.300L5.600 7.900 12 11.500l6.400-3.600zM5 9.600v6.200l6 3.300v-6.100zm14 0l-6 3.400v6.100l6-3.300z" />,
  flat: <path d="M12 3l7.800 4.500v9L12 21l-7.800-4.500v-9zm0 2.300L6.200 8.600v6.800l5.800 3.300 5.800-3.300V8.600z" />,
  soundOn: <path d="M4 9h4l5-4v14l-5-4H4zm11.500-1.200a6 6 0 010 8.400l-1.300-1.300a4.200 4.200 0 000-5.800zm2.600-2.600a9.700 9.700 0 010 13.600l-1.300-1.300a7.900 7.900 0 000-11z" />,
  soundOff: <path d="M4 9h4l5-4v14l-5-4H4zm11.300.300l1.700 1.700 1.700-1.700 1.300 1.300-1.700 1.700 1.700 1.700-1.300 1.300-1.700-1.700-1.700 1.700-1.300-1.300 1.700-1.700-1.700-1.700z" />,
  copy: <path d="M8 3h11a1.500 1.500 0 011.500 1.500V17H18V5.500H8zM4.500 7H15a1.500 1.500 0 011.500 1.500v11A1.500 1.500 0 0115 21H4.500A1.500 1.500 0 013 19.500v-11A1.500 1.500 0 014.500 7z" />,
  share: <path d="M17.500 2.500a3 3 0 11-2.800 4.100l-5.900 3.200a3 3 0 010 2.400l5.900 3.200a3 3 0 11-.900 1.600l-5.900-3.200a3 3 0 110-5.600l5.900-3.200a3 3 0 013.700-2.500z" />,
  pause: <path d="M6 4h4.500v16H6zm7.500 0H18v16h-4.500z" />,
  play: <path d="M7 4l13 8-13 8z" />,
  close: <path d="M6.300 4.900L12 10.600l5.700-5.700 1.400 1.400L13.400 12l5.700 5.700-1.400 1.400L12 13.400l-5.700 5.700-1.400-1.400L10.600 12 4.900 6.300z" />,
  swords: <path d="M4 3h3.500l6.200 6.200-2.500 2.500L5 5.500zm16 0v2.500l-9.700 9.700 1.700 1.700-1.400 1.400-2-2L6 18.900 5.100 18l2.600-2.600-2-2 1.400-1.400 1.700 1.700L18.500 4 20 3zm-4.300 11.200l1.700-1.700 1.400 1.400-2 2L19.400 18.500l-.9.900-2.600-2.600-2 2-1.400-1.400 1.700-1.700z" />,
  home: <path d="M12 3l9 8h-2.500v9h-5v-6h-3v6h-5v-9H3z" />,
} as const;

export type IcoName = keyof typeof ICONS;

export function Ico({ name, size = 18 }: { name: IcoName; size?: number }) {
  return (
    <svg className="ico" width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      {ICONS[name]}
    </svg>
  );
}
