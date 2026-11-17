import type { DecreeCard, Resource, Terrain, ThemeId } from '@kervan/shared';

export type Lang = 'tr' | 'en';
export type L = Record<Lang, string>;
export type PieceKind = 'road' | 'outpost' | 'keep' | 'market';

export interface ThemeDef {
  id: ThemeId;
  label: L;
  res: Record<Resource, L>;
  terrain: Record<Terrain, L>;
  piece: Record<PieceKind, L>;
  bandit: L;
  decree: L;
  card: Record<DecreeCard, L>;
  palette: {
    terrain: Record<Terrain, string>;
    deco: Record<Terrain, string>;
    resource: Record<Resource, string>;
    backdrop: string; // scene background / fog
    sea: string; // plane around the board (unused when stars = true)
    base: string; // slab under the hexes
    token: string;
    tokenInk: string;
    tokenHot: string;
    bandit: string;
    stars: boolean;
  };
  ui: {
    dark: boolean;
    bg: string;
    bg2: string;
    panel: string;
    panel2: string;
    ink: string;
    muted: string;
    line: string;
    accent: string;
    accentInk: string;
    accent2: string;
    gold: string;
    fontDisplay: string;
    fontBody: string;
  };
}

const SYS = 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

export const THEMES: Record<ThemeId, ThemeDef> = {
  anatolia: {
    id: 'anatolia',
    label: { tr: 'Anadolu Beylikleri', en: 'Anatolian Beyliks' },
    res: {
      timber: { tr: 'Kereste', en: 'Timber' },
      stone: { tr: 'Taş', en: 'Stone' },
      grain: { tr: 'Buğday', en: 'Wheat' },
      fiber: { tr: 'Yün', en: 'Wool' },
      ore: { tr: 'Demir', en: 'Iron' },
    },
    terrain: {
      forest: { tr: 'Orman', en: 'Forest' },
      quarry: { tr: 'Taş Ocağı', en: 'Quarry' },
      field: { tr: 'Tarla', en: 'Field' },
      pasture: { tr: 'Yayla', en: 'Highland Pasture' },
      mine: { tr: 'Maden', en: 'Mine' },
      barren: { tr: 'Bozkır', en: 'Steppe' },
    },
    piece: {
      road: { tr: 'Yol', en: 'Road' },
      outpost: { tr: 'Oba', en: 'Camp' },
      keep: { tr: 'Kale', en: 'Fortress' },
      market: { tr: 'Pazar', en: 'Bazaar' },
    },
    bandit: { tr: 'Eşkıya', en: 'Bandit' },
    decree: { tr: 'Ferman', en: 'Decree' },
    card: {
      raider: { tr: 'Akıncı', en: 'Raider' },
      caravan: { tr: 'Kervan', en: 'Caravan' },
      bounty: { tr: 'Bereket', en: 'Bounty' },
      bargain: { tr: 'Pazarlık', en: 'Bargain' },
      glory: { tr: 'Şan', en: 'Glory' },
    },
    palette: {
      terrain: { forest: '#4f7a3a', quarry: '#b08d6e', field: '#e0b64a', pasture: '#9cc069', mine: '#7c7f8e', barren: '#d9c39a' },
      deco: { forest: '#2f5527', quarry: '#8a6a50', field: '#b98a1f', pasture: '#f4efe2', mine: '#54576a', barren: '#b79f74' },
      resource: { timber: '#4f7a3a', stone: '#a07a5c', grain: '#d6a22e', fiber: '#7fae4c', ore: '#6a6e80' },
      backdrop: '#12514f',
      sea: '#1d7874',
      base: '#8a5a3a',
      token: '#f8ecd0',
      tokenInk: '#3a2418',
      tokenHot: '#b5321c',
      bandit: '#2a1c18',
      stars: false,
    },
    ui: {
      dark: false,
      bg: '#f3e6cc',
      bg2: '#ead7b2',
      panel: '#fbf3e0',
      panel2: '#f3e3c2',
      ink: '#3a2418',
      muted: '#7d6450',
      line: '#d6bb8d',
      accent: '#a8432a',
      accentInk: '#fff6e6',
      accent2: '#1d7874',
      gold: '#c48f22',
      fontDisplay: '"Palatino Linotype", Palatino, "Book Antiqua", Georgia, serif',
      fontBody: SYS,
    },
  },
  archipelago: {
    id: 'archipelago',
    label: { tr: 'Takımada Kolonileri', en: 'Archipelago Colonies' },
    res: {
      timber: { tr: 'Bambu', en: 'Bamboo' },
      stone: { tr: 'Mercan Taşı', en: 'Coral Stone' },
      grain: { tr: 'Pirinç', en: 'Rice' },
      fiber: { tr: 'Keten', en: 'Flax' },
      ore: { tr: 'Bakır', en: 'Copper' },
    },
    terrain: {
      forest: { tr: 'Bambu Korusu', en: 'Bamboo Grove' },
      quarry: { tr: 'Resif', en: 'Reef' },
      field: { tr: 'Çeltik', en: 'Rice Paddy' },
      pasture: { tr: 'Keten Tarlası', en: 'Flax Field' },
      mine: { tr: 'Bakır Ocağı', en: 'Copper Pit' },
      barren: { tr: 'Kumsal', en: 'Sandbar' },
    },
    piece: {
      road: { tr: 'Rota', en: 'Route' },
      outpost: { tr: 'İskele', en: 'Jetty' },
      keep: { tr: 'Hisar', en: 'Citadel' },
      market: { tr: 'Liman Pazarı', en: 'Harbor Market' },
    },
    bandit: { tr: 'Korsan', en: 'Pirate' },
    decree: { tr: 'Buyruk', en: 'Edict' },
    card: {
      raider: { tr: 'Devriye', en: 'Patrol' },
      caravan: { tr: 'Konvoy', en: 'Convoy' },
      bounty: { tr: 'Bolluk', en: 'Plenty' },
      bargain: { tr: 'Pazarlık', en: 'Bargain' },
      glory: { tr: 'Şöhret', en: 'Renown' },
    },
    palette: {
      terrain: { forest: '#3d9b6c', quarry: '#f0907a', field: '#cfe08a', pasture: '#8fb8de', mine: '#c97b4a', barren: '#f2e2b6' },
      deco: { forest: '#226b47', quarry: '#c7604c', field: '#8fa84a', pasture: '#5d86b8', mine: '#8f4f28', barren: '#d1bd88' },
      resource: { timber: '#3d9b6c', stone: '#e27863', grain: '#a9bd4d', fiber: '#6f9fd0', ore: '#c1703f' },
      backdrop: '#0b5d78',
      sea: '#1b9bb5',
      base: '#e8d5a0',
      token: '#ffffff',
      tokenInk: '#12343b',
      tokenHot: '#d1432f',
      bandit: '#1d2530',
      stars: false,
    },
    ui: {
      dark: false,
      bg: '#e4f3f1',
      bg2: '#cfe9e6',
      panel: '#f8fdfc',
      panel2: '#e6f4f2',
      ink: '#12343b',
      muted: '#4f7078',
      line: '#b4d8d6',
      accent: '#d9583f',
      accentInk: '#ffffff',
      accent2: '#12788c',
      gold: '#d69a1e',
      fontDisplay: '"Trebuchet MS", "Gill Sans", "Segoe UI", sans-serif',
      fontBody: SYS,
    },
  },
  space: {
    id: 'space',
    label: { tr: 'Uzay Kolonileri', en: 'Space Colonies' },
    res: {
      timber: { tr: 'Biyokütle', en: 'Biomass' },
      stone: { tr: 'Regolit', en: 'Regolith' },
      grain: { tr: 'Yosun Kültürü', en: 'Algae Culture' },
      fiber: { tr: 'Polimer', en: 'Polymer' },
      ore: { tr: 'Titanyum', en: 'Titanium' },
    },
    terrain: {
      forest: { tr: 'Biyokubbe', en: 'Biodome' },
      quarry: { tr: 'Regolit Ovası', en: 'Regolith Plain' },
      field: { tr: 'Yosun Havuzu', en: 'Algae Vat' },
      pasture: { tr: 'Polimer Tesisi', en: 'Polymer Plant' },
      mine: { tr: 'Titanyum Damarı', en: 'Titanium Vein' },
      barren: { tr: 'Krater', en: 'Crater' },
    },
    piece: {
      road: { tr: 'Hat', en: 'Line' },
      outpost: { tr: 'Üs', en: 'Base' },
      keep: { tr: 'İstasyon', en: 'Station' },
      market: { tr: 'Takas Merkezi', en: 'Exchange Hub' },
    },
    bandit: { tr: 'Yağmacı Dron', en: 'Raider Drone' },
    decree: { tr: 'Direktif', en: 'Directive' },
    card: {
      raider: { tr: 'Önleyici', en: 'Interceptor' },
      caravan: { tr: 'İkmal Hattı', en: 'Supply Line' },
      bounty: { tr: 'Hasat', en: 'Windfall' },
      bargain: { tr: 'Takas Protokolü', en: 'Trade Protocol' },
      glory: { tr: 'Onur Nişanı', en: 'Commendation' },
    },
    palette: {
      terrain: { forest: '#2fa38a', quarry: '#b8703f', field: '#7fd14f', pasture: '#b06fd8', mine: '#7f93b8', barren: '#4b4f63' },
      deco: { forest: '#8ff0d8', quarry: '#7d4521', field: '#3f8a22', pasture: '#e6c2ff', mine: '#d6e2f5', barren: '#2e3142' },
      resource: { timber: '#2fa38a', stone: '#b8703f', grain: '#5fb832', fiber: '#a45fd0', ore: '#7f93b8' },
      backdrop: '#070914',
      sea: '#0d1126',
      base: '#2a2f4a',
      token: '#10142b',
      tokenInk: '#e6e9ff',
      tokenHot: '#ffb347',
      bandit: '#e23d5a',
      stars: true,
    },
    ui: {
      dark: true,
      bg: '#0c1022',
      bg2: '#12172e',
      panel: '#181d38',
      panel2: '#222849',
      ink: '#e6e9ff',
      muted: '#98a0c8',
      line: '#333b66',
      accent: '#49d6b6',
      accentInk: '#06221c',
      accent2: '#8f7bff',
      gold: '#ffc857',
      fontDisplay: '"Segoe UI", "Avenir Next", "Helvetica Neue", Arial, sans-serif',
      fontBody: SYS,
    },
  },
};

export const THEME_IDS: ThemeId[] = ['anatolia', 'archipelago', 'space'];

/** Push the UI palette into CSS custom properties. */
export function applyThemeVars(t: ThemeDef): void {
  const s = document.documentElement.style;
  const u = t.ui;
  const set = (k: string, v: string) => s.setProperty(k, v);
  set('--bg', u.bg);
  set('--bg2', u.bg2);
  set('--panel', u.panel);
  set('--panel2', u.panel2);
  set('--ink', u.ink);
  set('--muted', u.muted);
  set('--line', u.line);
  set('--accent', u.accent);
  set('--accent-ink', u.accentInk);
  set('--accent2', u.accent2);
  set('--gold', u.gold);
  set('--font-display', u.fontDisplay);
  set('--font-body', u.fontBody);
  set('--backdrop', t.palette.backdrop);
  for (const [k, v] of Object.entries(t.palette.resource)) set(`--res-${k}`, v);
  document.documentElement.dataset.theme = t.id;
  document.documentElement.style.colorScheme = u.dark ? 'dark' : 'light';
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', u.dark ? u.bg : u.accent);
}

/** Darken (amt < 0) or lighten (amt > 0) a #rrggbb colour; amt in -1..1. */
export function tint(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  const ch = (v: number) => {
    const out = amt < 0 ? v * (1 + amt) : v + (255 - v) * amt;
    return Math.max(0, Math.min(255, Math.round(out)));
  };
  const r = ch((n >> 16) & 255);
  const g = ch((n >> 8) & 255);
  const b = ch(n & 255);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}
