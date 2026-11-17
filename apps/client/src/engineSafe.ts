// Safe wrappers around the shared engine helpers. If the engine throws (e.g. still a stub),
// a small local approximation is used so the UI keeps working. The server stays authoritative.
import {
  COSTS,
  RESOURCES,
  TERRAIN_RESOURCE,
  bankRate as eBankRate,
  canAfford as eCanAfford,
  validBanditHexes as eBanditHexes,
  validOutpostVertices as eOutposts,
  validRoadEdges as eRoads,
  validUpgradeVertices as eUpgrades,
  type Buyable,
  type PlayerView,
  type Resource,
  type Seat,
} from '@kervan/shared';

function guard<T>(fn: () => T, fallback: () => T): T {
  try {
    return fn();
  } catch {
    return fallback();
  }
}

function touchesOwnRoad(v: PlayerView, vertex: number, seat: Seat): boolean {
  return v.board.vertices[vertex].edges.some((e) => v.roads[e] === seat);
}

export function outpostVertices(v: PlayerView, seat: Seat): number[] {
  return guard(
    () => eOutposts(v, seat),
    () =>
      v.board.vertices
        .filter(
          (vx) =>
            !v.buildings[vx.id] &&
            vx.adjacent.every((a) => !v.buildings[a]) &&
            (v.phase === 'setup' || touchesOwnRoad(v, vx.id, seat)),
        )
        .map((vx) => vx.id),
  );
}

export function roadEdges(v: PlayerView, seat: Seat): number[] {
  return guard(
    () => eRoads(v, seat),
    () => {
      const free = v.board.edges.filter((e) => v.roads[e.id] === undefined);
      if (v.phase === 'setup') {
        const lv = v.setup?.lastVertex;
        return free.filter((e) => e.a === lv || e.b === lv).map((e) => e.id);
      }
      const ok = (vertex: number) => {
        const b = v.buildings[vertex];
        if (b) return b.owner === seat;
        return touchesOwnRoad(v, vertex, seat);
      };
      return free.filter((e) => ok(e.a) || ok(e.b)).map((e) => e.id);
    },
  );
}

export function upgradeVertices(v: PlayerView, seat: Seat): number[] {
  return guard(
    () => eUpgrades(v, seat),
    () =>
      Object.entries(v.buildings)
        .filter(([, b]) => b.owner === seat && b.kind === 'outpost')
        .map(([id]) => Number(id)),
  );
}

export function banditHexes(v: PlayerView): number[] {
  return guard(
    () => eBanditHexes(v),
    () => v.board.hexes.filter((h) => h.id !== v.bandit).map((h) => h.id),
  );
}

export function bankRate(v: PlayerView, seat: Seat, give: Resource): number {
  return guard(
    () => eBankRate(v, seat, give),
    () => {
      if (v.bargainActive && v.current === seat) return 2;
      const markets = Object.entries(v.buildings).filter(([, b]) => b.owner === seat && b.kind === 'market');
      if (markets.length === 0) return 4;
      const near = markets.some(([id]) =>
        v.board.vertices[Number(id)].hexes.some((h) => TERRAIN_RESOURCE[v.board.hexes[h].terrain] === give),
      );
      return near ? 2 : 3;
    },
  );
}

export function canAfford(v: PlayerView, seat: Seat, item: Buyable): boolean {
  return guard(
    () => eCanAfford(v, seat, item),
    () => {
      const bag = v.players.find((p) => p.seat === seat)?.resources;
      if (!bag) return false;
      return RESOURCES.every((r) => bag[r] >= (COSTS[item][r] ?? 0));
    },
  );
}
