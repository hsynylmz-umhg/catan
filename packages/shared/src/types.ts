// Kervan Yolu — shared game types. This file is the CONTRACT between engine, server and client.
// Do not change shapes here without updating docs/RULES.md and all three consumers.

export type Resource = 'timber' | 'stone' | 'grain' | 'fiber' | 'ore';
export const RESOURCES: readonly Resource[] = ['timber', 'stone', 'grain', 'fiber', 'ore'];
export type ResourceBag = Record<Resource, number>;

export type Terrain = 'forest' | 'quarry' | 'field' | 'pasture' | 'mine' | 'barren';
/** Which resource a terrain yields (barren yields nothing). */
export const TERRAIN_RESOURCE: Record<Terrain, Resource | null> = {
  forest: 'timber',
  quarry: 'stone',
  field: 'grain',
  pasture: 'fiber',
  mine: 'ore',
  barren: null,
};

export type MapSize = 'standard' | 'large'; // standard: 2-4 players (19 hexes), large: 5-6 players (37 hexes)
export type ThemeId = 'anatolia' | 'archipelago' | 'space';
export type BuildingKind = 'outpost' | 'keep' | 'market';
export type DecreeCard = 'raider' | 'caravan' | 'bounty' | 'bargain' | 'glory';

/** Seat index 0..5. Seats are assigned in join order and are also turn order. */
export type Seat = number;

// ---------- Board ----------
// Pointy-top hexes, axial coords (q, r). x/y are 2D layout coordinates with hex "size" (center to corner) = 1.
// The client renders both 2D and 3D from x/y (3D: x -> X, y -> Z).
export interface Hex {
  id: number;
  q: number;
  r: number;
  x: number;
  y: number;
  terrain: Terrain;
  /** Production number 2..12 (never 7); null for barren. */
  number: number | null;
  /** The 6 corner vertex ids, clockwise starting from the top corner. */
  vertices: number[];
}
export interface Vertex {
  id: number;
  x: number;
  y: number;
  hexes: number[]; // 1..3 adjacent hex ids
  edges: number[]; // 2..3 incident edge ids
  adjacent: number[]; // 2..3 neighbouring vertex ids
}
export interface Edge {
  id: number;
  a: number; // vertex id
  b: number; // vertex id
}
export interface Board {
  size: MapSize;
  hexes: Hex[];
  vertices: Vertex[];
  edges: Edge[];
}

// ---------- Game state ----------
export interface GameConfig {
  mapSize: MapSize;
  /** Points needed to win. Allowed 8..14. Default 10 (standard) / 11 (large). */
  targetPoints: number;
  /** Seed for board generation, deck shuffle and dice. */
  seed: number;
}

export interface PlayerState {
  seat: Seat;
  name: string;
  color: string; // one of PLAYER_COLORS
  resources: ResourceBag;
  /** Decree cards playable this turn. */
  cards: DecreeCard[];
  /** Decree cards bought this turn (become playable next turn). */
  newCards: DecreeCard[];
  raidersPlayed: number;
  /** True once a (non-glory) decree card has been played this turn. Max one per turn. */
  playedCardThisTurn: boolean;
}

export interface Building {
  owner: Seat;
  kind: BuildingKind;
}

export interface TradeOffer {
  from: Seat;
  give: ResourceBag; // what `from` gives
  want: ResourceBag; // what `from` receives
  /** Responses from the other seats. Missing = not answered yet. */
  responses: Record<Seat, 'accept' | 'decline'>;
}

export type Phase = 'setup' | 'main' | 'finished';
/**
 * What the current player must do next (main phase):
 *  roll        -> must send `roll`
 *  sevenChoice -> rolled a 7: must send `sevenChoice`
 *  moveBandit  -> must send `moveBandit`
 *  steal       -> must send `steal` (only when 2+ possible victims; engine auto-resolves 0 or 1)
 *  actions     -> free build / trade / card actions, then `endTurn`
 */
export type Step = 'roll' | 'sevenChoice' | 'moveBandit' | 'steal' | 'actions';

export interface SetupState {
  /** 1 = seats ascending, 2 = seats descending (snake). */
  round: 1 | 2;
  expecting: 'outpost' | 'road';
  /** Vertex of the outpost just placed (the road must touch it). */
  lastVertex: number | null;
}

export interface GameState {
  config: GameConfig;
  board: Board;
  players: PlayerState[];
  phase: Phase;
  /** Seat whose turn it is. */
  current: Seat;
  /** Turn counter, starts at 1 when the main phase begins. */
  turn: number;
  setup: SetupState | null; // non-null only in setup phase
  step: Step; // meaningful only in main phase
  dice: [number, number] | null; // last roll
  /** vertex id -> building */
  buildings: Record<number, Building>;
  /** edge id -> owner seat */
  roads: Record<number, Seat>;
  /** Hex id the bandit stands on (starts on a barren hex). */
  bandit: number;
  /** Seats that can be stolen from while step === 'steal'. */
  stealCandidates: Seat[];
  /** Free roads remaining from a caravan card. */
  freeRoads: number;
  /** Bargain card active: bank rate is 2:1 for everything until end of turn. */
  bargainActive: boolean;
  trade: TradeOffer | null;
  /** Draw pile, top = last element. Hidden from players. */
  deck: DecreeCard[];
  longestRoute: { owner: Seat | null; length: number };
  strongestGuard: { owner: Seat | null; count: number };
  winner: Seat | null;
  /** Internal PRNG state (mulberry32). Hidden from players. */
  rng: number;
}

// ---------- Actions ----------
export type Action =
  | { type: 'roll' }
  | { type: 'sevenChoice'; choice: 'bandit' }
  | { type: 'sevenChoice'; choice: 'tribute'; resources: [Resource, Resource] }
  | { type: 'moveBandit'; hex: number }
  | { type: 'steal'; victim: Seat }
  | { type: 'buildRoad'; edge: number } // setup (free), main (cost or freeRoads)
  | { type: 'buildOutpost'; vertex: number } // setup (free), main (cost)
  | { type: 'upgrade'; vertex: number; to: 'keep' | 'market' }
  | { type: 'buyCard' }
  | { type: 'playCard'; card: 'raider' }
  | { type: 'playCard'; card: 'caravan' }
  | { type: 'playCard'; card: 'bounty'; resources: [Resource, Resource] }
  | { type: 'playCard'; card: 'bargain' }
  | { type: 'bankTrade'; give: Resource; want: Resource } // gives bankRate(give) of `give` for 1 `want`
  | { type: 'offerTrade'; give: ResourceBag; want: ResourceBag } // current player only; replaces any open offer
  | { type: 'respondTrade'; accept: boolean } // any NON-current player
  | { type: 'confirmTrade'; with: Seat } // current player picks an accepter
  | { type: 'cancelTrade' } // current player
  | { type: 'endTurn'; discard?: ResourceBag }; // discard required (exactly hand-10) when holding > 10 cards

/** Error codes returned by applyAction. The client maps them to localized messages. */
export type ActionError =
  | 'notYourTurn'
  | 'wrongPhase'
  | 'wrongStep'
  | 'invalidLocation'
  | 'cannotAfford'
  | 'noPiecesLeft'
  | 'deckEmpty'
  | 'noSuchCard'
  | 'cardAlreadyPlayed'
  | 'invalidTrade'
  | 'noOpenTrade'
  | 'invalidDiscard'
  | 'invalidTarget'
  | 'badAction';

// ---------- Events (for the game log and animations) ----------
export type GameEvent =
  | { type: 'rolled'; seat: Seat; dice: [number, number] }
  | { type: 'produced'; gains: Record<Seat, Partial<ResourceBag>> }
  | { type: 'tribute'; seat: Seat; resources: Resource[] }
  | { type: 'banditMoved'; seat: Seat; hex: number }
  | { type: 'stole'; seat: Seat; victim: Seat } // stolen resource is NOT revealed
  | { type: 'built'; seat: Seat; kind: 'road'; edge: number }
  | { type: 'built'; seat: Seat; kind: BuildingKind; vertex: number }
  | { type: 'boughtCard'; seat: Seat }
  | { type: 'playedCard'; seat: Seat; card: DecreeCard }
  | { type: 'bankTraded'; seat: Seat; give: Resource; giveCount: number; want: Resource }
  | { type: 'tradeOffered'; seat: Seat }
  | { type: 'tradeCompleted'; seat: Seat; with: Seat; give: ResourceBag; want: ResourceBag }
  | { type: 'tradeCancelled'; seat: Seat }
  | { type: 'discarded'; seat: Seat; count: number }
  | { type: 'bonusChanged'; bonus: 'longestRoute' | 'strongestGuard'; owner: Seat | null }
  | { type: 'turnStarted'; seat: Seat; turn: number }
  | { type: 'gameWon'; seat: Seat; points: number };

// ---------- Player view (what a client is allowed to see) ----------
export interface PublicPlayer {
  seat: Seat;
  name: string;
  color: string;
  /** Own seat: full bag. Other seats: null. */
  resources: ResourceBag | null;
  resourceCount: number;
  /** Own seat: playable cards. Others: null. */
  cards: DecreeCard[] | null;
  /** Own seat: cards bought this turn. Others: null. */
  newCards: DecreeCard[] | null;
  cardCount: number; // cards + newCards
  raidersPlayed: number;
  playedCardThisTurn: boolean;
  /** Points everyone can see (buildings + bonuses). */
  publicPoints: number;
  /** Own seat (and everyone once the game is finished): publicPoints + glory cards. Others: null. */
  totalPoints: number | null;
  piecesLeft: { road: number; outpost: number; keep: number; market: number };
}

export interface PlayerView extends Omit<GameState, 'players' | 'deck' | 'rng'> {
  players: PublicPlayer[];
  /** Viewer's seat, or null for a spectator. */
  you: Seat | null;
  deckCount: number;
}

// ---------- Constants ----------
export const PLAYER_COLORS = ['#c0392b', '#2471a3', '#d4a017', '#1e8449', '#7d3c98', '#d35400'] as const;
export const PIECE_LIMITS = { road: 15, outpost: 5, keep: 4, market: 3 } as const;
export const HAND_LIMIT = 10;
export const MIN_ROUTE_FOR_BONUS = 5;
export const MIN_RAIDERS_FOR_BONUS = 3;

export type Buyable = 'road' | 'outpost' | 'keep' | 'market' | 'card';
export const COSTS: Record<Buyable, Partial<ResourceBag>> = {
  road: { timber: 1, stone: 1 },
  outpost: { timber: 1, stone: 1, grain: 1, fiber: 1 },
  keep: { grain: 2, ore: 3 },
  market: { timber: 2, fiber: 1, stone: 1 },
  card: { grain: 1, fiber: 1, ore: 1 },
};

export function emptyBag(): ResourceBag {
  return { timber: 0, stone: 0, grain: 0, fiber: 0, ore: 0 };
}
export function bagTotal(bag: Partial<ResourceBag>): number {
  let n = 0;
  for (const r of RESOURCES) n += bag[r] ?? 0;
  return n;
}
