// Test-only helpers (not exported from the engine index).
import {
  type Action,
  type Board,
  type GameEvent,
  type GameState,
  type MapSize,
  PIECE_LIMITS,
  PLAYER_COLORS,
  RESOURCES,
  type Resource,
  type ResourceBag,
  type Seat,
  bagTotal,
  emptyBag,
} from '../types';
import { applyAction, createGame } from './game';
import { type Rng, nextFloat, nextInt } from './rng';
import {
  bankRate,
  canAfford,
  pieceCounts,
  piecesLeft,
  validBanditHexes,
  validOutpostVertices,
  validRoadEdges,
  validUpgradeVertices,
} from './rules';

export function newGame(n = 3, mapSize: MapSize = 'standard', seed = 1, targetPoints?: number): GameState {
  const players = Array.from({ length: n }, (_, i) => ({ name: `P${i}`, color: PLAYER_COLORS[i]! }));
  return createGame({ mapSize, seed, targetPoints: targetPoints ?? (mapSize === 'standard' ? 10 : 11) }, players);
}

/** Apply an action that is expected to succeed. */
export function must(state: GameState, seat: Seat, action: Action): { state: GameState; events: GameEvent[] } {
  const r = applyAction(state, seat, action);
  if (!r.ok) throw new Error(`expected ok for ${JSON.stringify(action)} by seat ${seat}, got ${r.error}`);
  return { state: r.state, events: r.events };
}

/** Error code of an action that is expected to fail. */
export function err(state: GameState, seat: Seat, action: unknown): string {
  const r = applyAction(state, seat, action as Action);
  if (r.ok) throw new Error(`expected failure for ${JSON.stringify(action)}`);
  return r.error;
}

/** Deep-copy a state and tweak the copy. */
export function edit(state: GameState, fn: (s: GameState) => void): GameState {
  const copy = structuredClone(state);
  fn(copy);
  return copy;
}

export function bag(partial: Partial<ResourceBag>): ResourceBag {
  return { ...emptyBag(), ...partial };
}

export const RICH: ResourceBag = { timber: 20, stone: 20, grain: 20, fiber: 20, ore: 20 };

/** Play the whole setup phase, always taking the first legal spot. */
export function runSetup(state: GameState): GameState {
  let s = state;
  while (s.phase === 'setup') {
    const seat = s.current;
    s = must(s, seat, { type: 'buildOutpost', vertex: validOutpostVertices(s, seat)[0]! }).state;
    s = must(s, seat, { type: 'buildRoad', edge: validRoadEdges(s, seat)[0]! }).state;
  }
  return s;
}

/** An empty board already in the main phase (seat 0, step `actions`, dice already rolled). */
export function blankMain(n = 3, mapSize: MapSize = 'standard', seed = 1, targetPoints?: number): GameState {
  return edit(newGame(n, mapSize, seed, targetPoints), (s) => {
    s.phase = 'main';
    s.setup = null;
    s.turn = 1;
    s.step = 'actions';
    s.dice = [1, 2];
  });
}

/** Roll for the current seat, searching PRNG states until the dice sum satisfies `want`. */
export function rollUntil(
  state: GameState,
  want: (sum: number) => boolean,
): { state: GameState; events: GameEvent[] } {
  for (let k = 0; k < 2000; k++) {
    const r = must(edit(state, (s) => (s.rng = k)), state.current, { type: 'roll' });
    if (want(r.state.dice![0] + r.state.dice![1])) return r;
  }
  throw new Error('no matching roll found');
}

export function edgeBetween(board: Board, a: number, b: number): number {
  const e = board.edges.find((x) => (x.a === a && x.b === b) || (x.a === b && x.b === a));
  if (!e) throw new Error(`no edge between ${a} and ${b}`);
  return e.id;
}

/** A simple path of `len` edges that avoids the given vertices. */
export function findPath(
  board: Board,
  len: number,
  avoid: ReadonlySet<number> = new Set(),
): { vertices: number[]; edges: number[] } {
  const path: number[] = [];
  const walk = (v: number): boolean => {
    path.push(v);
    if (path.length === len + 1) return true;
    for (const n of board.vertices[v]!.adjacent) {
      if (avoid.has(n) || path.includes(n)) continue;
      if (walk(n)) return true;
    }
    path.pop();
    return false;
  };
  for (const v of board.vertices) {
    if (avoid.has(v.id)) continue;
    if (walk(v.id)) {
      const edges = path.slice(1).map((p, i) => edgeBetween(board, path[i]!, p));
      return { vertices: path.slice(), edges };
    }
  }
  throw new Error('no path found');
}

export function deepFreeze<T>(o: T): T {
  if (o && typeof o === 'object' && !Object.isFrozen(o)) {
    Object.freeze(o);
    for (const v of Object.values(o)) deepFreeze(v);
  }
  return o;
}

/** Throws if the state violates a structural invariant. */
export function checkInvariants(s: GameState): void {
  const bad = (msg: string): never => {
    throw new Error(`invariant violated: ${msg}`);
  };
  for (const p of s.players) {
    for (const r of RESOURCES) {
      if (!Number.isInteger(p.resources[r]) || p.resources[r] < 0) bad(`seat ${p.seat} ${r}=${p.resources[r]}`);
    }
    const c = pieceCounts(s, p.seat);
    for (const k of ['road', 'outpost', 'keep', 'market'] as const) {
      if (c[k] > PIECE_LIMITS[k]) bad(`seat ${p.seat} has ${c[k]} ${k}`);
    }
    if (p.raidersPlayed < 0) bad('raidersPlayed');
  }
  for (const k in s.buildings) {
    for (const n of s.board.vertices[Number(k)]!.adjacent) if (s.buildings[n]) bad(`distance rule at ${k}`);
  }
  if (s.freeRoads < 0 || s.freeRoads > 2) bad('freeRoads');
  if (s.bandit < 0 || s.bandit >= s.board.hexes.length) bad('bandit');
  if ((s.phase === 'finished') !== (s.winner !== null)) bad('winner/phase mismatch');
  if ((s.phase === 'setup') !== (s.setup !== null)) bad('setup/phase mismatch');
  if (s.step === 'steal' ? s.stealCandidates.length < 2 : s.stealCandidates.length !== 0) bad('stealCandidates');
  if (s.current < 0 || s.current >= s.players.length) bad('current');
  if (!Number.isInteger(s.rng) || s.rng < 0 || s.rng > 0xffffffff) bad('rng');
  const total = s.deck.length + s.players.reduce((n, p) => n + p.cards.length + p.newCards.length, 0);
  const max = s.config.mapSize === 'standard' ? 22 : 33;
  if (total > max) bad('too many cards in play');
}

const pick = <T>(rng: Rng, items: readonly T[]): T => items[nextInt(rng, items.length)]!;

/** A random *legal* move for whoever has to act next. Used by the randomized playthrough tests. */
export function botMove(s: GameState, rng: Rng): { seat: Seat; action: Action } {
  const seat = s.current;
  const me = s.players[seat]!;
  if (s.phase === 'setup') {
    return s.setup!.expecting === 'outpost'
      ? { seat, action: { type: 'buildOutpost', vertex: pick(rng, validOutpostVertices(s, seat)) } }
      : { seat, action: { type: 'buildRoad', edge: pick(rng, validRoadEdges(s, seat)) } };
  }

  const cardPlays: Action[] = [];
  if (!me.playedCardThisTurn) {
    const two = (): [Resource, Resource] => [pick(rng, RESOURCES), pick(rng, RESOURCES)];
    if (me.cards.includes('raider')) cardPlays.push({ type: 'playCard', card: 'raider' });
    if (me.cards.includes('caravan')) cardPlays.push({ type: 'playCard', card: 'caravan' });
    if (me.cards.includes('bounty')) cardPlays.push({ type: 'playCard', card: 'bounty', resources: two() });
    if (me.cards.includes('bargain')) cardPlays.push({ type: 'playCard', card: 'bargain' });
  }

  switch (s.step) {
    case 'roll':
      if (cardPlays.length && nextFloat(rng) < 0.3) return { seat, action: pick(rng, cardPlays) };
      return { seat, action: { type: 'roll' } };
    case 'sevenChoice':
      return nextFloat(rng) < 0.5
        ? { seat, action: { type: 'sevenChoice', choice: 'bandit' } }
        : { seat, action: { type: 'sevenChoice', choice: 'tribute', resources: [pick(rng, RESOURCES), pick(rng, RESOURCES)] } };
    case 'moveBandit':
      return { seat, action: { type: 'moveBandit', hex: pick(rng, validBanditHexes(s)) } };
    case 'steal':
      return { seat, action: { type: 'steal', victim: pick(rng, s.stealCandidates) } };
    case 'actions':
      break;
  }

  // Resolve an open trade completely before doing anything else.
  if (s.trade) {
    const trade = s.trade;
    for (const p of s.players) {
      if (p.seat === seat || trade.responses[p.seat]) continue;
      const can = RESOURCES.every((r) => p.resources[r] >= trade.want[r]);
      return { seat: p.seat, action: { type: 'respondTrade', accept: can && nextFloat(rng) < 0.7 } };
    }
    const takers = s.players.filter((p) => trade.responses[p.seat] === 'accept').map((p) => p.seat);
    const canGive = RESOURCES.every((r) => me.resources[r] >= trade.give[r]);
    if (takers.length && canGive) return { seat, action: { type: 'confirmTrade', with: pick(rng, takers) } };
    return { seat, action: { type: 'cancelTrade' } };
  }

  const left = piecesLeft(s, seat);
  const big: Action[] = [];
  if (canAfford(s, seat, 'outpost')) {
    for (const vertex of validOutpostVertices(s, seat)) big.push({ type: 'buildOutpost', vertex });
  }
  for (const vertex of validUpgradeVertices(s, seat)) {
    if (left.keep > 0 && canAfford(s, seat, 'keep')) big.push({ type: 'upgrade', vertex, to: 'keep' });
    if (left.market > 0 && canAfford(s, seat, 'market')) big.push({ type: 'upgrade', vertex, to: 'market' });
  }
  if (big.length) return { seat, action: pick(rng, big) };

  const small: Action[] = [...cardPlays];
  if (s.freeRoads > 0 || canAfford(s, seat, 'road')) {
    const edges = validRoadEdges(s, seat);
    const wantRoad = s.freeRoads > 0 || validOutpostVertices(s, seat).length === 0 || nextFloat(rng) < 0.2;
    if (edges.length && wantRoad) small.push({ type: 'buildRoad', edge: pick(rng, edges) });
  }
  if (s.deck.length && canAfford(s, seat, 'card') && nextFloat(rng) < 0.5) small.push({ type: 'buyCard' });
  const surplus = RESOURCES.filter((r) => me.resources[r] >= bankRate(s, seat, r) + 1);
  if (surplus.length) {
    const give = pick(rng, surplus);
    const want = pick(rng, RESOURCES.filter((r) => r !== give));
    small.push({ type: 'bankTrade', give, want });
  }
  const held = RESOURCES.filter((r) => me.resources[r] > 0);
  if (held.length && nextFloat(rng) < 0.1) {
    const give = pick(rng, held);
    const want = pick(rng, RESOURCES.filter((r) => r !== give));
    small.push({ type: 'offerTrade', give: bag({ [give]: 1 }), want: bag({ [want]: 1 }) });
  }
  if (small.length && nextFloat(rng) < 0.7) return { seat, action: pick(rng, small) };

  // End the turn, discarding random cards down to the hand limit.
  let excess = bagTotal(me.resources) - 10;
  if (excess <= 0) return { seat, action: { type: 'endTurn' } };
  const hand = { ...me.resources };
  const discard = emptyBag();
  while (excess > 0) {
    const r = pick(rng, RESOURCES.filter((x) => hand[x] > 0));
    hand[r] -= 1;
    discard[r] += 1;
    excess -= 1;
  }
  return { seat, action: { type: 'endTurn', discard } };
}
