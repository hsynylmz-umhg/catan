// Engine public API. SIGNATURES ARE FIXED (server and client code against them).
// The engine agent replaces these stubs with real implementations (may split into more files in this folder).
// All functions are pure: they never mutate their inputs.
import type {
  Action,
  ActionError,
  Board,
  Buyable,
  GameConfig,
  GameEvent,
  GameState,
  MapSize,
  PlayerView,
  Resource,
  Seat,
} from '../types';

/** Any object carrying the public board situation: works with both GameState and PlayerView. */
export type Situation = GameState | PlayerView;

export type ApplyResult =
  | { ok: true; state: GameState; events: GameEvent[] }
  | { ok: false; error: ActionError };

const todo = (): never => {
  throw new Error('engine not implemented yet');
};

/** Deterministic board for a size + seed. */
export function generateBoard(_size: MapSize, _seed: number): Board {
  return todo();
}

/** New game in setup phase. players.length must be 2..4 (standard) or 2..6 (large). */
export function createGame(_config: GameConfig, _players: { name: string; color: string }[]): GameState {
  return todo();
}

/** Validate + apply one action for a seat. */
export function applyAction(_state: GameState, _seat: Seat, _action: Action): ApplyResult {
  return todo();
}

/** Redacted view for a seat (null = spectator). */
export function getView(_state: GameState, _seat: Seat | null): PlayerView {
  return todo();
}

// ----- helpers used by the client for highlighting (work on GameState and PlayerView) -----

/** Vertices where `seat` may place an outpost right now (setup: anywhere legal; main: connected to own road). Ignores cost. */
export function validOutpostVertices(_s: Situation, _seat: Seat): number[] {
  return todo();
}
/** Edges where `seat` may place a road right now (setup: touching the just-placed outpost). Ignores cost. */
export function validRoadEdges(_s: Situation, _seat: Seat): number[] {
  return todo();
}
/** Own outposts that can be upgraded. Ignores cost. */
export function validUpgradeVertices(_s: Situation, _seat: Seat): number[] {
  return todo();
}
/** Hexes the bandit may move to (every hex except its current one). */
export function validBanditHexes(_s: Situation): number[] {
  return todo();
}
/** How many `give` the bank asks for one resource: 4, 3 or 2 (see RULES.md). */
export function bankRate(_s: Situation, _seat: Seat, _give: Resource): number {
  return todo();
}
/** Whether seat holds the cost. For a PlayerView only meaningful for the viewer's own seat. */
export function canAfford(_s: Situation, _seat: Seat, _item: Buyable): boolean {
  return todo();
}
/** Length of seat's longest continuous route. */
export function routeLength(_s: Situation, _seat: Seat): number {
  return todo();
}
