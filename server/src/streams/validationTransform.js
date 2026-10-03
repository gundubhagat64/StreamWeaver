import { Transform } from 'node:stream';

function makeIssue(code, message, field = null) {
  return { code, message, field };
}

export class ValidationTransform extends Transform {
  constructor() {
    super({
      writableObjectMode: true,
      readableObjectMode: true,
    });

    this.validRows = 0;
    this.failedRows = 0;
  }

  _transform(row, _encoding, callback) {
    try {
      const issues = [];
      const data = row?.data;

      if (!data || typeof data !== 'object' || Array.isArray(data)) {
        issues.push(
          makeIssue(
            'INVALID_ROW_OBJECT',
            'The transformed row is not a valid destination object.',
          ),
        );
      }

      if (row?.hasColumnMismatch) {
        issues.push(
          makeIssue(
            'COLUMN_COUNT_MISMATCH',
            'The CSV row contains a different number of columns than the header.',
          ),
        );
      }

      if (data && typeof data === 'object' && !Array.isArray(data)) {
        let meaningfulValues = 0;

        for (const [field, value] of Object.entries(data)) {
          if (value !== null && value !== undefined && String(value).trim() !== '') {
            meaningfulValues += 1;
          }

          if (typeof value === 'number' && !Number.isFinite(value)) {
            issues.push(
              makeIssue(
                'INVALID_NUMBER',
                `Field "${field}" contains a non-finite number.`,
                field,
              ),
            );
          }

          if (typeof value === 'string' && Buffer.byteLength(value, 'utf8') > 1024 * 1024) {
            issues.push(
              makeIssue(
                'FIELD_TOO_LARGE',
                `Field "${field}" exceeds the 1 MB validation limit.`,
                field,
              ),
            );
          }
        }

        if (meaningfulValues === 0) {
          issues.push(
            makeIssue(
              'EMPTY_ROW',
              'The mapped row does not contain any non-empty values.',
            ),
          );
        }
      }

      const valid = issues.length === 0;

      if (valid) {
        this.validRows += 1;
      } else {
        this.failedRows += 1;
      }

      callback(null, {
        ...row,
        valid,
        validationErrors: issues,
      });
    } catch (error) {
      callback(error);
    }
  }
}
