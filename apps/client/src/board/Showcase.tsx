// Home-screen backdrop: a slowly orbiting island with a few settlements, not interactive.
import { useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import * as THREE from 'three';
import { PLAYER_COLORS, generateBoard, type Building } from '@kervan/shared';
import type { ThemeDef } from '../themes';
import { Scene, reducedMotion } from './Scene3D';
import { NO_HIGHLIGHTS } from './types';

const noop = () => {};

export default function Showcase({ theme }: { theme: ThemeDef }) {
  const view = useMemo(() => {
    const board = generateBoard('standard', 20261118);
    // Sprinkle a believable mid-game: a few camps, a fortress, a bazaar and the roads between them.
    const picks: [number, number, Building['kind']][] = [
      [0, 3, 'outpost'],
      [1, 11, 'keep'],
      [2, 20, 'outpost'],
      [3, 27, 'market'],
      [0, 38, 'outpost'],
      [1, 46, 'outpost'],
    ];
    const buildings: Record<number, Building> = {};
    const roads: Record<number, number> = {};
    for (const [seat, v, kind] of picks) {
      if (!board.vertices[v]) continue;
      buildings[v] = { owner: seat, kind };
      const es = board.vertices[v].edges;
      roads[es[0]] = seat;
      const next = board.edges[es[0]];
      const far = next.a === v ? next.b : next.a;
      const e2 = board.vertices[far].edges.find((e) => e !== es[0]);
      if (e2 !== undefined) roads[e2] = seat;
    }
    const players = [0, 1, 2, 3].map((seat) => ({ seat, color: PLAYER_COLORS[seat] as string }));
    const bandit = board.hexes.find((h) => h.terrain === 'barren')?.id ?? 0;
    return { board, buildings, roads, players, bandit } as const;
  }, []);

  return (
    <Canvas
      className="showcase3d"
      shadows="soft"
      dpr={[1, 1.5]}
      frameloop={reducedMotion() ? 'demand' : 'always'}
      camera={{ fov: 34, near: 0.1, far: 500, position: [0, 10, 14] }}
      gl={{ antialias: true, powerPreference: 'high-performance', toneMapping: THREE.ACESFilmicToneMapping }}
      style={{ pointerEvents: 'none' }}
    >
      <Scene
        view={view as never}
        theme={theme}
        highlights={NO_HIGHLIGHTS}
        onPick={noop}
        lastBuilt={null}
        mode="showcase"
      />
    </Canvas>
  );
}
