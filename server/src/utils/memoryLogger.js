import env from '../config/env.js';

function toMiB(bytes) {
  return (bytes / 1024 / 1024).toFixed(2);
}

export function logMemoryUsage(label) {
  if (env.nodeEnv !== 'development') {
    return;
  }

  const memory = process.memoryUsage();

  console.log(
    `[Memory] ${label} | ` +
      `rss=${toMiB(memory.rss)}MB ` +
      `heapTotal=${toMiB(memory.heapTotal)}MB ` +
      `heapUsed=${toMiB(memory.heapUsed)}MB ` +
      `external=${toMiB(memory.external)}MB`,
  );
}