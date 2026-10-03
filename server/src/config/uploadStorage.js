import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const serverRoot = fileURLToPath(
  new URL('../../', import.meta.url),
);

export const uploadDirectory = path.join(
  serverRoot,
  'temp',
  'uploads',
);

export async function ensureUploadDirectory() {
  await mkdir(uploadDirectory, {
    recursive: true,
  });
}