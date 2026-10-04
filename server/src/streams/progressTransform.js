import { Transform } from 'node:stream';

export class ProgressTransform extends Transform {
  constructor({ onProgress, emitEveryRows = 250, emitEveryMs = 250 } = {}) {
    super({
      writableObjectMode: true,
      readableObjectMode: true,
    });

    this.onProgress = typeof onProgress === 'function' ? onProgress : () => {};
    this.emitEveryRows = Math.max(1, emitEveryRows);
    this.emitEveryMs = Math.max(50, emitEveryMs);
    this.rowsProcessed = 0;
    this.startedAt = Date.now();
    this.lastEmittedAt = this.startedAt;
  }

  _transform(row, _encoding, callback) {
    this.rowsProcessed += 1;

    const now = Date.now();
    const shouldEmit =
      this.rowsProcessed % this.emitEveryRows === 0 ||
      now - this.lastEmittedAt >= this.emitEveryMs;

    if (shouldEmit) {
      this.lastEmittedAt = now;
      this.emitSnapshot(now);
    }

    callback(null, row);
  }

  _flush(callback) {
    this.emitSnapshot(Date.now());
    callback();
  }

  emitSnapshot(now) {
    const elapsedSeconds = Math.max((now - this.startedAt) / 1000, 0.001);

    this.onProgress({
      rowsProcessed: this.rowsProcessed,
      rowsPerSecond: Math.round(this.rowsProcessed / elapsedSeconds),
      elapsedSeconds: Number(elapsedSeconds.toFixed(2)),
    });
  }
}
