/**
 * Common response utilities for consistent API responses
 */

/**
 * Create a standardized JSON response
 */
export const createJsonResponse = (data: any, status = 200): Response =>
  Response.json(data, { status });

/**
 * Create a not found response
 */
export const createNotFoundResponse = (): Response =>
  new Response("Not Found", { status: 404 });

/**
 * Create an error response with consistent format
 */
export const createErrorJsonResponse = (error: any, status = 200): Response =>
  Response.json(error, { status });
