import { create } from 'zustand';
import type {
  Action,
  ChatMessage,
  ClientMsg,
  GameEvent,
  LogEntry,
  PlayerView,
  RoomInfo,
  Seat,
  ServerMsg,
} from '@kervan/shared';
import { findSeat, loadSettings, removeSeat, saveSeat, saveSettings, type Settings } from './storage';
import { blip, setMuted } from './sound';
import { makeDemo } from './demo';
import type { Key, Vars } from './i18n';

export type Conn = 'idle' | 'connecting' | 'open' | 'reconnecting';
export type BuildMode = 'road' | 'outpost' | 'keep' | 'market';
export interface Toast {
  id: number;
  kind: 'error' | 'info';
  /** Server/engine error code (kind=error) … */
  code?: string;
  /** … or an i18n key (kind=info). */
  key?: Key;
  vars?: Vars;
}
export interface LastBuilt {
  kind: 'edge' | 'vertex';
  id: number;
  at: number;
}

type Intent =
  | { t: 'create'; name: string }
  | { t: 'join'; code: string; name: string }
  | { t: 'resume'; code: string; token: string };

interface Store {
  settings: Settings;
  setSetting: <K extends keyof Settings>(key: K, value: Settings[K]) => void;

  demo: boolean;
  conn: Conn;
  /** Seat was taken over by another tab/device (WS close 4000). Auto-reconnect is suspended. */
  replaced: boolean;
  /** Re-open the current seat on this device after `replaced`. */
  takeBack: () => void;
  code: string | null;
  seat: Seat | null;
  room: RoomInfo | null;
  view: PlayerView | null;
  chat: ChatMessage[];
  log: LogEntry[];

  toasts: Toast[];
  pushToast: (t: Omit<Toast, 'id'>) => void;
  dropToast: (id: number) => void;

  mode: BuildMode | null;
  setMode: (m: BuildMode | null) => void;
  lastBuilt: LastBuilt | null;
  diceTick: number;

  panelOpen: boolean;
  panelTab: 'log' | 'chat';
  unreadChat: number;
  unreadLog: number;
  setPanel: (open: boolean, tab?: 'log' | 'chat') => void;

  createRoom: (name: string) => void;
  joinRoom: (code: string, name: string) => void;
  resumeRoom: (code: string, token: string) => void;
  send: (msg: ClientMsg) => void;
  act: (action: Action) => void;
  /** Close the socket and go to the home screen. `giveUpSeat` (lobby) also frees the seat. */
  leaveHome: (giveUpSeat?: boolean) => void;
}

let ws: WebSocket | null = null;
let intent: Intent | null = null;
let retry = 0;
let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
let pingTimer: ReturnType<typeof setInterval> | undefined;
let toastId = 1;
let builtTimer: ReturnType<typeof setTimeout> | undefined;

const isWide = () => typeof window !== 'undefined' && window.matchMedia('(min-width: 900px)').matches;
const setUrlRoom = (code: string | null) => {
  try {
    const url = new URL(location.href);
    if (code) url.searchParams.set('room', code);
    else url.searchParams.delete('room');
    history.replaceState(null, '', url.pathname + url.search);
  } catch {
    /* ignore */
  }
};

const initialSettings = loadSettings();
setMuted(initialSettings.muted);
const params = new URLSearchParams(typeof location !== 'undefined' ? location.search : '');
const demoData = params.get('demo') === '1' ? makeDemo(params) : null;

export const useStore = create<Store>((set, get) => {
  const closeSocket = () => {
    clearTimeout(reconnectTimer);
    clearInterval(pingTimer);
    const s = ws;
    ws = null;
    if (s) {
      s.onopen = s.onmessage = s.onclose = s.onerror = null;
      try {
        s.close();
      } catch {
        /* ignore */
      }
    }
  };

  const resetRoom = () =>
    set({
      conn: 'idle', replaced: false, code: null, seat: null, room: null, view: null, chat: [], log: [],
      mode: null, lastBuilt: null, panelOpen: false, unreadChat: 0, unreadLog: 0,
    });

  const goHome = () => {
    intent = null;
    closeSocket();
    resetRoom();
    setUrlRoom(null);
  };

  const onEvents = (events: GameEvent[], view: PlayerView) => {
    if (events.length === 0) return;
    const now = Date.now();
    const st = get();
    const patch: Partial<Store> = {
      log: [...st.log, ...events.map((event) => ({ ts: now, event }))].slice(-300),
    };
    const logVisible = st.panelTab === 'log' && (st.panelOpen || isWide());
    if (!logVisible) patch.unreadLog = st.unreadLog + events.length;
    for (const ev of events) {
      if (ev.type === 'rolled') {
        patch.diceTick = st.diceTick + 1;
        blip('dice');
      } else if (ev.type === 'built') {
        patch.lastBuilt = ev.kind === 'road' ? { kind: 'edge', id: ev.edge, at: now } : { kind: 'vertex', id: ev.vertex, at: now };
        blip('build');
        clearTimeout(builtTimer);
        builtTimer = setTimeout(() => set({ lastBuilt: null }), 3500);
      } else if (ev.type === 'turnStarted' && ev.seat === view.you) blip('turn');
      else if (ev.type === 'tradeOffered' && ev.seat !== view.you) blip('trade');
      else if (ev.type === 'tradeCompleted') blip('trade');
      else if (ev.type === 'gameWon') blip('win');
    }
    set(patch);
  };

  const handle = (msg: ServerMsg) => {
    switch (msg.t) {
      case 'joined': {
        const name = msg.room.members.find((m) => m.seat === msg.seat)?.name ?? get().settings.name;
        saveSeat({ code: msg.code, token: msg.token, name });
        intent = { t: 'resume', code: msg.code, token: msg.token };
        retry = 0;
        setUrlRoom(msg.code);
        const fresh = get().code !== msg.code;
        set({
          conn: 'open',
          code: msg.code,
          seat: msg.view?.you ?? msg.seat,
          room: msg.room,
          view: msg.view,
          chat: msg.chat,
          log: msg.log,
          ...(fresh ? { mode: null, lastBuilt: null, unreadChat: 0, unreadLog: 0, panelOpen: false } : {}),
        });
        break;
      }
      case 'room':
        set({ room: msg.room });
        break;
      case 'state': {
        const prev = get().view;
        const turnChanged = !prev || prev.current !== msg.view.current || prev.step !== msg.view.step || prev.phase !== msg.view.phase;
        set({
          view: msg.view,
          ...(msg.view.you !== null ? { seat: msg.view.you } : {}),
          ...(turnChanged ? { mode: null } : {}),
        });
        onEvents(msg.events, msg.view);
        break;
      }
      case 'chat': {
        const st = get();
        const visible = st.panelTab === 'chat' && (st.panelOpen || isWide());
        set({ chat: [...st.chat, msg.msg].slice(-200), unreadChat: visible ? 0 : st.unreadChat + 1 });
        if (msg.msg.seat !== st.seat) blip('chat');
        break;
      }
      case 'error': {
        const st = get();
        const wasResume = intent?.t === 'resume';
        get().pushToast({ kind: 'error', code: msg.code });
        blip('error');
        const fatalResume = wasResume && (msg.code === 'badToken' || msg.code === 'roomNotFound');
        if (fatalResume && intent?.t === 'resume') removeSeat(intent.code);
        // An error before we ever got `joined` (or a dead seat) means there is nothing to stay connected for.
        if (!st.room || fatalResume) goHome();
        break;
      }
      case 'pong':
        break;
    }
  };

  const open = () => {
    closeSocket();
    if (!intent) return;
    let sock: WebSocket;
    try {
      sock = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`);
    } catch {
      scheduleReconnect();
      return;
    }
    ws = sock;
    sock.onopen = () => {
      if (ws !== sock || !intent) return;
      sock.send(JSON.stringify(intent));
      pingTimer = setInterval(() => {
        if (sock.readyState === WebSocket.OPEN) sock.send(JSON.stringify({ t: 'ping' } satisfies ClientMsg));
      }, 25_000);
    };
    sock.onmessage = (ev) => {
      if (ws !== sock) return;
      let msg: ServerMsg;
      try {
        msg = JSON.parse(String(ev.data)) as ServerMsg;
      } catch {
        return;
      }
      handle(msg);
    };
    sock.onclose = (ev) => {
      if (ws !== sock) return;
      clearInterval(pingTimer);
      ws = null;
      if (ev.code === 4000) {
        // Another socket resumed this seat: do not fight over it.
        set({ replaced: true, conn: 'idle' });
        return;
      }
      scheduleReconnect();
    };
  };

  const scheduleReconnect = () => {
    if (!intent) return;
    set({ conn: get().room ? 'reconnecting' : 'connecting' });
    const delay = Math.min(15_000, 700 * 2 ** retry);
    retry += 1;
    clearTimeout(reconnectTimer);
    reconnectTimer = setTimeout(open, delay);
  };

  const start = (i: Intent) => {
    // One room per socket: politely leave a lobby seat we hold before switching rooms.
    const st = get();
    if (ws && ws.readyState === WebSocket.OPEN && st.room && st.room.status === 'lobby' && st.code && i.t !== 'resume') {
      try {
        ws.send(JSON.stringify({ t: 'leave' } satisfies ClientMsg));
      } catch {
        /* ignore */
      }
    }
    intent = i;
    retry = 0;
    set({ conn: 'connecting', replaced: false });
    open(); // always a fresh socket
  };

  if (typeof window !== 'undefined') {
    // Reconnect promptly when the tab/network comes back instead of waiting for the backoff timer.
    const kick = () => {
      if (intent && !ws && !get().replaced && document.visibilityState === 'visible') {
        retry = 0;
        open();
      }
    };
    window.addEventListener('online', kick);
    document.addEventListener('visibilitychange', kick);
  }

  return {
    settings: initialSettings,
    setSetting: (key, value) => {
      const settings = { ...get().settings, [key]: value };
      saveSettings(settings);
      if (key === 'muted') setMuted(Boolean(value));
      set({ settings });
    },

    demo: !!demoData,
    conn: demoData ? 'open' : 'idle',
    replaced: false,
    takeBack: () => {
      if (!intent) return;
      retry = 0;
      set({ replaced: false, conn: 'reconnecting' });
      open();
    },
    code: demoData?.room.code ?? null,
    seat: demoData ? 0 : null,
    room: demoData?.room ?? null,
    view: demoData?.view ?? null,
    chat: demoData?.chat ?? [],
    log: demoData?.log ?? [],

    toasts: [],
    pushToast: (t) => {
      const id = toastId++;
      set({ toasts: [...get().toasts.slice(-2), { ...t, id }] });
      setTimeout(() => get().dropToast(id), 3800);
    },
    dropToast: (id) => set({ toasts: get().toasts.filter((x) => x.id !== id) }),

    mode: null,
    setMode: (mode) => set({ mode }),
    lastBuilt: null,
    diceTick: 0,

    panelOpen: false,
    panelTab: 'log',
    unreadChat: 0,
    unreadLog: 0,
    setPanel: (open_, tab) => {
      const t = tab ?? get().panelTab;
      const visible = open_ || isWide();
      set({
        panelOpen: open_,
        panelTab: t,
        ...(visible && t === 'chat' ? { unreadChat: 0 } : {}),
        ...(visible && t === 'log' ? { unreadLog: 0 } : {}),
      });
    },

    createRoom: (name) => start({ t: 'create', name }),
    joinRoom: (code, name) => {
      const c = code.trim().toUpperCase();
      const saved = findSeat(c);
      start(saved ? { t: 'resume', code: c, token: saved.token } : { t: 'join', code: c, name });
    },
    resumeRoom: (code, token) => start({ t: 'resume', code, token }),

    send: (msg) => {
      if (get().demo) return;
      if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
      else get().pushToast({ kind: 'error', code: 'network' });
    },
    act: (action) => {
      const st = get();
      if (st.demo) {
        // Minimal local reactions so the demo isn't completely inert.
        const v = st.view!;
        if (action.type === 'roll') {
          const dice: [number, number] = [1 + Math.floor(Math.random() * 6), 1 + Math.floor(Math.random() * 6)];
          set({ view: { ...v, dice, step: 'actions' } });
          onEvents([{ type: 'rolled', seat: 0, dice }], v);
        } else if (action.type === 'endTurn') set({ view: { ...v, step: 'roll' }, mode: null });
        else if (action.type === 'buildRoad') {
          set({ view: { ...v, roads: { ...v.roads, [action.edge]: 0 } }, mode: null });
          onEvents([{ type: 'built', seat: 0, kind: 'road', edge: action.edge }], v);
        } else if (action.type === 'buildOutpost') {
          set({ view: { ...v, buildings: { ...v.buildings, [action.vertex]: { owner: 0, kind: 'outpost' } } }, mode: null });
          onEvents([{ type: 'built', seat: 0, kind: 'outpost', vertex: action.vertex }], v);
        } else if (action.type === 'upgrade') {
          set({ view: { ...v, buildings: { ...v.buildings, [action.vertex]: { owner: 0, kind: action.to } } }, mode: null });
          onEvents([{ type: 'built', seat: 0, kind: action.to, vertex: action.vertex }], v);
        } else if (action.type === 'moveBandit') set({ view: { ...v, bandit: action.hex, step: 'actions' } });
        else if (action.type === 'sevenChoice') set({ view: { ...v, step: action.choice === 'bandit' ? 'moveBandit' : 'actions' } });
        else if (action.type === 'steal') set({ view: { ...v, step: 'actions', stealCandidates: [] } });
        else console.info('[demo] action', action);
        return;
      }
      st.send({ t: 'action', action });
    },
    leaveHome: (giveUpSeat) => {
      const st = get();
      if (st.demo) {
        location.href = location.pathname;
        return;
      }
      if (giveUpSeat && st.code) {
        if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ t: 'leave' } satisfies ClientMsg));
        removeSeat(st.code);
      }
      goHome();
    },
  };
});

/** Room code from the URL (?room=CODE), if any. */
export function urlRoomCode(): string | null {
  const c = new URLSearchParams(location.search).get('room');
  return c ? c.trim().toUpperCase() : null;
}
