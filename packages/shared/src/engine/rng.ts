// mulberry32 PRNG. The state is a single uint32 that lives in GameState.rng (plain JSON number).

/** Mutable cursor over a PRNG state. Create with `{ s: state.rng }`, write `s` back when done. */
export interface Rng {
  s: number;
}

/** Normalise any numeric seed to a uint32 PRNG state. */
export function seedToState(seed: number): number {
  return Number.isFinite(seed) ? Math.floor(seed) >>> 0 : 0;
}

/** Next float in [0, 1). Advances the cursor. */
export function nextFloat(r: Rng): number {
  r.s = (r.s + 0x6d2b79f5) >>> 0;
  let t = r.s;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** Next integer in [0, n). */
export function nextInt(r: Rng, n: number): number {
  return Math.floor(nextFloat(r) * n);
}

/** Fisher-Yates shuffle; returns a new array. */
export function shuffle<T>(r: Rng, items: readonly T[]): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = nextInt(r, i + 1);
    const tmp = out[i]!;
    out[i] = out[j]!;
    out[j] = tmp;
  }
  return out;
}
