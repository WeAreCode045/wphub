/**
 * Response utilities for Supabase Edge Functions
 */

import { corsHeaders } from './cors';
import type { ApiResponse } from '@wphub/types';

/**
 * Create a JSON response with CORS headers
 */
export function jsonResponse<T = any>(
  data: T,
  status = 200,
  additionalHeaders: Record<string, string> = {}
): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
      ...additionalHeaders,
    },
  });
}

/**
 * Create a success response
 */
export function successResponse<T = any>(
  data?: T,
  message?: string,
  additionalHeaders?: Record<string, string>
): Response {
  const body: ApiResponse<T> = {
    success: true,
    ...(data !== undefined && { data }),
    ...(message && { message }),
  };
  return jsonResponse(body, 200, additionalHeaders);
}

/**
 * Create an error response
 */
export function errorResponse(
  error: string,
  status = 500,
  additionalHeaders?: Record<string, string>
): Response {
  const body: ApiResponse = {
    success: false,
    error,
  };
  return jsonResponse(body, status, additionalHeaders);
}

/**
 * Create a validation error response (400)
 */
export function validationErrorResponse(
  error: string,
  additionalHeaders?: Record<string, string>
): Response {
  return errorResponse(error, 400, additionalHeaders);
}

/**
 * Create an unauthorized error response (401)
 */
export function unauthorizedResponse(
  error = 'Unauthorized',
  additionalHeaders?: Record<string, string>
): Response {
  return errorResponse(error, 401, additionalHeaders);
}

/**
 * Create a forbidden error response (403)
 */
export function forbiddenResponse(
  error = 'Forbidden',
  additionalHeaders?: Record<string, string>
): Response {
  return errorResponse(error, 403, additionalHeaders);
}

/**
 * Create a not found error response (404)
 */
export function notFoundResponse(
  error = 'Not found',
  additionalHeaders?: Record<string, string>
): Response {
  return errorResponse(error, 404, additionalHeaders);
}

/**
 * Catch and format errors
 */
export function handleError(error: any, defaultMessage = 'Internal server error'): Response {
  console.error('Edge function error:', error);
  
  const message = error?.message || error?.toString() || defaultMessage;
  
  // Check for specific error types
  if (message.includes('Unauthorized') || message.includes('auth')) {
    return unauthorizedResponse(message);
  }
  
  if (message.includes('Forbidden') || message.includes('permission')) {
    return forbiddenResponse(message);
  }
  
  if (message.includes('not found') || message.includes('Not found')) {
    return notFoundResponse(message);
  }
  
  if (message.includes('Missing') || message.includes('required') || message.includes('invalid')) {
    return validationErrorResponse(message);
  }
  
  return errorResponse(message, 500);
}

/**
 * Try-catch wrapper for Edge Functions
 */
export async function tryCatch<T>(
  fn: () => Promise<T>,
  errorHandler?: (error: any) => Response
): Promise<Response | T> {
  try {
    return await fn();
  } catch (error) {
    if (errorHandler) {
      return errorHandler(error);
    }
    return handleError(error);
  }
}
