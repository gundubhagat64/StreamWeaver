import { Server } from 'socket.io';

let io = null;

export function initializeSocketServer(httpServer, clientOrigin) {
  io = new Server(httpServer, {
    cors: {
      origin: clientOrigin,
      methods: ['GET', 'POST'],
    },
  });

  io.on('connection', (socket) => {
    socket.on('job:subscribe', (jobId) => {
      if (typeof jobId !== 'string' || !jobId.trim()) {
        return;
      }

      socket.join(`job:${jobId}`);
    });

    socket.on('job:unsubscribe', (jobId) => {
      if (typeof jobId !== 'string' || !jobId.trim()) {
        return;
      }

      socket.leave(`job:${jobId}`);
    });
  });

  return io;
}

export function emitJobEvent(jobId, eventName, payload) {
  if (!io) {
    return;
  }

  io.to(`job:${jobId}`).emit(eventName, payload);
}

export function closeSocketServer() {
  return new Promise((resolve) => {
    if (!io) {
      resolve();
      return;
    }

    io.close(() => {
      io = null;
      resolve();
    });
  });
}
