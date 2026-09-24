import dotenv from 'dotenv';

dotenv.config();

function readInteger(name, fallback, minimum = 1) {
  const rawValue = process.env[name] ?? String(fallback);
  const value = Number.parseInt(rawValue, 10);

  if (!Number.isSafeInteger(value) || value < minimum) {
    throw new Error(
      `${name} must be a safe integer greater than or equal to ${minimum}.`,
    );
  }

  return value;
}

const clientOrigin =
  process.env.CLIENT_ORIGIN?.trim() ||
  'http://localhost:5173';

const env = Object.freeze({
  nodeEnv: process.env.NODE_ENV?.trim() || 'development',

  port: readInteger('PORT', 5000),

  clientOrigin,

  maxUploadBytes: readInteger(
    'MAX_UPLOAD_BYTES',
    536870912,
  ),

  uploadTtlMinutes: readInteger(
    'UPLOAD_TTL_MINUTES',
    60,
  ),

  uploadCleanupIntervalMinutes: readInteger(
    'UPLOAD_CLEANUP_INTERVAL_MINUTES',
    10,
  ),

  mongodbUri: process.env.MONGODB_URI?.trim() || '',

  mongodbDatabase:
    process.env.MONGODB_DATABASE?.trim() || 'streamweaver',

  mongodbBatchSize: readInteger(
    'MONGODB_BATCH_SIZE',
    5000,
  ),

  mongodbCollection:
    process.env.MONGODB_COLLECTION?.trim() || 'ingested_rows',
});

export default env;
