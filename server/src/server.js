import { createServer } from 'node:http';
import fs from 'node:fs';

import app from './app.js';
import env from './config/env.js';
import { closeMongoDB } from './config/mongodb.js';

import {
  initializeUploadLifecycle,
} from './services/uploadCleanupService.js';

import {
  closeSocketServer,
  initializeSocketServer,
} from './sockets/socketServer.js';

process.title = 'streamweaver-backend';

const pkg = JSON.parse(
  fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
);

const stopUploadLifecycle =
  await initializeUploadLifecycle();

const server = createServer(app);

initializeSocketServer(
  server,
  env.clientOrigin,
);

server.listen(
  env.port,
  () => {
    console.log('');
    console.log(
      '======================================',
    );

    console.log(
      ' StreamWeaver Backend',
    );

    console.log(
      '======================================',
    );

    console.log(
      `Environment : ${env.nodeEnv}`,
    );

    console.log(
      `Server      : http://localhost:${env.port}`,
    );

    console.log(
      `Health API  : http://localhost:${env.port}/api/health`,
    );

    console.log(
      `Upload API  : http://localhost:${env.port}/api/files/upload`,
    );

    console.log(
      `WebSocket   : ws://localhost:${env.port}`,
    );

    console.log(
      `Version     : ${pkg.version}`,
    );

    console.log(
      `Max Upload  : ${env.maxUploadBytes} bytes`,
    );

    console.log(
      `Mongo Batch : ${env.mongodbBatchSize} rows`,
    );

    console.log(
      '======================================',
    );

    console.log('');
  },
);

server.on(
  'error',
  (error) => {
    console.error(
      'Server startup error:',
      error,
    );
  },
);

let shuttingDown = false;

async function shutdown(signal) {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;

  console.log(
    `\n${signal} received. Closing server...`,
  );

  stopUploadLifecycle();

  try {
    await closeSocketServer();
  } catch (error) {
    console.error(
      'Failed to close Socket.IO cleanly:',
      error,
    );
  }

  try {
    await closeMongoDB();
  } catch (error) {
    console.error(
      'Failed to close MongoDB cleanly:',
      error,
    );
  }

  if (!server.listening) {
    console.log(
      'StreamWeaver backend stopped.',
    );
    process.exit(0);
  }

  server.close((error) => {
    if (error) {
      console.error(
        'Failed to close server cleanly:',
        error,
      );

      process.exit(1);
    }

    console.log(
      'StreamWeaver backend stopped.',
    );

    process.exit(0);
  });
}

process.on(
  'SIGINT',
  () => void shutdown('SIGINT'),
);

process.on(
  'SIGTERM',
  () => void shutdown('SIGTERM'),
);

process.on(
  'unhandledRejection',
  (reason) => {
    console.error(
      'Unhandled promise rejection:',
      reason,
    );
  },
);
