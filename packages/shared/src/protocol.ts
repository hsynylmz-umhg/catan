// WebSocket protocol (JSON text frames) between client and server. Endpoint: ws(s)://<host>/ws
import type { Action, GameEvent, MapSize, PlayerView, Seat, ThemeId } from './types';

export type RoomStatus = 'lobby' | 'playing' | 'paused' | 'finished';

export interface LobbyConfig {
  mapSize: MapSize;
  targetPoints: number; // 8..14
  /** Room's default visual theme. Each client may override it locally. */
  theme: ThemeId;
}

export interface Member {
  seat: Seat;
  name: string;
  color: string;
  connected: boolean;
}

export interface RoomInfo {
  code: string; // 5 chars, A-Z2-9 without lookalikes
  status: RoomStatus;
  hostSeat: Seat;
  config: LobbyConfig;
  members: Member[];
  /** standard: 4, large: 6 */
  maxPlayers: number;
  createdAt: number;
  updatedAt: number;
}

export interface ChatMessage {
  seat: Seat;
  name: string;
  text: string; // max 300 chars
  ts: number;
}

/** Logged game event with a timestamp, kept for the in-game history panel. */
export interface LogEntry {
  ts: number;
  event: GameEvent;
}

// ----- client -> server -----
export type ClientMsg =
  | { t: 'create'; name: string }
  | { t: 'join'; code: string; name: string }
  /** Reconnect / resume a seat using the secret token received in `joined`. */
  | { t: 'resume'; code: string; token: string }
  | { t: 'config'; config: Partial<LobbyConfig> } // host, lobby only
  | { t: 'color'; color: string } // lobby only, must be a free PLAYER_COLORS entry
  | { t: 'start' } // host, lobby only, needs 2+ members and members <= maxPlayers
  | { t: 'action'; action: Action }
  | { t: 'chat'; text: string }
  | { t: 'pause' } // host: playing -> paused
  | { t: 'unpause' } // host: paused -> playing
  | { t: 'leave' } // lobby: frees the seat. In game: just disconnects (seat is kept).
  | { t: 'ping' };

// ----- server -> client -----
export type ServerMsg =
  | {
      t: 'joined';
      code: string;
      seat: Seat;
      /** Secret seat token. Client stores it (localStorage) to resume later. */
      token: string;
      room: RoomInfo;
      chat: ChatMessage[]; // history (last 100)
      log: LogEntry[]; // history (last 200)
      view: PlayerView | null; // null while in lobby
    }
  | { t: 'room'; room: RoomInfo }
  | { t: 'state'; view: PlayerView; events: GameEvent[] }
  | { t: 'chat'; msg: ChatMessage }
  | { t: 'error'; code: ServerErrorCode; message?: string }
  | { t: 'pong' };

export type ServerErrorCode =
  | 'roomNotFound'
  | 'roomFull'
  | 'gameAlreadyStarted'
  | 'badToken'
  | 'notHost'
  | 'notInRoom'
  | 'paused'
  | 'needMorePlayers'
  | 'tooManyPlayers'
  | 'colorTaken'
  | 'badRequest'
  // plus any ActionError code from the engine, forwarded verbatim
  | (string & {});

// ----- REST -----
/** GET /api/rooms/:code -> RoomSummary | 404. Used by the home screen to list "my saved games". */
export interface RoomSummary {
  code: string;
  status: RoomStatus;
  players: string[];
  turn: number;
  updatedAt: number;
}
/** GET /api/history?limit=20 -> FinishedGame[] (most recent first). */
export interface FinishedGame {
  code: string;
  finishedAt: number;
  mapSize: MapSize;
  turns: number;
  winner: string;
  players: { name: string; points: number }[];
}
