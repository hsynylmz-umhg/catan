// Test bot: joins a room and plays simple legal moves. For local testing only.
// Usage: npx tsx scripts/bot.ts <ROOM_CODE> [name] [ws-url]
import {
  bagTotal,
  canAfford,
  HAND_LIMIT,
  RESOURCES,
  validBanditHexes,
  validOutpostVertices,
  validRoadEdges,
  validUpgradeVertices,
  type Action,
  type PlayerView,
  type ResourceBag,
  type ServerMsg,
} from '@kervan/shared';

const [code, name = 'Bot', url = 'ws://localhost:3000/ws'] = process.argv.slice(2);
if (!code) {
  console.error('usage: npx tsx scripts/bot.ts <ROOM_CODE> [name] [ws-url]');
  process.exit(1);
}

const ws = new WebSocket(url);
let token: string | null = null;
let lastKey = '';
const send = (m: unknown) => ws.send(JSON.stringify(m));
const act = (action: Action) => {
  console.log('->', JSON.stringify(action));
  send({ t: 'action', action });
};
const pick = <T>(xs: T[]): T => xs[Math.floor(Math.random() * xs.length)];

function discardFor(bag: ResourceBag): ResourceBag {
  const out = { timber: 0, stone: 0, grain: 0, fiber: 0, ore: 0 } as ResourceBag;
  let need = bagTotal(bag) - HAND_LIMIT;
  const left = { ...bag };
  while (need > 0) {
    const r = RESOURCES.reduce((a, b) => (left[a] >= left[b] ? a : b));
    left[r]--;
    out[r]++;
    need--;
  }
  return out;
}

function play(v: PlayerView) {
  const me = v.you;
  if (me === null || v.phase === 'finished') return;
  const mine = v.players[me];

  // Answer trade offers from others.
  if (v.trade && v.trade.from !== me && v.trade.responses[me] === undefined) {
    const ok = RESOURCES.every((r) => (mine.resources?.[r] ?? 0) >= v.trade!.want[r]);
    act({ type: 'respondTrade', accept: ok });
    return;
  }
  if (v.current !== me) return;

  const key = JSON.stringify([v.phase, v.step, v.setup, v.turn, mine.resourceCount, Object.keys(v.roads).length, Object.keys(v.buildings).length]);
  if (key === lastKey) return; // avoid repeating the same move on duplicate states
  lastKey = key;

  setTimeout(() => {
    if (v.phase === 'setup') {
      if (v.setup!.expecting === 'outpost') act({ type: 'buildOutpost', vertex: pick(validOutpostVertices(v, me)) });
      else act({ type: 'buildRoad', edge: pick(validRoadEdges(v, me)) });
      return;
    }
    switch (v.step) {
      case 'roll':
        return act({ type: 'roll' });
      case 'sevenChoice':
        return act({ type: 'sevenChoice', choice: 'bandit' });
      case 'moveBandit':
        return act({ type: 'moveBandit', hex: pick(validBanditHexes(v)) });
      case 'steal':
        return act({ type: 'steal', victim: pick(v.stealCandidates) });
    }
    const up = validUpgradeVertices(v, me);
    if (up.length && canAfford(v, me, 'keep')) return act({ type: 'upgrade', vertex: up[0], to: 'keep' });
    const op = validOutpostVertices(v, me);
    if (op.length && canAfford(v, me, 'outpost')) return act({ type: 'buildOutpost', vertex: pick(op) });
    const rd = validRoadEdges(v, me);
    if (rd.length && canAfford(v, me, 'road') && mine.resourceCount > 4) return act({ type: 'buildRoad', edge: pick(rd) });
    const bag = mine.resources!;
    act(bagTotal(bag) > HAND_LIMIT ? { type: 'endTurn', discard: discardFor(bag) } : { type: 'endTurn' });
  }, 600);
}

ws.onopen = () => send({ t: 'join', code, name });
ws.onmessage = (e) => {
  const m = JSON.parse(String(e.data)) as ServerMsg;
  if (m.t === 'joined') {
    if (token === null) console.log(`joined ${m.code} as seat ${m.seat}`);
    token = m.token;
    lastKey = '';
    if (m.view) play(m.view);
  } else if (m.t === 'state') {
    for (const ev of m.events) if (ev.type === 'gameWon') console.log('game won by seat', ev.seat);
    play(m.view);
  } else if (m.t === 'error') {
    console.log('error:', m.code);
    lastKey = '';
  }
};
ws.onclose = () => {
  console.log('disconnected');
  process.exit(0);
};
