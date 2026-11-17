// Per-theme look of the 3D diorama (sky, sea, light, terrain materials, flora style).
// The 2D UI palette lives in themes.ts; this file only drives Board3D / Showcase.
import type { Terrain, ThemeId } from '@kervan/shared';

export type Flora = 'steppe' | 'tropic' | 'alien';

export interface TerrainLook {
  top: string; // tile top colour
  side: string; // tile side (soil / rock) colour
  height: number; // tile top height above the island plate
}

export interface Look3D {
  flora: Flora;
  terrain: Record<Terrain, TerrainLook>;
  sky: { top: string; horizon: string; glow: string };
  stars: boolean;
  sea: { deep: string; shallow: string; foam: string } | null; // null = floating island in the void
  plate: string; // sand / rock under the tiles
  cliff: string; // underside of the island
  sun: { color: string; intensity: number; dir: [number, number, number] };
  fill: { sky: string; ground: string; intensity: number };
  exposure: number;
  medallion: { face: string; rim: string; ink: string; hot: string };
  glow: string; // placement rings
  clouds: string | null;
  // decoration colours
  c: {
    leaf: string;
    leaf2: string;
    trunk: string;
    grain: string;
    grass: string;
    wool: string;
    woolFace: string;
    stone: string;
    stoneCut: string;
    rock: string;
    snow: string;
    dry: string;
    ruin: string;
    emissive: string; // alien glow
  };
}

export const LOOKS: Record<ThemeId, Look3D> = {
  // Dusk over an Anatolian plateau: low warm sun, lapis sea, cypress and pine, snowy peaks.
  anatolia: {
    flora: 'steppe',
    terrain: {
      forest: { top: '#4c7a3c', side: '#5a4330', height: 0.26 },
      quarry: { top: '#c49a72', side: '#8f6a4c', height: 0.3 },
      field: { top: '#c9a043', side: '#6e5233', height: 0.18 },
      pasture: { top: '#86ac57', side: '#5d4a33', height: 0.22 },
      mine: { top: '#77706b', side: '#4f4a46', height: 0.34 },
      barren: { top: '#cdb48a', side: '#8e7656', height: 0.2 },
    },
    sky: { top: '#1a2c55', horizon: '#e7a46a', glow: '#ffd29a' },
    stars: false,
    sea: { deep: '#0f2a4d', shallow: '#2fa39a', foam: '#f4ead2' },
    plate: '#d9bf8c',
    cliff: '#7a5a3e',
    sun: { color: '#ffcf96', intensity: 2.6, dir: [-0.55, 0.62, 0.55] },
    fill: { sky: '#9db8ff', ground: '#6b4a2c', intensity: 0.75 },
    exposure: 1.0,
    medallion: { face: '#f3e8d0', rim: '#d9a944', ink: '#2a2014', hot: '#c8412f' },
    glow: '#ffd36b',
    clouds: '#ffe2c4',
    c: {
      leaf: '#2f5a2c',
      leaf2: '#3f6e33',
      trunk: '#5b3b24',
      grain: '#e6bf55',
      grass: '#6e9a45',
      wool: '#f2ede2',
      woolFace: '#2b2420',
      stone: '#d8c3a0',
      stoneCut: '#e9d8b7',
      rock: '#8a7c6c',
      snow: '#f6f4ef',
      dry: '#b89a5e',
      ruin: '#d3bb92',
      emissive: '#000000',
    },
  },
  // Bright midday lagoon: turquoise shallows, palms, coral sand.
  archipelago: {
    flora: 'tropic',
    terrain: {
      forest: { top: '#3f9a5a', side: '#7a5a3c', height: 0.24 },
      quarry: { top: '#ee9a84', side: '#b9705c', height: 0.28 },
      field: { top: '#a9cf62', side: '#6f6a3a', height: 0.17 },
      pasture: { top: '#7cc08a', side: '#6b5a3c', height: 0.21 },
      mine: { top: '#9a6a4e', side: '#5e4030', height: 0.34 },
      barren: { top: '#f1e1b3', side: '#c9b27f', height: 0.19 },
    },
    sky: { top: '#3c8fd1', horizon: '#bfe9f2', glow: '#ffffff' },
    stars: false,
    sea: { deep: '#07508a', shallow: '#36d1c4', foam: '#ffffff' },
    plate: '#f3e2b8',
    cliff: '#a88a62',
    sun: { color: '#fff4dc', intensity: 2.9, dir: [-0.35, 0.85, 0.4] },
    fill: { sky: '#bfe6ff', ground: '#d8c48e', intensity: 1.0 },
    exposure: 1.0,
    medallion: { face: '#ffffff', rim: '#1fa3a3', ink: '#123a44', hot: '#e5546a' },
    glow: '#ffffff',
    clouds: '#ffffff',
    c: {
      leaf: '#2e8a4a',
      leaf2: '#4fb35c',
      trunk: '#8a6a44',
      grain: '#cfe07a',
      grass: '#5fae6a',
      wool: '#f7f2e8',
      woolFace: '#3a2a20',
      stone: '#f2a58f',
      stoneCut: '#f8c7b6',
      rock: '#8c6b55',
      snow: '#3a2b24',
      dry: '#d9c48c',
      ruin: '#efe0bf',
      emissive: '#000000',
    },
  },
  // A colony on a drifting asteroid: violet void, crystals, glowing veins.
  space: {
    flora: 'alien',
    terrain: {
      forest: { top: '#1f6f66', side: '#2b2a44', height: 0.24 },
      quarry: { top: '#8a5a3c', side: '#3a2c32', height: 0.3 },
      field: { top: '#3d7a2f', side: '#2c2a3e', height: 0.18 },
      pasture: { top: '#6a3f8a', side: '#2b2442', height: 0.22 },
      mine: { top: '#5c6888', side: '#2a2e44', height: 0.34 },
      barren: { top: '#3a3d52', side: '#24263a', height: 0.2 },
    },
    sky: { top: '#05040f', horizon: '#2a1650', glow: '#7a4bd8' },
    stars: true,
    sea: null,
    plate: '#3a3a52',
    cliff: '#2a2840',
    sun: { color: '#c9d4ff', intensity: 2.2, dir: [0.5, 0.7, 0.45] },
    fill: { sky: '#7a5cff', ground: '#1a1430', intensity: 0.9 },
    exposure: 1.05,
    medallion: { face: '#141a36', rim: '#46e0d8', ink: '#e8ecff', hot: '#ffb347' },
    glow: '#46e0d8',
    clouds: null,
    c: {
      leaf: '#46e0d8',
      leaf2: '#8ff0e0',
      trunk: '#2a2f4a',
      grain: '#9cf06a',
      grass: '#4a3a6a',
      wool: '#d9b8ff',
      woolFace: '#4a2a6a',
      stone: '#c07a4a',
      stoneCut: '#e09a6a',
      rock: '#4a4e66',
      snow: '#bfe8ff',
      dry: '#50546e',
      ruin: '#6a6e88',
      emissive: '#46e0d8',
    },
  },
};
