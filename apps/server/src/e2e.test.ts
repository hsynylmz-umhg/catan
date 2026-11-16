// Integration: real HTTP + WebSocket server on an ephemeral port, real engine.
// Skips itself while the shared engine is still a stub.
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { WebSocket } from 'ws';
import { createGame, validOutpostVertices, validRoadEdges } from '@kervan/shared';
import type { ClientMsg, PlayerView, ServerMsg } from '@kervan/shared';
import { startServer, type RunningServer } from './app';

function engineReady(): boolean {
  try {
    createGame({ mapSize: 'standard', targetPoints: 10, seed: 1 }, [
      { name: 'a', color: '#c0392b' },
      { name: 'b', color: '#2471a3' },
    ]);
    return true;
  } catch (e) {
    if (String((e as Error)?.message).includes('not implemented')) return false;
    throw e;
  }
}

/** Tiny test client: queues incoming messages and lets a test await the next one of a type. */
class Conn {
  private queue: ServerMsg[] = [];
  private waiters: (() => void)[] = [];
  private constructor(readonly ws: WebSocket) {
    ws.on('message', (data) => {
      this.queue.push(JSON.parse(data.toString()));
      this.waiters.splice(0).forEach((w) => w());
    });
  }
  static open(port: number): Promise<Conn> {
    return new Promise((ok, fail) => {
      const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);
      const conn = new Conn(ws);
      ws.once('open', () => ok(conn));
      ws.once('error', fail);
    });
  }
  send(msg: ClientMsg): void {
    this.ws.send(JSON.stringify(msg));
  }
  raw(text: string): void {
    this.ws.send(text);
  }
  async next<T extends ServerMsg['t']>(t: T, timeoutMs = 3000): Promise<Extract<ServerMsg, { t: T }>> {
    const deadline = Date.now() + timeoutMs;
    for (;;) {
      const i = this.queue.findIndex((m) => m.t === t);
      if (i >= 0) return this.queue.splice(i, 1)[0] as Extract<ServerMsg, { t: T }>;
      const left = deadline - Date.now();
      if (left <= 0) throw new Error(`timeout waiting for "${t}"; queued: ${JSON.stringify(this.queue).slice(0, 400)}`);
      await new Promise<void>((ok) => {
        const timer = setTimeout(ok, left);
        this.waiters.push(() => {
          clearTimeout(timer);
          ok();
        });
      });
    }
  }
  close(): void {
    this.ws.close();
  }
}

let dir: string;
let server: RunningServer;

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'kervan-e2e-'));
  server = await startServer({ port: 0, dataDir: dir, quiet: true, clientDist: join(dir, 'no-client') });
});
afterAll(async () => {
  await server.close();
  rmSync(dir, { recursive: true, force: true });
});

describe('http + ws transport', () => {
  it('serves health, history and 404s', async () => {
    const base = `http://127.0.0.1:${server.port}`;
    expect(await (await fetch(`${base}/api/health`)).json()).toEqual({ ok: true });
    expect(await (await fetch(`${base}/api/history?limit=5`)).json()).toEqual([]);
    expect((await fetch(`${base}/api/rooms/ZZZZZ`)).status).toBe(404);
  });

  it('survives garbage, answers ping, exposes the room over REST', async () => {
    const a = await Conn.open(server.port);
    a.raw('{not json');
    expect((await a.next('error')).code).toBe('badRequest');
    a.raw('[1,2,3]');
    expect((await a.next('error')).code).toBe('badRequest');
    a.send({ t: 'ping' });
    await a.next('pong');
    a.send({ t: 'create', name: 'Ada' });
    const joined = await a.next('joined');
    const summary = await (await fetch(`http://127.0.0.1:${server.port}/api/rooms/${joined.code}`)).json();
    expect(summary).toMatchObject({ code: joined.code, status: 'lobby', players: ['Ada'], turn: 0 });

    // a second socket resuming the seat replaces the first one
    const b = await Conn.open(server.port);
    const closed = new Promise<number>((ok) => a.ws.once('close', (code) => ok(code)));
    b.send({ t: 'resume', code: joined.code, token: joined.token });
    expect((await b.next('joined')).seat).toBe(0);
    expect(await closed).toBe(4000);
    b.close();
  });
});

describe.skipIf(!engineReady())('real engine over websockets', () => {
  it('plays the first setup placements and resumes with the same state', async () => {
    const a = await Conn.open(server.port);
    const b = await Conn.open(server.port);
    a.send({ t: 'create', name: 'Ada' });
    const ja = await a.next('joined');
    b.send({ t: 'join', code: ja.code, name: 'Bora' });
    const jb = await b.next('joined');
    expect(jb.seat).toBe(1);

    a.send({ t: 'start' });
    const conns = [a, b];
    const views: PlayerView[] = [(await a.next('joined')).view!, (await b.next('joined')).view!];
    expect(views[0]).toMatchObject({ phase: 'setup', you: 0 });
    expect(views[1].you).toBe(1);
    expect(views[1].players[0].resources).toBeNull(); // redacted view

    // out-of-turn action is rejected by the engine and forwarded verbatim
    const other = 1 - views[0].current;
    conns[other].send({ t: 'action', action: { type: 'buildOutpost', vertex: validOutpostVertices(views[other], views[0].current)[0] } });
    expect((await conns[other].next('error')).code).toBe('notYourTurn');

    // first two placements (outpost + road) of the snake draft
    let events = 0;
    for (let i = 0; i < 2; i++) {
      const seat = views[0].current;
      const me = conns[seat];
      me.send({ t: 'action', action: { type: 'buildOutpost', vertex: validOutpostVertices(views[seat], seat)[0] } });
      for (const s of [0, 1]) {
        const st = await conns[s].next('state');
        views[s] = st.view;
        if (s === 0) events += st.events.length;
      }
      me.send({ t: 'action', action: { type: 'buildRoad', edge: validRoadEdges(views[seat], seat)[0] } });
      for (const s of [0, 1]) {
        const st = await conns[s].next('state');
        views[s] = st.view;
        if (s === 0) events += st.events.length;
      }
    }
    expect(Object.keys(views[0].buildings)).toHaveLength(2);
    expect(Object.keys(views[0].roads)).toHaveLength(2);
    expect(events).toBeGreaterThanOrEqual(4);

    // reconnect: same view and the log history
    b.close();
    const b2 = await Conn.open(server.port);
    b2.send({ t: 'resume', code: ja.code, token: jb.token });
    const again = await b2.next('joined');
    expect(again.seat).toBe(1);
    expect(again.view).toEqual(views[1]);
    expect(again.log).toHaveLength(events);
    a.close();
    b2.close();
  });
});
