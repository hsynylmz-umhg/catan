import type { ThemeId } from '@kervan/shared';
import type { Lang } from './themes';

export interface SavedSeat {
  code: string;
  token: string;
  name: string;
}

export interface Settings {
  lang: Lang;
  /** Local theme override; null = follow the room's theme. */
  themeOverride: ThemeId | null;
  boardMode: '3d' | '2d';
  muted: boolean;
  name: string;
}

const K_SEATS = 'kervan.seats';
const K_SETTINGS = 'kervan.settings';

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* private mode / quota: settings just won't persist */
  }
}

export function loadSeats(): SavedSeat[] {
  const v = read<SavedSeat[]>(K_SEATS, []);
  return Array.isArray(v) ? v.filter((s) => s && typeof s.code === 'string' && typeof s.token === 'string') : [];
}
export function saveSeat(seat: SavedSeat): void {
  write(K_SEATS, [seat, ...loadSeats().filter((s) => s.code !== seat.code)].slice(0, 30));
}
export function removeSeat(code: string): void {
  write(K_SEATS, loadSeats().filter((s) => s.code !== code));
}
export function findSeat(code: string): SavedSeat | undefined {
  return loadSeats().find((s) => s.code === code);
}

export const DEFAULT_SETTINGS: Settings = { lang: 'tr', themeOverride: null, boardMode: '3d', muted: false, name: '' };
export function loadSettings(): Settings {
  return { ...DEFAULT_SETTINGS, ...read<Partial<Settings>>(K_SETTINGS, {}) };
}
export function saveSettings(s: Settings): void {
  write(K_SETTINGS, s);
}
