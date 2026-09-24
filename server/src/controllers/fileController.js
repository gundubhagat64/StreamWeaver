import {
  getUploadConfiguration,
  streamCsvUpload,
} from '../services/uploadService.js';

import {
  createCsvPreview,
} from '../services/previewService.js';

import {
  createMappedRowsPreview,
} from '../services/mappingService.js';

export function getFileUploadConfig(
  _request,
  response,
) {
  response.status(200).json({
    success: true,
    message:
      'Upload configuration retrieved successfully',
    data:
      getUploadConfiguration(),
  });
}

export async function uploadCsvFile(
  request,
  response,
  next,
) {
  try {
    const upload =
      await streamCsvUpload(
        request,
      );

    if (
      request.aborted ||
      response.headersSent
    ) {
      return;
    }

    response.status(201).json({
      success: true,
      message:
        'CSV file uploaded successfully',
      data: upload,
    });
  } catch (error) {
    if (request.aborted) {
      return;
    }

    next(error);
  }
}

export async function getCsvPreview(
  request,
  response,
  next,
) {
  try {
    const preview =
      await createCsvPreview(
        request.params.uploadId,
      );

    response.status(200).json({
      success: true,
      message:
        'CSV preview generated successfully',
      data: preview,
    });
  } catch (error) {
    next(error);
  }
}

export async function previewMappedRows(
  request,
  response,
  next,
) {
  try {
    const preview =
      await createMappedRowsPreview(
        request.params.uploadId,
        request.body?.mappings,
      );

    response.status(200).json({
      success: true,
      message:
        'Mapping preview generated successfully',
      data: preview,
    });
  } catch (error) {
    next(error);
  }
}
