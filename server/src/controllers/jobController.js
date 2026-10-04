import {
  getProcessingJob,
  startProcessingJob,
} from '../services/jobService.js';

export function startJob(request, response, next) {
  try {
    const job = startProcessingJob(
      request.params.uploadId,
      request.body?.mappings,
      request.body?.transformations,
    );

    response.status(202).json({
      success: true,
      message: 'Processing job started successfully',
      data: job,
    });
  } catch (error) {
    next(error);
  }
}

export function getJobStatus(request, response, next) {
  try {
    const job = getProcessingJob(request.params.jobId);

    response.status(200).json({
      success: true,
      message: 'Processing job retrieved successfully',
      data: job,
    });
  } catch (error) {
    next(error);
  }
}
