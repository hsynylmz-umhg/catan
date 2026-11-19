// Engine public API. SIGNATURES ARE FIXED (server and client code against them).
// All functions are pure: they never mutate their inputs.
//
//   board.ts  — generateBoard (geometry, terrain, number tokens)
//   game.ts   — createGame, applyAction (the rules state machine)
//   rules.ts  — read-only helpers that work on GameState and PlayerView
//   view.ts   — getView (redaction), totalPoints
//   rng.ts    — mulberry32 PRNG (state lives in GameState.rng)

export type { Situation } from './rules';
export type { ApplyResult } from './game';

export { generateBoard, coastalEdges, placeHarbors } from './board';
export { createGame, applyAction } from './game';
export { getView, totalPoints } from './view';
export {
  validOutpostVertices,
  validRoadEdges,
  validUpgradeVertices,
  validBanditHexes,
  bankRate,
  canAfford,
  routeLength,
  harborsOf,
  piecesLeft,
  publicPoints,
} from './rules';
