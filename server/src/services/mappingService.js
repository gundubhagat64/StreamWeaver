import { createReadStream } from 'node:fs';
import { Writable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

import { parse } from 'csv-parse';

import { CsvRowObjectTransform } from '../streams/csvRowObjectTransform.js';
import { MappingTransform } from '../streams/mappingTransform.js';
import {
  PreviewLimitTransform,
} from '../streams/previewLimitTransform.js';
import { createHttpError } from '../utils/httpError.js';
import { logMemoryUsage } from '../utils/memoryLogger.js';
import {
  getUpload,
  updateUploadStatus,
} from './uploadRegistry.js';

const MAPPING_PREVIEW_LIMIT = 25;
const MAX_MAPPING_FIELDS = 200;
const MAX_RECORD_SIZE_BYTES = 2 * 1024 * 1024;
const DESTINATION_FIELD_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;
const BLOCKED_DESTINATION_FIELDS = new Set([
  '__proto__',
  'constructor',
  'prototype',
]);

function validateAndNormalizeMappings(rawMappings) {
  if (!Array.isArray(rawMappings) || rawMappings.length === 0) {
    throw createHttpError(
      400,
      'MAPPING_REQUIRED',
      'At least one source-to-destination mapping is required.',
    );
  }

  if (rawMappings.length > MAX_MAPPING_FIELDS) {
    throw createHttpError(
      400,
      'TOO_MANY_MAPPINGS',
      `A maximum of ${MAX_MAPPING_FIELDS} mapped fields is supported.`,
    );
  }

  const sourceIndexes = new Set();
  const sourceKeys = new Set();
  const destinationFields = new Set();

  return rawMappings.map((mapping, index) => {
    const sourceKey = String(mapping?.sourceKey ?? '').trim();
    const sourceIndex = mapping?.sourceIndex;
    const destinationField = String(
      mapping?.destinationField ?? '',
    ).trim();

    if (!sourceKey) {
      throw createHttpError(
        400,
        'INVALID_SOURCE_FIELD',
        `Mapping ${index + 1} does not contain a valid source field.`,
      );
    }

    if (!Number.isInteger(sourceIndex) || sourceIndex < 0) {
      throw createHttpError(
        400,
        'INVALID_SOURCE_INDEX',
        `Mapping ${index + 1} contains an invalid source column index.`,
      );
    }

    if (!destinationField) {
      throw createHttpError(
        400,
        'DESTINATION_FIELD_REQUIRED',
        `Mapping ${index + 1} requires a destination field name.`,
      );
    }

    if (
      destinationField.length > 120 ||
      !DESTINATION_FIELD_PATTERN.test(destinationField) ||
      BLOCKED_DESTINATION_FIELDS.has(destinationField)
    ) {
      throw createHttpError(
        400,
        'INVALID_DESTINATION_FIELD',
        `Destination field "${destinationField}" must begin with a letter or underscore and contain only letters, numbers, and underscores.`,
      );
    }

    if (sourceIndexes.has(sourceIndex) || sourceKeys.has(sourceKey)) {
      throw createHttpError(
        400,
        'DUPLICATE_SOURCE_MAPPING',
        `Source field "${sourceKey}" is mapped more than once.`,
      );
    }

    const destinationKey = destinationField.toLocaleLowerCase();

    if (destinationFields.has(destinationKey)) {
      throw createHttpError(
        400,
        'MAPPING_DUPLICATE_DESTINATION',
        `Destination field "${destinationField}" is used more than once.`,
      );
    }

    sourceIndexes.add(sourceIndex);
    sourceKeys.add(sourceKey);
    destinationFields.add(destinationKey);

    return {
      sourceKey,
      sourceIndex,
      destinationField,
    };
  });
}

function getActiveUpload(uploadId) {
  const upload = getUpload(uploadId);

  if (!upload) {
    throw createHttpError(
      404,
      'UPLOAD_NOT_FOUND',
      'The temporary upload could not be found. Upload the dataset again.',
    );
  }

  if (upload.expiresAtMs <= Date.now()) {
    throw createHttpError(
      410,
      'UPLOAD_EXPIRED',
      'This temporary upload has expired. Upload the dataset again.',
    );
  }

  return upload;
}

function createMalformedCsvError(error) {
  const details = [];

  if (Number.isInteger(error?.lines)) {
    details.push({ line: error.lines });
  }

  return createHttpError(
    422,
    'MALFORMED_CSV',
    'The CSV could not be parsed while testing the mapping configuration.',
    details,
  );
}

export async function createMappedRowsPreview(uploadId, rawMappings) {
  const upload = getActiveUpload(uploadId);
  const mappings = validateAndNormalizeMappings(rawMappings);

  updateUploadStatus(uploadId, 'processing');
  logMemoryUsage(`mapping-preview:start ${uploadId}`);

  const source = createReadStream(upload.filePath, {
    highWaterMark: 64 * 1024,
  });

  const parser = parse({
    bom: true,
    skip_empty_lines: true,
    relax_column_count: true,
    max_record_size: MAX_RECORD_SIZE_BYTES,
    trim: false,
  });

  const csvObjectTransform = new CsvRowObjectTransform({
    sourceColumns: mappings.map((mapping) => ({
      key: mapping.sourceKey,
      index: mapping.sourceIndex,
    })),
  });

  const mappingTransform = new MappingTransform({ mappings });
  const previewLimitTransform = new PreviewLimitTransform(
    MAPPING_PREVIEW_LIMIT,
  );

  const rows = [];

  const collector = new Writable({
    objectMode: true,
    write(row, _encoding, callback) {
      rows.push(row);
      callback();
    },
  });

  try {
    try {
      await pipeline(
        source,
        parser,
        csvObjectTransform,
        mappingTransform,
        previewLimitTransform,
        collector,
      );
    } catch (error) {
      if (error?.code !== 'PREVIEW_LIMIT_REACHED') {
        throw error;
      }
    }

    if (!csvObjectTransform.headerSeen) {
      throw createHttpError(
        422,
        'EMPTY_CSV',
        'The CSV does not contain a header row.',
      );
    }

    return {
      uploadId,
      fileName: upload.originalFileName,
      mappings,
      rows,
      previewCount: rows.length,
      previewLimit: MAPPING_PREVIEW_LIMIT,
      hasMoreRows: previewLimitTransform.hasMoreRows,
    };
  } catch (error) {
    if (error?.statusCode) {
      throw error;
    }

    if (error?.code === 'ENOENT') {
      throw createHttpError(
        404,
        'UPLOAD_FILE_MISSING',
        'The temporary dataset file is no longer available.',
      );
    }

    throw createMalformedCsvError(error);
  } finally {
    source.destroy();
    parser.destroy();
    csvObjectTransform.destroy();
    mappingTransform.destroy();
    previewLimitTransform.destroy();

    if (getUpload(uploadId)) {
      updateUploadStatus(uploadId, 'ready');
    }

    logMemoryUsage(`mapping-preview:end ${uploadId}`);
  }
}
