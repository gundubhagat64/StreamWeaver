export function errorHandler(error, _request, response, _next) {
  console.error(error);

  const statusCode =
    Number.isInteger(error.statusCode) &&
    error.statusCode >= 400 &&
    error.statusCode <= 599
      ? error.statusCode
      : 500;

  const message =
    statusCode === 500
      ? 'An unexpected server error occurred.'
      : error.message || 'The request could not be completed.';

  response.status(statusCode).json({
    success: false,
    message,
    error: {
      code:
        error.code ||
        (statusCode === 500
          ? 'INTERNAL_SERVER_ERROR'
          : 'REQUEST_ERROR'),
      details: Array.isArray(error.details)
        ? error.details
        : [],
    },
  });
}