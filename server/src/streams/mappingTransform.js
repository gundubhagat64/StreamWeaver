import { Transform } from 'node:stream';

export class MappingTransform extends Transform {
  constructor({ mappings }) {
    super({
      writableObjectMode: true,
      readableObjectMode: true,
    });

    this.mappings = mappings;
  }

  _transform(row, _encoding, callback) {
    try {
      const mapped = Object.create(null);

      for (const mapping of this.mappings) {
        mapped[mapping.destinationField] =
          row.source[mapping.sourceKey] ?? null;
      }

      callback(null, {
        rowNumber: row.rowNumber,
        data: mapped,
        hasColumnMismatch: row.hasColumnMismatch,
      });
    } catch (error) {
      callback(error);
    }
  }
}
