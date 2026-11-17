// ?demo=1 — hand-built fake PlayerView so the game screen can be checked without a server.
// Optional: &step=roll|sevenChoice|moveBandit|steal|actions|setup|trade|finished|paused  &size=large
import {
  PLAYER_COLORS,
  type Board,
  type ChatMessage,
  type Edge,
  type Hex,
  type LogEntry,
  type PlayerView,
  type PublicPlayer,
  type RoomInfo,
  type Terrain,
  type Vertex,
} from '@kervan/shared';

function demoBoard(large: boolean): Board {
  const radius = large ? 3 : 2;
  const terrains: Terrain[] = ['forest', 'pasture', 'field', 'quarry', 'mine', 'forest', 'field', 'pasture', 'mine', 'quarry'];
  const numbers = [5, 2, 6, 3, 8, 10, 9, 12, 11, 4, 8, 10, 9, 4, 5, 6, 3, 11];
  const hexes: Hex[] = [];
  const vertices: Vertex[] = [];
  const edges: Edge[] = [];
  const vKey = new Map<string, number>();
  const eKey = new Map<string, number>();
  let n = 0;
  for (let r = -radius; r <= radius; r++) {
    for (let q = -radius; q <= radius; q++) {
      if (Math.abs(q + r) > radius) continue;
      const id = hexes.length;
      const x = Math.sqrt(3) * (q + r / 2);
      const y = 1.5 * r;
      const barren = q === 0 && r === 0;
      const hv: number[] = [];
      for (let i = 0; i < 6; i++) {
        const a = (Math.PI / 3) * i;
        const vx = x + Math.sin(a);
        const vy = y - Math.cos(a);
        const key = `${Math.round(vx * 100)}:${Math.round(vy * 100)}`;
        let vid = vKey.get(key);
        if (vid === undefined) {
          vid = vertices.length;
          vKey.set(key, vid);
          vertices.push({ id: vid, x: vx, y: vy, hexes: [], edges: [], adjacent: [] });
        }
        vertices[vid].hexes.push(id);
        hv.push(vid);
      }
      for (let i = 0; i < 6; i++) {
        const a = hv[i];
        const b = hv[(i + 1) % 6];
        const key = a < b ? `${a}-${b}` : `${b}-${a}`;
        if (!eKey.has(key)) {
          const eid = edges.length;
          eKey.set(key, eid);
          edges.push({ id: eid, a, b });
          vertices[a].edges.push(eid);
          vertices[b].edges.push(eid);
          vertices[a].adjacent.push(b);
          vertices[b].adjacent.push(a);
        }
      }
      hexes.push({
        id, q, r, x, y,
        terrain: barren ? 'barren' : terrains[n % terrains.length],
        number: barren ? null : numbers[n % numbers.length],
        vertices: hv,
      });
      if (!barren) n++;
    }
  }
  return { size: large ? 'large' : 'standard', hexes, vertices, edges };
}

export interface DemoData {
  room: RoomInfo;
  view: PlayerView;
  chat: ChatMessage[];
  log: LogEntry[];
}

export function makeDemo(params: URLSearchParams): DemoData {
  const stepParam = params.get('step') ?? 'actions';
  const large = params.get('size') === 'large';
  const board = demoBoard(large);
  const names = large ? ['Elif', 'Kaan', 'Zeynep', 'Mert', 'Defne'] : ['Elif', 'Kaan', 'Zeynep'];
  const edgeOf = (a: number, b: number) => board.edges.find((e) => (e.a === a && e.b === b) || (e.a === b && e.b === a))!.id;
  const mid = board.hexes.find((h) => h.terrain === 'barren')!;
  const h = (i: number) => board.hexes[i];

  const buildings: PlayerView['buildings'] = {};
  const roads: PlayerView['roads'] = {};
  const put = (seat: number, hex: number, corner: number, kind: 'outpost' | 'keep' | 'market', roadTo: number) => {
    const v = h(hex).vertices[corner];
    buildings[v] = { owner: seat, kind };
    roads[edgeOf(v, h(hex).vertices[roadTo])] = seat;
  };
  put(0, mid.id, 0, 'keep', 1);
  put(0, mid.id, 3, 'outpost', 2);
  roads[edgeOf(mid.vertices[1], mid.vertices[2])] = 0;
  put(1, 0, 0, 'outpost', 1);
  put(1, 2, 2, 'market', 3);
  put(2, board.hexes.length - 1, 3, 'outpost', 4);
  put(2, board.hexes.length - 3, 4, 'keep', 5);

  const players: PublicPlayer[] = names.map((name, seat) => ({
    seat,
    name,
    color: PLAYER_COLORS[seat],
    resources: seat === 0 ? { timber: 3, stone: 2, grain: 4, fiber: 1, ore: 3 } : null,
    resourceCount: seat === 0 ? 13 : 3 + seat,
    cards: seat === 0 ? ['raider', 'bounty', 'glory'] : null,
    newCards: seat === 0 ? ['caravan'] : null,
    cardCount: seat === 0 ? 4 : seat,
    raidersPlayed: seat === 1 ? 3 : 0,
    playedCardThisTurn: false,
    publicPoints: seat === 0 ? 5 : 2 + seat,
    totalPoints: seat === 0 ? 6 : null,
    piecesLeft: { road: 12, outpost: 3, keep: 3, market: 3 },
  }));

  const finished = stepParam === 'finished';
  const setup = stepParam === 'setup';
  const view: PlayerView = {
    config: { mapSize: board.size, targetPoints: 10, seed: 1 },
    board,
    players: finished ? players.map((p) => ({ ...p, totalPoints: p.seat === 0 ? 10 : p.publicPoints })) : players,
    phase: finished ? 'finished' : setup ? 'setup' : 'main',
    current: stepParam === 'trade' ? 1 : 0,
    turn: 7,
    setup: setup ? { round: 1, expecting: 'outpost', lastVertex: null } : null,
    step: (['roll', 'sevenChoice', 'moveBandit', 'steal', 'actions'] as const).find((s) => s === stepParam) ?? 'actions',
    dice: stepParam === 'roll' ? null : [3, 5],
    buildings,
    roads,
    bandit: mid.id,
    stealCandidates: stepParam === 'steal' ? [1, 2] : [],
    freeRoads: 0,
    bargainActive: false,
    trade:
      stepParam === 'trade'
        ? {
            from: 1,
            give: { timber: 0, stone: 2, grain: 0, fiber: 0, ore: 0 },
            want: { timber: 0, stone: 0, grain: 1, fiber: 0, ore: 0 },
            responses: {},
          }
        : null,
    longestRoute: { owner: 0, length: 5 },
    strongestGuard: { owner: 1, count: 3 },
    winner: finished ? 0 : null,
    you: 0,
    deckCount: 14,
  };

  const now = Date.now();
  const room: RoomInfo = {
    code: 'DEMO1',
    status: stepParam === 'paused' ? 'paused' : finished ? 'finished' : 'playing',
    hostSeat: 0,
    config: { mapSize: board.size, targetPoints: 10, theme: 'anatolia' },
    members: names.map((name, seat) => ({ seat, name, color: PLAYER_COLORS[seat], connected: seat !== 2 })),
    maxPlayers: large ? 6 : 4,
    createdAt: now - 3600_000,
    updatedAt: now,
  };
  const log: LogEntry[] = [
    { ts: now - 60_000, event: { type: 'turnStarted', seat: 2, turn: 6 } },
    { ts: now - 50_000, event: { type: 'rolled', seat: 2, dice: [4, 4] } },
    { ts: now - 49_000, event: { type: 'produced', gains: { 0: { grain: 2 }, 1: { ore: 1 } } } },
    { ts: now - 40_000, event: { type: 'built', seat: 2, kind: 'road', edge: 3 } },
    { ts: now - 30_000, event: { type: 'bonusChanged', bonus: 'strongestGuard', owner: 1 } },
    { ts: now - 20_000, event: { type: 'turnStarted', seat: 0, turn: 7 } },
    { ts: now - 10_000, event: { type: 'rolled', seat: 0, dice: [3, 5] } },
  ];
  const chat: ChatMessage[] = [
    { seat: 1, name: 'Kaan', text: 'Taş verecek olan var mı?', ts: now - 45_000 },
    { seat: 2, name: 'Zeynep', text: 'Buğday karşılığı olur.', ts: now - 30_000 },
  ];
  return { room, view, chat, log };
}
