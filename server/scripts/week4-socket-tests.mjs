
import assert from 'node:assert/strict';
import { io } from 'socket.io-client';

const origin = process.env.WEEK4_BACKEND_ORIGIN || 'http://localhost:5000';
const api = `${origin}/api`;

const mappings = [
  { sourceKey: 'name', sourceIndex: 0, destinationField: 'name' },
];

const socket = io(origin, { autoConnect: false, reconnection: false });
const events = new Set();

async function request(url, options) {
  const response = await fetch(url, options);
  const body = await response.json();

  if (!response.ok) {
    throw new Error(body.message || `HTTP ${response.status}`);
  }

  return body.data ?? body;
}

try {
  await new Promise((resolve, reject) => {
    socket.once('connect', resolve);
    socket.once('connect_error', reject);
    socket.connect();
  });
  console.log('[PASS] Socket.IO client connects');

  const form = new FormData();
  form.append(
    'file',
    new Blob(['name\nAlice\nBob\nCharlie\n'], { type: 'text/csv' }),
    'socket-week4-test.csv',
  );

  const upload = await request(`${api}/files/upload`, {
    method: 'POST',
    body: form,
  });
  assert.ok(upload.uploadId);

  // Start listening before starting the job.
  const eventNames = ['job:started', 'job:progress', 'job:completed', 'job:failed'];
  for (const name of eventNames) {
    socket.on(name, (payload) => {
      if (payload?.jobId) events.add(name);
    });
  }

  const job = await request(
    `${api}/files/${encodeURIComponent(upload.uploadId)}/process`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mappings, transformations: [] }),
    },
  );
  assert.ok(job.jobId);

  socket.emit('job:subscribe', job.jobId);

  const deadline = Date.now() + 45000;
  let status = 'queued';

  while (Date.now() < deadline) {
    const current = await request(`${api}/jobs/${encodeURIComponent(job.jobId)}`);
    status = current.status;

    if (['completed', 'failed', 'cancelled'].includes(status)) break;
    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  assert.equal(status, 'completed', `Job ended with status: ${status}`);
  console.log('[PASS] Processing job completed');

  console.log('Events received:', [...events].join(', ') || '(none)');
  assert.ok(events.has('job:completed'), 'Did not receive job:completed');
  console.log('[PASS] Received job:completed event');
} catch (error) {
  console.error('[FAIL]', error.message);
  process.exitCode = 1;
} finally {
  socket.disconnect();
}