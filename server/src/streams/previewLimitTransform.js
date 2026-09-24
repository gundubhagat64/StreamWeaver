import { Transform } from 'node:stream';

export class PreviewLimitReachedError extends Error {
  constructor() {
    super('Preview row limit reached.');
    this.name = 'PreviewLimitReachedError';
    this.code = 'PREVIEW_LIMIT_REACHED';
  }
}

export class PreviewLimitTransform extends Transform {
  constructor(limit) {
    super({
      writableObjectMode: true,
      readableObjectMode: true,
    });

    this.limit = limit;
    this.count = 0;
    this.hasMoreRows = false;
  }

  _transform(row, _encoding, callback) {
    if (this.count >= this.limit) {
      this.hasMoreRows = true;
      callback(new PreviewLimitReachedError());
      return;
    }

    this.count += 1;
    callback(null, row);
  }
}
