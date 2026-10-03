import { Writable } from 'node:stream';

function truncateValue(value) {
  if (value === null || value === undefined) {
    return value;
  }

  const text = typeof value === 'string' ? value : JSON.stringify(value);

  if (text.length <= 160) {
    return value;
  }

  return `${text.slice(0, 157)}...`;
}

function makeFailedSample(row) {
  const data = Object.create(null);

  for (const [field, value] of Object.entries(row?.data ?? {})) {
    data[field] = truncateValue(value);
  }

  return {
    rowNumber: row?.rowNumber ?? null,
    errors: row?.validationErrors ?? [],
    data,
  };
}

export class MongoBulkWriteSink extends Writable {
  constructor({
    collection,
    batchSize = 5000,
    jobId,
    uploadId,
    failedSampleLimit = 100,
    onBatch,
  }) {
    super({ objectMode: true });

    this.collection = collection;
    this.batchSize = batchSize;
    this.jobId = jobId;
    this.uploadId = uploadId;
    this.failedSampleLimit = failedSampleLimit;
    this.onBatch = onBatch;

    this.operations = [];
    this.insertedRows = 0;
    this.failedRows = 0;
    this.batchesWritten = 0;
    this.failedRowSamples = [];
  }

  async consume(row) {
    if (!row?.valid) {
      this.failedRows += 1;

      if (this.failedRowSamples.length < this.failedSampleLimit) {
        this.failedRowSamples.push(makeFailedSample(row));
      }

      return;
    }

    this.operations.push({
      insertOne: {
        document: {
          ...row.data,
          _streamweaver: {
            jobId: this.jobId,
            uploadId: this.uploadId,
            rowNumber: row.rowNumber,
            ingestedAt: new Date(),
          },
        },
      },
    });

    if (this.operations.length >= this.batchSize) {
      await this.flushBatch();
    }
  }

  async flushBatch() {
    if (this.operations.length === 0) {
      return;
    }

    const operations = this.operations;
    this.operations = [];

    const result = await this.collection.bulkWrite(
      operations,
      { ordered: false },
    );

    this.insertedRows += result.insertedCount ?? operations.length;
    this.batchesWritten += 1;

    if (this.onBatch) {
      await this.onBatch({
        insertedRows: this.insertedRows,
        failedRows: this.failedRows,
        batchesWritten: this.batchesWritten,
        batchSize: operations.length,
      });
    }
  }

  _write(row, _encoding, callback) {
    this.consume(row)
      .then(() => callback())
      .catch(callback);
  }

  _final(callback) {
    this.flushBatch()
      .then(() => callback())
      .catch(callback);
  }
}
