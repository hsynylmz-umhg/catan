// Tiny WebAudio blips — no audio files.
let ctx: AudioContext | null = null;
let muted = false;

export function setMuted(m: boolean): void {
  muted = m;
}

function tone(freq: number, at: number, dur: number, type: OscillatorType = 'triangle', gain = 0.06): void {
  if (!ctx) return;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.value = freq;
  const t0 = ctx.currentTime + at;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(ctx.destination);
  o.start(t0);
  o.stop(t0 + dur + 0.02);
}

export type Blip = 'dice' | 'build' | 'turn' | 'error' | 'chat' | 'trade' | 'win';

export function blip(kind: Blip): void {
  if (muted) return;
  try {
    ctx ??= new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    if (ctx.state === 'suspended') void ctx.resume();
    switch (kind) {
      case 'dice':
        for (let i = 0; i < 5; i++) tone(220 + Math.random() * 260, i * 0.05, 0.05, 'square', 0.03);
        break;
      case 'build':
        tone(196, 0, 0.09, 'square', 0.04);
        tone(294, 0.07, 0.12);
        break;
      case 'turn':
        tone(523, 0, 0.12);
        tone(784, 0.11, 0.2);
        break;
      case 'error':
        tone(150, 0, 0.18, 'sawtooth', 0.04);
        break;
      case 'chat':
        tone(880, 0, 0.07, 'sine', 0.04);
        break;
      case 'trade':
        tone(440, 0, 0.08);
        tone(554, 0.08, 0.1);
        break;
      case 'win':
        [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.13, 0.25));
        break;
    }
  } catch {
    /* audio unavailable */
  }
}
