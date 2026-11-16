import { describe, expect, it } from 'vitest';
import { type GameState, RESOURCES, type ResourceBag, TERRAIN_RESOURCE, bagTotal, emptyBag } from '../types';
import {
  applyAction,
  bankRate,
  canAfford,
  getView,
  routeLength,
  validBanditHexes,
  validOutpostVertices,
  validRoadEdges,
  validUpgradeVertices,
} from './index';
import { RICH, bag, blankMain, edgeBetween, edit, err, findPath, must, newGame, rollUntil, runSetup } from './testkit';

const total = (s: GameState, seat: number) => bagTotal(s.players[seat]!.resources);

describe('setup phase', () => {
  it('runs the snake draft and hands out second-outpost resources', () => {
    let s = newGame(3);
    const order: number[] = [];
    const second: Record<number, number> = {};
    while (s.phase === 'setup') {
      const seat = s.current;
      order.push(seat);
      const round = s.setup!.round;
      const vertex = validOutpostVertices(s, seat)[0]!;
      expect(validRoadEdges(s, seat)).toEqual([]);
      const placed = must(s, seat, { type: 'buildOutpost', vertex });
      s = placed.state;
      if (round === 2) second[seat] = vertex;
      expect(placed.events.some((e) => e.type === 'produced')).toBe(round === 2 && total(s, seat) > 0);
      expect(s.setup).toMatchObject({ expecting: 'road', lastVertex: vertex });
      expect(validOutpostVertices(s, seat)).toEqual([]);
      const edges = validRoadEdges(s, seat);
      expect(edges.sort()).toEqual([...s.board.vertices[vertex]!.edges].sort());
      s = must(s, seat, { type: 'buildRoad', edge: edges[0]! }).state;
    }
    expect(order).toEqual([0, 1, 2, 2, 1, 0]);
    expect(s).toMatchObject({ phase: 'main', setup: null, current: 0, turn: 1, step: 'roll', dice: null });
    for (const p of s.players) {
      const expected = emptyBag();
      for (const h of s.board.vertices[second[p.seat]!]!.hexes) {
        const res = TERRAIN_RESOURCE[s.board.hexes[h]!.terrain];
        if (res) expected[res] += 1;
      }
      expect(p.resources).toEqual(expected);
      expect(Object.values(s.buildings).filter((b) => b.owner === p.seat)).toHaveLength(2);
      expect(Object.values(s.roads).filter((o) => o === p.seat)).toHaveLength(2);
    }
  });

  it('emits turnStarted when the main phase begins', () => {
    let s = newGame(2);
    let last = must(s, 0, { type: 'buildOutpost', vertex: validOutpostVertices(s, 0)[0]! });
    while (last.state.phase === 'setup') {
      s = last.state;
      const seat = s.current;
      last =
        s.setup!.expecting === 'outpost'
          ? must(s, seat, { type: 'buildOutpost', vertex: validOutpostVertices(s, seat)[0]! })
          : must(s, seat, { type: 'buildRoad', edge: validRoadEdges(s, seat)[0]! });
    }
    expect(last.events).toContainEqual({ type: 'turnStarted', seat: 0, turn: 1 });
  });

  it('rejects illegal setup input with the right codes', () => {
    const s = newGame(3);
    expect(err(s, 1, { type: 'buildOutpost', vertex: 0 })).toBe('notYourTurn');
    expect(err(s, 0, { type: 'roll' })).toBe('wrongPhase');
    expect(err(s, 0, { type: 'buildRoad', edge: 0 })).toBe('wrongStep');
    expect(err(s, 0, { type: 'buildOutpost', vertex: -1 })).toBe('invalidLocation');
    expect(err(s, 0, { type: 'buildOutpost', vertex: 9999 })).toBe('invalidLocation');
    expect(err(s, 0, { type: 'buildOutpost', vertex: 'a' })).toBe('invalidLocation');
    expect(err(s, 0, { type: 'nonsense' })).toBe('badAction');
    expect(err(s, 0, null)).toBe('badAction');
    expect(err(s, 7, { type: 'roll' })).toBe('notYourTurn');

    const v = 10;
    const s1 = must(s, 0, { type: 'buildOutpost', vertex: v }).state;
    expect(err(s1, 0, { type: 'buildOutpost', vertex: 20 })).toBe('wrongStep');
    const far = s1.board.edges.find((e) => e.a !== v && e.b !== v)!;
    expect(err(s1, 0, { type: 'buildRoad', edge: far.id })).toBe('invalidLocation');
    const s2 = must(s1, 0, { type: 'buildRoad', edge: s1.board.vertices[v]!.edges[0]! }).state;
    // distance rule
    expect(err(s2, 1, { type: 'buildOutpost', vertex: v })).toBe('invalidLocation');
    for (const n of s2.board.vertices[v]!.adjacent) {
      expect(err(s2, 1, { type: 'buildOutpost', vertex: n })).toBe('invalidLocation');
      expect(validOutpostVertices(s2, 1)).not.toContain(n);
    }
    expect(validOutpostVertices(s2, 1)).toHaveLength(54 - 1 - s2.board.vertices[v]!.adjacent.length);
  });

  it('does not mutate the input state', () => {
    const s = newGame(3);
    const snapshot = JSON.stringify(s);
    must(s, 0, { type: 'buildOutpost', vertex: 0 });
    err(s, 0, { type: 'buildRoad', edge: 0 });
    expect(JSON.stringify(s)).toBe(snapshot);
  });
});

describe('roll and production', () => {
  it('only allows roll / playCard before rolling', () => {
    const s = runSetup(newGame(3));
    expect(err(s, 1, { type: 'roll' })).toBe('notYourTurn');
    expect(err(s, 0, { type: 'endTurn' })).toBe('wrongStep');
    expect(err(s, 0, { type: 'buildRoad', edge: 0 })).toBe('wrongStep');
    expect(err(s, 0, { type: 'buyCard' })).toBe('wrongStep');
    expect(err(s, 0, { type: 'bankTrade', give: 'timber', want: 'ore' })).toBe('wrongStep');
    expect(err(s, 0, { type: 'offerTrade', give: bag({ timber: 1 }), want: bag({ ore: 1 }) })).toBe('wrongStep');
    expect(err(s, 0, { type: 'moveBandit', hex: 0 })).toBe('wrongStep');
    expect(err(s, 0, { type: 'playCard', card: 'raider' })).toBe('noSuchCard');
    expect(validRoadEdges(s, 0)).toEqual([]);
    expect(validOutpostVertices(s, 0)).toEqual([]);
    expect(validUpgradeVertices(s, 0)).toEqual([]);
    expect(validBanditHexes(s)).toEqual([]);
  });

  it('produces 1 per outpost/market and 2 per keep, skipping the bandit hex', () => {
    const base = blankMain(3);
    const hex = base.board.hexes.find((h) => h.number !== null && h.id !== base.bandit)!;
    const res = TERRAIN_RESOURCE[hex.terrain]!;
    const s = edit(base, (d) => {
      d.step = 'roll';
      d.dice = null;
      d.buildings[hex.vertices[0]!] = { owner: 0, kind: 'outpost' };
      d.buildings[hex.vertices[2]!] = { owner: 1, kind: 'keep' };
      d.buildings[hex.vertices[4]!] = { owner: 2, kind: 'market' };
    });
    // reference computation over all hexes sharing the number
    const expected = (st: GameState) => {
      const g: ResourceBag[] = st.players.map(() => emptyBag());
      for (const h of st.board.hexes) {
        if (h.number !== hex.number || h.id === st.bandit) continue;
        for (const v of h.vertices) {
          const b = st.buildings[v];
          if (b) g[b.owner]![TERRAIN_RESOURCE[h.terrain]!] += b.kind === 'keep' ? 2 : 1;
        }
      }
      return g;
    };
    const r = rollUntil(s, (sum) => sum === hex.number);
    expect(r.state.step).toBe('actions');
    expect(r.state.players.map((p) => p.resources)).toEqual(expected(s));
    expect(r.state.players[0]!.resources[res]).toBeGreaterThanOrEqual(1);
    expect(r.state.players[1]!.resources[res]).toBeGreaterThanOrEqual(2);
    expect(r.state.players[2]!.resources[res]).toBeGreaterThanOrEqual(1);
    expect(r.events[0]).toMatchObject({ type: 'rolled', seat: 0 });
    const produced = r.events.find((e) => e.type === 'produced');
    expect(produced && produced.type === 'produced' && produced.gains[1]![res]).toBeGreaterThanOrEqual(2);

    const blocked = edit(s, (d) => (d.bandit = hex.id));
    const rb = rollUntil(blocked, (sum) => sum === hex.number);
    expect(rb.state.players.map((p) => p.resources)).toEqual(expected(blocked));
    expect(rb.state.players[0]!.resources[res]).toBeLessThan(r.state.players[0]!.resources[res]);
  });

  it('is deterministic for the same rng state', () => {
    const s = runSetup(newGame(3, 'standard', 5));
    expect(must(s, 0, { type: 'roll' })).toEqual(must(s, 0, { type: 'roll' }));
  });
});

describe('seven, bandit and steal', () => {
  const seven = () => {
    const s = runSetup(newGame(3));
    return rollUntil(s, (sum) => sum === 7);
  };

  it('a 7 produces nothing and asks for a choice', () => {
    const before = runSetup(newGame(3));
    const r = seven();
    expect(r.state.step).toBe('sevenChoice');
    expect(r.events.map((e) => e.type)).toEqual(['rolled']);
    expect(r.state.players.map((p) => p.resources)).toEqual(before.players.map((p) => p.resources));
    expect(err(r.state, 0, { type: 'endTurn' })).toBe('wrongStep');
    expect(err(r.state, 0, { type: 'roll' })).toBe('wrongStep');
    expect(err(r.state, 0, { type: 'playCard', card: 'raider' })).toBe('wrongStep');
  });

  it('tribute grants two chosen resources', () => {
    const s = seven().state;
    expect(err(s, 0, { type: 'sevenChoice', choice: 'tribute', resources: ['gold', 'ore'] })).toBe('badAction');
    expect(err(s, 0, { type: 'sevenChoice', choice: 'tribute' })).toBe('badAction');
    expect(err(s, 0, { type: 'sevenChoice', choice: 'x' })).toBe('badAction');
    const r = must(s, 0, { type: 'sevenChoice', choice: 'tribute', resources: ['ore', 'ore'] });
    expect(r.state.step).toBe('actions');
    expect(r.state.players[0]!.resources.ore).toBe(s.players[0]!.resources.ore + 2);
    expect(r.events).toEqual([{ type: 'tribute', seat: 0, resources: ['ore', 'ore'] }]);
  });

  it('bandit choice leads to moveBandit; hex must differ', () => {
    const s = must(seven().state, 0, { type: 'sevenChoice', choice: 'bandit' }).state;
    expect(s.step).toBe('moveBandit');
    expect(validBanditHexes(s)).toHaveLength(18);
    expect(validBanditHexes(s)).not.toContain(s.bandit);
    expect(err(s, 0, { type: 'moveBandit', hex: s.bandit })).toBe('invalidLocation');
    expect(err(s, 0, { type: 'moveBandit', hex: 99 })).toBe('invalidLocation');
    expect(err(s, 0, { type: 'steal', victim: 1 })).toBe('wrongStep');
  });

  const banditScene = (victims: { seat: number; res: number }[]) => {
    const base = blankMain(3);
    const hex = base.board.hexes.find((h) => h.id !== base.bandit)!;
    const s = edit(base, (d) => {
      d.step = 'moveBandit';
      d.buildings[hex.vertices[0]!] = { owner: 0, kind: 'outpost' }; // own building is never a candidate
      victims.forEach((v, i) => {
        d.buildings[hex.vertices[2 + 2 * i]!] = { owner: v.seat, kind: 'outpost' };
        d.players[v.seat]!.resources.grain = v.res;
      });
    });
    return { s, hex: hex.id };
  };

  it('0 candidates: straight to actions', () => {
    const { s, hex } = banditScene([{ seat: 1, res: 0 }]);
    const r = must(s, 0, { type: 'moveBandit', hex });
    expect(r.state.step).toBe('actions');
    expect(r.state.bandit).toBe(hex);
    expect(r.events).toEqual([{ type: 'banditMoved', seat: 0, hex }]);
  });

  it('1 candidate: steals automatically without revealing the resource', () => {
    const { s, hex } = banditScene([
      { seat: 1, res: 3 },
      { seat: 2, res: 0 },
    ]);
    const r = must(s, 0, { type: 'moveBandit', hex });
    expect(r.state.step).toBe('actions');
    expect(r.state.players[1]!.resources.grain).toBe(2);
    expect(r.state.players[0]!.resources.grain).toBe(1);
    expect(r.events).toEqual([
      { type: 'banditMoved', seat: 0, hex },
      { type: 'stole', seat: 0, victim: 1 },
    ]);
  });

  it('2+ candidates: the mover picks a victim', () => {
    const { s, hex } = banditScene([
      { seat: 1, res: 2 },
      { seat: 2, res: 2 },
    ]);
    const moved = must(s, 0, { type: 'moveBandit', hex }).state;
    expect(moved.step).toBe('steal');
    expect(moved.stealCandidates).toEqual([1, 2]);
    expect(err(moved, 0, { type: 'steal', victim: 0 })).toBe('invalidTarget');
    expect(err(moved, 0, { type: 'steal', victim: 5 })).toBe('invalidTarget');
    expect(err(moved, 1, { type: 'steal', victim: 2 })).toBe('notYourTurn');
    expect(err(moved, 0, { type: 'endTurn' })).toBe('wrongStep');
    const r = must(moved, 0, { type: 'steal', victim: 2 });
    expect(r.state.step).toBe('actions');
    expect(r.state.stealCandidates).toEqual([]);
    expect(total(r.state, 2)).toBe(1);
    expect(total(r.state, 1)).toBe(2);
    expect(total(r.state, 0)).toBe(1);
    expect(r.events).toEqual([{ type: 'stole', seat: 0, victim: 2 }]);
  });
});

describe('building', () => {
  it('roads must connect to own network and cost timber + stone', () => {
    const s0 = must(runSetup(newGame(3)), 0, { type: 'roll' }).state;
    const s = s0.step === 'actions' ? s0 : must(s0, 0, { type: 'sevenChoice', choice: 'tribute', resources: ['ore', 'ore'] }).state;
    const poor = edit(s, (d) => (d.players[0]!.resources = emptyBag()));
    const legal = validRoadEdges(poor, 0);
    expect(legal.length).toBeGreaterThan(0);
    expect(err(poor, 0, { type: 'buildRoad', edge: legal[0]! })).toBe('cannotAfford');
    const taken = Number(Object.keys(poor.roads)[0]);
    expect(err(poor, 0, { type: 'buildRoad', edge: taken })).toBe('invalidLocation');
    const rich = edit(poor, (d) => (d.players[0]!.resources = bag({ timber: 1, stone: 1 })));
    for (const e of rich.board.edges) {
      if (!legal.includes(e.id)) expect(err(rich, 0, { type: 'buildRoad', edge: e.id })).toBe('invalidLocation');
    }
    const r = must(rich, 0, { type: 'buildRoad', edge: legal[0]! });
    expect(r.state.roads[legal[0]!]).toBe(0);
    expect(total(r.state, 0)).toBe(0);
    expect(r.events).toContainEqual({ type: 'built', seat: 0, kind: 'road', edge: legal[0]! });
  });

  it('cannot connect a road through an opponent building', () => {
    const base = blankMain(2);
    const p = findPath(base.board, 2);
    const s = edit(base, (d) => {
      d.roads[p.edges[0]!] = 0;
      d.buildings[p.vertices[1]!] = { owner: 1, kind: 'outpost' };
      d.players[0]!.resources = { ...RICH };
    });
    expect(validRoadEdges(s, 0)).not.toContain(p.edges[1]);
    expect(err(s, 0, { type: 'buildRoad', edge: p.edges[1]! })).toBe('invalidLocation');
    const open = edit(s, (d) => delete d.buildings[p.vertices[1]!]);
    expect(validRoadEdges(open, 0)).toContain(p.edges[1]);
  });

  it('main-phase outposts need an own road and the distance rule', () => {
    const base = blankMain(2);
    const p = findPath(base.board, 3);
    const s = edit(base, (d) => {
      d.buildings[p.vertices[0]!] = { owner: 0, kind: 'outpost' };
      d.roads[p.edges[0]!] = 0;
      d.roads[p.edges[1]!] = 0;
      d.players[0]!.resources = bag({ timber: 1, stone: 1, grain: 1, fiber: 1 });
    });
    expect(validOutpostVertices(s, 0)).toEqual([p.vertices[2]]);
    expect(err(s, 0, { type: 'buildOutpost', vertex: p.vertices[1]! })).toBe('invalidLocation'); // too close
    expect(err(s, 0, { type: 'buildOutpost', vertex: p.vertices[3]! })).toBe('invalidLocation'); // no road
    const r = must(s, 0, { type: 'buildOutpost', vertex: p.vertices[2]! });
    expect(r.state.buildings[p.vertices[2]!]).toEqual({ owner: 0, kind: 'outpost' });
    expect(total(r.state, 0)).toBe(0);
    const again = edit(s, (d) => (d.players[0]!.resources = emptyBag()));
    expect(err(again, 0, { type: 'buildOutpost', vertex: p.vertices[2]! })).toBe('cannotAfford');
  });

  it('upgrades to keep / market, returning the outpost piece and respecting limits', () => {
    const base = blankMain(2);
    const p = findPath(base.board, 12);
    const spots = [0, 2, 4, 6, 8, 10, 12].map((i) => p.vertices[i]!);
    const s = edit(base, (d) => {
      d.buildings[spots[0]!] = { owner: 0, kind: 'outpost' };
      d.buildings[spots[1]!] = { owner: 1, kind: 'outpost' };
      d.players[0]!.resources = bag({ grain: 2, ore: 3 });
    });
    expect(validUpgradeVertices(s, 0)).toEqual([spots[0]]);
    expect(validUpgradeVertices(s, 1)).toEqual([]);
    expect(err(s, 0, { type: 'upgrade', vertex: spots[1]!, to: 'keep' })).toBe('invalidLocation');
    expect(err(s, 0, { type: 'upgrade', vertex: spots[0]!, to: 'market' })).toBe('cannotAfford');
    expect(err(s, 0, { type: 'upgrade', vertex: spots[0]!, to: 'castle' })).toBe('badAction');
    const r = must(s, 0, { type: 'upgrade', vertex: spots[0]!, to: 'keep' });
    expect(r.state.buildings[spots[0]!]).toEqual({ owner: 0, kind: 'keep' });
    expect(total(r.state, 0)).toBe(0);
    expect(r.events).toEqual([{ type: 'built', seat: 0, kind: 'keep', vertex: spots[0]! }]);
    expect(getView(r.state, 0).players[0]!.piecesLeft).toEqual({ road: 15, outpost: 5, keep: 3, market: 3 });
    expect(err(r.state, 0, { type: 'upgrade', vertex: spots[0]!, to: 'market' })).toBe('invalidLocation'); // no keep <-> market

    const full = edit(base, (d) => {
      for (const i of [0, 1, 2]) d.buildings[spots[i]!] = { owner: 0, kind: 'market' };
      for (const i of [3, 4, 5]) d.buildings[spots[i]!] = { owner: 0, kind: 'keep' };
      d.buildings[spots[6]!] = { owner: 0, kind: 'outpost' };
      d.players[0]!.resources = { ...RICH };
    });
    expect(err(full, 0, { type: 'upgrade', vertex: spots[6]!, to: 'market' })).toBe('noPiecesLeft');
    const k4 = must(full, 0, { type: 'upgrade', vertex: spots[6]!, to: 'keep' }).state;
    expect(getView(k4, 0).players[0]!.piecesLeft).toEqual({ road: 15, outpost: 5, keep: 0, market: 0 });
  });

  it('enforces road and outpost piece limits', () => {
    const base = blankMain(2);
    const p = findPath(base.board, 16);
    const s = edit(base, (d) => {
      for (let i = 0; i < 15; i++) d.roads[p.edges[i]!] = 0;
      d.players[0]!.resources = { ...RICH };
    });
    expect(err(s, 0, { type: 'buildRoad', edge: p.edges[15]! })).toBe('noPiecesLeft');
    expect(validRoadEdges(s, 0)).toEqual([]);
    const o = edit(s, (d) => {
      for (const i of [0, 2, 4, 6, 8]) d.buildings[p.vertices[i]!] = { owner: 0, kind: 'outpost' };
    });
    expect(err(o, 0, { type: 'buildOutpost', vertex: p.vertices[10]! })).toBe('noPiecesLeft');
    expect(validOutpostVertices(o, 0)).toEqual([]);
  });
});

describe('decree cards', () => {
  const withCards = (cards: GameState['players'][0]['cards'], fn?: (d: GameState) => void) =>
    edit(blankMain(3), (d) => {
      d.players[0]!.cards = cards;
      fn?.(d);
    });

  it('buyCard draws the top card into newCards; it cannot be played the same turn', () => {
    const s = edit(blankMain(3), (d) => {
      d.players[0]!.resources = bag({ grain: 1, fiber: 1, ore: 1 });
      d.deck = ['glory', 'raider'];
    });
    const r = must(s, 0, { type: 'buyCard' });
    expect(r.state.players[0]!.newCards).toEqual(['raider']);
    expect(r.state.players[0]!.cards).toEqual([]);
    expect(r.state.deck).toEqual(['glory']);
    expect(total(r.state, 0)).toBe(0);
    expect(r.events).toEqual([{ type: 'boughtCard', seat: 0 }]);
    expect(err(r.state, 0, { type: 'playCard', card: 'raider' })).toBe('noSuchCard');
    expect(err(r.state, 0, { type: 'buyCard' })).toBe('cannotAfford');
    const next = must(r.state, 0, { type: 'endTurn' }).state;
    expect(next.players[0]!.cards).toEqual(['raider']);
    expect(next.players[0]!.newCards).toEqual([]);
    const empty = edit(s, (d) => (d.deck = []));
    expect(err(empty, 0, { type: 'buyCard' })).toBe('deckEmpty');
  });

  it('allows one card per turn and never glory', () => {
    const s = withCards(['bargain', 'bounty', 'glory']);
    expect(err(s, 0, { type: 'playCard', card: 'glory' })).toBe('badAction');
    expect(err(s, 0, { type: 'playCard', card: 'caravan' })).toBe('noSuchCard');
    expect(err(s, 1, { type: 'playCard', card: 'bargain' })).toBe('notYourTurn');
    const r = must(s, 0, { type: 'playCard', card: 'bargain' });
    expect(r.state.players[0]!.playedCardThisTurn).toBe(true);
    expect(err(r.state, 0, { type: 'playCard', card: 'bounty', resources: ['ore', 'ore'] })).toBe('cardAlreadyPlayed');
    const next = must(r.state, 0, { type: 'endTurn' }).state;
    expect(next.players[0]!.playedCardThisTurn).toBe(false);
  });

  it('raider moves the bandit and returns to the step it was played from', () => {
    const before = withCards(['raider'], (d) => {
      d.step = 'roll';
      d.dice = null;
    });
    const hex = before.board.hexes.find((h) => h.id !== before.bandit)!.id;
    const played = must(before, 0, { type: 'playCard', card: 'raider' });
    expect(played.state.step).toBe('moveBandit');
    expect(played.state.players[0]!.raidersPlayed).toBe(1);
    expect(played.state.players[0]!.cards).toEqual([]);
    expect(played.events).toEqual([{ type: 'playedCard', seat: 0, card: 'raider' }]);
    expect(must(played.state, 0, { type: 'moveBandit', hex }).state.step).toBe('roll');

    const after = withCards(['raider']);
    const s2 = must(after, 0, { type: 'playCard', card: 'raider' }).state;
    expect(must(s2, 0, { type: 'moveBandit', hex }).state.step).toBe('actions');

    // returns to `roll` through the steal step as well
    const two = edit(before, (d) => {
      const h = d.board.hexes[hex]!;
      d.buildings[h.vertices[0]!] = { owner: 1, kind: 'outpost' };
      d.buildings[h.vertices[2]!] = { owner: 2, kind: 'outpost' };
      d.players[1]!.resources.ore = 1;
      d.players[2]!.resources.ore = 1;
    });
    let t = must(two, 0, { type: 'playCard', card: 'raider' }).state;
    t = must(t, 0, { type: 'moveBandit', hex }).state;
    expect(t.step).toBe('steal');
    t = must(t, 0, { type: 'steal', victim: 1 }).state;
    expect(t.step).toBe('roll');
    expect(t.players[0]!.resources.ore).toBe(1);
  });

  it('caravan grants up to two free roads that expire at end of turn', () => {
    const base = blankMain(2);
    const p = findPath(base.board, 4);
    const s = edit(base, (d) => {
      d.players[0]!.cards = ['caravan'];
      d.roads[p.edges[0]!] = 0;
    });
    const c = must(s, 0, { type: 'playCard', card: 'caravan' }).state;
    expect(c.freeRoads).toBe(2);
    const r1 = must(c, 0, { type: 'buildRoad', edge: p.edges[1]! }).state;
    const r2 = must(r1, 0, { type: 'buildRoad', edge: p.edges[2]! }).state;
    expect(r2.freeRoads).toBe(0);
    expect(total(r2, 0)).toBe(0);
    expect(err(r2, 0, { type: 'buildRoad', edge: p.edges[3]! })).toBe('cannotAfford');
    expect(must(r1, 0, { type: 'endTurn' }).state.freeRoads).toBe(0);

    const long = findPath(base.board, 15);
    const fewLeft = edit(base, (d) => {
      d.players[0]!.cards = ['caravan'];
      for (let i = 0; i < 14; i++) d.roads[long.edges[i]!] = 0;
    });
    expect(must(fewLeft, 0, { type: 'playCard', card: 'caravan' }).state.freeRoads).toBe(1);
  });

  it('bounty grants two chosen resources', () => {
    const s = withCards(['bounty']);
    expect(err(s, 0, { type: 'playCard', card: 'bounty' })).toBe('badAction');
    expect(err(s, 0, { type: 'playCard', card: 'bounty', resources: ['ore'] })).toBe('badAction');
    const r = must(s, 0, { type: 'playCard', card: 'bounty', resources: ['ore', 'timber'] });
    expect(r.state.players[0]!.resources).toEqual(bag({ ore: 1, timber: 1 }));
  });

  it('bargain makes every bank trade 2:1 until end of turn', () => {
    const s = withCards(['bargain'], (d) => (d.players[0]!.resources = bag({ timber: 4 })));
    expect(bankRate(s, 0, 'timber')).toBe(4);
    const b = must(s, 0, { type: 'playCard', card: 'bargain' }).state;
    expect(b.bargainActive).toBe(true);
    for (const r of RESOURCES) expect(bankRate(b, 0, r)).toBe(2);
    const t = must(b, 0, { type: 'bankTrade', give: 'timber', want: 'ore' });
    expect(t.state.players[0]!.resources).toEqual(bag({ timber: 2, ore: 1 }));
    expect(t.events).toEqual([{ type: 'bankTraded', seat: 0, give: 'timber', giveCount: 2, want: 'ore' }]);
    const next = must(t.state, 0, { type: 'endTurn' }).state;
    expect(next.bargainActive).toBe(false);
    expect(bankRate(next, 0, 'timber')).toBe(4);
  });
});

describe('bank trade', () => {
  it('uses 4:1, 3:1 with a market and 2:1 next to the matching terrain', () => {
    const base = blankMain(2);
    const forest = base.board.hexes.find((h) => h.terrain === 'forest')!;
    const vertex = forest.vertices[0]!;
    const local = new Set(base.board.vertices[vertex]!.hexes.map((h) => TERRAIN_RESOURCE[base.board.hexes[h]!.terrain]));
    const s = edit(base, (d) => (d.players[0]!.resources = bag({ timber: 4, ore: 3 })));
    for (const r of RESOURCES) expect(bankRate(s, 0, r)).toBe(4);
    expect(err(s, 0, { type: 'bankTrade', give: 'ore', want: 'grain' })).toBe('cannotAfford');
    expect(err(s, 0, { type: 'bankTrade', give: 'ore', want: 'ore' })).toBe('invalidTrade');
    expect(err(s, 0, { type: 'bankTrade', give: 'gold', want: 'ore' })).toBe('invalidTrade');
    expect(err(s, 1, { type: 'bankTrade', give: 'ore', want: 'grain' })).toBe('notYourTurn');
    expect(must(s, 0, { type: 'bankTrade', give: 'timber', want: 'grain' }).state.players[0]!.resources).toEqual(
      bag({ ore: 3, grain: 1 }),
    );

    const m = edit(s, (d) => (d.buildings[vertex] = { owner: 0, kind: 'market' }));
    for (const r of RESOURCES) {
      expect(bankRate(m, 0, r)).toBe(local.has(r) ? 2 : 3);
      expect(bankRate(m, 1, r)).toBe(4);
      expect(bankRate(getView(m, 1), 0, r)).toBe(local.has(r) ? 2 : 3);
    }
    expect(bankRate(m, 0, 'timber')).toBe(2);
    const t = must(m, 0, { type: 'bankTrade', give: 'timber', want: 'grain' });
    expect(t.state.players[0]!.resources.timber).toBe(2);
    expect(t.events[0]).toMatchObject({ giveCount: 2 });
    // an outpost or keep on the same spot gives no discount
    const k = edit(s, (d) => (d.buildings[vertex] = { owner: 0, kind: 'keep' }));
    expect(bankRate(k, 0, 'timber')).toBe(4);
  });
});

describe('player trade', () => {
  const scene = () =>
    edit(blankMain(3), (d) => {
      d.players[0]!.resources = bag({ timber: 2 });
      d.players[1]!.resources = bag({ ore: 1 });
      d.players[2]!.resources = bag({ grain: 1 });
    });
  const offer = { type: 'offerTrade', give: bag({ timber: 2 }), want: bag({ ore: 1 }) } as const;

  it('validates offers', () => {
    const s = scene();
    expect(err(s, 1, offer)).toBe('notYourTurn');
    expect(err(s, 0, { ...offer, give: emptyBag() })).toBe('invalidTrade');
    expect(err(s, 0, { ...offer, want: emptyBag() })).toBe('invalidTrade');
    expect(err(s, 0, { ...offer, want: bag({ timber: 1 }) })).toBe('invalidTrade');
    expect(err(s, 0, { ...offer, give: bag({ timber: -1 }) })).toBe('invalidTrade');
    expect(err(s, 0, { ...offer, give: bag({ timber: 1.5 }) })).toBe('invalidTrade');
    expect(err(s, 0, { ...offer, give: 'all' })).toBe('invalidTrade');
    expect(err(s, 0, { ...offer, give: bag({ timber: 3 }) })).toBe('cannotAfford');
    expect(err(s, 0, { type: 'confirmTrade', with: 1 })).toBe('noOpenTrade');
    expect(err(s, 0, { type: 'cancelTrade' })).toBe('noOpenTrade');
    expect(err(s, 1, { type: 'respondTrade', accept: true })).toBe('noOpenTrade');
  });

  it('offer -> respond -> confirm swaps resources', () => {
    const o = must(scene(), 0, offer);
    expect(o.events).toEqual([{ type: 'tradeOffered', seat: 0 }]);
    expect(o.state.trade).toEqual({ from: 0, give: bag({ timber: 2 }), want: bag({ ore: 1 }), responses: {} });
    expect(err(o.state, 0, { type: 'respondTrade', accept: true })).toBe('invalidTrade');
    expect(err(o.state, 2, { type: 'respondTrade', accept: true })).toBe('cannotAfford');
    expect(err(o.state, 0, { type: 'confirmTrade', with: 1 })).toBe('invalidTarget');
    let s = must(o.state, 2, { type: 'respondTrade', accept: false }).state;
    s = must(s, 1, { type: 'respondTrade', accept: true }).state;
    expect(s.trade!.responses).toEqual({ 1: 'accept', 2: 'decline' });
    expect(err(s, 0, { type: 'confirmTrade', with: 2 })).toBe('invalidTarget');
    expect(err(s, 0, { type: 'confirmTrade', with: 0 })).toBe('invalidTarget');
    expect(err(s, 1, { type: 'confirmTrade', with: 1 })).toBe('notYourTurn');
    const done = must(s, 0, { type: 'confirmTrade', with: 1 });
    expect(done.state.trade).toBeNull();
    expect(done.state.players[0]!.resources).toEqual(bag({ ore: 1 }));
    expect(done.state.players[1]!.resources).toEqual(bag({ timber: 2 }));
    expect(done.events).toEqual([
      { type: 'tradeCompleted', seat: 0, with: 1, give: bag({ timber: 2 }), want: bag({ ore: 1 }) },
    ]);
  });

  it('re-checks both hands at confirm time, replaces offers, and cancels', () => {
    let s = must(scene(), 0, offer).state;
    s = must(s, 1, { type: 'respondTrade', accept: true }).state;
    const drained = edit(s, (d) => (d.players[1]!.resources = emptyBag()));
    expect(err(drained, 0, { type: 'confirmTrade', with: 1 })).toBe('cannotAfford');

    const replaced = must(s, 0, { ...offer, give: bag({ timber: 1 }) }).state;
    expect(replaced.trade!.responses).toEqual({});
    expect(replaced.trade!.give).toEqual(bag({ timber: 1 }));

    const cancelled = must(s, 0, { type: 'cancelTrade' });
    expect(cancelled.state.trade).toBeNull();
    expect(cancelled.events).toEqual([{ type: 'tradeCancelled', seat: 0 }]);

    const ended = must(s, 0, { type: 'endTurn' });
    expect(ended.state.trade).toBeNull();
    expect(ended.events).toEqual([
      { type: 'tradeCancelled', seat: 0 },
      { type: 'turnStarted', seat: 1, turn: 2 },
    ]);
  });
});

describe('endTurn and the hand limit', () => {
  it('passes the turn and resets per-turn flags', () => {
    const s = edit(blankMain(3), (d) => {
      d.current = 2;
      d.freeRoads = 1;
      d.bargainActive = true;
      d.players[2]!.newCards = ['glory'];
      d.players[2]!.playedCardThisTurn = true;
      d.config.targetPoints = 12;
    });
    const r = must(s, 2, { type: 'endTurn' });
    expect(r.state).toMatchObject({ current: 0, turn: 2, step: 'roll', dice: null, freeRoads: 0, bargainActive: false });
    expect(r.state.players[2]).toMatchObject({ cards: ['glory'], newCards: [], playedCardThisTurn: false });
    expect(r.events).toEqual([{ type: 'turnStarted', seat: 0, turn: 2 }]);
  });

  it('requires discarding exactly hand - 10', () => {
    const s = edit(blankMain(3), (d) => (d.players[0]!.resources = bag({ timber: 6, ore: 6, grain: 1 })));
    const end = (discard?: unknown) => ({ type: 'endTurn', discard });
    expect(err(s, 0, end())).toBe('invalidDiscard');
    expect(err(s, 0, end(bag({ timber: 2 })))).toBe('invalidDiscard');
    expect(err(s, 0, end(bag({ timber: 4 })))).toBe('invalidDiscard');
    expect(err(s, 0, end(bag({ grain: 3 })))).toBe('invalidDiscard');
    expect(err(s, 0, end(bag({ timber: 4, ore: -1 })))).toBe('invalidDiscard');
    expect(err(s, 0, end('lots'))).toBe('invalidDiscard');
    const r = must(s, 0, { type: 'endTurn', discard: bag({ timber: 2, grain: 1 }) });
    expect(r.state.players[0]!.resources).toEqual(bag({ timber: 4, ore: 6 }));
    expect(r.events).toEqual([
      { type: 'discarded', seat: 0, count: 3 },
      { type: 'turnStarted', seat: 1, turn: 2 },
    ]);

    const ten = edit(s, (d) => (d.players[0]!.resources = bag({ timber: 10 })));
    expect(err(ten, 0, end(bag({ timber: 1 })))).toBe('invalidDiscard');
    expect(must(ten, 0, { type: 'endTurn', discard: emptyBag() }).state.current).toBe(1);
    expect(must(ten, 0, { type: 'endTurn' }).state.players[0]!.resources.timber).toBe(10);
  });
});

describe('longest route', () => {
  it('measures chains, forks and loops', () => {
    const base = blankMain(2);
    expect(routeLength(base, 0)).toBe(0);
    const p = findPath(base.board, 6);
    const chain = edit(base, (d) => p.edges.forEach((e) => (d.roads[e] = 0)));
    expect(routeLength(chain, 0)).toBe(6);
    expect(routeLength(chain, 1)).toBe(0);
    expect(routeLength(getView(chain, 1), 0)).toBe(6);

    const ring = base.board.hexes[9]!.vertices;
    const loop = edit(base, (d) => {
      for (let i = 0; i < 6; i++) d.roads[edgeBetween(d.board, ring[i]!, ring[(i + 1) % 6]!)] = 0;
    });
    expect(routeLength(loop, 0)).toBe(6);

    // fork: a centre vertex with three single-road arms counts 2, not 3
    const centre = base.board.vertices.find((v) => v.edges.length === 3)!;
    const fork = edit(base, (d) => centre.edges.forEach((e) => (d.roads[e] = 0)));
    expect(routeLength(fork, 0)).toBe(2);

    // own building does not break, opponent building does
    const own = edit(chain, (d) => (d.buildings[p.vertices[2]!] = { owner: 0, kind: 'outpost' }));
    expect(routeLength(own, 0)).toBe(6);
    const cut = edit(chain, (d) => (d.buildings[p.vertices[2]!] = { owner: 1, kind: 'outpost' }));
    expect(routeLength(cut, 0)).toBe(4);
  });

  it('awards at 5, needs strictly more to take over', () => {
    const base = blankMain(2);
    const a = findPath(base.board, 5);
    const b = findPath(base.board, 6, new Set(a.vertices));
    let s = edit(base, (d) => {
      for (let i = 0; i < 4; i++) d.roads[a.edges[i]!] = 0;
      for (let i = 0; i < 4; i++) d.roads[b.edges[i]!] = 1;
      d.players[0]!.resources = { ...RICH };
      d.players[1]!.resources = { ...RICH };
    });
    expect(s.longestRoute).toEqual({ owner: null, length: 0 });
    const first = must(s, 0, { type: 'buildRoad', edge: a.edges[4]! });
    expect(first.state.longestRoute).toEqual({ owner: 0, length: 5 });
    expect(first.events).toContainEqual({ type: 'bonusChanged', bonus: 'longestRoute', owner: 0 });
    expect(getView(first.state, null).players[0]!.publicPoints).toBe(2);

    s = edit(first.state, (d) => (d.current = 1));
    const tie = must(s, 1, { type: 'buildRoad', edge: b.edges[4]! });
    expect(tie.state.longestRoute).toEqual({ owner: 0, length: 5 });
    expect(tie.events.some((e) => e.type === 'bonusChanged')).toBe(false);
    const over = must(tie.state, 1, { type: 'buildRoad', edge: b.edges[5]! });
    expect(over.state.longestRoute).toEqual({ owner: 1, length: 6 });
    expect(over.events).toContainEqual({ type: 'bonusChanged', bonus: 'longestRoute', owner: 1 });
  });

  const breakScene = (rivalRoads: number) => {
    const base = blankMain(3);
    const a = findPath(base.board, 5);
    const mid = [1, 2, 3, 4].map((i) => a.vertices[i]!).find((v) => base.board.vertices[v]!.edges.length === 3)!;
    const spur = base.board.vertices[mid]!.edges.find((e) => !a.edges.includes(e))!;
    const spurEnd = base.board.edges[spur]!.a === mid ? base.board.edges[spur]!.b : base.board.edges[spur]!.a;
    const c = findPath(base.board, 6, new Set([...a.vertices, spurEnd]));
    const s = edit(base, (d) => {
      a.edges.forEach((e) => (d.roads[e] = 0));
      d.roads[spur] = 1;
      for (let i = 0; i < rivalRoads; i++) d.roads[c.edges[i]!] = 2;
      d.longestRoute = { owner: 0, length: 5 };
      d.current = 1;
      d.players[1]!.resources = { ...RICH };
    });
    return { s, mid };
  };

  it('an opponent building breaks the route; nobody qualifies -> bonus vacated', () => {
    const { s, mid } = breakScene(4);
    const r = must(s, 1, { type: 'buildOutpost', vertex: mid });
    expect(routeLength(r.state, 0)).toBeLessThan(5);
    expect(r.state.longestRoute).toEqual({ owner: null, length: 0 });
    expect(r.events).toContainEqual({ type: 'bonusChanged', bonus: 'longestRoute', owner: null });
  });

  it('after a break the single longest (>= 5) player takes the bonus', () => {
    const { s, mid } = breakScene(5);
    const r = must(s, 1, { type: 'buildOutpost', vertex: mid });
    expect(r.state.longestRoute).toEqual({ owner: 2, length: 5 });
    expect(r.events).toContainEqual({ type: 'bonusChanged', bonus: 'longestRoute', owner: 2 });
  });

  it('after a break a tie for longest leaves the bonus unowned', () => {
    const { s, mid } = breakScene(5);
    const b = findPath(s.board, 5, new Set(Object.keys(s.roads).flatMap((e) => [s.board.edges[+e]!.a, s.board.edges[+e]!.b])));
    const tied = edit(s, (d) => b.edges.forEach((e) => (d.roads[e] = 1)));
    const r = must(tied, 1, { type: 'buildOutpost', vertex: mid });
    expect(routeLength(r.state, 1)).toBe(5);
    expect(routeLength(r.state, 2)).toBe(5);
    expect(r.state.longestRoute).toEqual({ owner: null, length: 0 });
  });
});

describe('strongest guard', () => {
  it('awards at 3 raiders and needs strictly more to take over', () => {
    const hexes = blankMain(2).board.hexes.map((h) => h.id);
    const raid = (st: GameState, seat: number) => {
      const ready = edit(st, (d) => {
        d.current = seat;
        d.players[seat]!.cards = ['raider'];
        d.players[seat]!.playedCardThisTurn = false;
      });
      const played = must(ready, seat, { type: 'playCard', card: 'raider' });
      const moved = must(played.state, seat, { type: 'moveBandit', hex: hexes.find((h) => h !== played.state.bandit)! });
      return { state: moved.state, events: played.events };
    };
    let s = blankMain(2);
    s = raid(s, 0).state;
    s = raid(s, 0).state;
    expect(s.strongestGuard).toEqual({ owner: null, count: 0 });
    const third = raid(s, 0);
    expect(third.state.strongestGuard).toEqual({ owner: 0, count: 3 });
    expect(third.events).toContainEqual({ type: 'bonusChanged', bonus: 'strongestGuard', owner: 0 });
    expect(getView(third.state, 1).players[0]!.publicPoints).toBe(2);

    s = third.state;
    for (let i = 0; i < 3; i++) s = raid(s, 1).state;
    expect(s.strongestGuard).toEqual({ owner: 0, count: 3 }); // tie: holder keeps
    const fourth = raid(s, 1);
    expect(fourth.state.strongestGuard).toEqual({ owner: 1, count: 4 });
    expect(fourth.events).toContainEqual({ type: 'bonusChanged', bonus: 'strongestGuard', owner: 1 });
    const again = raid(fourth.state, 1);
    expect(again.state.strongestGuard).toEqual({ owner: 1, count: 5 });
    expect(again.events.some((e) => e.type === 'bonusChanged')).toBe(false);
  });
});

describe('winning', () => {
  const nearWin = () => {
    const base = blankMain(2, 'standard', 1, 8);
    const p = findPath(base.board, 8);
    return {
      p,
      s: edit(base, (d) => {
        for (const i of [0, 2, 4]) d.buildings[p.vertices[i]!] = { owner: 0, kind: 'keep' };
        d.buildings[p.vertices[6]!] = { owner: 0, kind: 'outpost' }; // 7 points
        d.players[0]!.resources = bag({ grain: 3, ore: 4, fiber: 1 });
      }),
    };
  };

  it('ends the game as soon as the current player reaches the target', () => {
    const { s, p } = nearWin();
    const r = must(s, 0, { type: 'upgrade', vertex: p.vertices[6]!, to: 'keep' });
    expect(r.state).toMatchObject({ phase: 'finished', winner: 0 });
    expect(r.events.at(-1)).toEqual({ type: 'gameWon', seat: 0, points: 8 });
    expect(err(r.state, 0, { type: 'endTurn' })).toBe('wrongPhase');
    expect(err(r.state, 1, { type: 'roll' })).toBe('wrongPhase');
    expect(validRoadEdges(r.state, 0)).toEqual([]);
  });

  it('counts hidden glory cards, including one bought this turn', () => {
    const { s } = nearWin();
    const g = edit(s, (d) => (d.deck = ['glory']));
    const r = must(g, 0, { type: 'buyCard' });
    expect(r.state).toMatchObject({ phase: 'finished', winner: 0 });
    expect(r.events.at(-1)).toEqual({ type: 'gameWon', seat: 0, points: 8 });
  });

  it('only wins on your own turn (checked when the turn starts)', () => {
    const { s } = nearWin();
    const other = edit(s, (d) => {
      d.current = 1;
      d.players[0]!.cards = ['glory'];
      d.players[1]!.resources = bag({ timber: 4 });
    });
    const t = must(other, 1, { type: 'bankTrade', give: 'timber', want: 'ore' });
    expect(t.state.phase).toBe('main');
    const r = must(t.state, 1, { type: 'endTurn' });
    expect(r.state).toMatchObject({ phase: 'finished', winner: 0, current: 0 });
    expect(r.events.map((e) => e.type)).toEqual(['turnStarted', 'gameWon']);
  });
});

describe('getView', () => {
  const scene = () =>
    edit(runSetup(newGame(3)), (d) => {
      d.players[0]!.resources = bag({ timber: 2, ore: 1 });
      d.players[0]!.cards = ['glory', 'raider'];
      d.players[0]!.newCards = ['bounty'];
      d.players[1]!.resources = bag({ grain: 4 });
      d.players[1]!.cards = ['glory'];
    });

  it('redacts other players, the deck and the rng', () => {
    const s = scene();
    const v = getView(s, 0);
    expect(v.you).toBe(0);
    expect('deck' in v).toBe(false);
    expect('rng' in v).toBe(false);
    expect(v.deckCount).toBe(s.deck.length);
    expect(v.players[0]).toMatchObject({
      resources: bag({ timber: 2, ore: 1 }),
      resourceCount: 3,
      cards: ['glory', 'raider'],
      newCards: ['bounty'],
      cardCount: 3,
      publicPoints: 2,
      totalPoints: 3,
      piecesLeft: { road: 13, outpost: 3, keep: 4, market: 3 },
    });
    expect(v.players[1]).toMatchObject({
      resources: null,
      resourceCount: 4,
      cards: null,
      newCards: null,
      cardCount: 1,
      publicPoints: 2,
      totalPoints: null,
    });
    expect(JSON.stringify(v.players[1])).not.toContain('glory');
    expect(v.board).toEqual(s.board);
    expect(v.buildings).toEqual(s.buildings);
    expect(JSON.parse(JSON.stringify(v))).toEqual(v);
  });

  it('spectators see no private data; finished games reveal totals', () => {
    const s = scene();
    const spec = getView(s, null);
    expect(spec.you).toBeNull();
    for (const p of spec.players) {
      expect(p.resources).toBeNull();
      expect(p.cards).toBeNull();
      expect(p.newCards).toBeNull();
      expect(p.totalPoints).toBeNull();
    }
    expect(getView(s, 9).you).toBeNull();
    const done = getView(edit(s, (d) => ((d.phase = 'finished'), (d.winner = 0))), 2);
    expect(done.players.map((p) => p.totalPoints)).toEqual([3, 3, 2]);
    expect(done.players[0]!.cards).toBeNull();
  });

  it('helpers work on a view for the own seat', () => {
    const s = edit(scene(), (d) => {
      d.step = 'actions';
      d.dice = [2, 3];
      d.players[0]!.resources = bag({ timber: 1, stone: 1 });
    });
    const v = getView(s, 0);
    expect(validRoadEdges(v, 0)).toEqual(validRoadEdges(s, 0));
    expect(validOutpostVertices(v, 0)).toEqual(validOutpostVertices(s, 0));
    expect(validUpgradeVertices(v, 0)).toEqual(validUpgradeVertices(s, 0));
    expect(validUpgradeVertices(v, 0)).toHaveLength(2);
    expect(canAfford(v, 0, 'road')).toBe(true);
    expect(canAfford(v, 0, 'outpost')).toBe(false);
    expect(canAfford(v, 1, 'road')).toBe(false); // hidden hand
    expect(canAfford(s, 1, 'road')).toBe(false);
    expect(validRoadEdges(v, 1)).toEqual([]);
    expect(getView(s, 1).players[0]!.resources).toBeNull();
  });
});

describe('robustness', () => {
  it('never throws on malformed input', () => {
    const states = [newGame(3), runSetup(newGame(3)), blankMain(3)];
    const junk: unknown[] = [
      undefined,
      null,
      42,
      'roll',
      [],
      {},
      { type: 5 },
      { type: 'buildRoad' },
      { type: 'buildRoad', edge: null },
      { type: 'buildRoad', edge: 1.5 },
      { type: 'buildRoad', edge: '__proto__' },
      { type: 'buildOutpost', vertex: {} },
      { type: 'upgrade', vertex: 'x', to: 'keep' },
      { type: 'moveBandit' },
      { type: 'steal', victim: 'you' },
      { type: 'playCard' },
      { type: 'playCard', card: 'bounty', resources: 'ore' },
      { type: 'bankTrade' },
      { type: 'offerTrade' },
      { type: 'offerTrade', give: null, want: [] },
      { type: 'confirmTrade' },
      { type: 'respondTrade' },
      { type: 'endTurn', discard: 3 },
      { type: 'sevenChoice' },
    ];
    for (const s of states) {
      const snapshot = JSON.stringify(s);
      for (const j of junk) {
        for (const seat of [0, 1, -1, 99, 1.5, Number.NaN, '0' as unknown as number]) {
          const r = applyAction(s, seat, j as never);
          expect(r.ok).toBe(false);
        }
      }
      expect(JSON.stringify(s)).toBe(snapshot);
    }
  });
});
