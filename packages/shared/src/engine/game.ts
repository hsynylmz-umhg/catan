import {
  type Action,
  type ActionError,
  type BuildingKind,
  COSTS,
  type DecreeCard,
  type GameConfig,
  type GameEvent,
  type GameState,
  HAND_LIMIT,
  type MapSize,
  MIN_RAIDERS_FOR_BONUS,
  MIN_ROUTE_FOR_BONUS,
  RESOURCES,
  type Resource,
  type ResourceBag,
  type Seat,
  TERRAIN_RESOURCE,
  bagTotal,
  emptyBag,
} from '../types';
import { generateBoard } from './board';
import { type Rng, nextInt, seedToState, shuffle } from './rng';
import {
  bankRate,
  distanceOk,
  hasBag,
  outpostSpotOk,
  piecesLeft,
  roadSpotOk,
  routeLength,
  setupRoadSpotOk,
} from './rules';
import { totalPoints } from './view';

export type ApplyResult =
  | { ok: true; state: GameState; events: GameEvent[] }
  | { ok: false; error: ActionError };

export const DECK_COUNTS: Record<MapSize, Record<DecreeCard, number>> = {
  standard: { raider: 12, caravan: 2, bounty: 2, bargain: 2, glory: 4 },
  large: { raider: 18, caravan: 3, bounty: 3, bargain: 3, glory: 6 },
};

const MAX_PLAYERS: Record<MapSize, number> = { standard: 4, large: 6 };

const ACTION_TYPES: readonly string[] = [
  'roll',
  'sevenChoice',
  'moveBandit',
  'steal',
  'buildRoad',
  'buildOutpost',
  'upgrade',
  'buyCard',
  'playCard',
  'bankTrade',
  'offerTrade',
  'respondTrade',
  'confirmTrade',
  'cancelTrade',
  'endTurn',
];

// ---------- createGame ----------

/** New game in setup phase. players.length must be 2..4 (standard) or 2..6 (large). Throws on invalid input. */
export function createGame(config: GameConfig, players: { name: string; color: string }[]): GameState {
  if (!config || typeof config !== 'object') throw new Error('invalid config');
  const { mapSize, targetPoints, seed } = config;
  if (mapSize !== 'standard' && mapSize !== 'large') throw new Error(`invalid map size: ${String(mapSize)}`);
  if (!Number.isInteger(targetPoints) || targetPoints < 8 || targetPoints > 14) {
    throw new Error('targetPoints must be an integer in 8..14');
  }
  if (typeof seed !== 'number' || !Number.isFinite(seed)) throw new Error('seed must be a finite number');
  if (!Array.isArray(players) || players.length < 2 || players.length > MAX_PLAYERS[mapSize]) {
    throw new Error(`player count must be 2..${MAX_PLAYERS[mapSize]} for a ${mapSize} map`);
  }
  for (const p of players) {
    if (!p || typeof p.name !== 'string' || typeof p.color !== 'string') throw new Error('invalid player');
  }

  const board = generateBoard(mapSize, seed);
  // Separate stream from the board's so generateBoard(size, seed) alone reproduces state.board.
  const rng: Rng = { s: (seedToState(seed) ^ 0x9e3779b9) >>> 0 };
  const pool: DecreeCard[] = [];
  for (const card of Object.keys(DECK_COUNTS[mapSize]) as DecreeCard[]) {
    for (let i = 0; i < DECK_COUNTS[mapSize][card]; i++) pool.push(card);
  }
  const deck = shuffle(rng, pool);
  const barren = board.hexes.find((h) => h.terrain === 'barren');

  return {
    config: { mapSize, targetPoints, seed },
    board,
    players: players.map((p, seat) => ({
      seat,
      name: p.name,
      color: p.color,
      resources: emptyBag(),
      cards: [],
      newCards: [],
      raidersPlayed: 0,
      playedCardThisTurn: false,
      })),
    phase: 'setup',
    current: 0,
    turn: 0,
    setup: { round: 1, expecting: 'outpost', lastVertex: null },
    step: 'roll',
    dice: null,
    buildings: {},
    roads: {},
    bandit: barren ? barren.id : 0,
    stealCandidates: [],
    freeRoads: 0,
    bargainActive: false,
    trade: null,
    deck,
    longestRoute: { owner: null, length: 0 },
    strongestGuard: { owner: null, count: 0 },
    winner: null,
    rng: rng.s,
  };
}

// ---------- small utilities ----------

const fail = (error: ActionError): ApplyResult => ({ ok: false, error });

function cloneState(s: GameState): GameState {
  // The board never changes after generation, so it is shared instead of deep-copied.
  const { board, ...rest } = s;
  return { ...structuredClone(rest), board };
}

function isResource(x: unknown): x is Resource {
  return typeof x === 'string' && (RESOURCES as readonly string[]).includes(x);
}

/** Normalise untrusted input into a full bag of non-negative integers, or null if malformed. */
function parseBag(x: unknown): ResourceBag | null {
  if (!x || typeof x !== 'object' || Array.isArray(x)) return null;
  const bag = emptyBag();
  for (const r of RESOURCES) {
    const v = (x as Record<string, unknown>)[r] ?? 0;
    if (typeof v !== 'number' || !Number.isInteger(v) || v < 0) return null;
    bag[r] = v;
  }
  return bag;
}

function parseResourcePair(x: unknown): [Resource, Resource] | null {
  if (!Array.isArray(x) || x.length !== 2 || !isResource(x[0]) || !isResource(x[1])) return null;
  return [x[0], x[1]];
}

function pay(have: ResourceBag, cost: Partial<ResourceBag>): void {
  for (const r of RESOURCES) have[r] -= cost[r] ?? 0;
}
function gain(have: ResourceBag, bag: Partial<ResourceBag>): void {
  for (const r of RESOURCES) have[r] += bag[r] ?? 0;
}

function isSeat(st: GameState, x: unknown): x is Seat {
  return typeof x === 'number' && Number.isInteger(x) && x >= 0 && x < st.players.length;
}

// ---------- bonuses / win ----------

function updateLongestRoute(st: GameState, ev: GameEvent[]): void {
  const lens = st.players.map((p) => routeLength(st, p.seat));
  const max = Math.max(...lens);
  const prev = st.longestRoute.owner;
  let owner: Seat | null;
  if (prev !== null && lens[prev]! >= MIN_ROUTE_FOR_BONUS && lens[prev] === max) {
    owner = prev; // holder keeps it unless someone is strictly longer
  } else {
    const leaders = lens.flatMap((l, seat) => (l === max ? [seat] : []));
    owner = max >= MIN_ROUTE_FOR_BONUS && leaders.length === 1 ? leaders[0]! : null;
  }
  st.longestRoute = { owner, length: owner === null ? 0 : lens[owner]! };
  if (owner !== prev) ev.push({ type: 'bonusChanged', bonus: 'longestRoute', owner });
}

function updateStrongestGuard(st: GameState, seat: Seat, ev: GameEvent[]): void {
  const count = st.players[seat]!.raidersPlayed;
  const sg = st.strongestGuard;
  if (sg.owner === seat) {
    sg.count = count;
  } else if (count >= MIN_RAIDERS_FOR_BONUS && (sg.owner === null || count > sg.count)) {
    st.strongestGuard = { owner: seat, count };
    ev.push({ type: 'bonusChanged', bonus: 'strongestGuard', owner: seat });
  }
}

function checkWin(st: GameState, ev: GameEvent[]): void {
  if (st.phase !== 'main') return;
  const points = totalPoints(st, st.current);
  if (points < st.config.targetPoints) return;
  st.phase = 'finished';
  st.winner = st.current;
  st.trade = null;
  st.stealCandidates = [];
  ev.push({ type: 'gameWon', seat: st.current, points });
}

// ---------- bandit / steal ----------

/** Step to return to once a bandit move is fully resolved: `roll` if the dice were not rolled yet this turn. */
function afterBanditStep(st: GameState): 'roll' | 'actions' {
  return st.dice === null ? 'roll' : 'actions';
}

function stealFrom(st: GameState, thief: Seat, victim: Seat, ev: GameEvent[]): void {
  const from = st.players[victim]!.resources;
  const total = bagTotal(from);
  if (total > 0) {
    const rng: Rng = { s: st.rng };
    let pick = nextInt(rng, total);
    st.rng = rng.s;
    for (const r of RESOURCES) {
      if (pick < from[r]) {
        from[r] -= 1;
        st.players[thief]!.resources[r] += 1;
        break;
      }
      pick -= from[r];
    }
  }
  ev.push({ type: 'stole', seat: thief, victim });
}

// ---------- setup phase ----------

function applySetup(st: GameState, seat: Seat, action: Action, ev: GameEvent[]): ActionError | null {
  if (action.type !== 'buildOutpost' && action.type !== 'buildRoad') return 'wrongPhase';
  if (seat !== st.current) return 'notYourTurn';
  const setup = st.setup!;
  const n = st.players.length;

  if (action.type === 'buildOutpost') {
    if (setup.expecting !== 'outpost') return 'wrongStep';
    const v = action.vertex;
    if (!distanceOk(st, v)) return 'invalidLocation';
    st.buildings[v] = { owner: seat, kind: 'outpost' };
    ev.push({ type: 'built', seat, kind: 'outpost', vertex: v });
    if (setup.round === 2) {
      const got: Partial<ResourceBag> = {};
      for (const h of st.board.vertices[v]!.hexes) {
        const res = TERRAIN_RESOURCE[st.board.hexes[h]!.terrain];
        if (res) got[res] = (got[res] ?? 0) + 1;
      }
      if (bagTotal(got) > 0) {
        gain(st.players[seat]!.resources, got);
        ev.push({ type: 'produced', gains: { [seat]: got } });
      }
    }
    setup.expecting = 'road';
    setup.lastVertex = v;
    return null;
  }

  if (setup.expecting !== 'road') return 'wrongStep';
  const e = action.edge;
  if (!setupRoadSpotOk(st, e)) return 'invalidLocation';
  st.roads[e] = seat;
  ev.push({ type: 'built', seat, kind: 'road', edge: e });
  setup.expecting = 'outpost';
  setup.lastVertex = null;
  if (setup.round === 1) {
    if (st.current < n - 1) st.current += 1;
    else setup.round = 2; // snake: the last seat places twice in a row
  } else if (st.current > 0) {
    st.current -= 1;
  } else {
    st.phase = 'main';
    st.setup = null;
    st.current = 0;
    st.turn = 1;
    st.step = 'roll';
    st.dice = null;
    ev.push({ type: 'turnStarted', seat: 0, turn: 1 });
  }
  return null;
}

// ---------- main phase ----------

function applyMain(st: GameState, seat: Seat, action: Action, ev: GameEvent[]): ActionError | null {
  const me = st.players[seat]!;

  // The only action open to non-current players.
  if (action.type === 'respondTrade') {
    if (seat === st.current) return 'invalidTrade';
    if (!st.trade) return 'noOpenTrade';
    if (typeof action.accept !== 'boolean') return 'badAction';
    if (action.accept && !hasBag(me.resources, st.trade.want)) return 'cannotAfford';
    st.trade.responses[seat] = action.accept ? 'accept' : 'decline';
    return null;
  }

  if (seat !== st.current) return 'notYourTurn';

  switch (action.type) {
    case 'roll': {
      if (st.step !== 'roll') return 'wrongStep';
      const rng: Rng = { s: st.rng };
      const dice: [number, number] = [1 + nextInt(rng, 6), 1 + nextInt(rng, 6)];
      st.rng = rng.s;
      st.dice = dice;
      ev.push({ type: 'rolled', seat, dice });
      const sum = dice[0] + dice[1];
      if (sum === 7) {
        st.step = 'sevenChoice';
        return null;
      }
      const gains: Record<Seat, Partial<ResourceBag>> = {};
      for (const h of st.board.hexes) {
        if (h.number !== sum || h.id === st.bandit) continue;
        const res = TERRAIN_RESOURCE[h.terrain];
        if (!res) continue;
        for (const v of h.vertices) {
          const b = st.buildings[v];
          if (!b) continue;
          const amount = b.kind === 'keep' ? 2 : 1;
          const g = (gains[b.owner] ??= {});
          g[res] = (g[res] ?? 0) + amount;
        }
      }
      for (const k in gains) gain(st.players[Number(k)]!.resources, gains[k]!);
      ev.push({ type: 'produced', gains });
      st.step = 'actions';
      return null;
    }

    case 'sevenChoice': {
      if (st.step !== 'sevenChoice') return 'wrongStep';
      if (action.choice === 'bandit') {
        st.step = 'moveBandit';
        return null;
      }
      if (action.choice !== 'tribute') return 'badAction';
      const pair = parseResourcePair(action.resources);
      if (!pair) return 'badAction';
      for (const r of pair) me.resources[r] += 1;
      ev.push({ type: 'tribute', seat, resources: pair });
      st.step = 'actions';
      return null;
    }

    case 'moveBandit': {
      if (st.step !== 'moveBandit') return 'wrongStep';
      const hex = action.hex;
      if (!Number.isInteger(hex) || hex < 0 || hex >= st.board.hexes.length || hex === st.bandit) {
        return 'invalidLocation';
      }
      st.bandit = hex;
      ev.push({ type: 'banditMoved', seat, hex });
      const candidates: Seat[] = [];
      for (const v of st.board.hexes[hex]!.vertices) {
        const b = st.buildings[v];
        if (!b || b.owner === seat || candidates.includes(b.owner)) continue;
        if (bagTotal(st.players[b.owner]!.resources) > 0) candidates.push(b.owner);
      }
      candidates.sort((a, b) => a - b);
      if (candidates.length >= 2) {
        st.stealCandidates = candidates;
        st.step = 'steal';
        return null;
      }
      if (candidates.length === 1) stealFrom(st, seat, candidates[0]!, ev);
      st.stealCandidates = [];
      st.step = afterBanditStep(st);
      return null;
    }

    case 'steal': {
      if (st.step !== 'steal') return 'wrongStep';
      if (!isSeat(st, action.victim) || !st.stealCandidates.includes(action.victim)) return 'invalidTarget';
      stealFrom(st, seat, action.victim, ev);
      st.stealCandidates = [];
      st.step = afterBanditStep(st);
      return null;
    }

    case 'buildRoad': {
      if (st.step !== 'actions') return 'wrongStep';
      if (piecesLeft(st, seat).road <= 0) return 'noPiecesLeft';
      if (!roadSpotOk(st, seat, action.edge)) return 'invalidLocation';
      if (st.freeRoads > 0) {
        st.freeRoads -= 1;
      } else {
        if (!hasBag(me.resources, COSTS.road)) return 'cannotAfford';
        pay(me.resources, COSTS.road);
      }
      st.roads[action.edge] = seat;
      ev.push({ type: 'built', seat, kind: 'road', edge: action.edge });
      updateLongestRoute(st, ev);
      return null;
    }

    case 'buildOutpost': {
      if (st.step !== 'actions') return 'wrongStep';
      if (piecesLeft(st, seat).outpost <= 0) return 'noPiecesLeft';
      if (!outpostSpotOk(st, seat, action.vertex)) return 'invalidLocation';
      if (!hasBag(me.resources, COSTS.outpost)) return 'cannotAfford';
      pay(me.resources, COSTS.outpost);
      st.buildings[action.vertex] = { owner: seat, kind: 'outpost' };
      ev.push({ type: 'built', seat, kind: 'outpost', vertex: action.vertex });
      updateLongestRoute(st, ev); // a new building may cut an opponent's route
      return null;
    }

    case 'upgrade': {
      if (st.step !== 'actions') return 'wrongStep';
      const to: BuildingKind = action.to;
      if (to !== 'keep' && to !== 'market') return 'badAction';
      const b = Number.isInteger(action.vertex) ? st.buildings[action.vertex] : undefined;
      if (!b || b.owner !== seat || b.kind !== 'outpost') return 'invalidLocation';
      if (piecesLeft(st, seat)[to] <= 0) return 'noPiecesLeft';
      if (!hasBag(me.resources, COSTS[to])) return 'cannotAfford';
      pay(me.resources, COSTS[to]);
      b.kind = to;
      ev.push({ type: 'built', seat, kind: to, vertex: action.vertex });
      return null;
    }

    case 'buyCard': {
      if (st.step !== 'actions') return 'wrongStep';
      if (st.deck.length === 0) return 'deckEmpty';
      if (!hasBag(me.resources, COSTS.card)) return 'cannotAfford';
      pay(me.resources, COSTS.card);
      me.newCards.push(st.deck.pop()!);
      ev.push({ type: 'boughtCard', seat });
      return null;
    }

    case 'playCard': {
      if (st.step !== 'roll' && st.step !== 'actions') return 'wrongStep';
      const card: string = action.card;
      if (card !== 'raider' && card !== 'caravan' && card !== 'bounty' && card !== 'bargain') return 'badAction';
      let pair: [Resource, Resource] | null = null;
      if (action.card === 'bounty') {
        pair = parseResourcePair(action.resources);
        if (!pair) return 'badAction';
      }
      const idx = me.cards.indexOf(card);
      if (idx < 0) return 'noSuchCard';
      if (me.playedCardThisTurn) return 'cardAlreadyPlayed';
      me.cards.splice(idx, 1);
      me.playedCardThisTurn = true;
      ev.push({ type: 'playedCard', seat, card });
      if (card === 'raider') {
        me.raidersPlayed += 1;
        updateStrongestGuard(st, seat, ev);
        st.step = 'moveBandit';
      } else if (card === 'caravan') {
        st.freeRoads = Math.min(2, Math.max(0, piecesLeft(st, seat).road));
      } else if (card === 'bounty') {
        for (const r of pair!) me.resources[r] += 1;
      } else {
        st.bargainActive = true;
      }
      return null;
    }

    case 'bankTrade': {
      if (st.step !== 'actions') return 'wrongStep';
      const { give, want } = action;
      if (!isResource(give) || !isResource(want) || give === want) return 'invalidTrade';
      const rate = bankRate(st, seat, give);
      if (me.resources[give] < rate) return 'cannotAfford';
      me.resources[give] -= rate;
      me.resources[want] += 1;
      ev.push({ type: 'bankTraded', seat, give, giveCount: rate, want });
      return null;
    }

    case 'offerTrade': {
      if (st.step !== 'actions') return 'wrongStep';
      const give = parseBag(action.give);
      const want = parseBag(action.want);
      if (!give || !want || bagTotal(give) === 0 || bagTotal(want) === 0) return 'invalidTrade';
      if (RESOURCES.some((r) => give[r] > 0 && want[r] > 0)) return 'invalidTrade';
      if (!hasBag(me.resources, give)) return 'cannotAfford';
      st.trade = { from: seat, give, want, responses: {} };
      ev.push({ type: 'tradeOffered', seat });
      return null;
    }

    case 'confirmTrade': {
      if (st.step !== 'actions') return 'wrongStep';
      const trade = st.trade;
      if (!trade) return 'noOpenTrade';
      const other = action.with;
      if (!isSeat(st, other) || other === seat || trade.responses[other] !== 'accept') return 'invalidTarget';
      const them = st.players[other]!;
      if (!hasBag(me.resources, trade.give) || !hasBag(them.resources, trade.want)) return 'cannotAfford';
      pay(me.resources, trade.give);
      gain(them.resources, trade.give);
      pay(them.resources, trade.want);
      gain(me.resources, trade.want);
      ev.push({ type: 'tradeCompleted', seat, with: other, give: trade.give, want: trade.want });
      st.trade = null;
      return null;
    }

    case 'cancelTrade': {
      if (!st.trade) return 'noOpenTrade';
      st.trade = null;
      ev.push({ type: 'tradeCancelled', seat });
      return null;
    }

    case 'endTurn': {
      if (st.step !== 'actions') return 'wrongStep';
      const excess = bagTotal(me.resources) - HAND_LIMIT;
      const discard = action.discard === undefined || action.discard === null ? emptyBag() : parseBag(action.discard);
      if (!discard) return 'invalidDiscard';
      const count = bagTotal(discard);
      if (count !== Math.max(0, excess) || !hasBag(me.resources, discard)) return 'invalidDiscard';
      if (count > 0) {
        pay(me.resources, discard);
        ev.push({ type: 'discarded', seat, count });
      }
      if (st.trade) {
        st.trade = null;
        ev.push({ type: 'tradeCancelled', seat });
      }
      me.cards.push(...me.newCards);
      me.newCards = [];
      me.playedCardThisTurn = false;
      st.bargainActive = false;
      st.freeRoads = 0;
      st.stealCandidates = [];
      st.dice = null; // "not rolled yet this turn" — a raider played before rolling returns to `roll`
      st.current = (st.current + 1) % st.players.length;
      st.turn += 1;
      st.step = 'roll';
      ev.push({ type: 'turnStarted', seat: st.current, turn: st.turn });
      return null;
    }
  }
  return 'badAction';
}

// ---------- applyAction ----------

function apply(state: GameState, seat: Seat, action: Action): ApplyResult {
  if (!action || typeof action !== 'object' || !ACTION_TYPES.includes((action as { type: string }).type)) {
    return fail('badAction');
  }
  if (!isSeat(state, seat)) return fail('notYourTurn');
  if (state.phase === 'finished') return fail('wrongPhase');
  const st = cloneState(state);
  const ev: GameEvent[] = [];
  const err = st.phase === 'setup' ? applySetup(st, seat, action, ev) : applyMain(st, seat, action, ev);
  if (err) return fail(err);
  checkWin(st, ev);
  return { ok: true, state: st, events: ev };
}

/** Validate + apply one action for a seat. Never throws for bad player input and never mutates `state`. */
export function applyAction(state: GameState, seat: Seat, action: Action): ApplyResult {
  try {
    return apply(state, seat, action);
  } catch {
    return fail('badAction');
  }
}
