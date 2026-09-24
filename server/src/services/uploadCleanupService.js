 import {
  readdir,
  rm,
  stat,
} from 'node:fs/promises';

import path from 'node:path';

import env from '../config/env.js';

import {
  ensureUploadDirectory,
  uploadDirectory,
} from '../config/uploadStorage.js';

import {
  getAllUploads,
  removeUpload,
} from './uploadRegistry.js';

const ACTIVE_STATUSES = new Set([
  'previewing',
  'processing',
]);

async function removeFileSafely(filePath) {
  try {
    await rm(filePath, {
      force: true,
    });
  } catch (error) {
    console.error(
      '[Upload Cleanup] Unable to remove file:',
      error.message,
    );
  }
}

async function cleanupExpiredRegisteredUploads() {
  const now = Date.now();

  for (const upload of getAllUploads()) {
    if (ACTIVE_STATUSES.has(upload.status)) {
      continue;
    }

    if (upload.expiresAtMs > now) {
      continue;
    }

    await removeFileSafely(upload.filePath);

    removeUpload(upload.uploadId);

    console.log(
      `[Upload Cleanup] Removed expired upload ${upload.uploadId}`,
    );
  }
}

async function cleanupOrphanedFiles() {
  await ensureUploadDirectory();

  const entries = await readdir(uploadDirectory, {
    withFileTypes: true,
  });

  const expirationMs =
    env.uploadTtlMinutes * 60 * 1000;

  const now = Date.now();

  for (const entry of entries) {
    if (!entry.isFile()) {
      continue;
    }

    const extension = path
      .extname(entry.name)
      .toLowerCase();

    if (
      extension !== '.csv' &&
      extension !== '.part'
    ) {
      continue;
    }

    const filePath = path.join(
      uploadDirectory,
      entry.name,
    );

    try {
      const fileStats = await stat(filePath);

      const age =
        now - fileStats.mtimeMs;

      if (age > expirationMs) {
        await removeFileSafely(filePath);

        console.log(
          `[Upload Cleanup] Removed orphaned file ${entry.name}`,
        );
      }
    } catch (error) {
      console.error(
        '[Upload Cleanup] Unable to inspect file:',
        error.message,
      );
    }
  }
}

export async function initializeUploadLifecycle() {
  await ensureUploadDirectory();

  await cleanupOrphanedFiles();

  const intervalMs =
    env.uploadCleanupIntervalMinutes *
    60 *
    1000;

  const timer = setInterval(async () => {
    try {
      await cleanupExpiredRegisteredUploads();
      await cleanupOrphanedFiles();
    } catch (error) {
      console.error(
        '[Upload Cleanup] Cleanup cycle failed:',
        error,
      );
    }
  }, intervalMs);

  timer.unref();

  console.log(
    `[Upload Cleanup] Temporary uploads expire after ${env.uploadTtlMinutes} minutes.`,
  );

  return function stopUploadLifecycle() {
    clearInterval(timer);
  };
}