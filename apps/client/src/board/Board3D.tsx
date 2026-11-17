import { Component, useEffect, useMemo, useRef, type ReactNode } from 'react';
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import type { BuildingKind, Hex, Terrain } from '@kervan/shared';
import { tint, type ThemeDef } from '../themes';
import { pips, type BoardProps } from './types';

const TOP = 0.3; // base hex height
const PIECE_Y = 0.33;

// ---- shared geometries (built once, procedurally) ----
const G = {
  hex: new THREE.CylinderGeometry(0.965, 0.965, 1, 6),
  slab: new THREE.CylinderGeometry(1.14, 1.2, 0.16, 6),
  road: new THREE.BoxGeometry(0.62, 0.1, 0.13),
  box: new THREE.BoxGeometry(1, 1, 1),
  roof4: new THREE.ConeGeometry(0.21, 0.19, 4),
  tower: new THREE.CylinderGeometry(0.115, 0.135, 0.44, 8),
  towerCap: new THREE.ConeGeometry(0.16, 0.17, 8),
  tree: new THREE.ConeGeometry(0.15, 0.42, 6),
  peak: new THREE.ConeGeometry(0.24, 0.38, 4),
  rock: new THREE.DodecahedronGeometry(0.14, 0),
  blob: new THREE.SphereGeometry(0.11, 7, 5),
  banditBody: new THREE.ConeGeometry(0.17, 0.42, 8),
  banditHead: new THREE.SphereGeometry(0.11, 10, 8),
  vMark: new THREE.CylinderGeometry(0.17, 0.17, 0.08, 20),
  vMarkRim: new THREE.CylinderGeometry(0.24, 0.24, 0.05, 20),
  vHit: new THREE.SphereGeometry(0.42, 8, 6),
  eMark: new THREE.BoxGeometry(0.5, 0.08, 0.13),
  eMarkRim: new THREE.BoxGeometry(0.58, 0.05, 0.22),
  eHit: new THREE.BoxGeometry(0.74, 0.5, 0.5),
  hMark: new THREE.RingGeometry(0.46, 0.62, 28),
  hMarkRim: new THREE.RingGeometry(0.62, 0.7, 28),
  hHit: new THREE.CylinderGeometry(0.9, 0.9, 0.5, 6),
  ring: new THREE.TorusGeometry(0.34, 0.035, 8, 28),
};
const HIT_MAT = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });
const WHITE_MAT = new THREE.MeshBasicMaterial({ color: '#ffffff' });
const WHITE_RING_MAT = new THREE.MeshBasicMaterial({ color: '#ffffff', side: THREE.DoubleSide, transparent: true, opacity: 0.92 });

// ---- number tokens as canvas-texture sprites (no fonts loaded) ----
const tokenCache = new Map<string, THREE.CanvasTexture>();
function tokenTexture(n: number, theme: ThemeDef): THREE.CanvasTexture {
  const p = theme.palette;
  const key = `${n}|${theme.id}`;
  const hit = tokenCache.get(key);
  if (hit) return hit;
  const size = 160;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d')!;
  const hot = n === 6 || n === 8;
  const ink = hot ? p.tokenHot : p.tokenInk;
  g.beginPath();
  g.arc(size / 2, size / 2, size / 2 - 8, 0, Math.PI * 2);
  g.fillStyle = p.token;
  g.fill();
  g.lineWidth = hot ? 10 : 5;
  g.strokeStyle = hot ? p.tokenHot : tint(p.tokenInk, 0.25);
  g.stroke();
  g.fillStyle = ink;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = `800 ${hot ? 82 : 72}px Georgia, "Times New Roman", serif`;
  g.fillText(String(n), size / 2, size / 2 - 8);
  const k = pips(n);
  for (let i = 0; i < k; i++) {
    g.beginPath();
    g.arc(size / 2 + (i - (k - 1) / 2) * 15, size - 36, 5, 0, Math.PI * 2);
    g.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  tokenCache.set(key, tex);
  return tex;
}

const hexTop = (h: Hex) => TOP + ((h.id * 7) % 5) * 0.012;

function Deco({ terrain, color, seed }: { terrain: Terrain; color: string; seed: number }) {
  const a0 = (seed * 1.913) % (Math.PI * 2);
  const spots = [0, 1, 2].map((i) => {
    const a = a0 + (i * Math.PI * 2) / 3;
    return { x: Math.cos(a) * 0.53, z: Math.sin(a) * 0.53, a, s: 0.85 + (((seed + i) * 37) % 10) * 0.035 };
  });
  const mat = <meshStandardMaterial color={color} flatShading roughness={0.9} />;
  switch (terrain) {
    case 'forest':
      return (
        <>
          {spots.map((s, i) => (
            <mesh key={i} geometry={G.tree} position={[s.x, 0.21 * s.s, s.z]} scale={s.s} castShadow>
              {mat}
            </mesh>
          ))}
        </>
      );
    case 'mine':
      return (
        <>
          {spots.slice(0, 2).map((s, i) => (
            <mesh key={i} geometry={G.peak} position={[s.x, 0.19 * s.s, s.z]} scale={s.s} rotation={[0, s.a, 0]} castShadow>
              {mat}
            </mesh>
          ))}
        </>
      );
    case 'quarry':
      return (
        <>
          {spots.map((s, i) => (
            <mesh key={i} geometry={G.rock} position={[s.x, 0.07, s.z]} scale={[s.s * 1.1, s.s * 0.8, s.s]} rotation={[s.a, s.a * 2, 0]} castShadow>
              {mat}
            </mesh>
          ))}
        </>
      );
    case 'field':
      return (
        <>
          {spots.map((s, i) => (
            <mesh key={i} geometry={G.box} position={[s.x, 0.03, s.z]} scale={[0.4, 0.06, 0.12]} rotation={[0, a0, 0]}>
              {mat}
            </mesh>
          ))}
        </>
      );
    case 'pasture':
      return (
        <>
          {spots.map((s, i) => (
            <mesh key={i} geometry={G.blob} position={[s.x, 0.07, s.z]} scale={[s.s * 1.2, s.s * 0.8, s.s]} castShadow>
              {mat}
            </mesh>
          ))}
        </>
      );
    default:
      return (
        <mesh geometry={G.rock} position={[spots[0].x * 0.6, 0.03, spots[0].z * 0.6]} scale={0.7}>
          {mat}
        </mesh>
      );
  }
}

function Piece({ kind, color }: { kind: BuildingKind; color: string }) {
  const dark = tint(color, -0.35);
  const body = <meshStandardMaterial color={color} flatShading roughness={0.7} />;
  const roof = <meshStandardMaterial color={dark} flatShading roughness={0.7} />;
  if (kind === 'outpost')
    return (
      <group>
        <mesh geometry={G.box} scale={[0.27, 0.2, 0.27]} position={[0, 0.1, 0]} castShadow>{body}</mesh>
        <mesh geometry={G.roof4} position={[0, 0.295, 0]} rotation={[0, Math.PI / 4, 0]} castShadow>{roof}</mesh>
      </group>
    );
  if (kind === 'keep')
    return (
      <group>
        <mesh geometry={G.box} scale={[0.38, 0.17, 0.38]} position={[0, 0.085, 0]} castShadow>{body}</mesh>
        <mesh geometry={G.tower} position={[0, 0.39, 0]} castShadow>{body}</mesh>
        <mesh geometry={G.towerCap} position={[0, 0.695, 0]} castShadow>{roof}</mesh>
      </group>
    );
  return (
    <group>
      <mesh geometry={G.box} scale={[0.42, 0.13, 0.3]} position={[0, 0.065, 0]} castShadow>{body}</mesh>
      <mesh geometry={G.box} scale={[0.5, 0.04, 0.38]} position={[0, 0.23, 0]} rotation={[0.16, 0, 0]} castShadow>
        <meshStandardMaterial color="#fff1d6" flatShading roughness={0.8} />
      </mesh>
      <mesh geometry={G.box} scale={[0.14, 0.045, 0.385]} position={[0, 0.232, 0]} rotation={[0.16, 0, 0]}>{roof}</mesh>
      <mesh geometry={G.box} scale={[0.03, 0.12, 0.03]} position={[-0.19, 0.17, -0.13]}>{roof}</mesh>
      <mesh geometry={G.box} scale={[0.03, 0.12, 0.03]} position={[0.19, 0.17, -0.13]}>{roof}</mesh>
    </group>
  );
}

/** Gently pulsing wrapper (scales around its own origin). */
function Pulse({ children, position, rotation }: { children: ReactNode; position: [number, number, number]; rotation?: [number, number, number] }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (ref.current) {
      const s = 1 + 0.14 * Math.sin(clock.elapsedTime * 5);
      ref.current.scale.setScalar(s);
    }
  });
  return (
    <group position={position} rotation={rotation}>
      <group ref={ref}>{children}</group>
    </group>
  );
}

function Rig({ extent }: { extent: number }) {
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const invalidate = useThree((s) => s.invalidate);
  const portrait = size.width < size.height;
  useEffect(() => {
    const aspect = size.height > 0 ? size.width / size.height : 1;
    const tanV = Math.tan(((camera as THREE.PerspectiveCamera).fov * Math.PI) / 360);
    const d = Math.max(extent / (tanV * aspect), (extent * 0.82) / tanV) * 1.04;
    const elev = (56 * Math.PI) / 180;
    camera.position.set(0, d * Math.sin(elev), d * Math.cos(elev));
    camera.lookAt(0, 0, 0);
    invalidate();
    // Refit only when the board or the orientation changes, not on every resize.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [extent, portrait]);
  return null;
}

function Stars() {
  const geo = useMemo(() => {
    const n = 500;
    const pos = new Float32Array(n * 3);
    let seed = 1234567;
    const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
    for (let i = 0; i < n; i++) {
      const u = rnd() * 2 - 1;
      const th = rnd() * Math.PI * 2;
      const r = 70 + rnd() * 40;
      const s = Math.sqrt(1 - u * u);
      pos[i * 3] = r * s * Math.cos(th);
      pos[i * 3 + 1] = r * u;
      pos[i * 3 + 2] = r * s * Math.sin(th);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    return g;
  }, []);
  return (
    <points geometry={geo}>
      <pointsMaterial color="#dfe6ff" size={0.55} sizeAttenuation />
    </points>
  );
}

function Scene({ view, theme, highlights, onPick, lastBuilt }: BoardProps) {
  const { board } = view;
  const pal = theme.palette;
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => invalidate(), [view, theme, highlights, lastBuilt, invalidate]);

  const extent = useMemo(() => {
    let m = 0;
    for (const v of board.vertices) m = Math.max(m, Math.abs(v.x), Math.abs(v.y));
    return m + 0.9;
  }, [board]);

  const colorOf = (seat: number) => view.players.find((p) => p.seat === seat)?.color ?? '#888888';
  const click = (kind: 'vertex' | 'edge' | 'hex', id: number) => (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (e.delta < 9) onPick(kind, id);
  };
  const edgePose = (id: number) => {
    const e = board.edges[id];
    const a = board.vertices[e.a];
    const b = board.vertices[e.b];
    return { x: (a.x + b.x) / 2, z: (a.y + b.y) / 2, rot: -Math.atan2(b.y - a.y, b.x - a.x) };
  };

  const hexes = useMemo(
    () =>
      board.hexes.map((h) => {
        const top = hexTop(h);
        const col = pal.terrain[h.terrain];
        return (
          <group key={h.id} position={[h.x, 0, h.y]}>
            <mesh geometry={G.slab} position={[0, -0.06, 0]} receiveShadow>
              <meshStandardMaterial color={pal.base} flatShading roughness={1} />
            </mesh>
            <mesh geometry={G.hex} position={[0, top / 2, 0]} scale={[1, top, 1]} receiveShadow>
              <meshStandardMaterial attach="material-0" color={tint(col, -0.28)} flatShading roughness={1} />
              <meshStandardMaterial attach="material-1" color={col} roughness={0.95} />
              <meshStandardMaterial attach="material-2" color={tint(col, -0.4)} />
            </mesh>
            <group position={[0, top, 0]}>
              <Deco terrain={h.terrain} color={pal.deco[h.terrain]} seed={h.id + 1} />
            </group>
            {h.number !== null && (
              <sprite position={[0, top + 0.5, 0]} scale={[0.74, 0.74, 1]}>
                <spriteMaterial map={tokenTexture(h.number, theme)} depthWrite={false} />
              </sprite>
            )}
          </group>
        );
      }),
    [board, pal, theme],
  );

  const banditHex = board.hexes[view.bandit];
  let built: { x: number; z: number } | null = null;
  if (lastBuilt?.kind === 'vertex' && board.vertices[lastBuilt.id]) built = { x: board.vertices[lastBuilt.id].x, z: board.vertices[lastBuilt.id].y };
  else if (lastBuilt?.kind === 'edge' && board.edges[lastBuilt.id]) built = edgePose(lastBuilt.id);

  return (
    <>
      <color attach="background" args={[pal.backdrop]} />
      <hemisphereLight args={['#ffffff', pal.base, 0.62]} />
      <directionalLight
        position={[extent * 0.8, extent * 1.7, extent * 0.5]}
        intensity={0.72}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-left={-extent - 1}
        shadow-camera-right={extent + 1}
        shadow-camera-top={extent + 1}
        shadow-camera-bottom={-extent - 1}
        shadow-camera-near={0.5}
        shadow-camera-far={extent * 5}
        shadow-bias={-0.0008}
      />
      {pal.stars ? (
        <Stars />
      ) : (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.12, 0]} receiveShadow>
          <circleGeometry args={[extent * 6, 48]} />
          <meshStandardMaterial color={pal.sea} roughness={0.55} metalness={0.05} />
        </mesh>
      )}

      {hexes}

      {Object.entries(view.roads).map(([id, seat]) => {
        if (!board.edges[Number(id)]) return null;
        const p = edgePose(Number(id));
        return (
          <mesh key={id} geometry={G.road} position={[p.x, PIECE_Y + 0.05, p.z]} rotation={[0, p.rot, 0]} castShadow>
            <meshStandardMaterial color={colorOf(seat)} flatShading roughness={0.7} />
          </mesh>
        );
      })}

      {Object.entries(view.buildings).map(([id, b]) => {
        const v = board.vertices[Number(id)];
        if (!v) return null;
        return (
          <group key={`${id}-${b.kind}`} position={[v.x, PIECE_Y, v.y]}>
            <Piece kind={b.kind} color={colorOf(b.owner)} />
          </group>
        );
      })}

      {banditHex && (
        <group position={[banditHex.x + 0.45, hexTop(banditHex), banditHex.y + 0.1]}>
          <mesh geometry={G.banditBody} position={[0, 0.21, 0]} castShadow>
            <meshStandardMaterial color={pal.bandit} flatShading roughness={0.6} />
          </mesh>
          <mesh geometry={G.banditHead} position={[0, 0.47, 0]} castShadow>
            <meshStandardMaterial color={pal.bandit} flatShading roughness={0.6} />
          </mesh>
          <mesh geometry={G.box} scale={[0.24, 0.045, 0.24]} position={[0, 0.5, 0]}>
            <meshStandardMaterial color={pal.tokenHot} />
          </mesh>
        </group>
      )}

      {built && (
        <Pulse position={[built.x, PIECE_Y + 0.12, built.z]} rotation={[Math.PI / 2, 0, 0]}>
          <mesh geometry={G.ring}>
            <meshBasicMaterial color={theme.ui.gold} />
          </mesh>
        </Pulse>
      )}

      {highlights.vertices.map((id) => {
        const v = board.vertices[id];
        if (!v) return null;
        return (
          <group key={`v${id}`} onClick={click('vertex', id)}>
            <Pulse position={[v.x, PIECE_Y + 0.06, v.y]}>
              <mesh geometry={G.vMarkRim}>
                <meshBasicMaterial color={theme.ui.accent} />
              </mesh>
              <mesh geometry={G.vMark} position={[0, 0.03, 0]} material={WHITE_MAT} />
            </Pulse>
            <mesh geometry={G.vHit} position={[v.x, PIECE_Y + 0.1, v.y]} material={HIT_MAT} />
          </group>
        );
      })}
      {highlights.edges.map((id) => {
        if (!board.edges[id]) return null;
        const p = edgePose(id);
        return (
          <group key={`e${id}`} onClick={click('edge', id)}>
            <Pulse position={[p.x, PIECE_Y + 0.06, p.z]} rotation={[0, p.rot, 0]}>
              <mesh geometry={G.eMarkRim}>
                <meshBasicMaterial color={theme.ui.accent} />
              </mesh>
              <mesh geometry={G.eMark} position={[0, 0.03, 0]} material={WHITE_MAT} />
            </Pulse>
            <mesh geometry={G.eHit} position={[p.x, PIECE_Y + 0.1, p.z]} rotation={[0, p.rot, 0]} material={HIT_MAT} />
          </group>
        );
      })}
      {highlights.hexes.map((id) => {
        const h = board.hexes[id];
        if (!h) return null;
        return (
          <group key={`h${id}`} onClick={click('hex', id)}>
            <Pulse position={[h.x, hexTop(h) + 0.05, h.y]}>
              <group rotation={[-Math.PI / 2, 0, 0]}>
                <mesh geometry={G.hMark} material={WHITE_RING_MAT} />
                <mesh geometry={G.hMarkRim}>
                  <meshBasicMaterial color={theme.ui.accent} side={THREE.DoubleSide} />
                </mesh>
              </group>
            </Pulse>
            <mesh geometry={G.hHit} position={[h.x, hexTop(h) + 0.2, h.y]} material={HIT_MAT} />
          </group>
        );
      })}

      <Rig extent={extent} />
      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={0.12}
        target={[0, 0, 0]}
        minPolarAngle={0.05}
        maxPolarAngle={Math.PI * 0.43}
        minDistance={3.5}
        maxDistance={extent * 7}
        zoomSpeed={0.9}
        rotateSpeed={0.7}
        panSpeed={0.8}
      />
    </>
  );
}

class Boundary extends Component<{ onFail: () => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onFail();
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

export default function Board3D(props: BoardProps & { onFail: () => void }) {
  const { onFail, ...board } = props;
  // R3F force-loses the context when the canvas unmounts (e.g. switching to 2D): that is not a failure.
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const animating =
    board.highlights.vertices.length + board.highlights.edges.length + board.highlights.hexes.length > 0 || !!board.lastBuilt;
  return (
    <Boundary onFail={onFail}>
      <Canvas
        className="board3d"
        flat
        shadows
        dpr={[1, 2]}
        frameloop={animating ? 'always' : 'demand'}
        camera={{ fov: 38, near: 0.1, far: 400, position: [0, 12, 9] }}
        gl={{ antialias: true, powerPreference: 'high-performance' }}
        onCreated={({ gl }) => {
          gl.domElement.addEventListener('webglcontextlost', () => mounted.current && onFail(), { once: true });
        }}
      >
        <Scene {...board} />
      </Canvas>
    </Boundary>
  );
}
