// Kervan Yolu server entry. Env: PORT (3000), DATA_DIR (./data), CLIENT_DIST (auto: apps/client/dist).
import { startServer } from './app';

const port = Number.parseInt(process.env.PORT ?? '', 10);

startServer({ port: Number.isFinite(port) ? port : 3000 })
  .then((server) => {
    const stop = () => {
      server.close().then(() => process.exit(0));
      setTimeout(() => process.exit(0), 2000).unref();
    };
    process.on('SIGINT', stop);
    process.on('SIGTERM', stop);
  })
  .catch((e) => {
    console.error(`${new Date().toISOString()} failed to start: ${e?.stack ?? e}`);
    process.exit(1);
  });
