 import {
  createWriteStream,
} from 'node:fs';

import {
  open,
  rename,
  rm,
} from 'node:fs/promises';

import {
  pipeline,
} from 'node:stream/promises';

import {
  randomUUID,
} from 'node:crypto';

import path from 'node:path';
import busboy from 'busboy';

import env from '../config/env.js';

import {
  ensureUploadDirectory,
  uploadDirectory,
} from '../config/uploadStorage.js';

import {
  createHttpError,
} from '../utils/httpError.js';

import {
  registerUpload,
  toPublicUpload,
} from './uploadRegistry.js';

const ALLOWED_MIME_TYPES =
  new Set([
    'text/csv',
    'application/csv',
    'application/vnd.ms-excel',
    'text/plain',
    'application/octet-stream',
  ]);

function getSafeOriginalFileName(
  filename,
) {
  return path.basename(
    String(
      filename ||
        'dataset.csv',
    ),
  );
}

function validateFileInformation(
  filename,
  mimeType,
) {
  const extension =
    path
      .extname(filename)
      .toLowerCase();

  if (extension !== '.csv') {
    throw createHttpError(
      415,
      'UNSUPPORTED_FILE_EXTENSION',
      'Only CSV files are supported during Week 1.',
    );
  }

  const normalizedMimeType =
    String(
      mimeType || '',
    ).toLowerCase();

  if (
    !ALLOWED_MIME_TYPES.has(
      normalizedMimeType,
    )
  ) {
    throw createHttpError(
      415,
      'UNSUPPORTED_FILE_TYPE',
      'The uploaded file does not have a supported CSV content type.',
    );
  }
}

async function verifyTextLikeContent(
  filePath,
) {
  const handle =
    await open(
      filePath,
      'r',
    );

  try {
    const sampleBuffer =
      Buffer.alloc(8192);

    const {
      bytesRead,
    } = await handle.read(
      sampleBuffer,
      0,
      sampleBuffer.length,
      0,
    );

    if (bytesRead === 0) {
      throw createHttpError(
        400,
        'EMPTY_FILE',
        'The uploaded CSV file is empty.',
      );
    }

    const sample =
      sampleBuffer.subarray(
        0,
        bytesRead,
      );

    if (sample.includes(0)) {
      throw createHttpError(
        415,
        'INVALID_CSV_CONTENT',
        'The uploaded file appears to contain binary data rather than CSV text.',
      );
    }
  } finally {
    await handle.close();
  }
}

async function removeSafely(
  filePath,
) {
  if (!filePath) {
    return;
  }

  try {
    await rm(
      filePath,
      {
        force: true,
      },
    );
  } catch (error) {
    console.error(
      '[Upload] Temporary file cleanup failed:',
      error.message,
    );
  }
}

export async function streamCsvUpload(
  request,
) {
  await ensureUploadDirectory();

  return new Promise(
    (resolve, reject) => {
      let parser;

      try {
        parser = busboy({
          headers:
            request.headers,

          limits: {
            /*
             * Allow Busboy to actually
             * encounter a second file so
             * we can reject it safely.
             */
            files: 2,

            fileSize:
              env.maxUploadBytes,

            fields: 5,

            parts: 8,
          },
        });
      } catch {
        reject(
          createHttpError(
            400,
            'INVALID_MULTIPART_REQUEST',
            'The request is not valid multipart form data.',
          ),
        );

        return;
      }

      let fileSeen = false;
      let multipleFiles =
        false;

      let validationError =
        null;

      let fileTask =
        Promise.resolve(null);

      let fileTaskStarted =
        false;

      let temporaryFilePath =
        null;

      let finalFilePath =
        null;

      let requestWasAborted =
        false;

      let promiseSettled =
        false;

      function resolveOnce(
        value,
      ) {
        if (promiseSettled) {
          return;
        }

        promiseSettled = true;
        resolve(value);
      }

      function rejectOnce(
        error,
      ) {
        if (promiseSettled) {
          return;
        }

        promiseSettled = true;
        reject(error);
      }

      request.once(
        'aborted',
        () => {
          requestWasAborted =
            true;

          /*
           * Cleanup is best-effort here.
           * fileTask itself already owns
           * its stream error handling.
           */
          void removeSafely(
            temporaryFilePath,
          );

          void removeSafely(
            finalFilePath,
          );

          rejectOnce(
            createHttpError(
              499,
              'UPLOAD_INTERRUPTED',
              'The upload was interrupted before completion.',
            ),
          );
        },
      );

      parser.on(
        'file',
        (
          fieldName,
          fileStream,
          fileInformation,
        ) => {
          /*
           * A second file is always
           * rejected, but it still must
           * be drained so Busboy can
           * finish parsing the request.
           */
          if (fileSeen) {
            multipleFiles =
              true;

            fileStream.resume();
            return;
          }

          fileSeen = true;

          if (
            fieldName !==
            'file'
          ) {
            validationError =
              createHttpError(
                400,
                'INVALID_FILE_FIELD',
                'The CSV file must be submitted using the "file" field.',
              );

            fileStream.resume();
            return;
          }

          const originalFileName =
            getSafeOriginalFileName(
              fileInformation.filename,
            );

          const mimeType =
            fileInformation.mimeType;

          try {
            validateFileInformation(
              originalFileName,
              mimeType,
            );
          } catch (error) {
            validationError =
              error;

            fileStream.resume();
            return;
          }

          const uploadId =
            randomUUID();

          const storedFileName =
            `${uploadId}.csv`;

          temporaryFilePath =
            path.join(
              uploadDirectory,
              `${uploadId}.part`,
            );

          finalFilePath =
            path.join(
              uploadDirectory,
              storedFileName,
            );

          let receivedBytes =
            0;

          let sizeLimitExceeded =
            false;

          fileStream.on(
            'data',
            (chunk) => {
              receivedBytes +=
                chunk.length;
            },
          );

          fileStream.once(
            'limit',
            () => {
              sizeLimitExceeded =
                true;
            },
          );

          const destination =
            createWriteStream(
              temporaryFilePath,
              {
                flags: 'wx',
              },
            );

          fileTaskStarted =
            true;

          /*
           * CRITICAL:
           *
           * The catch is attached
           * immediately so a pipeline
           * rejection can never become
           * an unhandled promise
           * rejection and crash Node.
           */
          fileTask =
            pipeline(
              fileStream,
              destination,
            )
              .then(
                async () => {
                  if (
                    sizeLimitExceeded ||
                    fileStream.truncated
                  ) {
                    throw createHttpError(
                      413,
                      'FILE_TOO_LARGE',
                      'The uploaded CSV exceeds the configured maximum file size.',
                    );
                  }

                  if (
                    receivedBytes ===
                    0
                  ) {
                    throw createHttpError(
                      400,
                      'EMPTY_FILE',
                      'The uploaded CSV file is empty.',
                    );
                  }

                  await verifyTextLikeContent(
                    temporaryFilePath,
                  );

                  await rename(
                    temporaryFilePath,
                    finalFilePath,
                  );

                  temporaryFilePath =
                    null;

                  const uploadedAt =
                    new Date();

                  const expiresAt =
                    new Date(
                      uploadedAt.getTime() +
                        env.uploadTtlMinutes *
                          60 *
                          1000,
                    );

                  return {
                    uploadId,

                    originalFileName,

                    storedFileName,

                    mimeType,

                    sizeBytes:
                      receivedBytes,

                    uploadedAt:
                      uploadedAt.toISOString(),

                    expiresAt:
                      expiresAt.toISOString(),

                    expiresAtMs:
                      expiresAt.getTime(),

                    filePath:
                      finalFilePath,

                    status:
                      'ready',
                  };
                },
              )
              .catch(
                (error) => ({
                  __uploadError:
                    error,
                }),
              );
        },
      );

      /*
       * If somebody supplies more than
       * two files, Busboy reaches its
       * configured file limit.
       */
      parser.once(
        'filesLimit',
        () => {
          multipleFiles =
            true;
        },
      );

      parser.once(
        'error',
        async () => {
          /*
           * Wait for the active file
           * task so no asynchronous
           * rejection is left behind.
           */
          if (
            fileTaskStarted
          ) {
            await fileTask;
          }

          await removeSafely(
            temporaryFilePath,
          );

          await removeSafely(
            finalFilePath,
          );

          rejectOnce(
            createHttpError(
              400,
              'INVALID_MULTIPART_REQUEST',
              'The multipart upload could not be processed.',
            ),
          );
        },
      );

      parser.once(
        'close',
        async () => {
          if (
            promiseSettled ||
            requestWasAborted
          ) {
            return;
          }

          try {
            if (!fileSeen) {
              throw createHttpError(
                400,
                'NO_FILE_SUPPLIED',
                'No CSV file was supplied.',
              );
            }

            if (
              validationError
            ) {
              throw validationError;
            }

            if (
              !fileTaskStarted
            ) {
              throw createHttpError(
                400,
                'UPLOAD_FAILED',
                'The CSV upload could not be started.',
              );
            }

            /*
             * Always wait for the first
             * upload pipeline to settle
             * BEFORE deciding how to
             * respond.
             */
            const fileResult =
              await fileTask;

            if (
              fileResult
                ?.__uploadError
            ) {
              throw fileResult.__uploadError;
            }

            /*
             * Multiple file detection
             * happens only after the
             * active pipeline has safely
             * settled.
             */
            if (
              multipleFiles
            ) {
              await removeSafely(
                temporaryFilePath,
              );

              await removeSafely(
                finalFilePath,
              );

              throw createHttpError(
                400,
                'MULTIPLE_FILES_NOT_ALLOWED',
                'Upload exactly one CSV file at a time.',
              );
            }

            registerUpload(
              fileResult,
            );

            resolveOnce(
              toPublicUpload(
                fileResult,
              ),
            );
          } catch (error) {
            await removeSafely(
              temporaryFilePath,
            );

            await removeSafely(
              finalFilePath,
            );

            rejectOnce(
              error,
            );
          }
        },
      );

      request.pipe(parser);
    },
  );
}

export function getUploadConfiguration() {
  return {
    maxFileSizeBytes:
      env.maxUploadBytes,

    acceptedExtensions: [
      '.csv',
    ],

    temporaryRetentionMinutes:
      env.uploadTtlMinutes,
  };
}