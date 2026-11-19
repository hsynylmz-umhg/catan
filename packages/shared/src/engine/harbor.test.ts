import { describe, expect, it } from 'vitest';
import { HARBOR_COUNTS, RESOURCES, type Board } from '../types';
import { bankRate, coastalEdges, generateBoard, getView, harborsOf } from './index';
import { bag, blankMain, edit, must } from './testkit';

const sizes = ['standard', 'large'] as const;

function corners(board: Board, edge: number) {
  const e = board.edges[edge]!;
  return [e.a, e.b];
}

describe('harbours', () => {
  for (const size of sizes) {
    it(`${size}: right counts and kinds, every resource has a 2:1 harbour`, () => {
      for (const seed of [1, 7, 42, 2026, 99999]) {
        const b = generateBoard(size, seed);
        const hs = b.harbors!;
        const c = HARBOR_COUNTS[size];
        expect(hs).toHaveLength(c.any + c.specific);
        expect(hs.filter((h) => h.kind === 'any')).toHaveLength(c.any);
        for (const r of RESOURCES) expect(hs.some((h) => h.kind === r)).toBe(true);
      }
    });

    it(`${size}: on distinct coastal edges, never sharing a corner, spread round the island`, () => {
      for (let seed = 0; seed < 60; seed++) {
        const b = generateBoard(size, seed);
        const coast = coastalEdges(b);
        expect(coast).toHaveLength(size === 'standard' ? 30 : 42);
        const hs = b.harbors!;
        const used = new Set<number>();
        for (const h of hs) {
          expect(coast).toContain(h.edge);
          for (const v of corners(b, h.edge)) {
            expect(used.has(v)).toBe(false);
            used.add(v);
          }
        }
        // no gap along the coast is larger than twice the even spacing
        const idx = hs.map((h) => coast.indexOf(h.edge)).sort((x, y) => x - y);
        const gaps = idx.map((v, i) => (idx[(i + 1) % idx.length]! - v + coast.length) % coast.length);
        expect(Math.max(...gaps)).toBeLessThanOrEqual(Math.ceil((2 * coast.length) / hs.length));
      }
    });
  }

  it('is deterministic per seed, varies across seeds and leaves terrain/numbers untouched', () => {
    const a = generateBoard('standard', 123);
    expect(generateBoard('standard', 123).harbors).toEqual(a.harbors);
    const layouts = new Set([1, 2, 3, 4, 5, 6].map((s) => JSON.stringify(generateBoard('standard', s).harbors)));
    expect(layouts.size).toBeGreaterThan(4);
    const { harbors, ...rest } = a;
    expect(harbors).toBeDefined();
    expect(rest.hexes.map((h) => [h.terrain, h.number])).toEqual(generateBoard('standard', 123).hexes.map((h) => [h.terrain, h.number]));
  });

  it('gives 3:1 or 2:1 to a player with a building on either end of the harbour', () => {
    const base = blankMain(2);
    const hs = base.board.harbors!;
    const generic = hs.find((h) => h.kind === 'any')!;
    const special = hs.find((h) => h.kind === 'ore')!;
    for (const r of RESOURCES) expect(bankRate(base, 0, r)).toBe(4);

    const [, gb] = corners(base.board, generic.edge);
    const g = edit(base, (d) => (d.buildings[gb!] = { owner: 0, kind: 'outpost' }));
    for (const r of RESOURCES) expect(bankRate(g, 0, r)).toBe(3);
    expect(bankRate(g, 1, 'ore')).toBe(4); // other players are not affected
    expect(harborsOf(g, 0)).toEqual([generic]);

    const [sa] = corners(base.board, special.edge);
    const s = edit(g, (d) => {
      d.buildings[sa!] = { owner: 0, kind: 'keep' };
      d.players[0]!.resources = bag({ ore: 2 });
    });
    expect(bankRate(s, 0, 'ore')).toBe(2);
    expect(bankRate(s, 0, 'timber')).toBe(3);
    const t = must(s, 0, { type: 'bankTrade', give: 'ore', want: 'grain' });
    expect(t.state.players[0]!.resources).toEqual(bag({ grain: 1 }));

    // the view carries harbours and the rate works on it too
    const v = getView(s, 0);
    expect(v.board.harbors).toEqual(hs);
    expect(bankRate(v, 0, 'ore')).toBe(2);
  });

  it('boards saved before harbours existed still work', () => {
    const base = blankMain(2);
    const old = edit(base, (d) => {
      delete d.board.harbors;
    });
    for (const r of RESOURCES) expect(bankRate(old, 0, r)).toBe(4);
  });
});
