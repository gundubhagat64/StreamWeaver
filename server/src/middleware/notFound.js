export function notFound(request, response) {
  response.status(404).json({
    success: false,
    message: 'The requested API route was not found.',
    error: {
      code: 'ROUTE_NOT_FOUND',
      details: [],
    },
  });
}