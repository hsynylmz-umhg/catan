import { describe, expect, it } from 'vitest';
import type { MapSize, Terrain } from '../types';
import { NUMBER_TOKENS, TERRAIN_COUNTS, generateBoard, hexNeighbours } from './board';
import { newGame } from './testkit';

const SIZES: [MapSize, number, number, number][] = [
  ['standard', 19, 54, 72],
  ['large', 37, 96, 132],
];

describe.each(SIZES)('generateBoard(%s)', (size, hexCount, vertexCount, edgeCount) => {
  const board = generateBoard(size, 42);

  it('has the expected hex / vertex / edge counts with sequential ids', () => {
    expect(board.size).toBe(size);
    expect(board.hexes).toHaveLength(hexCount);
    expect(board.vertices).toHaveLength(vertexCount);
    expect(board.edges).toHaveLength(edgeCount);
    board.hexes.forEach((h, i) => expect(h.id).toBe(i));
    board.vertices.forEach((v, i) => expect(v.id).toBe(i));
    board.edges.forEach((e, i) => expect(e.id).toBe(i));
  });

  it('lays hexes out pointy-top with size 1', () => {
    for (const h of board.hexes) {
      expect(h.x).toBeCloseTo(Math.sqrt(3) * (h.q + h.r / 2), 9);
      expect(h.y).toBeCloseTo(1.5 * h.r, 9);
      expect(h.vertices).toHaveLength(6);
      expect(new Set(h.vertices).size).toBe(6);
      // corners: distance 1 from the centre, clockwise from the top corner
      const top = board.vertices[h.vertices[0]!]!;
      expect(top.x).toBeCloseTo(h.x, 9);
      expect(top.y).toBeCloseTo(h.y - 1, 9);
      const second = board.vertices[h.vertices[1]!]!;
      expect(second.x).toBeGreaterThan(h.x);
      expect(second.y).toBeLessThan(h.y);
      for (const v of h.vertices) {
        const p = board.vertices[v]!;
        expect(Math.hypot(p.x - h.x, p.y - h.y)).toBeCloseTo(1, 9);
        expect(p.hexes).toContain(h.id);
      }
    }
  });

  it('has a consistent vertex / edge graph', () => {
    const seen = new Set<string>();
    for (const e of board.edges) {
      expect(e.a).not.toBe(e.b);
      const key = `${Math.min(e.a, e.b)}-${Math.max(e.a, e.b)}`;
      expect(seen.has(key)).toBe(false);
      seen.add(key);
      const a = board.vertices[e.a]!;
      const b = board.vertices[e.b]!;
      expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeCloseTo(1, 9);
      expect(a.edges).toContain(e.id);
      expect(b.edges).toContain(e.id);
      expect(a.adjacent).toContain(b.id);
      expect(b.adjacent).toContain(a.id);
    }
    for (const v of board.vertices) {
      expect(v.hexes.length).toBeGreaterThanOrEqual(1);
      expect(v.hexes.length).toBeLessThanOrEqual(3);
      expect(v.edges.length).toBeGreaterThanOrEqual(2);
      expect(v.edges.length).toBeLessThanOrEqual(3);
      expect(v.adjacent).toHaveLength(v.edges.length);
      expect(new Set(v.adjacent).size).toBe(v.adjacent.length);
    }
    // every hex side is an edge
    for (const h of board.hexes) {
      for (let i = 0; i < 6; i++) {
        const a = h.vertices[i]!;
        const b = h.vertices[(i + 1) % 6]!;
        expect(seen.has(`${Math.min(a, b)}-${Math.max(a, b)}`)).toBe(true);
      }
    }
  });

  it('is deterministic per seed and differs between seeds', () => {
    expect(generateBoard(size, 42)).toEqual(board);
    const layout = (seed: number) =>
      generateBoard(size, seed)
        .hexes.map((h) => `${h.terrain}${h.number}`)
        .join();
    expect(new Set([1, 2, 3, 4, 5].map(layout)).size).toBeGreaterThan(1);
  });

  it('uses the terrain and number distributions and keeps 6/8 apart', () => {
    for (let seed = 0; seed < 60; seed++) {
      const b = generateBoard(size, seed);
      const terrains: Record<string, number> = {};
      for (const h of b.hexes) terrains[h.terrain] = (terrains[h.terrain] ?? 0) + 1;
      expect(terrains).toEqual(TERRAIN_COUNTS[size]);
      const numbers = b.hexes.filter((h) => h.number !== null).map((h) => h.number!);
      expect(numbers.sort((x, y) => x - y)).toEqual(NUMBER_TOKENS[size]);
      for (const h of b.hexes) {
        expect(h.number === null).toBe((h.terrain as Terrain) === 'barren');
        if (h.number === 6 || h.number === 8) {
          for (const n of hexNeighbours(b, h.id)) expect([6, 8]).not.toContain(b.hexes[n]!.number);
        }
      }
    }
  });

  it('is plain JSON', () => {
    expect(JSON.parse(JSON.stringify(board))).toEqual(board);
  });
});

describe('createGame', () => {
  it('uses the generated board and puts the bandit on the lowest barren hex', () => {
    for (const size of ['standard', 'large'] as const) {
      const g = newGame(2, size, 7);
      expect(g.board).toEqual(generateBoard(size, 7));
      expect(g.bandit).toBe(g.board.hexes.find((h) => h.terrain === 'barren')!.id);
      expect(g.phase).toBe('setup');
      expect(g.setup).toEqual({ round: 1, expecting: 'outpost', lastVertex: null });
      expect(g.deck).toHaveLength(size === 'standard' ? 22 : 33);
      expect(g.deck.filter((c) => c === 'raider')).toHaveLength(size === 'standard' ? 12 : 18);
      expect(g.deck.filter((c) => c === 'glory')).toHaveLength(size === 'standard' ? 4 : 6);
    }
  });

  it('validates the player count and config', () => {
    expect(() => newGame(1)).toThrow();
    expect(() => newGame(5, 'standard')).toThrow();
    expect(() => newGame(4, 'standard')).not.toThrow();
    expect(() => newGame(6, 'large')).not.toThrow();
    expect(() => newGame(7, 'large')).toThrow();
    expect(() => newGame(3, 'standard', 1, 7)).toThrow();
    expect(() => newGame(3, 'standard', 1, 15)).toThrow();
    expect(() => newGame(3, 'standard', Number.NaN)).toThrow();
    expect(() => newGame(3, 'huge' as never)).toThrow();
  });

  it('is deterministic', () => {
    expect(newGame(4, 'standard', 99)).toEqual(newGame(4, 'standard', 99));
    expect(newGame(4, 'standard', 99).deck).not.toEqual(newGame(4, 'standard', 100).deck);
  });
});
