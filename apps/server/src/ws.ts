// WebSocket transport: JSON text frames on /ws, mapped onto RoomManager clients.
import type { Server } from 'node:http';
import { WebSocket, WebSocketServer } from 'ws';
import type { ServerMsg } from '@kervan/shared';
import type { Client, RoomManager } from './rooms';

const HEARTBEAT_MS = 30_000;
/** Close code sent to a socket whose seat was taken over by a newer connection (client should NOT auto-reconnect). */
export const CLOSE_REPLACED = 4000;

export function attachWs(server: Server, manager: RoomManager, log: (line: string) => void): { close(): void } {
  const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 64 * 1024 });
  const alive = new WeakMap<WebSocket, boolean>();

  wss.on('connection', (ws) => {
    alive.set(ws, true);
    const client: Client = {
      send(msg: ServerMsg) {
        if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
      },
      close() {
        ws.close(CLOSE_REPLACED, 'replaced');
      },
    };
    ws.on('pong', () => alive.set(ws, true));
    ws.on('message', (data, isBinary) => {
      let msg: unknown;
      try {
        if (isBinary) throw new Error('binary frame');
        msg = JSON.parse(data.toString());
      } catch {
        return client.send({ t: 'error', code: 'badRequest' });
      }
      manager.handle(client, msg);
    });
    ws.on('close', () => manager.disconnect(client));
    ws.on('error', (e) => log(`ws error: ${e.message}`));
  });
  wss.on('error', (e) => log(`wss error: ${e.message}`));

  const timer = setInterval(() => {
    for (const ws of wss.clients) {
      if (!alive.get(ws)) {
        ws.terminate();
        continue;
      }
      alive.set(ws, false);
      ws.ping();
    }
  }, HEARTBEAT_MS);
  timer.unref();

  return {
    close() {
      clearInterval(timer);
      for (const ws of wss.clients) ws.terminate();
      wss.close();
    },
  };
}
