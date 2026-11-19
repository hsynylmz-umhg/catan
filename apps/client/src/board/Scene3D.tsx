// The 3D diorama: island, sea, sky, medallions, pieces, bandit, placement rings and camera.
// Used by Board3D (interactive game board) and Showcase (home-screen backdrop).
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import type { Board, BuildingKind, Hex, PlayerView, Resource } from '@kervan/shared';
import type { ThemeDef } from '../themes';
import { LOOKS, type Look3D } from './look3d';
import { GLOW, SWAY, TIME, groupProps, layoutProps, propGeometry, propMaterial, rng, type PropKind } from './decor3d';
import { pips, type Highlights, type PickKind } from './types';
import { useStore, type LastBuilt } from '../store';

const PLATE = 0.06; // sand plate top
const SQ3 = Math.sqrt(3);
export const reducedMotion = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

export interface SceneProps {
  view: Pick<PlayerView, 'board' | 'players' | 'roads' | 'buildings' | 'bandit'>;
  theme: ThemeDef;
  highlights: Highlights;
  onPick: (kind: PickKind, id: number) => void;
  lastBuilt: LastBuilt | null;
  mode: 'game' | 'showcase';
}

// ---------------------------------------------------------------- helpers
const tileTop = (L: Look3D, h: Hex) => PLATE + L.terrain[h.terrain].height + ((h.id * 7) % 3) * 0.008;

function boardRadius(board: Board) {
  let m = 0;
  for (const h of board.hexes) m = Math.max(m, (Math.abs(h.q) + Math.abs(h.r) + Math.abs(-h.q - h.r)) / 2);
  return m;
}

/** Hex prism with vertex colours: `top` on upward faces, `side` fading darker downwards. */
function hexPrism(radius: number, y0: number, y1: number, top: string, side: string, bottomTint = 0.55, bevel = 0.035) {
  const shape = new THREE.Shape();
  const r = radius - bevel;
  for (let k = 0; k < 6; k++) {
    const a = (-90 + 60 * k) * (Math.PI / 180);
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    if (k === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();
  const h = y1 - y0;
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: Math.max(0.001, h - bevel * 2),
    bevelEnabled: bevel > 0,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 1,
    steps: 1,
  });
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, y0 + bevel, 0);
  const g = geo.toNonIndexed();
  g.computeVertexNormals();
  const pos = g.getAttribute('position');
  const nor = g.getAttribute('normal');
  const ct = new THREE.Color(top);
  const cs = new THREE.Color(side);
  const tmp = new THREE.Color();
  const col = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    if (nor.getY(i) > 0.5) tmp.copy(ct);
    else {
      const t = h > 0 ? (pos.getY(i) - y0) / h : 1;
      tmp.copy(cs).multiplyScalar(bottomTint + (1 - bottomTint) * Math.max(0, Math.min(1, t)));
    }
    col.set([tmp.r, tmp.g, tmp.b], i * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}

const VCOL = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.92 });

function Instanced({ geo, mat, mats, cast = true, receive = true }: { geo: THREE.BufferGeometry; mat: THREE.Material; mats: THREE.Matrix4[]; cast?: boolean; receive?: boolean }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const m = ref.current;
    if (!m) return;
    mats.forEach((x, i) => m.setMatrixAt(i, x));
    m.instanceMatrix.needsUpdate = true;
    m.computeBoundingSphere();
  }, [mats]);
  return <instancedMesh ref={ref} args={[geo, mat, mats.length]} castShadow={cast} receiveShadow={receive} frustumCulled={false} />;
}

// ---------------------------------------------------------------- island
function Island({ board, L }: { board: Board; L: Look3D }) {
  const R = boardRadius(board);
  const data = useMemo(() => {
    const r = rng(board.hexes.length * 131 + 7);
    const deep = L.sea ? -0.9 : -0.55;
    // plate under every tile, plus a ring (or two) of coast tiles
    const plate: THREE.Matrix4[] = [];
    const coast: { x: number; z: number; top: number }[] = [];
    for (const h of board.hexes) plate.push(new THREE.Matrix4().makeTranslation(h.x, 0, h.y));
    const openWater = harborSpots(board).map((h) => h.out);
    for (let q = -R - 1; q <= R + 1; q++)
      for (let s = -R - 1; s <= R + 1; s++) {
        const d = (Math.abs(q) + Math.abs(s) + Math.abs(-q - s)) / 2;
        if (d !== R + 1) continue;
        const x = SQ3 * (q + s / 2);
        const z = 1.5 * s;
        const keep = r();
        if (keep < (L.sea ? 0.28 : 0.45)) continue; // bays / broken asteroid rim
        if (openWater.some(([ox, oz]) => Math.hypot(ox - x, oz - z) < 0.4)) continue; // harbour mouth
        coast.push({ x, z, top: L.sea ? 0.02 : -0.02 - r() * 0.25 });
      }
    const tiles = new Map<string, THREE.Matrix4[]>();
    for (const h of board.hexes) {
      const key = h.terrain;
      if (!tiles.has(key)) tiles.set(key, []);
      tiles.get(key)!.push(new THREE.Matrix4().makeTranslation(h.x, tileTop(L, h) - (PLATE + L.terrain[h.terrain].height), h.y));
    }
    const tileGeo = new Map(
      [...tiles.keys()].map((k) => {
        const t = L.terrain[k as Hex['terrain']];
        return [k, hexPrism(0.955, PLATE - 0.02, PLATE + t.height, t.top, t.side, 0.5, 0.04)] as const;
      }),
    );
    const plateGeo = hexPrism(1.01, deep, PLATE, L.plate, L.cliff, 0.45, 0.02);
    const coastGeo = new Map<number, THREE.BufferGeometry>();
    const coastMats = coast.map((c) => {
      const b = Math.round(c.top * 50);
      if (!coastGeo.has(b)) coastGeo.set(b, hexPrism(L.sea ? 1.07 : 1.01, deep, b / 50, L.plate, L.cliff, 0.45, L.sea ? 0 : 0.02));
      return { b, m: new THREE.Matrix4().makeTranslation(c.x, 0, c.z) };
    });
    // stalactites under a floating island
    const spikes: THREE.Matrix4[] = [];
    if (!L.sea)
      for (const p of [...board.hexes.map((h) => ({ x: h.x, z: h.y })), ...coast]) {
        for (let i = 0; i < 2; i++) {
          const len = 0.5 + r() * 1.6 * (1 - Math.hypot(p.x, p.z) / (R * 2.6 + 3));
          spikes.push(
            new THREE.Matrix4().compose(
              new THREE.Vector3(p.x + (r() - 0.5) * 0.9, deep - len / 2 + 0.05, p.z + (r() - 0.5) * 0.9),
              new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI, r() * 6, 0)),
              new THREE.Vector3(1, Math.max(0.2, len), 1),
            ),
          );
        }
      }
    // coast props
    const coastProps: { kind: PropKind; m: THREE.Matrix4 }[] = [];
    for (const c of coast) {
      if (c.top < 0.0) continue;
      const n = 1 + Math.floor(r() * 3);
      for (let i = 0; i < n; i++) {
        const kind: PropKind = L.flora === 'tropic' && r() < 0.6 ? 'palm' : L.flora === 'alien' ? 'crystal' : r() < 0.5 ? 'boulder' : 'drytuft';
        coastProps.push({
          kind,
          m: new THREE.Matrix4().compose(
            new THREE.Vector3(c.x + (r() - 0.5) * 1.1, c.top, c.z + (r() - 0.5) * 1.1),
            new THREE.Quaternion().setFromEuler(new THREE.Euler(0, r() * 6, 0)),
            new THREE.Vector3().setScalar(0.7 + r() * 0.6),
          ),
        });
      }
    }
    // foam skirts around everything that meets the water
    const foam: THREE.Matrix4[] = [];
    if (L.sea) {
      for (const c of coast) foam.push(new THREE.Matrix4().makeTranslation(c.x, 0.004, c.z));
      for (const h of board.hexes)
        if ((Math.abs(h.q) + Math.abs(h.r) + Math.abs(-h.q - h.r)) / 2 === R) foam.push(new THREE.Matrix4().makeTranslation(h.x, 0.004, h.y));
    }
    return { plate, tiles, tileGeo, plateGeo, coastGeo, coastMats, spikes, coastProps, foam };
  }, [board, L, R]);

  const spikeGeo = useMemo(() => hexPrismCone(L), [L]);
  const coastPropGroups = useMemo(() => {
    const g = new Map<PropKind, THREE.Matrix4[]>();
    for (const p of data.coastProps) {
      if (!g.has(p.kind)) g.set(p.kind, []);
      g.get(p.kind)!.push(p.m);
    }
    return g;
  }, [data]);

  return (
    <group>
      <Instanced geo={data.plateGeo} mat={VCOL} mats={data.plate} cast={false} />
      {[...data.coastGeo.entries()].map(([b, geo]) => (
        <Instanced key={b} geo={geo} mat={VCOL} mats={data.coastMats.filter((c) => c.b === b).map((c) => c.m)} cast={false} />
      ))}
      {[...data.tiles.entries()].map(([k, mats]) => (
        <Instanced key={k} geo={data.tileGeo.get(k)!} mat={VCOL} mats={mats} cast={false} />
      ))}
      {data.spikes.length > 0 && <Instanced geo={spikeGeo} mat={VCOL} mats={data.spikes} cast={false} receive={false} />}
      <Props groups={coastPropGroups} L={L} />
      {data.foam.length > 0 && <Foam mats={data.foam} color={L.sea!.foam} />}
    </group>
  );
}

let foamTex: THREE.CanvasTexture | null = null;
function foamTexture() {
  if (foamTex) return foamTex;
  const S = 256;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d')!;
  const grd = g.createRadialGradient(S / 2, S / 2, S * 0.36, S / 2, S / 2, S / 2);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.25, 'rgba(255,255,255,0.85)');
  grd.addColorStop(0.5, 'rgba(255,255,255,0.18)');
  grd.addColorStop(0.62, 'rgba(255,255,255,0.4)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, S, S);
  foamTex = new THREE.CanvasTexture(c);
  return foamTex;
}
const FOAM_GEO = new THREE.CircleGeometry(1.42, 6, Math.PI / 6);

function Foam({ mats, color }: { mats: THREE.Matrix4[]; color: string }) {
  const mat = useMemo(
    () => new THREE.MeshBasicMaterial({ color, alphaMap: foamTexture(), transparent: true, opacity: 0.6, depthWrite: false, toneMapped: false }),
    [color],
  );
  const ref = useRef<THREE.Group>(null);
  useFrame(() => {
    mat.opacity = 0.42 + 0.18 * Math.sin(TIME.value * 0.9);
  });
  return (
    <group ref={ref} rotation={[0, 0, 0]}>
      <Instanced geo={FOAM_GEO.clone().rotateX(-Math.PI / 2)} mat={mat} mats={mats} cast={false} receive={false} />
    </group>
  );
}

function hexPrismCone(L: Look3D) {
  const g = new THREE.ConeGeometry(0.32, 1, 5).toNonIndexed();
  g.translate(0, 0, 0);
  const pos = g.getAttribute('position');
  const a = new THREE.Color(L.cliff);
  const b = new THREE.Color(L.cliff).multiplyScalar(0.45);
  const col = new Float32Array(pos.count * 3);
  const tmp = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    tmp.copy(b).lerp(a, pos.getY(i) + 0.5);
    col.set([tmp.r, tmp.g, tmp.b], i * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.computeVertexNormals();
  return g;
}

const propMatCache = new Map<string, THREE.MeshStandardMaterial>();
function matFor(kind: PropKind, L: Look3D) {
  const sway = SWAY[kind] ?? 0;
  const glow = L.flora === 'alien' && GLOW[kind] ? L.c.emissive : null;
  const key = `${sway}|${glow}`;
  if (!propMatCache.has(key)) propMatCache.set(key, propMaterial(sway, glow));
  return propMatCache.get(key)!;
}
const geoCache = new Map<string, THREE.BufferGeometry>();
function geoFor(kind: PropKind, L: Look3D) {
  const key = `${kind}|${L.flora}|${L.c.leaf}|${L.c.grain}|${L.c.rock}`;
  if (!geoCache.has(key)) geoCache.set(key, propGeometry(kind, L));
  return geoCache.get(key)!;
}

function Props({ groups, L }: { groups: Map<PropKind, THREE.Matrix4[]>; L: Look3D }) {
  return (
    <>
      {[...groups.entries()].map(([kind, mats]) => (
        <Instanced key={kind} geo={geoFor(kind, L)} mat={matFor(kind, L)} mats={mats} cast={kind !== 'stalk' && kind !== 'tuft' && kind !== 'drytuft'} />
      ))}
    </>
  );
}

// ---------------------------------------------------------------- sea & sky
const SEA_VS = /* glsl */ `
  varying vec3 vW;
  void main() {
    vec4 w = modelMatrix * vec4(position, 1.0);
    vW = w.xyz;
    gl_Position = projectionMatrix * viewMatrix * w;
  }`;
const SEA_FS = /* glsl */ `
  uniform float uTime; uniform float uApo; uniform float uReduced;
  uniform vec3 uDeep; uniform vec3 uShallow; uniform vec3 uFoam; uniform vec3 uHorizon; uniform vec3 uSun; uniform vec3 uSunCol;
  varying vec3 vW;
  float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float n2(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
    return mix(mix(h21(i), h21(i+vec2(1,0)), f.x), mix(h21(i+vec2(0,1)), h21(i+vec2(1,1)), f.x), f.y); }
  float hexd(vec2 p){ p = abs(p); return max(p.y, p.x * 0.8660254 + p.y * 0.5); }
  void main(){
    vec2 p = vW.xz;
    float t = uTime * (1.0 - uReduced);
    float d = hexd(vec2(p.x, p.y)) - uApo;
    float wob = n2(p * 1.3 + vec2(t * 0.15, -t * 0.1)) * 0.45 + n2(p * 3.1 - t * 0.3) * 0.2;
    vec3 col = mix(uShallow, uDeep, smoothstep(-0.6, 2.6, d + wob * 0.6));
    // foam: two soft bands breathing towards the shore
    col = mix(col, uFoam, smoothstep(0.62, 0.95, n2(p * 6.0 + vec2(t * 0.25, t * 0.1))) * 0.12 * (1.0 - smoothstep(0.0, 3.0, d)));
    // sun glints
    vec3 v = normalize(cameraPosition - vW);
    vec2 g = vec2(n2(p * 4.0 + t * 0.6), n2(p * 4.0 - t * 0.5)) - 0.5;
    vec3 n = normalize(vec3(g.x * 0.35, 1.0, g.y * 0.35));
    float spec = pow(max(dot(reflect(-normalize(uSun), n), v), 0.0), 60.0);
    col += uSunCol * spec * 0.9;
    // fade to horizon
    float fog = smoothstep(14.0, 70.0, length(vW - cameraPosition));
    gl_FragColor = vec4(mix(col, uHorizon, fog), 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`;

function Sea({ L, apo }: { L: Look3D; apo: number }) {
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: SEA_VS,
        fragmentShader: SEA_FS,
        uniforms: {
          uTime: TIME,
          uApo: { value: apo },
          uReduced: { value: reducedMotion() ? 1 : 0 },
          uDeep: { value: new THREE.Color(L.sea!.deep) },
          uShallow: { value: new THREE.Color(L.sea!.shallow) },
          uFoam: { value: new THREE.Color(L.sea!.foam) },
          uHorizon: { value: new THREE.Color(L.sky.horizon) },
          uSun: { value: new THREE.Vector3(...L.sun.dir) },
          uSunCol: { value: new THREE.Color(L.sun.color) },
        },
      }),
    [L, apo],
  );
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} material={mat}>
      <planeGeometry args={[400, 400, 1, 1]} />
    </mesh>
  );
}

const SKY_FS = /* glsl */ `
  uniform vec3 uTop; uniform vec3 uHorizon; uniform vec3 uGlow; uniform vec3 uSun; uniform float uNebula;
  varying vec3 vDir;
  float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float n2(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
    return mix(mix(h21(i), h21(i+vec2(1,0)), f.x), mix(h21(i+vec2(0,1)), h21(i+vec2(1,1)), f.x), f.y); }
  void main(){
    vec3 d = normalize(vDir);
    float y = max(d.y, 0.0);
    vec3 col = mix(uHorizon, uTop, pow(y, 0.55));
    float s = max(dot(d, normalize(uSun)), 0.0);
    col += uGlow * (pow(s, 6.0) * 0.55 + pow(s, 60.0) * 0.6) * (1.0 - y * 0.6);
    if (uNebula > 0.5) {
      vec2 q = d.xz / (0.4 + y) * 2.0;
      float n = n2(q * 1.5) * 0.6 + n2(q * 3.7) * 0.4;
      col += uGlow * smoothstep(0.55, 0.95, n) * 0.35;
    }
    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`;

function Sky({ L }: { L: Look3D }) {
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        vertexShader: 'varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
        fragmentShader: SKY_FS,
        uniforms: {
          uTop: { value: new THREE.Color(L.sky.top) },
          uHorizon: { value: new THREE.Color(L.sky.horizon) },
          uGlow: { value: new THREE.Color(L.sky.glow) },
          uSun: { value: new THREE.Vector3(...L.sun.dir) },
          uNebula: { value: L.stars ? 1 : 0 },
        },
      }),
    [L],
  );
  return (
    <mesh material={mat} renderOrder={-1}>
      <sphereGeometry args={[180, 32, 16]} />
    </mesh>
  );
}

function Stars() {
  const geo = useMemo(() => {
    const n = 900;
    const pos = new Float32Array(n * 3);
    const r = rng(99);
    for (let i = 0; i < n; i++) {
      const u = r() * 2 - 1;
      const th = r() * Math.PI * 2;
      const rad = 120 + r() * 40;
      const s = Math.sqrt(1 - u * u);
      pos.set([rad * s * Math.cos(th), rad * u, rad * s * Math.sin(th)], i * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    return g;
  }, []);
  return (
    <points geometry={geo}>
      <pointsMaterial color="#e6ecff" size={0.7} sizeAttenuation transparent opacity={0.9} depthWrite={false} />
    </points>
  );
}


// ---------------------------------------------------------------- harbours
interface HarborSpot {
  kind: Resource | 'any';
  a: [number, number];
  b: [number, number];
  mid: [number, number];
  dir: [number, number]; // outward unit vector
  out: [number, number]; // centre of the sea hex in front of it
  hex: number;
}
function harborSpots(board: Board): HarborSpot[] {
  return (board.harbors ?? []).flatMap((h) => {
    const e = board.edges[h.edge];
    if (!e) return [];
    const A = board.vertices[e.a];
    const B = board.vertices[e.b];
    const hexId = A.hexes.find((x) => B.hexes.includes(x));
    if (hexId === undefined) return [];
    const C = board.hexes[hexId];
    const mid: [number, number] = [(A.x + B.x) / 2, (A.y + B.y) / 2];
    const dx = mid[0] - C.x;
    const dz = mid[1] - C.y;
    const len = Math.hypot(dx, dz) || 1;
    return [{ kind: h.kind, a: [A.x, A.y], b: [B.x, B.y], mid, dir: [dx / len, dz / len], out: [C.x + 2 * dx, C.y + 2 * dz], hex: hexId }];
  });
}

const signCache = new Map<string, THREE.CanvasTexture>();
function harborTexture(kind: Resource | 'any', L: Look3D, color: string, label: string, fonts: boolean) {
  const key = `${kind}|${L.medallion.face}|${color}|${label}|${fonts}`;
  const hit = signCache.get(key);
  if (hit) return hit;
  const S = 256;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d')!;
  const m = L.medallion;
  const font = (w: number, px: number) => `${w} ${px}px ${fonts ? 'Alegreya, ' : ''}Georgia, serif`;
  g.beginPath();
  g.arc(S / 2, S / 2, S / 2 - 6, 0, Math.PI * 2);
  g.fillStyle = m.rim;
  g.fill();
  g.beginPath();
  g.arc(S / 2, S / 2, S / 2 - 20, 0, Math.PI * 2);
  g.fillStyle = kind === 'any' ? m.face : color;
  g.fill();
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  if (kind === 'any') {
    g.fillStyle = m.ink;
    g.font = font(800, 92);
    g.fillText('3:1', S / 2, S / 2 + 4);
  } else {
    g.fillStyle = '#ffffff';
    g.shadowColor = 'rgba(0,0,0,.45)';
    g.shadowBlur = 8;
    g.font = font(800, 88);
    g.fillText('2:1', S / 2, S / 2 - 20);
    g.font = font(700, label.length > 9 ? 30 : 38);
    g.fillText(label, S / 2, S / 2 + 52);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  signCache.set(key, tex);
  return tex;
}

const HB = {
  box: new THREE.BoxGeometry(1, 1, 1),
  post: new THREE.CylinderGeometry(0.03, 0.035, 1, 6),
};

function Beam({ from, to, y0, y1, w, h, mat }: { from: [number, number]; to: [number, number]; y0: number; y1: number; w: number; h: number; mat: THREE.Material }) {
  const dx = to[0] - from[0];
  const dz = to[1] - from[1];
  const len = Math.hypot(dx, dz);
  const dy = y1 - y0;
  const run = Math.hypot(len, dy);
  return (
    <group position={[(from[0] + to[0]) / 2, (y0 + y1) / 2, (from[1] + to[1]) / 2]} rotation={[0, -Math.atan2(dz, dx), 0]}>
      <mesh geometry={HB.box} material={mat} rotation={[0, 0, Math.atan2(dy, len)]} scale={[run, h, w]} castShadow receiveShadow />
    </group>
  );
}

function Harbors({ board, L, theme, lang, vTop }: { board: Board; L: Look3D; theme: ThemeDef; lang: 'tr' | 'en'; vTop: (v: number) => number }) {
  const fonts = useFontsReady();
  const spots = useMemo(() => harborSpots(board), [board]);
  const mats = useMemo(
    () => ({
      deck: new THREE.MeshStandardMaterial({ color: L.sea ? '#8a5f3a' : '#59607e', roughness: 0.85, flatShading: true }),
      dark: new THREE.MeshStandardMaterial({ color: L.sea ? '#4e3420' : '#2c3049', roughness: 0.9 }),
    }),
    [L],
  );
  const deckY = L.sea ? 0.07 : 0.0;
  return (
    <>
      {spots.map((h, i) => {
        const [ux, uz] = h.dir;
        const base: [number, number] = [h.mid[0] + ux * 0.18, h.mid[1] + uz * 0.18];
        const end: [number, number] = [h.mid[0] + ux * 1.0, h.mid[1] + uz * 1.0];
        const px = -uz;
        const pz = ux;
        const posts = [0.45, 0.95].flatMap((k) =>
          [-1, 1].map((sgn) => [h.mid[0] + ux * k + px * 0.15 * sgn, h.mid[1] + uz * k + pz * 0.15 * sgn] as [number, number]),
        );
        const top = Math.max(...board.hexes.filter((x) => x.id === h.hex).map((x) => tileTop(L, x)));
        const e = board.harbors![i]!;
        const E = board.edges[e.edge];
        const color = h.kind === 'any' ? L.medallion.face : theme.palette.resource[h.kind];
        const label = h.kind === 'any' ? '' : theme.res[h.kind][lang];
        return (
          <group key={i}>
            <Beam from={base} to={end} y0={deckY} y1={deckY} w={0.34} h={0.045} mat={mats.deck} />
            {posts.map((p, k) => (
              <mesh key={k} geometry={HB.post} material={mats.dark} position={[p[0], deckY - 0.2, p[1]]} scale={[1, 0.5, 1]} castShadow />
            ))}
            <Beam from={h.a} to={base} y0={vTop(E.a) - 0.01} y1={deckY + 0.02} w={0.07} h={0.03} mat={mats.dark} />
            <Beam from={h.b} to={base} y0={vTop(E.b) - 0.01} y1={deckY + 0.02} w={0.07} h={0.03} mat={mats.dark} />
            <mesh geometry={HB.post} material={mats.dark} position={[end[0], deckY + 0.22, end[1]]} scale={[0.6, 0.45, 0.6]} />
            <sprite position={[end[0], Math.max(deckY, top) + 0.62, end[1]]} scale={[0.62, 0.62, 1]}>
              <spriteMaterial map={harborTexture(h.kind, L, color, label, fonts)} depthWrite={false} />
            </sprite>
          </group>
        );
      })}
    </>
  );
}

// ---------------------------------------------------------------- medallions
const medCache = new Map<string, THREE.CanvasTexture>();
function medallionTexture(n: number, L: Look3D, fontsReady: boolean): THREE.CanvasTexture {
  const key = `${n}|${L.medallion.face}|${L.medallion.ink}|${fontsReady}`;
  const hit = medCache.get(key);
  if (hit) return hit;
  const S = 256;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d')!;
  const hot = n === 6 || n === 8;
  const m = L.medallion;
  g.fillStyle = m.face;
  g.fillRect(0, 0, S, S);
  // fine inner ring + eight-point star tick marks
  g.strokeStyle = hot ? m.hot : m.rim;
  g.lineWidth = 5;
  g.beginPath();
  g.arc(S / 2, S / 2, S * 0.42, 0, Math.PI * 2);
  g.stroke();
  g.fillStyle = hot ? m.hot : m.rim;
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    g.beginPath();
    g.arc(S / 2 + Math.cos(a) * S * 0.42, S / 2 + Math.sin(a) * S * 0.42, 5, 0, Math.PI * 2);
    g.fill();
  }
  g.fillStyle = hot ? m.hot : m.ink;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = `800 ${hot ? 122 : 108}px ${fontsReady ? 'Alegreya, ' : ''}Georgia, serif`;
  g.fillText(String(n), S / 2, S / 2 - 14);
  const k = pips(n);
  for (let i = 0; i < k; i++) {
    g.beginPath();
    g.arc(S / 2 + (i - (k - 1) / 2) * 19, S * 0.74, 6.5, 0, Math.PI * 2);
    g.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  medCache.set(key, tex);
  return tex;
}

const MED_GEO = new THREE.CylinderGeometry(0.27, 0.285, 0.05, 40);
const MED_RIM = new THREE.TorusGeometry(0.272, 0.018, 8, 40);

function useFontsReady() {
  const [ok, setOk] = useState(() => typeof document !== 'undefined' && !!document.fonts?.check?.('800 40px Alegreya'));
  useEffect(() => {
    if (ok || !document.fonts) return;
    let alive = true;
    document.fonts
      .load('800 40px Alegreya')
      .then(() => alive && setOk(document.fonts.check('800 40px Alegreya')))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [ok]);
  return ok;
}

function Medallions({ board, L }: { board: Board; L: Look3D }) {
  const fonts = useFontsReady();
  const rimMat = useMemo(() => new THREE.MeshStandardMaterial({ color: L.medallion.rim, metalness: 0.75, roughness: 0.3 }), [L]);
  return (
    <>
      {board.hexes.map((h) =>
        h.number === null ? null : (
          <group key={h.id} position={[h.x, tileTop(L, h) + 0.026, h.y]}>
            <mesh geometry={MED_GEO} rotation={[0, Math.PI / 2, 0]} castShadow receiveShadow>
              <meshStandardMaterial attach="material-0" color={L.medallion.rim} metalness={0.6} roughness={0.35} />
              <meshStandardMaterial attach="material-1" map={medallionTexture(h.number, L, fonts)} roughness={0.6} />
              <meshStandardMaterial attach="material-2" color={L.medallion.rim} />
            </mesh>
            <mesh geometry={MED_RIM} material={rimMat} position={[0, 0.025, 0]} rotation={[Math.PI / 2, 0, 0]} />
          </group>
        ),
      )}
    </>
  );
}

// ---------------------------------------------------------------- pieces
const PG = {
  yurtWall: new THREE.CylinderGeometry(0.12, 0.125, 0.1, 14),
  yurtRoof: new THREE.ConeGeometry(0.14, 0.1, 14),
  band: new THREE.TorusGeometry(0.122, 0.011, 6, 20),
  crown: new THREE.SphereGeometry(0.022, 8, 6),
  door: new THREE.BoxGeometry(0.05, 0.07, 0.02),
  box: new THREE.BoxGeometry(1, 1, 1),
  tower: new THREE.CylinderGeometry(0.05, 0.055, 1, 8),
  dome: new THREE.SphereGeometry(1, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2),
  drum: new THREE.CylinderGeometry(1, 1, 1, 16),
  finial: new THREE.ConeGeometry(0.012, 0.06, 6),
  road: new THREE.BoxGeometry(0.6, 0.055, 0.11),
  roadEdge: new THREE.BoxGeometry(0.64, 0.035, 0.15),
};

function Yurt({ body, trim, dark }: { body: THREE.Material; trim: THREE.Material; dark: THREE.Material }) {
  return (
    <group>
      <mesh geometry={PG.yurtWall} material={body} position={[0, 0.05, 0]} castShadow receiveShadow />
      <mesh geometry={PG.yurtRoof} material={body} position={[0, 0.15, 0]} castShadow />
      <mesh geometry={PG.band} material={trim} position={[0, 0.098, 0]} rotation={[Math.PI / 2, 0, 0]} />
      <mesh geometry={PG.crown} material={trim} position={[0, 0.205, 0]} />
      <mesh geometry={PG.door} material={dark} position={[0, 0.035, 0.118]} />
    </group>
  );
}

function Keep({ body, trim, dark }: { body: THREE.Material; trim: THREE.Material; dark: THREE.Material }) {
  const corners: [number, number][] = [
    [-0.15, -0.15],
    [0.15, -0.15],
    [-0.15, 0.15],
    [0.15, 0.15],
  ];
  return (
    <group>
      <mesh geometry={PG.box} material={body} scale={[0.32, 0.12, 0.32]} position={[0, 0.06, 0]} castShadow receiveShadow />
      {corners.map(([x, z], i) => (
        <group key={i} position={[x, 0, z]}>
          <mesh geometry={PG.tower} material={body} scale={[1, 0.2, 1]} position={[0, 0.1, 0]} castShadow />
          <mesh geometry={PG.box} material={trim} scale={[0.115, 0.03, 0.115]} position={[0, 0.215, 0]} />
        </group>
      ))}
      <mesh geometry={PG.box} material={body} scale={[0.17, 0.34, 0.17]} position={[0, 0.17, 0]} castShadow />
      {[-1, 1].flatMap((sx) =>
        [-1, 1].map((sz) => <mesh key={`${sx}${sz}`} geometry={PG.box} material={body} scale={[0.045, 0.045, 0.045]} position={[sx * 0.062, 0.36, sz * 0.062]} castShadow />),
      )}
      <mesh geometry={PG.box} material={trim} scale={[0.012, 0.16, 0.012]} position={[0, 0.44, 0]} />
      <mesh geometry={PG.box} material={trim} scale={[0.09, 0.05, 0.008]} position={[0.05, 0.495, 0]} castShadow />
      <mesh geometry={PG.box} material={dark} scale={[0.06, 0.08, 0.01]} position={[0, 0.04, 0.162]} />
    </group>
  );
}

function Bazaar({ body, trim, dark }: { body: THREE.Material; trim: THREE.Material; dark: THREE.Material }) {
  return (
    <group>
      <mesh geometry={PG.box} material={body} scale={[0.34, 0.13, 0.24]} position={[0, 0.065, 0]} castShadow receiveShadow />
      <mesh geometry={PG.drum} material={body} scale={[0.085, 0.05, 0.085]} position={[0, 0.155, 0]} castShadow />
      <mesh geometry={PG.dome} material={trim} scale={[0.09, 0.085, 0.09]} position={[0, 0.18, 0]} castShadow />
      <mesh geometry={PG.finial} material={trim} position={[0, 0.29, 0]} />
      {[-1, 1].map((s) => (
        <mesh key={s} geometry={PG.dome} material={trim} scale={[0.05, 0.045, 0.05]} position={[s * 0.12, 0.13, 0]} castShadow />
      ))}
      {[-1, 0, 1].map((s) => (
        <mesh key={s} geometry={PG.box} material={dark} scale={[0.045, 0.07, 0.01]} position={[s * 0.1, 0.035, 0.121]} />
      ))}
    </group>
  );
}

function usePlayerMats(L: Look3D, colors: string[]) {
  return useMemo(() => {
    const body = new Map<string, THREE.MeshStandardMaterial>();
    for (const c of colors) body.set(c, new THREE.MeshStandardMaterial({ color: c, roughness: 0.55, metalness: 0.05, flatShading: true }));
    return {
      body,
      trim: new THREE.MeshStandardMaterial({ color: L.medallion.rim, metalness: 0.8, roughness: 0.28 }),
      dark: new THREE.MeshStandardMaterial({ color: '#1b1612', roughness: 0.9 }),
      roadEdge: new THREE.MeshStandardMaterial({ color: '#2a221c', roughness: 0.9 }),
    };
  }, [L, colors.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps
}

/** Drops its children from the sky with a little bounce when `animate` is set. */
function Drop({ children, animate, position, rotation }: { children: ReactNode; animate: boolean; position: [number, number, number]; rotation?: [number, number, number] }) {
  const ref = useRef<THREE.Group>(null);
  const start = useRef<number | null>(animate && !reducedMotion() ? -1 : null);
  useFrame(({ clock }) => {
    const g = ref.current;
    if (!g || start.current === null) return;
    if (start.current < 0) start.current = clock.elapsedTime;
    const t = Math.min(1, (clock.elapsedTime - start.current) / 0.55);
    // ease-out bounce
    const b = t < 0.7 ? 1 - (t / 0.7) ** 2 : Math.sin(((t - 0.7) / 0.3) * Math.PI) * 0.12;
    g.position.y = b * 1.4;
    const sq = t > 0.7 ? 1 - Math.sin(((t - 0.7) / 0.3) * Math.PI) * 0.12 : 1;
    g.scale.set(1 / Math.sqrt(sq), sq, 1 / Math.sqrt(sq));
    if (t >= 1) {
      g.position.y = 0;
      g.scale.set(1, 1, 1);
      start.current = null;
    }
  });
  return (
    <group position={position} rotation={rotation}>
      <group ref={ref} position={[0, start.current !== null ? 1.4 : 0, 0]}>
        {children}
      </group>
    </group>
  );
}

// ---------------------------------------------------------------- bandit
function Bandit({ target, L }: { target: [number, number, number]; L: Look3D }) {
  const ref = useRef<THREE.Group>(null);
  const pos = useRef(new THREE.Vector3(...target));
  const cloak = useMemo(() => new THREE.MeshStandardMaterial({ color: '#211a1d', roughness: 0.8, flatShading: true }), []);
  const eye = useMemo(() => new THREE.MeshBasicMaterial({ color: L.medallion.hot }), [L]);
  const blade = useMemo(() => new THREE.MeshStandardMaterial({ color: '#d9dde3', metalness: 0.9, roughness: 0.2 }), []);
  useFrame((_, dt) => {
    const g = ref.current;
    if (!g) return;
    const tgt = new THREE.Vector3(...target);
    const k = reducedMotion() ? 1 : 1 - Math.exp(-dt * 4);
    const d = pos.current.distanceTo(tgt);
    pos.current.lerp(tgt, k);
    g.position.copy(pos.current);
    g.position.y += Math.min(1.2, d * 0.6) + Math.sin(TIME.value * 2) * 0.015;
  });
  return (
    <group ref={ref} position={target}>
      <mesh position={[0, 0.2, 0]} castShadow material={cloak}>
        <coneGeometry args={[0.13, 0.4, 9]} />
      </mesh>
      <mesh position={[0, 0.42, 0]} castShadow material={cloak}>
        <sphereGeometry args={[0.075, 12, 10]} />
      </mesh>
      <mesh position={[0, 0.47, 0]} castShadow material={cloak} rotation={[-0.35, 0, 0]}>
        <coneGeometry args={[0.085, 0.14, 9]} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 0.025, 0.425, 0.066]} material={eye}>
          <sphereGeometry args={[0.012, 6, 5]} />
        </mesh>
      ))}
      <mesh position={[0.12, 0.2, 0.04]} rotation={[0, 0, -0.5]} material={blade} castShadow>
        <boxGeometry args={[0.018, 0.3, 0.008]} />
      </mesh>
    </group>
  );
}

// ---------------------------------------------------------------- highlights
const HL = {
  ring: new THREE.TorusGeometry(0.17, 0.03, 8, 32),
  ringBack: new THREE.TorusGeometry(0.17, 0.055, 8, 32),
  disc: new THREE.CircleGeometry(0.15, 32),
  bar: new THREE.CapsuleGeometry(0.052, 0.38, 4, 10),
  barBack: new THREE.CapsuleGeometry(0.085, 0.4, 4, 10),
  hexRing: new THREE.RingGeometry(0.74, 0.84, 6, 1, Math.PI / 6),
  vHit: new THREE.SphereGeometry(0.36, 8, 6),
  eHit: new THREE.BoxGeometry(0.7, 0.4, 0.4),
  hHit: new THREE.CylinderGeometry(0.85, 0.85, 0.5, 6),
};
const HIT_MAT = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });

function Highlight({ highlights, board, L, vTop, eTop, onPick }: {
  highlights: Highlights;
  board: Board;
  L: Look3D;
  vTop: (v: number) => number;
  eTop: (e: number) => number;
  onPick: (kind: PickKind, id: number) => void;
}) {
  const mats = useMemo(() => {
    const glow = new THREE.MeshBasicMaterial({ color: L.glow, transparent: true, opacity: 0.9, depthWrite: false, toneMapped: false });
    const soft = new THREE.MeshBasicMaterial({ color: L.glow, transparent: true, opacity: 0.25, depthWrite: false, toneMapped: false, side: THREE.DoubleSide });
    const back = new THREE.MeshBasicMaterial({ color: '#0b1426', transparent: true, opacity: 0.6, depthWrite: false });
    return { glow, soft, back };
  }, [L]);
  useFrame(() => {
    const s = 0.5 + 0.5 * Math.sin(TIME.value * 4);
    mats.glow.opacity = 0.75 + 0.25 * s;
    mats.soft.opacity = 0.15 + 0.25 * s;
  });
  const click = (kind: PickKind, id: number) => (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (e.delta < 9) onPick(kind, id);
  };
  const edgePose = (id: number) => {
    const e = board.edges[id];
    const a = board.vertices[e.a];
    const b = board.vertices[e.b];
    return { x: (a.x + b.x) / 2, z: (a.y + b.y) / 2, rot: -Math.atan2(b.y - a.y, b.x - a.x) };
  };
  return (
    <>
      {highlights.vertices.map((id) => {
        const v = board.vertices[id];
        if (!v) return null;
        const y = vTop(id) + 0.03;
        return (
          <group key={`v${id}`} position={[v.x, y, v.y]} onClick={click('vertex', id)}>
            <mesh geometry={HL.ringBack} material={mats.back} rotation={[Math.PI / 2, 0, 0]} />
            <mesh geometry={HL.ring} material={mats.glow} rotation={[Math.PI / 2, 0, 0]} position={[0, 0.01, 0]} />
            <mesh geometry={HL.disc} material={mats.soft} rotation={[-Math.PI / 2, 0, 0]} />
            <mesh geometry={HL.vHit} material={HIT_MAT} />
          </group>
        );
      })}
      {highlights.edges.map((id) => {
        if (!board.edges[id]) return null;
        const p = edgePose(id);
        return (
          <group key={`e${id}`} position={[p.x, eTop(id) + 0.08, p.z]} rotation={[0, p.rot, 0]} onClick={click('edge', id)}>
            <mesh geometry={HL.barBack} material={mats.back} rotation={[0, 0, Math.PI / 2]} scale={[1, 1, 0.45]} />
            <mesh geometry={HL.bar} material={mats.glow} rotation={[0, 0, Math.PI / 2]} position={[0, 0.02, 0]} />
            <mesh geometry={HL.eHit} material={HIT_MAT} />
          </group>
        );
      })}
      {highlights.hexes.map((id) => {
        const h = board.hexes[id];
        if (!h) return null;
        return (
          <group key={`h${id}`} position={[h.x, tileTop(L, h) + 0.04, h.y]} onClick={click('hex', id)}>
            <mesh geometry={HL.hexRing} material={mats.glow} rotation={[-Math.PI / 2, 0, 0]} />
            <mesh geometry={HL.hHit} material={HIT_MAT} position={[0, 0.2, 0]} />
          </group>
        );
      })}
    </>
  );
}

// ---------------------------------------------------------------- camera
function GameRig({ extent }: { extent: number }) {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const size = useThree((s) => s.size);
  const controls = useThree((s) => s.controls) as unknown as { enabled: boolean; update: () => void } | null;
  const portrait = size.width < size.height;
  const intro = useRef<{ t0: number | null; from: THREE.Spherical; to: THREE.Spherical } | null>(null);

  useEffect(() => {
    const aspect = size.height > 0 ? size.width / size.height : 1;
    const tanV = Math.tan((camera.fov * Math.PI) / 360);
    const d = Math.max(extent / (tanV * aspect), (extent * 0.8) / tanV) * (aspect < 1 ? 1.04 : 1.2);
    const to = new THREE.Spherical(d, (36 * Math.PI) / 180, 0);
    if (intro.current === null && !reducedMotion()) {
      intro.current = { t0: null, from: new THREE.Spherical(d * 1.9, (8 * Math.PI) / 180, -1.25), to };
      camera.position.setFromSpherical(intro.current.from);
    } else {
      intro.current = null;
      camera.position.setFromSpherical(to);
    }
    camera.lookAt(0, 0, 0);
    controls?.update();
    // Refit only when the board or the orientation changes, not on every resize.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [extent, portrait]);

  useFrame(({ clock }) => {
    const it = intro.current;
    if (!it) return;
    if (it.t0 === null) it.t0 = clock.elapsedTime;
    const t = Math.min(1, (clock.elapsedTime - it.t0) / 2.4);
    const e = 1 - Math.pow(1 - t, 3);
    const s = new THREE.Spherical(
      it.from.radius + (it.to.radius - it.from.radius) * e,
      it.from.phi + (it.to.phi - it.from.phi) * e,
      it.from.theta + (it.to.theta - it.from.theta) * e,
    );
    camera.position.setFromSpherical(s);
    camera.lookAt(0, 0, 0);
    if (controls) controls.enabled = t >= 1;
    if (t >= 1) {
      intro.current = null;
      controls?.update();
    }
  });
  return null;
}

function ShowcaseRig({ extent }: { extent: number }) {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const size = useThree((s) => s.size);
  const sph = useMemo(() => new THREE.Spherical(), []);
  const tgt = useMemo(() => new THREE.Vector3(), []);
  useFrame(({ clock }) => {
    const portrait = size.width < size.height * 1.05;
    const t = reducedMotion() ? 0.6 : clock.elapsedTime * 0.045 + 0.6;
    // Phones: island fills the screen behind the title. Wide screens: island sits right of the text column.
    const d = extent * (portrait ? 3.3 : 2.75);
    sph.set(d, ((portrait ? 58 : 55) * Math.PI) / 180, t);
    const shift = portrait ? 0 : extent * 0.62; // move the look-at point to the camera's left
    tgt.set(-Math.cos(t) * shift, portrait ? -extent * 0.35 : -extent * 0.12, Math.sin(t) * shift);
    camera.position.setFromSpherical(sph).add(tgt);
    camera.lookAt(tgt);
  });
  return null;
}

function Ticker() {
  useFrame((_, dt) => {
    if (!reducedMotion()) TIME.value += Math.min(dt, 0.1);
  });
  return null;
}

// ---------------------------------------------------------------- scene
export function Scene({ view, theme, highlights, onPick, lastBuilt, mode }: SceneProps) {
  const { board } = view;
  const L = LOOKS[theme.id];
  const lang = useStore((s) => s.settings.lang);
  const gl = useThree((s) => s.gl);
  useEffect(() => {
    gl.toneMappingExposure = L.exposure;
  }, [gl, L]);

  const R = boardRadius(board);
  const extent = useMemo(() => {
    let m = 0;
    for (const v of board.vertices) m = Math.max(m, Math.abs(v.x), Math.abs(v.y));
    return m + 0.6;
  }, [board]);
  const apo = 1.5 * (R + 1) + 0.75;

  const tops = useMemo(() => board.hexes.map((h) => tileTop(L, h)), [board, L]);
  const vTop = (v: number) => Math.max(...board.vertices[v].hexes.map((h) => tops[h]));
  const eTop = (id: number) => {
    const e = board.edges[id];
    const a = board.vertices[e.a].hexes;
    const common = a.filter((h) => board.vertices[e.b].hexes.includes(h));
    return Math.max(...(common.length ? common : a).map((h) => tops[h]));
  };

  const decor = useMemo(() => groupProps(layoutProps(board, L, (h) => tileTop(L, h))), [board, L]);

  const colors = view.players.map((p) => p.color);
  const pm = usePlayerMats(L, colors);
  const colorOf = (seat: number) => view.players.find((p) => p.seat === seat)?.color ?? '#888888';
  const bodyOf = (seat: number) => pm.body.get(colorOf(seat)) ?? pm.dark;

  const banditHex = board.hexes[view.bandit];
  const banditTarget: [number, number, number] | null = banditHex ? [banditHex.x + 0.1, tileTop(L, banditHex) + 0.05, banditHex.y + 0.12] : null;

  const sun = new THREE.Vector3(...L.sun.dir).normalize().multiplyScalar(extent * 2.6);

  return (
    <>
      <Ticker />
      <fog attach="fog" args={[L.sky.horizon, 30, 110]} />
      <Sky L={L} />
      {L.stars && <Stars />}
      {L.sea && <Sea L={L} apo={apo} />}
      <hemisphereLight args={[L.fill.sky, L.fill.ground, L.fill.intensity]} />
      <directionalLight
        position={sun}
        color={L.sun.color}
        intensity={L.sun.intensity}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-left={-extent - 1.5}
        shadow-camera-right={extent + 1.5}
        shadow-camera-top={extent + 1.5}
        shadow-camera-bottom={-extent - 1.5}
        shadow-camera-near={0.5}
        shadow-camera-far={extent * 6}
        shadow-bias={-0.0006}
        shadow-normalBias={0.02}
      />

      <Island board={board} L={L} />
      <Props groups={decor} L={L} />
      <Medallions board={board} L={L} />
      <Harbors board={board} L={L} theme={theme} lang={lang} vTop={vTop} />

      {Object.entries(view.roads).map(([id, seat]) => {
        const n = Number(id);
        const e = board.edges[n];
        if (!e) return null;
        const a = board.vertices[e.a];
        const b = board.vertices[e.b];
        const rot = -Math.atan2(b.y - a.y, b.x - a.x);
        const anim = lastBuilt?.kind === 'edge' && lastBuilt.id === n;
        return (
          <Drop key={`r${id}`} animate={anim} position={[(a.x + b.x) / 2, eTop(n), (a.y + b.y) / 2]} rotation={[0, rot, 0]}>
            <mesh geometry={PG.roadEdge} material={pm.roadEdge} position={[0, 0.018, 0]} receiveShadow />
            <mesh geometry={PG.road} material={bodyOf(seat)} position={[0, 0.05, 0]} castShadow receiveShadow />
          </Drop>
        );
      })}

      {Object.entries(view.buildings).map(([id, b]) => {
        const n = Number(id);
        const v = board.vertices[n];
        if (!v) return null;
        const anim = lastBuilt?.kind === 'vertex' && lastBuilt.id === n;
        const face = Math.atan2(v.x, v.y); // door faces outward from the board centre
        const P: Record<BuildingKind, typeof Yurt> = { outpost: Yurt, keep: Keep, market: Bazaar };
        const C = P[b.kind];
        return (
          <Drop key={`${id}-${b.kind}`} animate={anim} position={[v.x, vTop(n), v.y]} rotation={[0, face, 0]}>
            <C body={bodyOf(b.owner)} trim={pm.trim} dark={pm.dark} />
          </Drop>
        );
      })}

      {banditTarget && mode === 'game' && <Bandit target={banditTarget} L={L} />}

      {mode === 'game' && <Highlight highlights={highlights} board={board} L={L} vTop={vTop} eTop={eTop} onPick={onPick} />}

      {mode === 'game' ? (
        <>
          <GameRig extent={extent} />
          <OrbitControls
            makeDefault
            enableDamping
            dampingFactor={0.1}
            target={[0, 0, 0]}
            minPolarAngle={0.12}
            maxPolarAngle={Math.PI * 0.4}
            minDistance={3}
            maxDistance={extent * 6}
            zoomSpeed={0.9}
            rotateSpeed={0.6}
            panSpeed={0.8}
          />
        </>
      ) : (
        <ShowcaseRig extent={extent} />
      )}
    </>
  );
}
