import type { Board, Edge, Hex, MapSize, Terrain, Vertex } from '../types';
import { type Rng, seedToState, shuffle } from './rng';

const SQ3 = Math.sqrt(3);

export const TERRAIN_COUNTS: Record<MapSize, Record<Terrain, number>> = {
  standard: { forest: 4, pasture: 4, field: 4, quarry: 3, mine: 3, barren: 1 },
  large: { forest: 8, pasture: 7, field: 7, quarry: 6, mine: 6, barren: 3 },
};

export const NUMBER_TOKENS: Record<MapSize, number[]> = {
  standard: [2, 3, 3, 4, 4, 5, 5, 6, 6, 8, 8, 9, 9, 10, 10, 11, 11, 12],
  large: [
    2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 6, 6, 6, 8, 8, 8, 9, 9, 9, 9, 10, 10, 10, 10, 11, 11, 11, 11, 12,
    12,
  ],
};

/** Corner offsets, clockwise from the top corner (y grows downward, like screen coordinates). */
const CORNERS: [number, number][] = [
  [0, -1],
  [SQ3 / 2, -0.5],
  [SQ3 / 2, 0.5],
  [0, 1],
  [-SQ3 / 2, 0.5],
  [-SQ3 / 2, -0.5],
];

const MAX_NUMBER_ATTEMPTS = 200;

/** Ids of hexes sharing a side with `hex`. */
export function hexNeighbours(board: Board, hex: number): number[] {
  const h = board.hexes[hex]!;
  const out: number[] = [];
  for (const o of board.hexes) {
    const dq = o.q - h.q;
    const dr = o.r - h.r;
    if ((Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2 === 1) out.push(o.id);
  }
  return out;
}

export function generateBoard(size: MapSize, seed: number): Board {
  if (size !== 'standard' && size !== 'large') throw new Error(`invalid map size: ${String(size)}`);
  const radius = size === 'standard' ? 2 : 3;
  const rng: Rng = { s: seedToState(seed) };

  const hexes: Hex[] = [];
  const vertices: Vertex[] = [];
  const edges: Edge[] = [];
  const vertexByKey = new Map<string, number>();
  const edgeByKey = new Map<string, number>();

  for (let r = -radius; r <= radius; r++) {
    for (let q = -radius; q <= radius; q++) {
      if (Math.abs(q + r) > radius) continue;
      const x = SQ3 * (q + r / 2);
      const y = 1.5 * r;
      const id = hexes.length;
      const corners: number[] = [];
      for (const [dx, dy] of CORNERS) {
        const vx = x + dx;
        const vy = y + dy;
        const key = `${Math.round(vx * 100)},${Math.round(vy * 100)}`;
        let vid = vertexByKey.get(key);
        if (vid === undefined) {
          vid = vertices.length;
          vertexByKey.set(key, vid);
          vertices.push({ id: vid, x: vx, y: vy, hexes: [], edges: [], adjacent: [] });
        }
        vertices[vid]!.hexes.push(id);
        corners.push(vid);
      }
      for (let i = 0; i < 6; i++) {
        const a = Math.min(corners[i]!, corners[(i + 1) % 6]!);
        const b = Math.max(corners[i]!, corners[(i + 1) % 6]!);
        const key = `${a}-${b}`;
        if (edgeByKey.has(key)) continue;
        const eid = edges.length;
        edgeByKey.set(key, eid);
        edges.push({ id: eid, a, b });
        vertices[a]!.edges.push(eid);
        vertices[b]!.edges.push(eid);
        vertices[a]!.adjacent.push(b);
        vertices[b]!.adjacent.push(a);
      }
      hexes.push({ id, q, r, x, y, terrain: 'barren', number: null, vertices: corners });
    }
  }

  // Terrain
  const terrainPool: Terrain[] = [];
  for (const t of Object.keys(TERRAIN_COUNTS[size]) as Terrain[]) {
    for (let i = 0; i < TERRAIN_COUNTS[size][t]; i++) terrainPool.push(t);
  }
  const terrains = shuffle(rng, terrainPool);
  hexes.forEach((h, i) => {
    h.terrain = terrains[i]!;
  });

  // Number tokens: reshuffle until no two 6/8 hexes touch (give up after MAX_NUMBER_ATTEMPTS).
  const board: Board = { size, hexes, vertices, edges };
  const productive = hexes.filter((h) => h.terrain !== 'barren');
  const neighbours = hexes.map((h) => hexNeighbours(board, h.id));
  const hot = (n: number | null) => n === 6 || n === 8;
  for (let attempt = 0; attempt < MAX_NUMBER_ATTEMPTS; attempt++) {
    const tokens = shuffle(rng, NUMBER_TOKENS[size]);
    productive.forEach((h, i) => {
      h.number = tokens[i]!;
    });
    const clash = hexes.some((h) => hot(h.number) && neighbours[h.id]!.some((n) => hot(hexes[n]!.number)));
    if (!clash) break;
  }

  return board;
}
