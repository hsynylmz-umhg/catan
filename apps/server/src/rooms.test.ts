import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PLAYER_COLORS } from '@kervan/shared';
import type { GameState, PlayerView, ServerMsg } from '@kervan/shared';
import { Store } from './db';
import { EVICT_MS, LOBBY_TTL_MS, RoomManager, type Client, type Engine } from './rooms';

// Minimal fake engine: 'roll' succeeds with one event, 'endTurn' finishes the game, 'boom' throws, anything else is rejected.
const fakeEngine: Engine = {
  createGame: (config, players) =>
    ({ config, players: players.map((p, seat) => ({ ...p, seat })), phase: 'setup', current: 0, turn: 0, winner: null }) as unknown as GameState,
  applyAction: (state, seat, action) => {
    if ((action as { type: string }).type === 'boom') throw new Error('boom');
    if (action.type === 'roll') {
      return { ok: true, state: { ...state, turn: state.turn + 1 }, events: [{ type: 'rolled', seat, dice: [1, 2] }] };
    }
    if (action.type === 'endTurn') {
      return { ok: true, state: { ...state, phase: 'finished', winner: seat }, events: [{ type: 'gameWon', seat, points: 10 }] };
    }
    return { ok: false, error: 'badAction' };
  },
  getView: (state, seat) =>
    ({ ...state, you: seat, players: state.players.map((p) => ({ ...p, publicPoints: 3, totalPoints: seat === null ? 4 : null })) }) as unknown as PlayerView,
};

class FakeClient implements Client {
  sent: ServerMsg[] = [];
  closed = false;
  code?: string;
  seat?: number;
  send(msg: ServerMsg) {
    this.sent.push(msg);
  }
  close() {
    this.closed = true;
  }
  last<T extends ServerMsg['t']>(t: T): Extract<ServerMsg, { t: T }> {
    const m = [...this.sent].reverse().find((x) => x.t === t);
    if (!m) throw new Error(`no ${t} message; got ${this.sent.map((x) => x.t).join(',')}`);
    return m as Extract<ServerMsg, { t: T }>;
  }
  lastError(): string | undefined {
    const m = this.sent[this.sent.length - 1];
    return m?.t === 'error' ? m.code : undefined;
  }
}

let dir: string;
let store: Store;
let clock: number;
let mgr: RoomManager;
const newManager = () => new RoomManager(store, { engine: fakeEngine, now: () => clock });

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'kervan-test-'));
  store = new Store(dir);
  clock = 1_000_000;
  mgr = newManager();
});
afterEach(() => {
  store.close();
  rmSync(dir, { recursive: true, force: true });
});

function create(name = 'Ayşe') {
  const c = new FakeClient();
  mgr.handle(c, { t: 'create', name });
  return { c, joined: c.last('joined') };
}
function join_(code: string, name: string) {
  const c = new FakeClient();
  mgr.handle(c, { t: 'join', code, name });
  return c;
}

describe('create / join / resume', () => {
  it('creates a room with a 5-char code, host seat 0 and a secret token', () => {
    const { c, joined } = create('  Ayşe  ');
    expect(joined.code).toMatch(/^[A-HJ-NP-Z2-9]{5}$/);
    expect(joined.seat).toBe(0);
    expect(joined.token.length).toBeGreaterThanOrEqual(24);
    expect(joined.view).toBeNull();
    expect(joined.room).toMatchObject({ status: 'lobby', hostSeat: 0, maxPlayers: 4, config: { mapSize: 'standard', targetPoints: 10 } });
    expect(joined.room.members).toEqual([{ seat: 0, name: 'Ayşe', color: PLAYER_COLORS[0], connected: true }]);
    expect(c.seat).toBe(0);
  });

  it('joins with lowest free seat, first free color and unique names', () => {
    const { c: host, joined } = create('Ali');
    const b = join_(joined.code.toLowerCase(), 'Ali');
    const j = b.last('joined');
    expect(j.seat).toBe(1);
    expect(j.token).not.toBe(joined.token);
    expect(j.room.members.map((m) => m.name)).toEqual(['Ali', 'Ali 2']);
    expect(j.room.members[1].color).toBe(PLAYER_COLORS[1]);
    expect(host.last('room').room.members).toHaveLength(2);
  });

  it('rejects bad joins', () => {
    const { joined } = create();
    expect(join_('ZZZZZ', 'x').lastError()).toBe('roomNotFound');
    expect(join_(joined.code, '   ').lastError()).toBe('badRequest');
    for (let i = 1; i < 6; i++) expect(join_(joined.code, `p${i}`).last('joined').seat).toBe(i);
    expect(join_(joined.code, 'seventh').lastError()).toBe('roomFull');
  });

  it('resume checks the token and replaces the older socket', () => {
    const { c: host, joined } = create();
    const bad = new FakeClient();
    mgr.handle(bad, { t: 'resume', code: joined.code, token: 'nope' });
    expect(bad.lastError()).toBe('badToken');

    const again = new FakeClient();
    mgr.handle(again, { t: 'resume', code: joined.code, token: joined.token });
    expect(again.last('joined').seat).toBe(0);
    expect(host.closed).toBe(true);
    mgr.disconnect(host); // late close event of the replaced socket must not mark the seat disconnected
    mgr.handle(again, { t: 'chat', text: 'hi' });
    expect(again.last('chat').msg.text).toBe('hi');
    expect(again.last('room').room.members[0].connected).toBe(true);
  });

  it('marks members disconnected on socket close', () => {
    const { c: host, joined } = create();
    const b = join_(joined.code, 'Bora');
    mgr.disconnect(b);
    expect(host.last('room').room.members[1]).toMatchObject({ name: 'Bora', connected: false });
  });
});

describe('lobby', () => {
  it('config is host-only and validated; default target follows map size until touched', () => {
    const { c: host, joined } = create();
    const b = join_(joined.code, 'Bora');
    mgr.handle(b, { t: 'config', config: { mapSize: 'large' } });
    expect(b.lastError()).toBe('notHost');
    mgr.handle(host, { t: 'config', config: { targetPoints: 20 } });
    expect(host.lastError()).toBe('badRequest');
    mgr.handle(host, { t: 'config', config: { mapSize: 'large', theme: 'space' } });
    expect(host.last('room').room).toMatchObject({ maxPlayers: 6, config: { mapSize: 'large', targetPoints: 11, theme: 'space' } });
    mgr.handle(host, { t: 'config', config: { targetPoints: 9 } });
    mgr.handle(host, { t: 'config', config: { mapSize: 'standard' } });
    expect(host.last('room').room.config).toEqual({ mapSize: 'standard', targetPoints: 9, theme: 'space' });
  });

  it('color must be a free palette entry', () => {
    const { c: host, joined } = create();
    const b = join_(joined.code, 'Bora');
    mgr.handle(b, { t: 'color', color: PLAYER_COLORS[0] });
    expect(b.lastError()).toBe('colorTaken');
    mgr.handle(b, { t: 'color', color: '#123456' });
    expect(b.lastError()).toBe('colorTaken');
    mgr.handle(b, { t: 'color', color: PLAYER_COLORS[4] });
    expect(host.last('room').room.members[1].color).toBe(PLAYER_COLORS[4]);
  });

  it('leave frees the seat, transfers host, and deletes an empty lobby', () => {
    const { c: host, joined } = create();
    const b = join_(joined.code, 'Bora');
    const c = join_(joined.code, 'Cem');
    mgr.handle(host, { t: 'leave' });
    const room = c.last('room').room;
    expect(room.hostSeat).toBe(1);
    expect(room.members.map((m) => m.seat)).toEqual([1, 2]);
    expect(join_(joined.code, 'Deniz').last('joined').seat).toBe(0); // freed seat is reused
    mgr.handle(host, { t: 'chat', text: 'x' });
    expect(host.lastError()).toBe('notInRoom');

    const solo = create('Solo');
    mgr.handle(solo.c, { t: 'leave' });
    expect(mgr.summary(solo.joined.code)).toBeNull();
    expect(store.loadRoom(solo.joined.code)).toBeNull();
    void b;
  });
});

describe('start', () => {
  it('enforces host and player counts', () => {
    const { c: host, joined } = create();
    mgr.handle(host, { t: 'start' });
    expect(host.lastError()).toBe('needMorePlayers');
    const others = [1, 2, 3, 4].map((i) => join_(joined.code, `p${i}`));
    mgr.handle(others[0], { t: 'start' });
    expect(others[0].lastError()).toBe('notHost');
    mgr.handle(host, { t: 'start' });
    expect(host.lastError()).toBe('tooManyPlayers');
    mgr.handle(host, { t: 'config', config: { mapSize: 'large' } });
    mgr.handle(host, { t: 'start' });
    expect(host.last('room').room.status).toBe('playing');
    expect(join_(joined.code, 'late').lastError()).toBe('gameAlreadyStarted');
  });

  it('compacts seats and tells every client its new seat', () => {
    const { c: a, joined } = create('A');
    const b = join_(joined.code, 'B');
    const c = join_(joined.code, 'C');
    const d = join_(joined.code, 'D');
    const tokenD = d.last('joined').token;
    mgr.handle(c, { t: 'chat', text: 'from seat 2' });
    mgr.handle(a, { t: 'leave' }); // host leaves -> B (seat 1) becomes host
    mgr.handle(c, { t: 'leave' });
    mgr.handle(b, { t: 'start' });

    const jb = b.last('joined');
    const jd = d.last('joined');
    expect([jb.seat, jd.seat]).toEqual([0, 1]);
    expect(jd.token).toBe(tokenD);
    expect(jd.room).toMatchObject({ status: 'playing', hostSeat: 0 });
    expect(jd.room.members.map((m) => [m.seat, m.name])).toEqual([[0, 'B'], [1, 'D']]);
    expect(jd.view).toMatchObject({ you: 1, players: [{ name: 'B' }, { name: 'D' }] });
    expect(d.seat).toBe(1);

    // the remapped seat is the one that acts
    mgr.handle(d, { t: 'action', action: { type: 'roll' } });
    expect(b.last('state').events).toEqual([{ type: 'rolled', seat: 1, dice: [1, 2] }]);
    expect(b.last('state').view.you).toBe(0);
    expect(d.last('state').view.you).toBe(1);
  });
});

describe('game', () => {
  function started() {
    const { c: host, joined } = create('A');
    const b = join_(joined.code, 'B');
    mgr.handle(host, { t: 'start' });
    return { host, b, code: joined.code, token: joined.token };
  }

  it('validates the transport shape and forwards engine errors', () => {
    const { host, b } = started();
    for (const bad of [null, 5, 'x', [], {}, { t: 7 }, { t: 'nope' }]) {
      mgr.handle(host, bad);
      expect(host.lastError()).toBe('badRequest');
    }
    mgr.handle(host, { t: 'action', action: 'roll' });
    expect(host.lastError()).toBe('badRequest');
    mgr.handle(host, { t: 'action', action: { type: 'buyCard' } });
    expect(host.lastError()).toBe('badAction');
    mgr.handle(host, { t: 'action', action: { type: 'boom' } }); // engine throws -> no crash
    expect(host.lastError()).toBe('badAction');
    mgr.handle(new FakeClient(), { t: 'ping' });
    const stranger = new FakeClient();
    mgr.handle(stranger, { t: 'action', action: { type: 'roll' } });
    expect(stranger.lastError()).toBe('notInRoom');
    void b;
  });

  it('pause blocks actions; only the host may pause', () => {
    const { host, b } = started();
    mgr.handle(b, { t: 'pause' });
    expect(b.lastError()).toBe('notHost');
    mgr.handle(host, { t: 'pause' });
    expect(b.last('room').room.status).toBe('paused');
    mgr.handle(b, { t: 'action', action: { type: 'roll' } });
    expect(b.lastError()).toBe('paused');
    mgr.handle(host, { t: 'unpause' });
    mgr.handle(b, { t: 'action', action: { type: 'roll' } });
    expect(host.last('state').view.turn).toBe(1);
  });

  it('leave in game keeps the seat', () => {
    const { host, b, code, token } = started();
    mgr.handle(host, { t: 'leave' });
    expect(b.last('room').room.members[0]).toMatchObject({ name: 'A', connected: false });
    const back = new FakeClient();
    mgr.handle(back, { t: 'resume', code, token });
    expect(back.last('joined')).toMatchObject({ seat: 0, room: { status: 'playing' } });
  });

  it('finishing writes a history record', () => {
    const { host, b, code } = started();
    mgr.handle(b, { t: 'action', action: { type: 'roll' } });
    mgr.handle(b, { t: 'action', action: { type: 'endTurn' } });
    expect(host.last('room').room.status).toBe('finished');
    expect(mgr.history(20)).toEqual([
      { code, finishedAt: clock, mapSize: 'standard', turns: 1, winner: 'B', players: [{ name: 'A', points: 4 }, { name: 'B', points: 4 }] },
    ]);
    mgr.handle(b, { t: 'action', action: { type: 'roll' } });
    expect(b.lastError()).toBe('wrongPhase');
    expect(mgr.summary(code)).toMatchObject({ status: 'finished', players: ['A', 'B'], turn: 1 });
  });
});

describe('chat', () => {
  it('trims, caps at 300 chars, drops empty and rate-limits', () => {
    const { c: host, joined } = create('A');
    const b = join_(joined.code, 'B');
    mgr.handle(host, { t: 'chat', text: '   ' });
    expect(b.sent.some((m) => m.t === 'chat')).toBe(false);
    mgr.handle(host, { t: 'chat', text: `  ${'x'.repeat(400)}  ` });
    expect(b.last('chat').msg).toMatchObject({ seat: 0, name: 'A', text: 'x'.repeat(300) });
    for (let i = 0; i < 4; i++) mgr.handle(host, { t: 'chat', text: `m${i}` });
    mgr.handle(host, { t: 'chat', text: 'too fast' });
    expect(host.lastError()).toBe('rateLimited');
    expect(b.last('chat').msg.text).toBe('m3');
    clock += 3_001;
    mgr.handle(host, { t: 'chat', text: 'later' });
    expect(b.last('chat').msg.text).toBe('later');
    mgr.handle(host, { t: 'chat', text: 42 });
    expect(host.lastError()).toBe('badRequest');
  });
});

describe('persistence', () => {
  it('a fresh manager reloads the room, chat, log and state from the DB', () => {
    const { c: host, joined } = create('A');
    const b = join_(joined.code, 'B');
    mgr.handle(host, { t: 'chat', text: 'merhaba' });
    mgr.handle(host, { t: 'start' });
    mgr.handle(b, { t: 'action', action: { type: 'roll' } });
    mgr.handle(host, { t: 'pause' });
    const tokenB = b.last('joined').token;

    // "restart": new DB handle + new manager on the same folder
    store.close();
    store = new Store(dir);
    mgr = newManager();
    expect(mgr.loadedRooms).toBe(0);
    expect(mgr.summary(joined.code)).toMatchObject({ status: 'paused', players: ['A', 'B'], turn: 1 });

    const back = new FakeClient();
    mgr.handle(back, { t: 'resume', code: joined.code, token: tokenB });
    const j = back.last('joined');
    expect(j.seat).toBe(1);
    expect(j.room).toMatchObject({ status: 'paused', hostSeat: 0 });
    expect(j.room.members.map((m) => m.connected)).toEqual([false, true]);
    expect(j.chat.map((m) => m.text)).toEqual(['merhaba']);
    expect(j.log.map((e) => e.event)).toEqual([{ type: 'rolled', seat: 1, dice: [1, 2] }]);
    expect(j.view).toMatchObject({ you: 1, turn: 1 });

    // host resumes, unpauses, play continues; action/log sequences continue after the reload
    const hostBack = new FakeClient();
    mgr.handle(hostBack, { t: 'resume', code: joined.code, token: joined.token });
    mgr.handle(hostBack, { t: 'unpause' });
    mgr.handle(hostBack, { t: 'action', action: { type: 'roll' } });
    expect(back.last('state').view.turn).toBe(2);
    expect(store.actions(joined.code).map((a) => [a.seq, a.seat, a.action.type])).toEqual([[1, 1, 'roll'], [2, 0, 'roll']]);
    expect(store.log(joined.code)).toHaveLength(2);
  });

  it('sweep evicts idle rooms from memory and deletes only stale lobbies', () => {
    const lobby = create('L');
    const { c: host, joined } = create('A');
    const b = join_(joined.code, 'B');
    mgr.handle(host, { t: 'start' });
    for (const c of [lobby.c, host, b]) mgr.disconnect(c);

    clock += EVICT_MS + 1;
    mgr.sweep();
    expect(mgr.loadedRooms).toBe(0);
    expect(store.loadRoom(lobby.joined.code)).not.toBeNull(); // still resumable

    clock += LOBBY_TTL_MS;
    mgr.sweep();
    expect(store.loadRoom(lobby.joined.code)).toBeNull();
    expect(store.loadRoom(joined.code)?.status).toBe('playing');
  });
});
