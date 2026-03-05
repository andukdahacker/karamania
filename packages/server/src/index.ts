import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express, { type Express } from 'express';
import { Server as SocketIOServer } from 'socket.io';
import { config } from './config.js';
import { logger } from './logger.js';
import { healthHandler } from './health.js';

const app: Express = express();
const httpServer = createServer(app);
const io = new SocketIOServer(httpServer);

app.get('/health', healthHandler);

if (config.NODE_ENV === 'production') {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const clientDist = path.resolve(__dirname, '../../client/dist');
  app.use(express.static(clientDist));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

io.on('connection', (socket) => {
  logger.info({ socketId: socket.id }, 'Client connected');

  socket.on('disconnect', (reason) => {
    logger.info({ socketId: socket.id, reason }, 'Client disconnected');
  });
});

httpServer.listen(config.PORT, () => {
  logger.info({ port: config.PORT, env: config.NODE_ENV }, 'Server started');
});

process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  io.close();
  httpServer.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
  setTimeout(() => {
    logger.warn('Graceful shutdown timeout, forcing exit');
    process.exit(0);
  }, 5000);
});

export { app, httpServer, io };
