// SQLite persistence (built-in node:sqlite, synchronous). One file: <DATA_DIR>/kervan.db
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';
import type { DatabaseSync, StatementSync } from 'node:sqlite';
import type {
  Action,
  ChatMessage,
  FinishedGame,
  GameEvent,
  GameState,
  LobbyConfig,
  LogEntry,
  RoomStatus,
  Seat,
} from '@kervan/shared';

// Loaded through require so bundlers / vite never try to resolve the `node:sqlite` builtin themselves.
const sqlite = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');

export interface StoredMember {
  seat: Seat;
  name: string;
  color: string;
  token: string;
}

export interface StoredRoom {
  code: string;
  status: RoomStatus;
  hostSeat: Seat;
  config: LobbyConfig;
  /** True once the host picked targetPoints explicitly (so a map size change keeps it). */
  targetTouched: boolean;
  members: StoredMember[];
  state: GameState | null;
  createdAt: number;
  updatedAt: number;
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS rooms (
  code TEXT PRIMARY KEY, status TEXT NOT NULL, host_seat INTEGER NOT NULL,
  config TEXT NOT NULL, members TEXT NOT NULL, state TEXT,
  created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS chat (
  id INTEGER PRIMARY KEY AUTOINCREMENT, room TEXT NOT NULL, seat INTEGER NOT NULL,
  name TEXT NOT NULL, text TEXT NOT NULL, ts INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS chat_room ON chat(room, id);
CREATE TABLE IF NOT EXISTS log (
  room TEXT NOT NULL, seq INTEGER NOT NULL, ts INTEGER NOT NULL, event TEXT NOT NULL,
  PRIMARY KEY (room, seq));
CREATE TABLE IF NOT EXISTS actions (
  room TEXT NOT NULL, seq INTEGER NOT NULL, ts INTEGER NOT NULL, seat INTEGER NOT NULL, action TEXT NOT NULL,
  PRIMARY KEY (room, seq));
CREATE TABLE IF NOT EXISTS finished (
  code TEXT NOT NULL, finished_at INTEGER NOT NULL, map_size TEXT NOT NULL,
  turns INTEGER NOT NULL, winner TEXT NOT NULL, players TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS finished_at ON finished(finished_at);
`;

type Row = Record<string, any>;

export class Store {
  readonly file: string;
  private db: DatabaseSync;
  private stmts = new Map<string, StatementSync>();

  constructor(dataDir: string) {
    const dir = resolve(dataDir);
    mkdirSync(dir, { recursive: true });
    this.file = join(dir, 'kervan.db');
    this.db = new sqlite.DatabaseSync(this.file);
    this.db.exec('PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL;');
    this.db.exec(SCHEMA);
  }

  private q(sql: string): StatementSync {
    let s = this.stmts.get(sql);
    if (!s) this.stmts.set(sql, (s = this.db.prepare(sql)));
    return s;
  }

  /** Run fn inside one transaction. */
  tx<T>(fn: () => T): T {
    this.db.exec('BEGIN');
    try {
      const out = fn();
      this.db.exec('COMMIT');
      return out;
    } catch (e) {
      this.db.exec('ROLLBACK');
      throw e;
    }
  }

  close(): void {
    this.stmts.clear();
    this.db.close();
  }

  // ----- rooms -----
  saveRoom(r: StoredRoom): void {
    this.q(
      `INSERT INTO rooms (code, status, host_seat, config, members, state, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(code) DO UPDATE SET status = excluded.status, host_seat = excluded.host_seat,
         config = excluded.config, members = excluded.members, state = excluded.state,
         updated_at = excluded.updated_at`,
    ).run(
      r.code,
      r.status,
      r.hostSeat,
      JSON.stringify({ ...r.config, targetTouched: r.targetTouched }),
      JSON.stringify(r.members),
      r.state ? JSON.stringify(r.state) : null,
      r.createdAt,
      r.updatedAt,
    );
  }

  loadRoom(code: string): StoredRoom | null {
    const row = this.q('SELECT * FROM rooms WHERE code = ?').get(code) as Row | undefined;
    if (!row) return null;
    const { targetTouched, ...config } = JSON.parse(row.config);
    return {
      code: row.code,
      status: row.status,
      hostSeat: row.host_seat,
      config,
      targetTouched: !!targetTouched,
      members: JSON.parse(row.members),
      state: row.state ? JSON.parse(row.state) : null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  roomExists(code: string): boolean {
    return !!this.q('SELECT 1 FROM rooms WHERE code = ?').get(code);
  }

  /** Remove a room that never started, with its lobby chat. */
  deleteRoom(code: string): void {
    this.q('DELETE FROM rooms WHERE code = ?').run(code);
    this.q('DELETE FROM chat WHERE room = ?').run(code);
  }

  /** Codes of lobby-status rooms not updated since `cutoff`. */
  staleLobbies(cutoff: number): string[] {
    const rows = this.q(`SELECT code FROM rooms WHERE status = 'lobby' AND updated_at < ?`).all(cutoff) as Row[];
    return rows.map((r) => r.code);
  }

  // ----- chat -----
  addChat(room: string, m: ChatMessage): void {
    this.q('INSERT INTO chat (room, seat, name, text, ts) VALUES (?, ?, ?, ?, ?)').run(room, m.seat, m.name, m.text, m.ts);
  }

  chat(room: string, limit = 100): ChatMessage[] {
    const rows = this.q('SELECT seat, name, text, ts FROM chat WHERE room = ? ORDER BY id DESC LIMIT ?').all(room, limit) as Row[];
    return rows.reverse().map((r) => ({ seat: r.seat, name: r.name, text: r.text, ts: r.ts }));
  }

  /** Seats are compacted when a game starts; keep lobby chat pointing at the right seats. Pairs must be ascending by old seat. */
  remapChatSeats(room: string, pairs: [from: Seat, to: Seat][]): void {
    for (const [from, to] of pairs) {
      if (from !== to) this.q('UPDATE chat SET seat = ? WHERE room = ? AND seat = ?').run(to, room, from);
    }
  }

  // ----- log + actions -----
  addLog(room: string, seq: number, ts: number, event: GameEvent): void {
    this.q('INSERT INTO log (room, seq, ts, event) VALUES (?, ?, ?, ?)').run(room, seq, ts, JSON.stringify(event));
  }

  log(room: string, limit = 200): LogEntry[] {
    const rows = this.q('SELECT ts, event FROM log WHERE room = ? ORDER BY seq DESC LIMIT ?').all(room, limit) as Row[];
    return rows.reverse().map((r) => ({ ts: r.ts, event: JSON.parse(r.event) }));
  }

  addAction(room: string, seq: number, ts: number, seat: Seat, action: Action): void {
    this.q('INSERT INTO actions (room, seq, ts, seat, action) VALUES (?, ?, ?, ?, ?)').run(room, seq, ts, seat, JSON.stringify(action));
  }

  actions(room: string): { seq: number; ts: number; seat: Seat; action: Action }[] {
    const rows = this.q('SELECT seq, ts, seat, action FROM actions WHERE room = ? ORDER BY seq').all(room) as Row[];
    return rows.map((r) => ({ seq: r.seq, ts: r.ts, seat: r.seat, action: JSON.parse(r.action) }));
  }

  /** Highest used sequence numbers, to continue counting after a reload. */
  seqs(room: string): { log: number; actions: number } {
    const l = this.q('SELECT COALESCE(MAX(seq), 0) AS n FROM log WHERE room = ?').get(room) as Row;
    const a = this.q('SELECT COALESCE(MAX(seq), 0) AS n FROM actions WHERE room = ?').get(room) as Row;
    return { log: l.n, actions: a.n };
  }

  // ----- finished games -----
  addFinished(g: FinishedGame): void {
    this.q('INSERT INTO finished (code, finished_at, map_size, turns, winner, players) VALUES (?, ?, ?, ?, ?, ?)').run(
      g.code,
      g.finishedAt,
      g.mapSize,
      g.turns,
      g.winner,
      JSON.stringify(g.players),
    );
  }

  history(limit = 20): FinishedGame[] {
    const rows = this.q('SELECT * FROM finished ORDER BY finished_at DESC, rowid DESC LIMIT ?').all(limit) as Row[];
    return rows.map((r) => ({
      code: r.code,
      finishedAt: r.finished_at,
      mapSize: r.map_size,
      turns: r.turns,
      winner: r.winner,
      players: JSON.parse(r.players),
    }));
  }
}
