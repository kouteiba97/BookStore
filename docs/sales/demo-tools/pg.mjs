import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
const db = await PGlite.create('./pgdata');
const server = new PGLiteSocketServer({ db, port: 5433, host: '127.0.0.1', maxConnections: 30 });
await server.start();
console.log('PG READY on 5433');
const stop = async () => { await server.stop(); await db.close(); process.exit(0); };
process.on('SIGINT', stop); process.on('SIGTERM', stop);
