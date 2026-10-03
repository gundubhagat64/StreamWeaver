 const uploads = new Map();

export function registerUpload(metadata) {
  uploads.set(metadata.uploadId, metadata);
}

export function getUpload(uploadId) {
  return uploads.get(uploadId) ?? null;
}

export function removeUpload(uploadId) {
  uploads.delete(uploadId);
}

export function getAllUploads() {
  return [...uploads.values()];
}

export function updateUploadStatus(uploadId, status) {
  const upload = uploads.get(uploadId);

  if (!upload) {
    return null;
  }

  upload.status = status;

  return upload;
}

export function toPublicUpload(metadata) {
  return {
    uploadId: metadata.uploadId,
    originalFileName: metadata.originalFileName,
    storedFileName: metadata.storedFileName,
    mimeType: metadata.mimeType,
    sizeBytes: metadata.sizeBytes,
    uploadedAt: metadata.uploadedAt,
    expiresAt: metadata.expiresAt,
  };
}