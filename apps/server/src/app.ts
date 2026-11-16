// HTTP + WebSocket server assembly. index.ts boots it; tests start it on an ephemeral port.
import { existsSync } from 'node:fs';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { Store } from './db';
import { RoomManager, type Engine } from './rooms';
import { attachWs } from './ws';

export interface ServerOptions {
  port?: number;
  dataDir?: string;
  /** Folder with the built client (index.html). Auto-detected when omitted. */
  clientDist?: string;
  engine?: Engine;
  quiet?: boolean;
}

export interface RunningServer {
  port: number;
  manager: RoomManager;
  close(): Promise<void>;
}

const SWEEP_MS = 60_000;

/** apps/client/dist, found from both apps/server/src (tsx) and apps/server/dist (bundle), or from the cwd. */
function findClientDist(override?: string): string | null {
  const candidates = override
    ? [resolve(override)]
    : [
        fileURLToPath(new URL('../../client/dist', import.meta.url)),
        resolve('apps/client/dist'),
        resolve('../client/dist'),
      ];
  return candidates.find((dir) => existsSync(join(dir, 'index.html'))) ?? null;
}

export function startServer(opts: ServerOptions = {}): Promise<RunningServer> {
  const log = opts.quiet ? () => {} : (line: string) => console.log(`${new Date().toISOString()} ${line}`);
  const store = new Store(opts.dataDir ?? process.env.DATA_DIR ?? './data');
  const manager = new RoomManager(store, { engine: opts.engine, log });

  const app = express();
  app.disable('x-powered-by');

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });
  app.get('/api/rooms/:code', (req, res) => {
    const summary = manager.summary(req.params.code);
    if (!summary) res.status(404).json({ error: 'roomNotFound' });
    else res.json(summary);
  });
  app.get('/api/history', (req, res) => {
    const n = Number.parseInt(String(req.query.limit ?? ''), 10);
    res.json(manager.history(Number.isFinite(n) ? Math.min(Math.max(n, 1), 100) : 20));
  });
  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'notFound' });
  });

  const clientDist = findClientDist(opts.clientDist ?? process.env.CLIENT_DIST);
  if (clientDist) {
    app.use(express.static(clientDist));
    app.get('*', (req, res, next) => {
      if (req.path === '/ws' || req.path.startsWith('/ws/')) return next();
      res.sendFile(join(clientDist, 'index.html'));
    });
  } else {
    app.get('/', (_req, res) => {
      res.type('text/plain').send('Kervan Yolu server is running. Client build not found (run: npm run build).');
    });
  }
  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    log(`http error: ${(err as Error)?.stack ?? err}`);
    res.status(500).json({ error: 'internal' });
  });

  const server = createServer(app);
  const ws = attachWs(server, manager, log);
  const sweeper = setInterval(() => {
    try {
      manager.sweep();
    } catch (e) {
      log(`sweep error: ${(e as Error)?.stack ?? e}`);
    }
  }, SWEEP_MS);
  sweeper.unref();
  manager.sweep();

  return new Promise((ok, fail) => {
    server.once('error', fail);
    server.listen(opts.port ?? 3000, () => {
      const port = (server.address() as AddressInfo).port;
      log(`listening on http://localhost:${port} (db: ${store.file}, client: ${clientDist ?? 'not built'})`);
      ok({
        port,
        manager,
        close: () =>
          new Promise<void>((done) => {
            clearInterval(sweeper);
            ws.close();
            server.close(() => {
              store.close();
              done();
            });
            server.closeAllConnections();
          }),
      });
    });
  });
}
