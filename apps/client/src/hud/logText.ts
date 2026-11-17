import { RESOURCES, type GameEvent, type PlayerView, type ResourceBag } from '@kervan/shared';
import type { TFn } from '../i18n';
import type { Names } from '../hooks';

export function bagText(bag: Partial<ResourceBag>, names: Names): string {
  return RESOURCES.filter((r) => (bag[r] ?? 0) > 0)
    .map((r) => `${bag[r]} ${names.res(r)}`)
    .join(', ');
}

/** Localized one-line description of a game event. `seat` is the main actor (for the colour dot). */
export function eventLine(
  ev: GameEvent,
  view: PlayerView | null,
  t: TFn,
  names: Names,
): { text: string; seat: number | null; strong?: boolean } {
  const nameOf = (seat: number) => view?.players.find((p) => p.seat === seat)?.name ?? `#${seat + 1}`;
  switch (ev.type) {
    case 'rolled':
      return { seat: ev.seat, text: t('ev.rolled', { name: nameOf(ev.seat), a: ev.dice[0], b: ev.dice[1], sum: ev.dice[0] + ev.dice[1] }) };
    case 'produced': {
      const parts = Object.entries(ev.gains)
        .map(([seat, bag]) => ({ seat: Number(seat), txt: bagText(bag, names) }))
        .filter((p) => p.txt)
        .map((p) => `${nameOf(p.seat)}: ${p.txt}`);
      return { seat: null, text: parts.length ? t('ev.produced', { list: parts.join('; ') }) : t('ev.producedNone') };
    }
    case 'tribute':
      return { seat: ev.seat, text: t('ev.tribute', { name: nameOf(ev.seat), list: ev.resources.map((r) => names.res(r)).join(', ') }) };
    case 'banditMoved': {
      const hex = view?.board.hexes[ev.hex];
      return {
        seat: ev.seat,
        text: t('ev.banditMoved', {
          name: nameOf(ev.seat),
          bandit: names.bandit,
          terrain: hex ? names.terrain(hex.terrain) + (hex.number ? ` ${hex.number}` : '') : '?',
        }),
      };
    }
    case 'stole':
      return { seat: ev.seat, text: t('ev.stole', { name: nameOf(ev.seat), victim: nameOf(ev.victim) }) };
    case 'built':
      return { seat: ev.seat, text: t('ev.built', { name: nameOf(ev.seat), piece: names.piece(ev.kind) }) };
    case 'boughtCard':
      return { seat: ev.seat, text: t('ev.boughtCard', { name: nameOf(ev.seat), decree: names.decree }) };
    case 'playedCard':
      return { seat: ev.seat, text: t('ev.playedCard', { name: nameOf(ev.seat), card: names.card(ev.card) }) };
    case 'bankTraded':
      return {
        seat: ev.seat,
        text: t('ev.bankTraded', { name: nameOf(ev.seat), n: ev.giveCount, give: names.res(ev.give), want: names.res(ev.want) }),
      };
    case 'tradeOffered':
      return { seat: ev.seat, text: t('ev.tradeOffered', { name: nameOf(ev.seat) }) };
    case 'tradeCompleted':
      return {
        seat: ev.seat,
        text: t('ev.tradeCompleted', {
          name: nameOf(ev.seat),
          other: nameOf(ev.with),
          give: bagText(ev.give, names),
          want: bagText(ev.want, names),
        }),
      };
    case 'tradeCancelled':
      return { seat: ev.seat, text: t('ev.tradeCancelled', { name: nameOf(ev.seat) }) };
    case 'discarded':
      return { seat: ev.seat, text: t('ev.discarded', { name: nameOf(ev.seat), n: ev.count }) };
    case 'bonusChanged': {
      const bonus = t(ev.bonus === 'longestRoute' ? 'bonus.longestRoute' : 'bonus.strongestGuard');
      return ev.owner === null
        ? { seat: null, text: t('ev.bonusLost', { bonus }) }
        : { seat: ev.owner, text: t('ev.bonusTaken', { bonus, name: nameOf(ev.owner) }), strong: true };
    }
    case 'turnStarted':
      return { seat: ev.seat, text: t('ev.turnStarted', { n: ev.turn, name: nameOf(ev.seat) }), strong: true };
    case 'gameWon':
      return { seat: ev.seat, text: t('ev.gameWon', { name: nameOf(ev.seat), n: ev.points }), strong: true };
    default:
      return { seat: null, text: '' };
  }
}
