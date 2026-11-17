import type { PlayerView } from '@kervan/shared';
import type { ThemeDef } from '../themes';
import type { LastBuilt } from '../store';

export type PickKind = 'vertex' | 'edge' | 'hex';

export interface Highlights {
  vertices: number[];
  edges: number[];
  hexes: number[];
}

export const NO_HIGHLIGHTS: Highlights = { vertices: [], edges: [], hexes: [] };

export interface BoardProps {
  view: PlayerView;
  theme: ThemeDef;
  highlights: Highlights;
  onPick: (kind: PickKind, id: number) => void;
  lastBuilt: LastBuilt | null;
}

/** Number of pips under a production number (how likely it is). */
export const pips = (n: number) => 6 - Math.abs(7 - n);

export function webglAvailable(): boolean {
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2') ?? c.getContext('webgl');
    return !!gl;
  } catch {
    return false;
  }
}
