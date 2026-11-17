// Procedural diorama props for Board3D: each prop is ONE merged geometry with baked vertex colours,
// drawn as an InstancedMesh per prop type, so even the large map stays cheap on phones.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Board, Hex } from '@kervan/shared';
import type { Look3D } from './look3d';

/** Shared clock for wind sway / water; advanced by the scene. */
export const TIME = { value: 0 };

// ---------- tiny deterministic random ----------
export function rng(seed: number) {
  let a = seed >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- geometry building ----------
const M = new THREE.Matrix4();
const Q = new THREE.Quaternion();
const E = new THREE.Euler();
const V = new THREE.Vector3();
const S = new THREE.Vector3();

function part(
  geo: THREE.BufferGeometry,
  color: string,
  pos: [number, number, number] = [0, 0, 0],
  rot: [number, number, number] = [0, 0, 0],
  scale: [number, number, number] = [1, 1, 1],
): THREE.BufferGeometry {
  const g = (geo.index ? geo.toNonIndexed() : geo.clone()) as THREE.BufferGeometry;
  if (!g.getAttribute('uv')) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.getAttribute('position').count * 2), 2));
  M.compose(V.set(...pos), Q.setFromEuler(E.set(...rot)), S.set(...scale));
  g.applyMatrix4(M);
  const c = new THREE.Color(color);
  const n = g.getAttribute('position').count;
  const col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    col[i * 3] = c.r;
    col[i * 3 + 1] = c.g;
    col[i * 3 + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}
function merge(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const g = mergeGeometries(parts, false)!;
  g.computeVertexNormals();
  g.computeBoundingSphere();
  return g;
}

/** Low-poly mountain: jittered icosphere, flattened base, snow above a height. */
function mountain(rock: string, snow: string, seed: number): THREE.BufferGeometry {
  const r = rng(seed);
  const base = new THREE.IcosahedronGeometry(1, 1);
  const pos = base.getAttribute('position');
  const jit = new Map<string, number>();
  for (let i = 0; i < pos.count; i++) {
    const key = `${pos.getX(i).toFixed(3)},${pos.getY(i).toFixed(3)},${pos.getZ(i).toFixed(3)}`;
    if (!jit.has(key)) jit.set(key, 0.82 + r() * 0.36);
    const k = jit.get(key)!;
    let y = pos.getY(i) * k;
    y = y < 0 ? 0 : y * 1.75;
    pos.setXYZ(i, pos.getX(i) * k, y, pos.getZ(i) * k);
  }
  const g = base.toNonIndexed();
  const p = g.getAttribute('position');
  const col = new Float32Array(p.count * 3);
  const cr = new THREE.Color(rock);
  const cs = new THREE.Color(snow);
  const tmp = new THREE.Color();
  for (let f = 0; f < p.count; f += 3) {
    const cy = (p.getY(f) + p.getY(f + 1) + p.getY(f + 2)) / 3;
    tmp.copy(cy > 1.12 ? cs : cr);
    if (cy <= 1.12) tmp.multiplyScalar(0.82 + ((f * 7) % 5) * 0.06);
    for (let k = 0; k < 3; k++) col.set([tmp.r, tmp.g, tmp.b], (f + k) * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.computeVertexNormals();
  return g;
}

export type PropKind =
  | 'pine'
  | 'cypress'
  | 'palm'
  | 'bush'
  | 'crystal'
  | 'stalk'
  | 'hay'
  | 'pod'
  | 'tuft'
  | 'drytuft'
  | 'sheep'
  | 'shroom'
  | 'block'
  | 'boulder'
  | 'mountain'
  | 'mineDoor'
  | 'arch'
  | 'crater';

/** Props that bend in the wind (vertex shader sway, scaled by height). */
export const SWAY: Partial<Record<PropKind, number>> = { pine: 0.05, cypress: 0.06, palm: 0.08, stalk: 0.12, tuft: 0.18, drytuft: 0.18, bush: 0.04 };
/** Props that glow in the alien theme. */
export const GLOW: Partial<Record<PropKind, boolean>> = { crystal: true, pod: true, shroom: true };

export function propGeometry(kind: PropKind, L: Look3D): THREE.BufferGeometry {
  const c = L.c;
  switch (kind) {
    case 'pine':
      return merge([
        part(new THREE.CylinderGeometry(0.018, 0.026, 0.09, 5), c.trunk, [0, 0.045, 0]),
        part(new THREE.ConeGeometry(0.11, 0.2, 7), c.leaf, [0, 0.16, 0]),
        part(new THREE.ConeGeometry(0.085, 0.17, 7), c.leaf, [0, 0.25, 0]),
        part(new THREE.ConeGeometry(0.055, 0.12, 7), c.leaf2, [0, 0.33, 0]),
      ]);
    case 'cypress':
      return merge([
        part(new THREE.CylinderGeometry(0.014, 0.02, 0.05, 5), c.trunk, [0, 0.025, 0]),
        part(new THREE.SphereGeometry(0.055, 7, 5), c.leaf2, [0, 0.1, 0], [0, 0, 0], [1, 1.3, 1]),
        part(new THREE.ConeGeometry(0.056, 0.36, 7), c.leaf2, [0, 0.27, 0]),
      ]);
    case 'palm': {
      const parts = [];
      let x = 0;
      for (let i = 0; i < 5; i++) {
        parts.push(part(new THREE.CylinderGeometry(0.016, 0.02, 0.075, 6), c.trunk, [x, 0.035 + i * 0.07, 0], [0, 0, -0.1 - i * 0.04]));
        x += 0.008 + i * 0.004;
      }
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        parts.push(part(new THREE.ConeGeometry(0.03, 0.2, 4), i % 2 ? c.leaf : c.leaf2, [x + Math.cos(a) * 0.08, 0.34, Math.sin(a) * 0.08], [Math.sin(a) * 1.25, 0, -Math.cos(a) * 1.25], [1, 1, 0.35]));
      }
      parts.push(part(new THREE.SphereGeometry(0.025, 6, 4), c.trunk, [x, 0.35, 0]));
      return merge(parts);
    }
    case 'bush':
      return merge([
        part(new THREE.IcosahedronGeometry(0.06, 0), c.leaf2, [0, 0.05, 0]),
        part(new THREE.IcosahedronGeometry(0.045, 0), c.leaf, [0.05, 0.04, 0.02]),
      ]);
    case 'crystal':
      return merge([
        part(new THREE.OctahedronGeometry(0.06, 0), c.leaf, [0, 0.17, 0], [0, 0, 0], [0.7, 3, 0.7]),
        part(new THREE.OctahedronGeometry(0.04, 0), c.leaf2, [0.05, 0.09, 0.02], [0, 0, 0.35], [0.7, 2.4, 0.7]),
        part(new THREE.OctahedronGeometry(0.035, 0), c.leaf2, [-0.045, 0.07, -0.02], [0.3, 0, -0.3], [0.7, 2.2, 0.7]),
      ]);
    case 'stalk':
      return merge([
        part(new THREE.CylinderGeometry(0.022, 0.016, 0.07, 6), c.dry, [0, 0.035, 0]),
        part(new THREE.ConeGeometry(0.03, 0.09, 6), c.grain, [0, 0.105, 0]),
        part(new THREE.ConeGeometry(0.02, 0.07, 5), c.grain, [0.018, 0.09, 0.01], [0, 0, -0.3]),
        part(new THREE.ConeGeometry(0.02, 0.07, 5), c.grain, [-0.017, 0.088, -0.008], [0.2, 0, 0.3]),
      ]);
    case 'hay':
      return merge([
        part(new THREE.CylinderGeometry(0.07, 0.085, 0.08, 9), c.dry, [0, 0.04, 0]),
        part(new THREE.ConeGeometry(0.075, 0.08, 9), c.grain, [0, 0.12, 0]),
      ]);
    case 'pod':
      return merge([
        part(new THREE.CylinderGeometry(0.006, 0.008, 0.09, 4), c.trunk, [0, 0.045, 0]),
        part(new THREE.SphereGeometry(0.03, 7, 5), c.grain, [0, 0.1, 0], [0, 0, 0], [1, 1.3, 1]),
      ]);
    case 'tuft':
    case 'drytuft': {
      const col = kind === 'tuft' ? c.grass : c.dry;
      return merge([
        part(new THREE.ConeGeometry(0.014, 0.08, 3), col, [0, 0.04, 0], [0, 0, 0.25]),
        part(new THREE.ConeGeometry(0.014, 0.07, 3), col, [0.015, 0.035, 0.01], [0.3, 0, -0.2]),
        part(new THREE.ConeGeometry(0.014, 0.06, 3), col, [-0.012, 0.03, -0.01], [-0.3, 0, 0.1]),
      ]);
    }
    case 'sheep':
      return merge([
        part(new THREE.IcosahedronGeometry(0.05, 1), c.wool, [0, 0.065, 0], [0, 0, 0], [1.35, 0.95, 1]),
        part(new THREE.BoxGeometry(0.035, 0.035, 0.03), c.woolFace, [0.07, 0.08, 0]),
        part(new THREE.BoxGeometry(0.012, 0.03, 0.012), c.woolFace, [0.035, 0.015, 0.025]),
        part(new THREE.BoxGeometry(0.012, 0.03, 0.012), c.woolFace, [0.035, 0.015, -0.025]),
        part(new THREE.BoxGeometry(0.012, 0.03, 0.012), c.woolFace, [-0.035, 0.015, 0.025]),
        part(new THREE.BoxGeometry(0.012, 0.03, 0.012), c.woolFace, [-0.035, 0.015, -0.025]),
      ]);
    case 'shroom':
      return merge([
        part(new THREE.CylinderGeometry(0.014, 0.02, 0.08, 6), c.woolFace, [0, 0.04, 0]),
        part(new THREE.SphereGeometry(0.055, 9, 5, 0, Math.PI * 2, 0, Math.PI / 2), c.wool, [0, 0.075, 0], [0, 0, 0], [1, 0.7, 1]),
      ]);
    case 'block':
      return merge([part(new THREE.BoxGeometry(0.1, 0.06, 0.07), c.stoneCut, [0, 0.03, 0])]);
    case 'boulder':
      return merge([
        part(new THREE.DodecahedronGeometry(0.1, 0), c.stone, [0, 0.05, 0], [0.3, 0.5, 0], [1.2, 0.85, 1]),
        part(new THREE.DodecahedronGeometry(0.07, 0), c.rock, [0.09, 0.03, 0.05], [0.8, 0.2, 0.4]),
      ]);
    case 'mountain':
      return mountain(c.rock, c.snow, 7);
    case 'mineDoor':
      return merge([
        part(new THREE.BoxGeometry(0.08, 0.07, 0.03), '#1a1410', [0, 0.035, 0]),
        part(new THREE.BoxGeometry(0.014, 0.085, 0.04), c.trunk, [-0.045, 0.042, 0]),
        part(new THREE.BoxGeometry(0.014, 0.085, 0.04), c.trunk, [0.045, 0.042, 0]),
        part(new THREE.BoxGeometry(0.11, 0.016, 0.04), c.trunk, [0, 0.088, 0]),
      ]);
    case 'arch':
      return merge([
        part(new THREE.BoxGeometry(0.04, 0.16, 0.05), c.ruin, [-0.07, 0.08, 0]),
        part(new THREE.BoxGeometry(0.04, 0.11, 0.05), c.ruin, [0.07, 0.055, 0]),
        part(new THREE.TorusGeometry(0.07, 0.022, 4, 8, Math.PI * 0.62), c.ruin, [0, 0.16, 0], [0, 0, 0.3]),
        part(new THREE.BoxGeometry(0.05, 0.03, 0.045), c.ruin, [0.12, 0.015, 0.05], [0, 0.6, 0]),
      ]);
    case 'crater':
      return merge([part(new THREE.TorusGeometry(0.08, 0.025, 5, 12), c.dry, [0, 0.005, 0], [Math.PI / 2, 0, 0], [1, 1, 0.5])]);
  }
}

export interface Placed {
  kind: PropKind;
  x: number;
  y: number;
  z: number;
  rot: number;
  s: number;
}

/** Positions inside a hex (local coords) that keep clear of the centre medallion and the corners/edges. */
function scatter(r: () => number, n: number, rMin: number, rMax: number, gap: number): [number, number][] {
  const out: [number, number][] = [];
  let tries = 0;
  while (out.length < n && tries++ < n * 30) {
    const a = r() * Math.PI * 2;
    const d = rMin + Math.sqrt(r()) * (rMax - rMin);
    const p: [number, number] = [Math.cos(a) * d, Math.sin(a) * d];
    if (out.every((q) => (q[0] - p[0]) ** 2 + (q[1] - p[1]) ** 2 > gap * gap)) out.push(p);
  }
  return out;
}

/** All decoration props for a board. `top(h)` is the tile top height. */
export function layoutProps(board: Board, L: Look3D, top: (h: Hex) => number, salt = 0): Placed[] {
  const out: Placed[] = [];
  for (const h of board.hexes) {
    const r = rng(h.id * 977 + 31 + salt);
    const y = top(h);
    const add = (kind: PropKind, lx: number, lz: number, s = 1, rot = r() * Math.PI * 2, dy = 0) =>
      out.push({ kind, x: h.x + lx, y: y + dy, z: h.y + lz, rot, s });
    const F = L.flora;
    switch (h.terrain) {
      case 'forest': {
        for (const [x, z] of scatter(r, 9, 0.4, 0.72, 0.17)) {
          const k: PropKind = F === 'alien' ? 'crystal' : F === 'tropic' ? (r() < 0.6 ? 'palm' : 'bush') : r() < 0.55 ? 'pine' : 'cypress';
          add(k, x, z, 0.85 + r() * 0.4);
        }
        break;
      }
      case 'field': {
        if (F === 'alien') {
          for (const [x, z] of scatter(r, 22, 0.38, 0.74, 0.09)) add('pod', x, z, 0.8 + r() * 0.5);
          break;
        }
        const a0 = r() * Math.PI;
        const ca = Math.cos(a0);
        const sa = Math.sin(a0);
        for (let i = -9; i <= 9; i++)
          for (let j = -12; j <= 12; j += 1) {
            const u = i * 0.11;
            const v = j * 0.072;
            const x = u * ca - v * sa;
            const z = u * sa + v * ca;
            const d = Math.hypot(x, z);
            if (d < 0.38 || d > 0.74) continue;
            add('stalk', x + (r() - 0.5) * 0.015, z + (r() - 0.5) * 0.015, 0.85 + r() * 0.3);
          }
        const [hx, hz] = scatter(r, 1, 0.55, 0.7, 0)[0] ?? [0.6, 0];
        add('hay', hx, hz, 1);
        break;
      }
      case 'pasture': {
        const pts = scatter(r, 13, 0.38, 0.74, 0.12);
        pts.forEach(([x, z], i) => {
          if (i < 4) add(F === 'alien' ? 'shroom' : 'sheep', x, z, F === 'alien' ? 0.9 + r() * 0.6 : 1.45);
          else add(F === 'alien' ? 'crater' : 'tuft', x, z, 0.9 + r() * 0.6);
        });
        break;
      }
      case 'quarry': {
        const a = r() * Math.PI * 2;
        add('boulder', Math.cos(a) * 0.55, Math.sin(a) * 0.55, 1.5);
        add('boulder', Math.cos(a + 0.6) * 0.6, Math.sin(a + 0.6) * 0.6, 1.1);
        const b = a + Math.PI * 0.9;
        for (let i = 0; i < 3; i++) {
          const bx = Math.cos(b + i * 0.32) * 0.56;
          const bz = Math.sin(b + i * 0.32) * 0.56;
          add('block', bx, bz, 1, b + i * 0.3);
          if (i !== 1) add('block', bx * 0.98, bz * 0.98, 0.9, b + i * 0.3 + 0.2, 0.06);
        }
        add('boulder', Math.cos(b + 1.9) * 0.6, Math.sin(b + 1.9) * 0.6, 0.7);
        break;
      }
      case 'mine': {
        const a = r() * Math.PI * 2;
        add('mountain', Math.cos(a) * 0.52, Math.sin(a) * 0.52, 0.34, r() * 6);
        add('mountain', Math.cos(a + 1.3) * 0.6, Math.sin(a + 1.3) * 0.6, 0.22, r() * 6);
        const d = a + Math.PI;
        add('mineDoor', Math.cos(d) * 0.55, Math.sin(d) * 0.55, 1, -d + Math.PI / 2);
        add('boulder', Math.cos(d + 0.7) * 0.6, Math.sin(d + 0.7) * 0.6, 0.6);
        break;
      }
      case 'barren': {
        const pts = scatter(r, 9, 0.38, 0.74, 0.13);
        pts.forEach(([x, z], i) => {
          if (i === 0) add(F === 'alien' ? 'crater' : 'arch', x, z, F === 'alien' ? 2 : 1.2);
          else if (i < 3) add(F === 'alien' ? 'crater' : 'boulder', x, z, 0.5 + r() * 0.4);
          else add('drytuft', x, z, 0.8 + r() * 0.6);
        });
        break;
      }
    }
  }
  return out;
}

/** Build InstancedMesh-ready matrices grouped by kind. */
export function groupProps(props: Placed[]): Map<PropKind, THREE.Matrix4[]> {
  const m = new Map<PropKind, THREE.Matrix4[]>();
  for (const p of props) {
    const mat = new THREE.Matrix4().compose(
      new THREE.Vector3(p.x, p.y, p.z),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(0, p.rot, 0)),
      new THREE.Vector3(p.s, p.s, p.s),
    );
    if (!m.has(p.kind)) m.set(p.kind, []);
    m.get(p.kind)!.push(mat);
  }
  return m;
}

/** MeshStandardMaterial with vertex colours and optional wind sway (instanced only). */
export function propMaterial(sway: number, glow: string | null): THREE.MeshStandardMaterial {
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.85, metalness: 0 });
  if (glow) {
    mat.emissive = new THREE.Color(glow);
    mat.emissiveIntensity = 0.55;
  }
  if (sway > 0) {
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uTime = TIME;
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nuniform float uTime;')
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
          #ifdef USE_INSTANCING
            vec3 iw = instanceMatrix[3].xyz;
            float ph = uTime * 1.3 + iw.x * 1.9 + iw.z * 1.3;
            float k = ${sway.toFixed(3)} * max(position.y, 0.0) * 4.0;
            transformed.x += sin(ph) * k;
            transformed.z += cos(ph * 0.8) * k * 0.6;
          #endif`,
        );
    };
    mat.customProgramCacheKey = () => `sway${sway}`;
  }
  return mat;
}
