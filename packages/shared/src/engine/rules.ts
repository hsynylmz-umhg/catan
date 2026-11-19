// Read-only rule helpers. They only look at public fields (plus the given seat's own resources),
// so they work on both the full GameState and a redacted PlayerView.
import {
  type Buyable,
  COSTS,
  type GameState,
  PIECE_LIMITS,
  type PlayerView,
  RESOURCES,
  type Resource,
  type ResourceBag,
  type Seat,
  TERRAIN_RESOURCE,
} from '../types';

/** Any object carrying the public board situation: works with both GameState and PlayerView. */
export type Situation = GameState | PlayerView;

export interface PieceCounts {
  road: number;
  outpost: number;
  keep: number;
  market: number;
}

export function pieceCounts(s: Situation, seat: Seat): PieceCounts {
  const c: PieceCounts = { road: 0, outpost: 0, keep: 0, market: 0 };
  for (const k in s.roads) if (s.roads[k] === seat) c.road++;
  for (const k in s.buildings) {
    const b = s.buildings[k]!;
    if (b.owner === seat) c[b.kind]++;
  }
  return c;
}

export function piecesLeft(s: Situation, seat: Seat): PieceCounts {
  const c = pieceCounts(s, seat);
  return {
    road: PIECE_LIMITS.road - c.road,
    outpost: PIECE_LIMITS.outpost - c.outpost,
    keep: PIECE_LIMITS.keep - c.keep,
    market: PIECE_LIMITS.market - c.market,
  };
}

/** Points everyone can see: buildings + bonuses. */
export function publicPoints(s: Situation, seat: Seat): number {
  const c = pieceCounts(s, seat);
  let p = c.outpost + c.market + c.keep * 2;
  if (s.longestRoute.owner === seat) p += 2;
  if (s.strongestGuard.owner === seat) p += 2;
  return p;
}

export function hasBag(have: ResourceBag, cost: Partial<ResourceBag>): boolean {
  for (const r of RESOURCES) if (have[r] < (cost[r] ?? 0)) return false;
  return true;
}

function validVertex(s: Situation, v: number): boolean {
  return Number.isInteger(v) && v >= 0 && v < s.board.vertices.length;
}
function validEdge(s: Situation, e: number): boolean {
  return Number.isInteger(e) && e >= 0 && e < s.board.edges.length;
}

/** Distance rule: vertex is empty and so are all its neighbours. */
export function distanceOk(s: Situation, v: number): boolean {
  if (!validVertex(s, v) || s.buildings[v]) return false;
  for (const n of s.board.vertices[v]!.adjacent) if (s.buildings[n]) return false;
  return true;
}

export function touchesOwnRoad(s: Situation, seat: Seat, v: number): boolean {
  for (const e of s.board.vertices[v]!.edges) if (s.roads[e] === seat) return true;
  return false;
}

/** Main-phase outpost spot: distance rule + touches an own road. Ignores turn, cost and piece limits. */
export function outpostSpotOk(s: Situation, seat: Seat, v: number): boolean {
  return distanceOk(s, v) && touchesOwnRoad(s, seat, v);
}

/** Main-phase road spot: empty edge connected to own building / own road (not through an opponent building). */
export function roadSpotOk(s: Situation, seat: Seat, e: number): boolean {
  if (!validEdge(s, e) || s.roads[e] !== undefined) return false;
  const edge = s.board.edges[e]!;
  for (const v of [edge.a, edge.b]) {
    const b = s.buildings[v];
    if (b) {
      if (b.owner === seat) return true;
      continue; // opponent building blocks connection through this vertex
    }
    if (touchesOwnRoad(s, seat, v)) return true;
  }
  return false;
}

/** Setup-phase road spot: empty edge touching the just-placed outpost. */
export function setupRoadSpotOk(s: Situation, e: number): boolean {
  if (!validEdge(s, e) || s.roads[e] !== undefined || !s.setup || s.setup.lastVertex === null) return false;
  const edge = s.board.edges[e]!;
  return edge.a === s.setup.lastVertex || edge.b === s.setup.lastVertex;
}

function inActions(s: Situation, seat: Seat): boolean {
  return s.phase === 'main' && s.current === seat && s.step === 'actions';
}

/** Vertices where `seat` may place an outpost right now (setup: anywhere legal; main: connected to own road). Ignores cost. */
export function validOutpostVertices(s: Situation, seat: Seat): number[] {
  const out: number[] = [];
  if (s.phase === 'setup') {
    if (s.current !== seat || !s.setup || s.setup.expecting !== 'outpost') return out;
    for (const v of s.board.vertices) if (distanceOk(s, v.id)) out.push(v.id);
    return out;
  }
  if (!inActions(s, seat) || piecesLeft(s, seat).outpost <= 0) return out;
  for (const v of s.board.vertices) if (outpostSpotOk(s, seat, v.id)) out.push(v.id);
  return out;
}

/** Edges where `seat` may place a road right now (setup: touching the just-placed outpost). Ignores cost. */
export function validRoadEdges(s: Situation, seat: Seat): number[] {
  const out: number[] = [];
  if (s.phase === 'setup') {
    if (s.current !== seat || !s.setup || s.setup.expecting !== 'road') return out;
    for (const e of s.board.edges) if (setupRoadSpotOk(s, e.id)) out.push(e.id);
    return out;
  }
  if (!inActions(s, seat) || piecesLeft(s, seat).road <= 0) return out;
  for (const e of s.board.edges) if (roadSpotOk(s, seat, e.id)) out.push(e.id);
  return out;
}

/** Own outposts that can be upgraded (at least one keep or market piece left). Ignores cost. */
export function validUpgradeVertices(s: Situation, seat: Seat): number[] {
  const out: number[] = [];
  if (!inActions(s, seat)) return out;
  const left = piecesLeft(s, seat);
  if (left.keep <= 0 && left.market <= 0) return out;
  for (const k in s.buildings) {
    const b = s.buildings[k]!;
    if (b.owner === seat && b.kind === 'outpost') out.push(Number(k));
  }
  return out.sort((a, b) => a - b);
}

/** Hexes the bandit may move to (every hex except its current one); [] unless a bandit move is pending. */
export function validBanditHexes(s: Situation): number[] {
  if (s.phase !== 'main' || s.step !== 'moveBandit') return [];
  return s.board.hexes.filter((h) => h.id !== s.bandit).map((h) => h.id);
}

/** How many `give` the bank asks for one resource: 4, 3 or 2 (see RULES.md). */
export function bankRate(s: Situation, seat: Seat, give: Resource): number {
  if (s.bargainActive && s.current === seat) return 2;
  let hasMarket = false;
  for (const k in s.buildings) {
    const b = s.buildings[k]!;
    if (b.owner !== seat || b.kind !== 'market') continue;
    hasMarket = true;
    for (const h of s.board.vertices[Number(k)]!.hexes) {
      if (TERRAIN_RESOURCE[s.board.hexes[h]!.terrain] === give) return 2;
    }
  }
  let rate = hasMarket ? 3 : 4;
  for (const h of s.board.harbors ?? []) {
    const e = s.board.edges[h.edge];
    if (!e) continue;
    const owns = [e.a, e.b].some((v) => s.buildings[v]?.owner === seat);
    if (!owns) continue;
    if (h.kind === give) return 2;
    if (h.kind === 'any') rate = Math.min(rate, 3);
  }
  return rate;
}

/** Harbours seat can use (has a building on either end of the harbour edge). */
export function harborsOf(s: Situation, seat: Seat) {
  return (s.board.harbors ?? []).filter((h) => {
    const e = s.board.edges[h.edge];
    return !!e && [e.a, e.b].some((v) => s.buildings[v]?.owner === seat);
  });
}

/** Whether seat holds the cost. For a PlayerView only meaningful for the viewer's own seat. */
export function canAfford(s: Situation, seat: Seat, item: Buyable): boolean {
  const res = s.players[seat]?.resources;
  const cost = COSTS[item];
  if (!res || !cost) return false;
  return hasBag(res, cost);
}

/** Length of seat's longest continuous route (no edge reused; opponent buildings cut the route at their vertex). */
export function routeLength(s: Situation, seat: Seat): number {
  const at = new Map<number, number[]>();
  for (const k in s.roads) {
    if (s.roads[k] !== seat) continue;
    const e = s.board.edges[Number(k)]!;
    for (const v of [e.a, e.b]) {
      const list = at.get(v);
      if (list) list.push(e.id);
      else at.set(v, [e.id]);
    }
  }
  const blocked = (v: number) => {
    const b = s.buildings[v];
    return !!b && b.owner !== seat;
  };
  const used = new Set<number>();
  const walk = (v: number): number => {
    let best = 0;
    for (const e of at.get(v) ?? []) {
      if (used.has(e)) continue;
      used.add(e);
      const edge = s.board.edges[e]!;
      const other = edge.a === v ? edge.b : edge.a;
      const len = 1 + (blocked(other) ? 0 : walk(other));
      used.delete(e);
      if (len > best) best = len;
    }
    return best;
  };
  let best = 0;
  for (const v of at.keys()) best = Math.max(best, walk(v));
  return best;
}
