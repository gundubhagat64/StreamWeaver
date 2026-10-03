import { createReadStream } from 'node:fs';
import { rm } from 'node:fs/promises';

import { parse } from 'csv-parse';

import { createHttpError } from '../utils/httpError.js';
import { logMemoryUsage } from '../utils/memoryLogger.js';

import {
  getUpload,
  removeUpload,
  updateUploadStatus,
} from './uploadRegistry.js';

const PREVIEW_LIMIT = 1000;

const MAX_RECORD_SIZE_BYTES =
  2 * 1024 * 1024;

function buildColumns(headerRecord) {
  const seenLabels = new Map();

  const blankHeaderIndexes = [];
  const duplicateLabels = [];

  const columns = headerRecord.map(
    (rawHeader, index) => {
      const originalLabel =
        String(rawHeader ?? '');

      let label =
        originalLabel.trim();

      if (!label) {
        label =
          `Column ${index + 1}`;

        blankHeaderIndexes.push(
          index,
        );
      }

      const collisionKey =
        label.toLocaleLowerCase();

      const occurrence =
        (seenLabels.get(
          collisionKey,
        ) ?? 0) + 1;

      seenLabels.set(
        collisionKey,
        occurrence,
      );

      let key = label;

      if (occurrence > 1) {
        key =
          `${label}__${occurrence}`;

        duplicateLabels.push(
          label,
        );
      }

      return {
        key,
        label,
        originalLabel,
        index,
      };
    },
  );

  return {
    columns,
    blankHeaderIndexes,
    duplicateLabels,
  };
}

function createWarnings({
  blankHeaderIndexes,
  duplicateLabels,
  mismatchedRowCount,
}) {
  const warnings = [];

  if (
    blankHeaderIndexes.length > 0
  ) {
    warnings.push({
      code: 'BLANK_HEADERS',
      message:
        `${blankHeaderIndexes.length} column header(s) were blank and were given temporary display names.`,
    });
  }

  if (
    duplicateLabels.length > 0
  ) {
    const uniqueDuplicates = [
      ...new Set(
        duplicateLabels,
      ),
    ];

    warnings.push({
      code: 'DUPLICATE_HEADERS',
      message:
        `Duplicate column names were detected: ${uniqueDuplicates.join(', ')}.`,
    });
  }

  if (
    mismatchedRowCount > 0
  ) {
    warnings.push({
      code:
        'COLUMN_COUNT_MISMATCH',
      message:
        `${mismatchedRowCount} preview row(s) did not contain the same number of fields as the header.`,
    });
  }

  return warnings;
}

function createMalformedCsvError(error) {
  const details = [];

  if (
    Number.isInteger(
      error?.lines,
    )
  ) {
    details.push({
      line: error.lines,
    });
  }

  return createHttpError(
    422,
    'MALFORMED_CSV',
    'The CSV could not be parsed. Check its quoting, delimiters, and record structure.',
    details,
  );
}

async function removeExpiredUpload(
  upload,
) {
  try {
    await rm(
      upload.filePath,
      {
        force: true,
      },
    );
  } finally {
    removeUpload(
      upload.uploadId,
    );
  }
}

export async function createCsvPreview(
  uploadId,
) {
  const upload =
    getUpload(uploadId);

  if (!upload) {
    throw createHttpError(
      404,
      'UPLOAD_NOT_FOUND',
      'The temporary upload could not be found. Upload the dataset again.',
    );
  }

  if (
    upload.expiresAtMs <=
    Date.now()
  ) {
    await removeExpiredUpload(
      upload,
    );

    throw createHttpError(
      410,
      'UPLOAD_EXPIRED',
      'This temporary upload has expired. Upload the dataset again.',
    );
  }

  updateUploadStatus(
    uploadId,
    'previewing',
  );

  logMemoryUsage(
    `preview:start ${uploadId}`,
  );

  let source = null;
  let parser = null;

  try {
    source =
      createReadStream(
        upload.filePath,
        {
          highWaterMark:
            64 * 1024,
        },
      );

    parser = parse({
      bom: true,

      skip_empty_lines: true,

      relax_column_count: true,

      max_record_size:
        MAX_RECORD_SIZE_BYTES,

      trim: false,
    });

    source.on(
      'error',
      (error) => {
        parser.destroy(error);
      },
    );

    source.pipe(parser);

    let headerRecord = null;

    let columns = [];

    let blankHeaderIndexes = [];

    let duplicateLabels = [];

    const rows = [];

    let recordNumber = 0;

    let mismatchedRowCount = 0;

    let hasMoreRows = false;

    for await (const record of parser) {
      if (
        !Array.isArray(record)
      ) {
        continue;
      }

      if (!headerRecord) {
        headerRecord = record;

        const result =
          buildColumns(
            headerRecord,
          );

        columns =
          result.columns;

        blankHeaderIndexes =
          result.blankHeaderIndexes;

        duplicateLabels =
          result.duplicateLabels;

        continue;
      }

      recordNumber += 1;

      /*
       * We deliberately read one additional
       * record only to determine whether more
       * than PREVIEW_LIMIT rows exist.
       */
      if (
        rows.length >=
        PREVIEW_LIMIT
      ) {
        hasMoreRows = true;
        break;
      }

      const hasColumnMismatch =
        record.length !==
        columns.length;

      if (hasColumnMismatch) {
        mismatchedRowCount += 1;
      }

      const values =
        columns.map(
          (column) => {
            const value =
              record[
                column.index
              ];

            if (
              value ===
              undefined
            ) {
              return null;
            }

            return String(
              value,
            );
          },
        );

      rows.push({
        rowNumber:
          recordNumber,

        values,

        hasColumnMismatch,

        extraValues:
          record.length >
          columns.length
            ? record
                .slice(
                  columns.length,
                )
                .map((value) =>
                  String(value),
                )
            : [],
      });
    }

    if (!headerRecord) {
      throw createHttpError(
        422,
        'EMPTY_CSV',
        'The CSV does not contain a header row.',
      );
    }

    if (
      columns.length === 0
    ) {
      throw createHttpError(
        422,
        'NO_COLUMNS_DETECTED',
        'No CSV columns could be detected.',
      );
    }

    const warnings =
      createWarnings({
        blankHeaderIndexes,
        duplicateLabels,
        mismatchedRowCount,
      });

    return {
      uploadId,

      fileName:
        upload.originalFileName,

      sizeBytes:
        upload.sizeBytes,

      mimeType:
        upload.mimeType,

      columns,

      rows,

      previewCount:
        rows.length,

      previewLimit:
        PREVIEW_LIMIT,

      hasMoreRows,

      warnings,

      encoding:
        'UTF-8',
    };
  } catch (error) {
    if (
      error?.statusCode
    ) {
      throw error;
    }

    if (
      error?.code ===
      'ENOENT'
    ) {
      throw createHttpError(
        404,
        'UPLOAD_FILE_MISSING',
        'The temporary dataset file is no longer available.',
      );
    }

    throw createMalformedCsvError(
      error,
    );
  } finally {
    if (source) {
      source.destroy();
    }

    if (parser) {
      parser.destroy();
    }

    if (
      getUpload(uploadId)
    ) {
      updateUploadStatus(
        uploadId,
        'ready',
      );
    }

    logMemoryUsage(
      `preview:end ${uploadId}`,
    );
  }
}