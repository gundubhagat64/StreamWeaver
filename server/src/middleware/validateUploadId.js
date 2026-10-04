import { createHttpError } from '../utils/httpError.js';

const UUID_V4_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function validateUploadId(request, _response, next) {
  const { uploadId } = request.params;

  if (!UUID_V4_PATTERN.test(uploadId)) {
    next(
      createHttpError(
        400,
        'INVALID_UPLOAD_ID',
        'The supplied upload ID is invalid.',
      ),
    );

    return;
  }

  next();
}