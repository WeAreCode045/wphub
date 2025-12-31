/**
 * CORS utilities for Supabase Edge Functions
 */

/** Standard CORS headers for all Edge Functions */
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Handle CORS preflight requests
 * Returns an OPTIONS response with CORS headers
 */
export function handleCorsPreflight() {
  return new Response('ok', { headers: corsHeaders });
}

/**
 * Check if request is a CORS preflight request
 */
export function isCorsPreflightRequest(req: Request): boolean {
  return req.method === 'OPTIONS';
}

/**
 * Add CORS headers to an existing response
 */
export function addCorsHeaders(response: Response): Response {
  const headers = new Headers(response.headers);
  Object.entries(corsHeaders).forEach(([key, value]) => {
    headers.set(key, value);
  });
  
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

/**
 * Create headers object with CORS included
 */
export function createHeaders(additionalHeaders: Record<string, string> = {}): Record<string, string> {
  return {
    ...corsHeaders,
    'Content-Type': 'application/json',
    ...additionalHeaders,
  };
}
