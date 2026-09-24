const jobs = new Map();
const activeUploadJobs = new Map();

export function registerJob(job) {
  jobs.set(job.jobId, job);
  activeUploadJobs.set(job.uploadId, job.jobId);
  return job;
}

export function getJob(jobId) {
  return jobs.get(jobId) ?? null;
}

export function updateJob(jobId, patch) {
  const current = jobs.get(jobId);

  if (!current) {
    return null;
  }

  const updated = {
    ...current,
    ...patch,
    updatedAt: new Date().toISOString(),
  };

  jobs.set(jobId, updated);

  if (['completed', 'failed', 'cancelled'].includes(updated.status)) {
    activeUploadJobs.delete(updated.uploadId);
  }

  return updated;
}

export function getActiveJobForUpload(uploadId) {
  const jobId = activeUploadJobs.get(uploadId);
  return jobId ? getJob(jobId) : null;
}

export function toPublicJob(job) {
  if (!job) {
    return null;
  }

  return {
    jobId: job.jobId,
    uploadId: job.uploadId,
    fileName: job.fileName,
    status: job.status,
    stage: job.stage,
    progressPercent: job.progressPercent,
    rowsProcessed: job.rowsProcessed,
    successfulRows: job.successfulRows,
    failedRows: job.failedRows,
    insertedRows: job.insertedRows ?? 0,
    batchesWritten: job.batchesWritten ?? 0,
    databaseName: job.databaseName ?? null,
    collectionName: job.collectionName ?? null,
    failedRowSamples: job.failedRowSamples ?? [],
    rowsPerSecond: job.rowsPerSecond,
    elapsedSeconds: job.elapsedSeconds,
    startedAt: job.startedAt,
    completedAt: job.completedAt ?? null,
    error: job.error ?? null,
  };
}
