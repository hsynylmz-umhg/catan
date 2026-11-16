// Room logic, independent of sockets: a "client" is anything that can receive ServerMsg objects.
import { randomBytes } from 'node:crypto';
import { PLAYER_COLORS, applyAction, createGame, getView } from '@kervan/shared';
import type {
  Action,
  ChatMessage,
  FinishedGame,
  GameState,
  LobbyConfig,
  MapSize,
  RoomInfo,
  RoomStatus,
  RoomSummary,
  Seat,
  ServerErrorCode,
  ServerMsg,
  ThemeId,
} from '@kervan/shared';
import type { Store, StoredMember } from './db';

export interface Engine {
  createGame: typeof createGame;
  applyAction: typeof applyAction;
  getView: typeof getView;
}
const realEngine: Engine = { createGame, applyAction, getView };

/** One connection. `code`/`seat` are set by the manager while the client sits in a room. */
export interface Client {
  send(msg: ServerMsg): void;
  /** Close the underlying connection (used when a newer connection takes over the seat). */
  close(): void;
  code?: string;
  seat?: Seat;
}

interface Room {
  code: string;
  status: RoomStatus;
  hostSeat: Seat;
  config: LobbyConfig;
  targetTouched: boolean;
  members: StoredMember[];
  state: GameState | null;
  createdAt: number;
  updatedAt: number;
  // runtime only
  clients: Map<Seat, Client>;
  logSeq: number;
  actionSeq: number;
  chatTimes: Map<Seat, number[]>;
  /** Last time a client was attached or detached (for eviction). */
  lastActive: number;
}

export interface ManagerOptions {
  engine?: Engine;
  now?: () => number;
  log?: (line: string) => void;
}

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no I, O, 0, 1
const MAX_SEATS = 6;
const MAX_NAME = 20;
const MAX_CHAT = 300;
const CHAT_BURST = 5;
const CHAT_WINDOW_MS = 3_000;
export const EVICT_MS = 10 * 60_000;
export const LOBBY_TTL_MS = 24 * 60 * 60_000;
const MAP_SIZES: MapSize[] = ['standard', 'large'];
const THEMES: ThemeId[] = ['anatolia', 'archipelago', 'space'];

const maxPlayers = (size: MapSize) => (size === 'large' ? 6 : 4);
const defaultTarget = (size: MapSize) => (size === 'large' ? 11 : 10);
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

export class RoomManager {
  private rooms = new Map<string, Room>();
  private engine: Engine;
  private now: () => number;
  private log: (line: string) => void;

  constructor(private store: Store, opts: ManagerOptions = {}) {
    this.engine = opts.engine ?? realEngine;
    this.now = opts.now ?? Date.now;
    this.log = opts.log ?? (() => {});
  }

  // ---------------------------------------------------------------- public API

  /** Handle one already-JSON-parsed client message. Never throws. */
  handle(client: Client, msg: unknown): void {
    try {
      this.dispatch(client, msg);
    } catch (e) {
      this.log(`error handling message: ${(e as Error)?.stack ?? e}`);
      this.err(client, 'internal');
    }
  }

  /** The connection went away. */
  disconnect(client: Client): void {
    const room = client.code ? this.rooms.get(client.code) : undefined;
    const seat = client.seat;
    client.code = undefined;
    client.seat = undefined;
    if (!room || seat === undefined || room.clients.get(seat) !== client) return;
    room.clients.delete(seat);
    room.lastActive = this.now();
    this.broadcastRoom(room);
  }

  summary(code: unknown): RoomSummary | null {
    const room = this.getRoom(code);
    if (!room) return null;
    return {
      code: room.code,
      status: room.status,
      players: [...room.members].sort((a, b) => a.seat - b.seat).map((m) => m.name),
      turn: room.state?.turn ?? 0,
      updatedAt: room.updatedAt,
    };
  }

  history(limit: number): FinishedGame[] {
    return this.store.history(limit);
  }

  /** Periodic housekeeping: evict idle rooms from memory, delete lobbies untouched for 24 h. */
  sweep(): void {
    const now = this.now();
    for (const room of this.rooms.values()) {
      if (room.clients.size === 0 && now - room.lastActive > EVICT_MS) this.rooms.delete(room.code);
    }
    for (const code of this.store.staleLobbies(now - LOBBY_TTL_MS)) {
      const live = this.rooms.get(code);
      if (live && live.clients.size > 0) continue;
      this.rooms.delete(code);
      this.store.deleteRoom(code);
      this.log(`room ${code} deleted (stale lobby)`);
    }
  }

  /** Number of rooms currently held in memory (for tests / diagnostics). */
  get loadedRooms(): number {
    return this.rooms.size;
  }

  // ---------------------------------------------------------------- dispatch

  private dispatch(client: Client, msg: unknown): void {
    if (!isObj(msg) || typeof msg.t !== 'string') return this.err(client, 'badRequest');
    switch (msg.t) {
      case 'ping':
        return client.send({ t: 'pong' });
      case 'create':
        return this.onCreate(client, msg.name);
      case 'join':
        return this.onJoin(client, msg.code, msg.name);
      case 'resume':
        return this.onResume(client, msg.code, msg.token);
      case 'config':
        return this.onConfig(client, msg.config);
      case 'color':
        return this.onColor(client, msg.color);
      case 'start':
        return this.onStart(client);
      case 'action':
        return this.onAction(client, msg.action);
      case 'chat':
        return this.onChat(client, msg.text);
      case 'pause':
        return this.onPause(client, true);
      case 'unpause':
        return this.onPause(client, false);
      case 'leave':
        return this.onLeave(client);
      default:
        return this.err(client, 'badRequest');
    }
  }

  private onCreate(client: Client, rawName: unknown): void {
    const name = cleanName(rawName);
    if (!name || client.code) return this.err(client, 'badRequest');
    let code: string;
    do code = randomCode();
    while (this.rooms.has(code) || this.store.roomExists(code));
    const now = this.now();
    const room: Room = {
      code,
      status: 'lobby',
      hostSeat: 0,
      config: { mapSize: 'standard', targetPoints: defaultTarget('standard'), theme: 'anatolia' },
      targetTouched: false,
      members: [{ seat: 0, name, color: PLAYER_COLORS[0], token: newToken() }],
      state: null,
      createdAt: now,
      updatedAt: now,
      clients: new Map(),
      logSeq: 0,
      actionSeq: 0,
      chatTimes: new Map(),
      lastActive: now,
    };
    this.rooms.set(code, room);
    this.save(room);
    this.attach(room, 0, client);
    this.log(`room ${code} created by "${name}"`);
    this.sendJoined(room, 0);
  }

  private onJoin(client: Client, rawCode: unknown, rawName: unknown): void {
    const base = cleanName(rawName);
    if (!base || typeof rawCode !== 'string' || client.code) return this.err(client, 'badRequest');
    const room = this.getRoom(rawCode);
    if (!room) return this.err(client, 'roomNotFound');
    if (room.status !== 'lobby') return this.err(client, 'gameAlreadyStarted');
    if (room.members.length >= MAX_SEATS) return this.err(client, 'roomFull');
    const seats = new Set(room.members.map((m) => m.seat));
    let seat = 0;
    while (seats.has(seat)) seat++;
    const used = new Set(room.members.map((m) => m.color));
    const color = PLAYER_COLORS.find((c) => !used.has(c))!;
    const name = uniqueName(base, room.members.map((m) => m.name));
    room.members.push({ seat, name, color, token: newToken() });
    room.members.sort((a, b) => a.seat - b.seat);
    this.touch(room);
    this.attach(room, seat, client);
    this.sendJoined(room, seat);
    this.broadcastRoom(room);
  }

  private onResume(client: Client, rawCode: unknown, token: unknown): void {
    if (typeof rawCode !== 'string' || typeof token !== 'string' || client.code) return this.err(client, 'badRequest');
    const room = this.getRoom(rawCode);
    if (!room) return this.err(client, 'roomNotFound');
    const member = room.members.find((m) => m.token === token);
    if (!member) return this.err(client, 'badToken');
    const old = room.clients.get(member.seat);
    if (old && old !== client) {
      old.code = undefined;
      old.seat = undefined;
      old.close();
    }
    this.attach(room, member.seat, client);
    this.sendJoined(room, member.seat);
    this.broadcastRoom(room);
  }

  private onConfig(client: Client, patch: unknown): void {
    const ctx = this.ctx(client);
    if (!ctx) return;
    const { room } = ctx;
    if (!isObj(patch)) return this.err(client, 'badRequest');
    if (ctx.member.seat !== room.hostSeat) return this.err(client, 'notHost');
    if (room.status !== 'lobby') return this.err(client, 'gameAlreadyStarted');
    const { mapSize, targetPoints, theme } = patch;
    if (mapSize !== undefined && !MAP_SIZES.includes(mapSize as MapSize)) return this.err(client, 'badRequest');
    if (theme !== undefined && !THEMES.includes(theme as ThemeId)) return this.err(client, 'badRequest');
    if (targetPoints !== undefined && !(Number.isInteger(targetPoints) && (targetPoints as number) >= 8 && (targetPoints as number) <= 14)) {
      return this.err(client, 'badRequest');
    }
    const next = { ...room.config };
    if (targetPoints !== undefined) {
      next.targetPoints = targetPoints as number;
      room.targetTouched = true;
    }
    if (mapSize !== undefined && mapSize !== next.mapSize) {
      next.mapSize = mapSize as MapSize;
      if (!room.targetTouched) next.targetPoints = defaultTarget(next.mapSize);
    }
    if (theme !== undefined) next.theme = theme as ThemeId;
    room.config = next;
    this.touch(room);
    this.broadcastRoom(room);
  }

  private onColor(client: Client, color: unknown): void {
    const ctx = this.ctx(client);
    if (!ctx) return;
    const { room, member } = ctx;
    if (typeof color !== 'string') return this.err(client, 'badRequest');
    if (room.status !== 'lobby') return this.err(client, 'gameAlreadyStarted');
    if (!(PLAYER_COLORS as readonly string[]).includes(color)) return this.err(client, 'colorTaken');
    if (room.members.some((m) => m !== member && m.color === color)) return this.err(client, 'colorTaken');
    member.color = color;
    this.touch(room);
    this.broadcastRoom(room);
  }

  private onStart(client: Client): void {
    const ctx = this.ctx(client);
    if (!ctx) return;
    const { room } = ctx;
    if (ctx.member.seat !== room.hostSeat) return this.err(client, 'notHost');
    if (room.status !== 'lobby') return this.err(client, 'gameAlreadyStarted');
    const sorted = [...room.members].sort((a, b) => a.seat - b.seat);
    if (sorted.length < 2) return this.err(client, 'needMorePlayers');
    if (sorted.length > maxPlayers(room.config.mapSize)) return this.err(client, 'tooManyPlayers');

    let state: GameState;
    try {
      state = this.engine.createGame(
        { mapSize: room.config.mapSize, targetPoints: room.config.targetPoints, seed: randomBytes(4).readUInt32BE(0) },
        sorted.map((m) => ({ name: m.name, color: m.color })),
      );
    } catch (e) {
      this.log(`room ${room.code} createGame failed: ${(e as Error)?.message ?? e}`);
      return this.err(client, 'internal', String((e as Error)?.message ?? e));
    }

    // Compact seats to 0..n-1 (seat order is kept, so it is also the turn order).
    const pairs = sorted.map((m, i) => [m.seat, i] as [Seat, Seat]);
    const map = new Map(pairs);
    const clients = new Map<Seat, Client>();
    for (const [seat, c] of room.clients) {
      c.seat = map.get(seat)!;
      clients.set(c.seat, c);
    }
    room.clients = clients;
    room.hostSeat = map.get(room.hostSeat)!;
    sorted.forEach((m, i) => (m.seat = i));
    room.members = sorted;
    room.chatTimes.clear();
    room.state = state;
    room.status = 'playing';
    this.store.tx(() => {
      this.store.remapChatSeats(room.code, pairs);
      this.touch(room);
    });
    this.log(`room ${room.code} started (${sorted.length} players, ${room.config.mapSize})`);
    for (const seat of room.clients.keys()) this.sendJoined(room, seat);
    this.broadcastRoom(room);
  }

  private onAction(client: Client, action: unknown): void {
    const ctx = this.ctx(client);
    if (!ctx) return;
    const { room } = ctx;
    const seat = ctx.member.seat;
    if (!isObj(action) || typeof action.type !== 'string') return this.err(client, 'badRequest');
    if (room.status === 'paused') return this.err(client, 'paused');
    if (room.status !== 'playing' || !room.state) return this.err(client, 'wrongPhase');

    let res: ReturnType<Engine['applyAction']>;
    try {
      res = this.engine.applyAction(room.state, seat, action as Action);
    } catch (e) {
      this.log(`room ${room.code} applyAction threw: ${(e as Error)?.stack ?? e}`);
      return this.err(client, 'badAction');
    }
    if (!res.ok) return this.err(client, res.error);

    const { state, events } = res;
    const ts = this.now();
    const finished = state.phase === 'finished';
    room.state = state;
    if (finished) room.status = 'finished';
    this.store.tx(() => {
      this.store.addAction(room.code, ++room.actionSeq, ts, seat, action as Action);
      for (const event of events) this.store.addLog(room.code, ++room.logSeq, ts, event);
      if (finished) this.store.addFinished(this.finishedRecord(room, state, ts));
      this.touch(room);
    });
    for (const [s, c] of room.clients) c.send({ t: 'state', view: this.engine.getView(state, s), events });
    if (finished) {
      this.log(`room ${room.code} finished (winner seat ${state.winner}, turn ${state.turn})`);
      this.broadcastRoom(room);
    }
  }

  private onChat(client: Client, rawText: unknown): void {
    const ctx = this.ctx(client);
    if (!ctx) return;
    const { room, member } = ctx;
    if (typeof rawText !== 'string') return this.err(client, 'badRequest');
    const text = rawText.trim().slice(0, MAX_CHAT);
    if (!text) return;
    const now = this.now();
    const times = (room.chatTimes.get(member.seat) ?? []).filter((t) => now - t < CHAT_WINDOW_MS);
    if (times.length >= CHAT_BURST) {
      room.chatTimes.set(member.seat, times);
      return this.err(client, 'rateLimited');
    }
    times.push(now);
    room.chatTimes.set(member.seat, times);
    const msg: ChatMessage = { seat: member.seat, name: member.name, text, ts: now };
    this.store.addChat(room.code, msg);
    this.broadcast(room, { t: 'chat', msg });
  }

  private onPause(client: Client, pause: boolean): void {
    const ctx = this.ctx(client);
    if (!ctx) return;
    const { room } = ctx;
    if (ctx.member.seat !== room.hostSeat) return this.err(client, 'notHost');
    if (room.status !== (pause ? 'playing' : 'paused')) return this.err(client, 'badRequest');
    room.status = pause ? 'paused' : 'playing';
    this.touch(room);
    this.log(`room ${room.code} ${pause ? 'paused' : 'resumed'}`);
    this.broadcastRoom(room);
  }

  private onLeave(client: Client): void {
    const ctx = this.ctx(client);
    if (!ctx) return;
    const { room, member } = ctx;
    room.clients.delete(member.seat);
    room.lastActive = this.now();
    client.code = undefined;
    client.seat = undefined;
    if (room.status === 'lobby') {
      room.members = room.members.filter((m) => m !== member);
      room.chatTimes.delete(member.seat);
      if (room.members.length === 0) {
        this.rooms.delete(room.code);
        this.store.deleteRoom(room.code);
        this.log(`room ${room.code} deleted (empty lobby)`);
        return;
      }
      if (room.hostSeat === member.seat) room.hostSeat = Math.min(...room.members.map((m) => m.seat));
      this.touch(room);
    }
    this.broadcastRoom(room);
  }

  // ---------------------------------------------------------------- helpers

  private err(client: Client, code: ServerErrorCode, message?: string): void {
    client.send(message ? { t: 'error', code, message } : { t: 'error', code });
  }

  /** Room + member for a client, or sends notInRoom. */
  private ctx(client: Client): { room: Room; member: StoredMember } | null {
    const room = client.code ? this.rooms.get(client.code) : undefined;
    const member = room?.members.find((m) => m.seat === client.seat);
    if (!room || !member || room.clients.get(member.seat) !== client) {
      this.err(client, 'notInRoom');
      return null;
    }
    return { room, member };
  }

  /** From memory, else lazily from the DB. */
  private getRoom(rawCode: unknown): Room | null {
    if (typeof rawCode !== 'string') return null;
    const code = rawCode.trim().toUpperCase();
    if (!/^[A-Z0-9]{5}$/.test(code)) return null;
    const live = this.rooms.get(code);
    if (live) return live;
    const stored = this.store.loadRoom(code);
    if (!stored) return null;
    const seqs = this.store.seqs(code);
    const room: Room = {
      ...stored,
      clients: new Map(),
      logSeq: seqs.log,
      actionSeq: seqs.actions,
      chatTimes: new Map(),
      lastActive: this.now(),
    };
    this.rooms.set(code, room);
    return room;
  }

  private attach(room: Room, seat: Seat, client: Client): void {
    room.clients.set(seat, client);
    room.lastActive = this.now();
    client.code = room.code;
    client.seat = seat;
  }

  private touch(room: Room): void {
    room.updatedAt = this.now();
    this.save(room);
  }

  private save(room: Room): void {
    const { code, status, hostSeat, config, targetTouched, members, state, createdAt, updatedAt } = room;
    this.store.saveRoom({ code, status, hostSeat, config, targetTouched, members, state, createdAt, updatedAt });
  }

  private info(room: Room): RoomInfo {
    return {
      code: room.code,
      status: room.status,
      hostSeat: room.hostSeat,
      config: room.config,
      members: room.members.map((m) => ({ seat: m.seat, name: m.name, color: m.color, connected: room.clients.has(m.seat) })),
      maxPlayers: maxPlayers(room.config.mapSize),
      createdAt: room.createdAt,
      updatedAt: room.updatedAt,
    };
  }

  private broadcast(room: Room, msg: ServerMsg): void {
    for (const c of room.clients.values()) c.send(msg);
  }

  private broadcastRoom(room: Room): void {
    this.broadcast(room, { t: 'room', room: this.info(room) });
  }

  private sendJoined(room: Room, seat: Seat): void {
    const member = room.members.find((m) => m.seat === seat)!;
    room.clients.get(seat)?.send({
      t: 'joined',
      code: room.code,
      seat,
      token: member.token,
      room: this.info(room),
      chat: this.store.chat(room.code, 100),
      log: this.store.log(room.code, 200),
      view: room.state ? this.engine.getView(room.state, seat) : null,
    });
  }

  private finishedRecord(room: Room, state: GameState, ts: number): FinishedGame {
    const view = this.engine.getView(state, null);
    return {
      code: room.code,
      finishedAt: ts,
      mapSize: room.config.mapSize,
      turns: state.turn,
      winner: state.winner === null ? '' : (state.players[state.winner]?.name ?? ''),
      players: view.players.map((p) => ({ name: p.name, points: p.totalPoints ?? p.publicPoints })),
    };
  }
}

function randomCode(): string {
  let out = '';
  for (const b of randomBytes(5)) out += CODE_CHARS[b & 31];
  return out;
}

function newToken(): string {
  return randomBytes(24).toString('base64url');
}

/** Trimmed, whitespace-collapsed, at most 20 chars; '' when unusable. */
function cleanName(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  return raw.replace(/\s+/g, ' ').trim().slice(0, MAX_NAME).trim();
}

function uniqueName(base: string, taken: string[]): string {
  const used = new Set(taken.map((n) => n.toLowerCase()));
  if (!used.has(base.toLowerCase())) return base;
  for (let i = 2; ; i++) {
    const suffix = ` ${i}`;
    const name = base.slice(0, MAX_NAME - suffix.length).trim() + suffix;
    if (!used.has(name.toLowerCase())) return name;
  }
}
