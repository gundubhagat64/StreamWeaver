import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// Define the upload directory path based on the server root
const serverRoot = fileURLToPath(
  new URL('../../', import.meta.url),
);

// Define the upload directory path based on the server root
export const uploadDirectory = path.join(
  serverRoot,
  'temp',
  'uploads',
);

// Ensure the upload directory exists, creating it if necessary
export async function ensureUploadDirectory() {
  await mkdir(uploadDirectory, {
    recursive: true,
  });
}