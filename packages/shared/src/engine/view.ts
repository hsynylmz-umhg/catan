import type { GameState, PlayerState, PlayerView, PublicPlayer, Seat } from '../types';
import { bagTotal } from '../types';
import { piecesLeft, publicPoints } from './rules';

/** publicPoints + glory cards held (playable or bought this turn). */
export function totalPoints(state: GameState, seat: Seat): number {
  const p = state.players[seat]!;
  const glory = p.cards.filter((c) => c === 'glory').length + p.newCards.filter((c) => c === 'glory').length;
  return publicPoints(state, seat) + glory;
}

/** Redacted view for a seat (null = spectator). */
export function getView(state: GameState, seat: Seat | null): PlayerView {
  const { players, deck, rng: _rng, board, ...rest } = state;
  const you = seat !== null && Number.isInteger(seat) && seat >= 0 && seat < players.length ? seat : null;
  const finished = state.phase === 'finished';
  const pub = (p: PlayerState): PublicPlayer => {
    const own = p.seat === you;
    return {
      seat: p.seat,
      name: p.name,
      color: p.color,
      resources: own ? { ...p.resources } : null,
      resourceCount: bagTotal(p.resources),
      cards: own ? p.cards.slice() : null,
      newCards: own ? p.newCards.slice() : null,
      cardCount: p.cards.length + p.newCards.length,
      raidersPlayed: p.raidersPlayed,
      playedCardThisTurn: p.playedCardThisTurn,
      publicPoints: publicPoints(state, p.seat),
      totalPoints: own || finished ? totalPoints(state, p.seat) : null,
      piecesLeft: piecesLeft(state, p.seat),
    };
  };
  // The board is immutable once generated, so it is shared by reference.
  return { ...structuredClone(rest), board, players: players.map(pub), you, deckCount: deck.length };
}
