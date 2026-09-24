import { Transform } from 'node:stream';

import { createHttpError } from '../utils/httpError.js';

export class CsvRowObjectTransform extends Transform {
  constructor({ sourceColumns }) {
    super({
      writableObjectMode: true,
      readableObjectMode: true,
    });

    this.sourceColumns = sourceColumns;
    this.headerSeen = false;
    this.headerColumnCount = 0;
    this.rowNumber = 0;
  }

  _transform(record, _encoding, callback) {
    try {
      if (!Array.isArray(record)) {
        throw createHttpError(
          422,
          'INVALID_CSV_RECORD',
          'The CSV parser produced an unexpected record format.',
        );
      }

      if (!this.headerSeen) {
        this.headerSeen = true;
        this.headerColumnCount =
          record.length;

        for (const column of this.sourceColumns) {
          if (
            !Number.isInteger(column.index) ||
            column.index < 0 ||
            column.index >= record.length
          ) {
            throw createHttpError(
              400,
              'MAPPING_SOURCE_NOT_FOUND',
              `The mapped source column "${column.key}" is not present in the CSV header.`,
            );
          }
        }

        callback();
        return;
      }

      this.rowNumber += 1;

      const source = Object.create(null);

      for (const column of this.sourceColumns) {
        const value = record[column.index];

        source[column.key] =
          value === undefined
            ? null
            : String(value);
      }

      callback(null, {
        rowNumber: this.rowNumber,
        source,
        hasColumnMismatch:
          record.length !== this.headerColumnCount,
      });
    } catch (error) {
      callback(error);
    }
  }
}
