import type { ReactNode } from 'react';
import { COSTS, RESOURCES, type Buyable, type Resource, type ResourceBag } from '@kervan/shared';

/* Resource emblems, drawn on a 32-unit grid. `HI` is the ivory face, `LO` the carved detail.
   The surrounding colour always comes from the theme (--res-*), so every theme reads its own palette. */
const HI = 'var(--emblem-hi, #f6edd9)';
const LO = 'rgba(8, 14, 28, .5)';

const EMBLEM: Record<Resource, ReactNode> = {
  // three logs stacked, end grain facing us
  timber: (
    <>
      {[
        [10.5, 21.5],
        [21.5, 21.5],
        [16, 12],
      ].map(([x, y]) => (
        <g key={`${x}${y}`}>
          <circle cx={x} cy={y} r="5.6" fill={HI} stroke={LO} strokeWidth="1.1" />
          <circle cx={x} cy={y} r="3.2" fill="none" stroke={LO} strokeWidth=".9" />
          <circle cx={x} cy={y} r="1" fill={LO} />
        </g>
      ))}
      <path d="M20.5 7.2c1.6-2.6 4.3-3.4 6.4-2.6-.5 2.4-2.9 3.9-5.6 3.6" fill={HI} />
    </>
  ),
  // dressed ashlar blocks in running bond
  stone: (
    <>
      <path d="M4.5 18.5h11v8h-11zM16.5 18.5h11v8h-11zM10 9.5h12v8H10z" fill={HI} stroke={LO} strokeWidth="1.1" strokeLinejoin="round" />
      <path d="M10 9.5h12l-1.5 2H11.5z M4.5 18.5h11l-1.4 1.8H5.9z M16.5 18.5h11l-1.4 1.8h-8.2z" fill="rgba(255,255,255,.55)" />
      <path d="M7.5 23.5l2.5-1.2M20 23l3-1.4M14 14.5l3.2-1.4" stroke={LO} strokeWidth=".9" strokeLinecap="round" />
    </>
  ),
  // a tied sheaf of three stalks
  grain: (
    <>
      <path d="M16 27V9M16 22l-6.5-11M16 22l6.5-11" stroke={HI} strokeWidth="1.6" strokeLinecap="round" fill="none" />
      {[
        [16, 5.5, 0],
        [16, 9, 0],
        [16, 12.5, 0],
        [9, 8, -30],
        [8.2, 11.4, -30],
        [23, 8, 30],
        [23.8, 11.4, 30],
      ].map(([x, y, r]) => (
        <ellipse key={`${x}${y}`} cx={x} cy={y} rx="2" ry="3.1" transform={`rotate(${r} ${x} ${y})`} fill={HI} stroke={LO} strokeWidth=".7" />
      ))}
      <rect x="12.6" y="19.5" width="6.8" height="3" rx="1.2" fill={LO} />
    </>
  ),
  // a ball of spun wool with a loose end
  fiber: (
    <>
      <circle cx="15" cy="16" r="9.5" fill={HI} stroke={LO} strokeWidth="1.1" />
      <path d="M7.4 12.5c4.5 1.2 10.6 1 15.6-2.2M6.2 17.6c5.7 1.4 12.3.8 17.8-3.2M8.6 22.6c5 .5 10.3-.8 14.2-4.6M12 7c-1.8 5.2-1.6 12.4 1.4 18.4" stroke={LO} strokeWidth=".95" fill="none" strokeLinecap="round" />
      <path d="M23.5 21.5c2.4 1.2 3.4 3.2 3 5.5" stroke={HI} strokeWidth="1.6" fill="none" strokeLinecap="round" />
    </>
  ),
  // two cast ingots
  ore: (
    <>
      <path d="M5 25.5h22l-3.2-7.5H8.2z" fill={HI} stroke={LO} strokeWidth="1.1" strokeLinejoin="round" />
      <path d="M9.5 16.5h13l-2.6-7H12.1z" fill={HI} stroke={LO} strokeWidth="1.1" strokeLinejoin="round" />
      <path d="M8.2 18h15.6l-.8-1.5H9z" fill={LO} opacity=".5" />
      <path d="M13 11.5l1.6 3M17 20.5l1.4 3" stroke="rgba(255,255,255,.9)" strokeWidth="1.1" strokeLinecap="round" />
    </>
  ),
};

/** The resource emblem alone, sized to its box (used on resource cards). */
export function ResEmblem({ res, size = 32 }: { res: Resource; size?: number }) {
  return (
    <svg className="res-emblem" width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      {EMBLEM[res]}
    </svg>
  );
}

/** Round resource token: theme colour, gold hairline rim, ivory emblem. */
export function ResIcon({ res, size = 26 }: { res: Resource; size?: number }) {
  return (
    <svg className="res-icon" width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      <circle cx="16" cy="16" r="15.2" fill={`var(--res-${res})`} />
      <circle cx="16" cy="16" r="15.2" fill="none" stroke="var(--gold)" strokeOpacity=".75" strokeWidth="1.2" />
      <circle cx="16" cy="16" r="13.4" fill="none" stroke="rgba(0,0,0,.28)" strokeWidth="1" />
      <g transform="translate(16 16.4) scale(.74) translate(-16 -16)">{EMBLEM[res]}</g>
    </svg>
  );
}

/** Row of small resource tokens with counts, e.g. for costs and trade summaries. */
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

/** Seljuk eight-point star (two interlaced squares), the house ornament. */
export const STAR8 = 'M22 12l-2.9 2.9v4.2h-4.2L12 22l-2.9-2.9H4.9v-4.2L2 12l2.9-2.9V4.9h4.2L12 2l2.9 2.9h4.2v4.2z';

export function Star8({ size = 14, className }: { size?: number; className?: string }) {
  return (
    <svg className={`star8${className ? ` ${className}` : ''}`} width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <path d={STAR8} fill="currentColor" />
      <path d={STAR8} transform="translate(12 12) scale(.46) translate(-12 -12)" fill="var(--star-core, rgba(0,0,0,.35))" />
    </svg>
  );
}

const ICONS = {
  star: <path d={STAR8} />,
  hand: (
    <>
      <rect x="4" y="6" width="9" height="13" rx="1.6" transform="rotate(-10 8.5 12.5)" />
      <rect x="11" y="5" width="9" height="13" rx="1.6" transform="rotate(10 15.5 11.5)" opacity=".7" />
    </>
  ),
  scroll: <path d="M6 4h11a2 2 0 012 2v10h-3v2a2 2 0 01-2 2H5a2 2 0 01-2-2v-1h10V6a2 2 0 00-2-2H8v9H6zm3 3h2v1.5H9zm0 3h2v1.5H9z" />,
  shield: <path d="M12 2.5l8 3v6c0 5-3.4 8.6-8 10-4.6-1.4-8-5-8-10v-6z" />,
  route: <path d="M5 4a2.5 2.5 0 110 5 2.5 2.5 0 010-5zm14 11a2.5 2.5 0 110 5 2.5 2.5 0 010-5zM6 10.5h7.5a2.5 2.5 0 010 5H10v2h3.5a4.5 4.5 0 000-9H6z" />,
  menu: <path d="M3 5.5h18v2.4H3zm0 5.3h18v2.4H3zm0 5.3h18v2.4H3z" />,
  chat: <path d="M4 4h16a1.5 1.5 0 011.5 1.5v10A1.5 1.5 0 0120 17h-8l-5 4v-4H4a1.5 1.5 0 01-1.5-1.5v-10A1.5 1.5 0 014 4z" />,
  cube: <path d="M12 2l9 5v10l-9 5-9-5V7zm0 2.3L5.6 7.9 12 11.5l6.4-3.6zM5 9.6v6.2l6 3.3v-6.1zm14 0l-6 3.4v6.1l6-3.3z" />,
  flat: <path d="M12 3l7.8 4.5v9L12 21l-7.8-4.5v-9zm0 2.3L6.2 8.6v6.8l5.8 3.3 5.8-3.3V8.6z" />,
  soundOn: <path d="M4 9h4l5-4v14l-5-4H4zm11.5-1.2a6 6 0 010 8.4l-1.3-1.3a4.2 4.2 0 000-5.8zm2.6-2.6a9.7 9.7 0 010 13.6l-1.3-1.3a7.9 7.9 0 000-11z" />,
  soundOff: <path d="M4 9h4l5-4v14l-5-4H4zm11.3.3l1.7 1.7 1.7-1.7 1.3 1.3-1.7 1.7 1.7 1.7-1.3 1.3-1.7-1.7-1.7 1.7-1.3-1.3 1.7-1.7-1.7-1.7z" />,
  copy: <path d="M8 3h11a1.5 1.5 0 011.5 1.5V17H18V5.5H8zM4.5 7H15a1.5 1.5 0 011.5 1.5v11A1.5 1.5 0 0115 21H4.5A1.5 1.5 0 013 19.5v-11A1.5 1.5 0 014.5 7z" />,
  share: <path d="M17.5 2.5a3 3 0 11-2.8 4.1l-5.9 3.2a3 3 0 010 2.4l5.9 3.2a3 3 0 11-.9 1.6l-5.9-3.2a3 3 0 110-5.6l5.9-3.2a3 3 0 013.7-2.5z" />,
  pause: <path d="M6 4h4.5v16H6zm7.5 0H18v16h-4.5z" />,
  play: <path d="M7 4l13 8-13 8z" />,
  close: <path d="M6.3 4.9L12 10.6l5.7-5.7 1.4 1.4L13.4 12l5.7 5.7-1.4 1.4L12 13.4l-5.7 5.7-1.4-1.4L10.6 12 4.9 6.3z" />,
  swords: <path d="M4 3h3.5l6.2 6.2-2.5 2.5L5 5.5zm16 0v2.5l-9.7 9.7 1.7 1.7-1.4 1.4-2-2L6 18.9 5.1 18l2.6-2.6-2-2 1.4-1.4 1.7 1.7L18.5 4 20 3zm-4.3 11.2l1.7-1.7 1.4 1.4-2 2 2.6 2.6-.9.9-2.6-2.6-2 2-1.4-1.4 1.7-1.7z" />,
  home: <path d="M12 3l9 8h-2.5v9h-5v-6h-3v6h-5v-9H3z" />,
  // mason's hammer
  build: <path d="M13.6 3.2l6.9 6.9-2.3 2.3-1.6-1.6-1.4 1.4-1.9-1.9-8.1 8.1a1.6 1.6 0 01-2.3 0l-.3-.3a1.6 1.6 0 010-2.3l8.1-8.1-1.9-1.9 1.4-1.4-1.1-1.1z" />,
  // balance scale
  bank: <path d="M11 3h2v2.1l6.2 1.6.4.1L22 13c0 1.9-1.6 3-3.5 3S15 14.9 15 13l2.2-5.3L13 6.6V19h4v2H7v-2h4V6.6L6.8 7.7 9 13c0 1.9-1.6 3-3.5 3S2 14.9 2 13l2.4-6.2.4-.1L11 5.1zM5.5 9.2L4.1 12.7h2.8zm13 0l-1.4 3.5h2.8z" />,
  // two hands of the market: a swap
  trade: <path d="M7 3l4 4-4 4V8H4V6h3zm10 10v3h3v2h-3v3l-4-4zM13 6h3.5A3.5 3.5 0 0120 9.5V12h-2V9.5A1.5 1.5 0 0016.5 8H13zM4 12h2v2.5A1.5 1.5 0 007.5 16H11v2H7.5A3.5 3.5 0 014 14.5z" />,
  dice: <path d="M6 3h12a3 3 0 013 3v12a3 3 0 01-3 3H6a3 3 0 01-3-3V6a3 3 0 013-3zm2 3.5a1.5 1.5 0 100 3 1.5 1.5 0 000-3zm8 8a1.5 1.5 0 100 3 1.5 1.5 0 000-3zm-4-4a1.5 1.5 0 100 3 1.5 1.5 0 000-3z" />,
  // hourglass: end of turn
  end: <path d="M6 2h12v2h-1v2.6a5 5 0 01-2.4 4.3L13.4 12l1.2.7A5 5 0 0117 17.1V20h1v2H6v-2h1v-2.9a5 5 0 012.4-4.3l1.2-.8-1.2-.7A5 5 0 017 6.6V4H6zm3 2v2.6c0 1 .5 1.9 1.4 2.5L12 10l1.6-.9c.9-.6 1.4-1.5 1.4-2.5V4zm3 10l-1.6 1c-.9.5-1.4 1.4-1.4 2.4V20h6v-2.6c0-1-.5-1.9-1.4-2.4z" />,
  crown: <path d="M3 7l4.5 4L12 4l4.5 7L21 7l-1.8 11H4.8zm2 13h14v2H5z" />,
  palette: <path d="M12 3a9 9 0 000 18c1.4 0 2-.9 2-1.8 0-.5-.2-.9-.5-1.3-.3-.4-.5-.8-.5-1.3 0-1 .8-1.6 1.8-1.6H17a4 4 0 004-4C21 6.6 17 3 12 3zM6.5 12a1.5 1.5 0 110-3 1.5 1.5 0 010 3zm3-4a1.5 1.5 0 110-3 1.5 1.5 0 010 3zm5 0a1.5 1.5 0 110-3 1.5 1.5 0 010 3zm3 4a1.5 1.5 0 110-3 1.5 1.5 0 010 3z" />,
  link: <path d="M10.6 13.4a1 1 0 010-1.4l3.5-3.5a1 1 0 111.4 1.4L12 13.4a1 1 0 01-1.4 0zM8.5 20.5a4.5 4.5 0 01-3.2-7.7l2.5-2.5 1.4 1.4-2.5 2.5a2.5 2.5 0 003.5 3.5l2.5-2.5 1.4 1.4-2.5 2.5a4.5 4.5 0 01-3.1 1.4zm7.7-6.8l-1.4-1.4 2.5-2.5a2.5 2.5 0 00-3.5-3.5L11.3 8.8 9.9 7.4l2.5-2.5a4.5 4.5 0 016.4 6.4z" />,
} as const;

export type IcoName = keyof typeof ICONS;

export function Ico({ name, size = 18 }: { name: IcoName; size?: number }) {
  return (
    <svg className="ico" width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      {ICONS[name]}
    </svg>
  );
}
