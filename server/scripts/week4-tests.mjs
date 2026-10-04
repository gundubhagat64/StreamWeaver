import assert from 'node:assert/strict';

import 'dotenv/config';
import { MongoClient } from 'mongodb';

const backendOrigin =
  process.env.WEEK4_BACKEND_ORIGIN?.trim() ||
  `http://localhost:${process.env.PORT || 5000}`;
const apiBase = `${backendOrigin}/api`;

const mappings = [
  { sourceKey: 'employee_id', sourceIndex: 0, destinationField: 'employeeId' },
  { sourceKey: 'name', sourceIndex: 1, destinationField: 'name' },
  { sourceKey: 'department', sourceIndex: 2, destinationField: 'department' },
  { sourceKey: 'email', sourceIndex: 3, destinationField: 'email' },
  { sourceKey: 'salary', sourceIndex: 4, destinationField: 'salary' },
];

let passed = 0;
let failed = 0;
let upload;
let job;
let mongoClient;

async function test(name, fn) {
  try {
    await fn();
    passed += 1;
    console.log(`[PASS] ${name}`);
  } catch (error) {
    failed += 1;
    console.error(`[FAIL] ${name}`);
    console.error(`       ${error.message}`);
  }
}

async function jsonRequest(url, options = {}) {
  const response = await fetch(url, options);
  const body = await response.json();

  if (!response.ok) {
    throw new Error(
      `${body?.error?.code || response.status}: ${body?.message || 'Request failed'}`,
    );
  }

  return body.data ?? body;
}

function buildDataset() {
  const lines = [
    'employee_id,name,department,email,salary',
  ];

  for (let index = 1; index <= 5001; index += 1) {
    lines.push(
      `${index},Employee ${index},Engineering,employee${index}@example.com,${50000 + index}`,
    );
  }

  lines.push('broken,Only Two Columns');
  lines.push(',,,,');

  return `${lines.join('\n')}\n`;
}

async function waitForJob(jobId) {
  const deadline = Date.now() + 45000;

  while (Date.now() < deadline) {
    const current = await jsonRequest(`${apiBase}/jobs/${encodeURIComponent(jobId)}`);

    if (['completed', 'failed', 'cancelled'].includes(current.status)) {
      return current;
    }

    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  throw new Error('Week 4 job did not finish within 45 seconds.');
}

await test('Health API', async () => {
  const response = await fetch(`${apiBase}/health`);
  const body = await response.json();
  assert.equal(response.ok, true);
  assert.equal(body.success, true);
});

await test('Upload 5,003-row Week 4 dataset', async () => {
  const form = new FormData();
  form.append(
    'file',
    new Blob([buildDataset()], { type: 'text/csv' }),
    'week4-bulk-ingestion.csv',
  );

  upload = await jsonRequest(`${apiBase}/files/upload`, {
    method: 'POST',
    body: form,
  });

  assert.ok(upload.uploadId);
});

await test('Start MongoDB bulk-ingestion job', async () => {
  job = await jsonRequest(
    `${apiBase}/files/${encodeURIComponent(upload.uploadId)}/process`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mappings, transformations: [] }),
    },
  );

  assert.ok(job.jobId);
  job = await waitForJob(job.jobId);
  assert.equal(job.status, 'completed');
});

await test('Use bounded 5,000-row bulkWrite batches', async () => {
  assert.equal(job.rowsProcessed, 5003);
  assert.equal(job.insertedRows, 5001);
  assert.equal(job.successfulRows, 5001);
  assert.equal(job.failedRows, 2);
  assert.equal(job.batchesWritten, 2);
});

await test('Capture validation failures without stopping the job', async () => {
  assert.equal(job.failedRowSamples.length, 2);

  const codes = new Set(
    job.failedRowSamples.flatMap((sample) =>
      sample.errors.map((error) => error.code)),
  );

  assert.equal(codes.has('COLUMN_COUNT_MISMATCH'), true);
  assert.equal(codes.has('EMPTY_ROW'), true);
});

await test('Persist valid rows in MongoDB', async () => {
  assert.ok(process.env.MONGODB_URI, 'MONGODB_URI is missing.');

  mongoClient = new MongoClient(process.env.MONGODB_URI);
  await mongoClient.connect();

  const databaseName = process.env.MONGODB_DATABASE || 'streamweaver';
  const collectionName = process.env.MONGODB_COLLECTION || 'ingested_rows';
  const collection = mongoClient.db(databaseName).collection(collectionName);

  const count = await collection.countDocuments({
    '_streamweaver.jobId': job.jobId,
  });

  assert.equal(count, 5001);

  await collection.deleteMany({
    '_streamweaver.jobId': job.jobId,
  });
});

await test('Backend survives completed Week 4 job', async () => {
  const response = await fetch(`${apiBase}/health`);
  assert.equal(response.ok, true);
});

if (mongoClient) {
  await mongoClient.close();
}

console.log('');
console.log('==============================================');
console.log(' StreamWeaver Week 4 Bulk Ingestion Verification');
console.log('==============================================');
console.log(`Backend: ${backendOrigin}`);
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);
console.log('');

if (failed > 0) {
  process.exitCode = 1;
} else {
  console.log('WEEK 4 BULK INGESTION VERIFICATION PASSED.');
}
