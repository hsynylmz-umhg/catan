import { describe, expect, it } from 'vitest';
import type { Action, GameEvent, GameState, MapSize } from '../types';
import { applyAction, getView } from './index';
import { type Rng, nextInt } from './rng';
import { botMove, checkInvariants, deepFreeze, newGame } from './testkit';

const JUNK: unknown[] = [
  { type: 'nope' },
  null,
  { type: 'buildRoad', edge: -1 },
  { type: 'buildOutpost', vertex: 100000 },
  { type: 'endTurn', discard: { timber: -1 } },
  { type: 'steal', victim: 99 },
  { type: 'moveBandit', hex: 1e9 },
  { type: 'upgrade', vertex: -3, to: 'keep' },
  { type: 'confirmTrade', with: -1 },
  { type: 'playCard', card: 'glory' },
];

interface Run {
  state: GameState;
  steps: number;
  log: { seat: number; action: Action }[];
  events: GameEvent[];
}

/** Drive a game with random legal moves until someone wins or `maxTurns` is reached. */
function playGame(players: number, mapSize: MapSize, seed: number, maxTurns: number, maxSteps = 200000): Run {
  const rng: Rng = { s: seed * 7919 + 13 };
  let state = deepFreeze(newGame(players, mapSize, seed));
  const log: Run['log'] = [];
  const events: GameEvent[] = [];
  let steps = 0;
  while (state.phase !== 'finished' && state.turn <= maxTurns && steps < maxSteps) {
    if (steps % 7 === 0) {
      const junk = applyAction(state, nextInt(rng, players), JUNK[nextInt(rng, JUNK.length)] as Action);
      expect(junk.ok).toBe(false);
    }
    const move = botMove(state, rng);
    const r = applyAction(state, move.seat, move.action);
    if (!r.ok) throw new Error(`bot move rejected (${r.error}): ${JSON.stringify(move)} at step ${steps}`);
    state = deepFreeze(r.state); // frozen: any later in-place mutation by the engine would throw
    checkInvariants(state);
    log.push(move);
    events.push(...r.events);
    steps++;
  }
  return { state, steps, log, events };
}

describe('randomized playthroughs', () => {
  const cases: [number, MapSize, number][] = [
    [2, 'standard', 11],
    [4, 'standard', 22],
    [3, 'standard', 33],
    [6, 'large', 44],
    [5, 'large', 55],
    [2, 'large', 66],
  ];

  it.each(cases)('%i players on a %s map (seed %i) plays to a win', (players, mapSize, seed) => {
    const run = playGame(players, mapSize, seed, 3000);
    const s = run.state;
    expect(s.phase).toBe('finished');
    expect(s.winner).not.toBeNull();
    const won = run.events.filter((e) => e.type === 'gameWon');
    expect(won).toHaveLength(1);
    expect(won[0]).toMatchObject({ seat: s.winner });
    const view = getView(s, null);
    expect(view.players[s.winner!]!.totalPoints).toBeGreaterThanOrEqual(s.config.targetPoints);
    expect(run.events.at(-1)!.type).toBe('gameWon');
    // every event type that the bot can trigger showed up at least once across a full game
    const seen = new Set(run.events.map((e) => e.type));
    for (const t of ['rolled', 'produced', 'built', 'turnStarted', 'banditMoved', 'bankTraded']) {
      expect(seen).toContain(t);
    }
  });

  it('is fully deterministic: same seed + same actions => identical states', () => {
    const a = playGame(4, 'standard', 5, 60);
    const b = playGame(4, 'standard', 5, 60);
    expect(a.steps).toBe(b.steps);
    expect(JSON.stringify(a.state)).toBe(JSON.stringify(b.state));
    // replaying the action log from scratch reproduces the same state
    let s = newGame(4, 'standard', 5);
    for (const m of a.log) {
      const r = applyAction(s, m.seat, m.action);
      if (!r.ok) throw new Error(r.error);
      s = r.state;
    }
    expect(s).toEqual(a.state);
  });

  it('survives a JSON round-trip mid-game', () => {
    const half = playGame(4, 'standard', 9, 25);
    expect(half.state.phase).toBe('main');
    const restored = JSON.parse(JSON.stringify(half.state)) as GameState;
    expect(restored).toEqual(half.state);
    // continue both copies with the same moves: they must stay identical
    const rngA: Rng = { s: 123 };
    const rngB: Rng = { s: 123 };
    let a = half.state;
    let b = restored;
    for (let i = 0; i < 300 && a.phase !== 'finished'; i++) {
      const ma = botMove(a, rngA);
      const mb = botMove(b, rngB);
      expect(mb).toEqual(ma);
      const ra = applyAction(a, ma.seat, ma.action);
      const rb = applyAction(b, mb.seat, mb.action);
      expect(rb).toEqual(ra);
      if (!ra.ok || !rb.ok) throw new Error('bot move rejected');
      a = ra.state;
      b = rb.state;
    }
    for (const seat of [0, 1, 2, 3, null]) {
      expect(JSON.parse(JSON.stringify(getView(a, seat)))).toEqual(getView(b, seat));
    }
  });

  it('views never leak hidden information during play', () => {
    const run = playGame(3, 'standard', 17, 40);
    const s = run.state;
    for (const seat of [0, 1, 2]) {
      const v = getView(s, seat);
      expect(Object.keys(v)).not.toContain('deck');
      expect(Object.keys(v)).not.toContain('rng');
      for (const p of v.players) {
        if (p.seat === seat) {
          expect(p.resources).toEqual(s.players[seat]!.resources);
        } else {
          expect(p.resources).toBeNull();
          expect(p.cards).toBeNull();
          expect(p.newCards).toBeNull();
          expect(p.totalPoints).toBeNull();
        }
      }
    }
    expect(run.events.filter((e) => e.type === 'stole').every((e) => Object.keys(e).sort().join() === 'seat,type,victim')).toBe(true);
  });
});
