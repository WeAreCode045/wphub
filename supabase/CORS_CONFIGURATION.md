# CORS Configuration for Supabase Edge Functions

## Problem
The frontend application (https://www.wphub.pro) was unable to call Supabase Edge Functions due to CORS (Cross-Origin Resource Sharing) policy errors. The browser's preflight OPTIONS requests were not being handled correctly by the edge functions.

## Solution
All Supabase Edge Functions have been updated to properly handle CORS:

### 1. Helper Functions (_helpers.ts)
Added reusable CORS utilities:
- `corsHeaders`: Standard CORS headers allowing all origins
- `handleCors()`: Helper to check and respond to OPTIONS requests
- `jsonResponseWithCors()`: Response builder with CORS headers

### 2. Edge Function Updates
All 54 edge functions have been updated with:
- OPTIONS request handler at the beginning of each function
- CORS headers included in all Response objects
- Proper imports from `_helpers.ts`

### Example Pattern
```typescript
import { corsHeaders } from '../_helpers.ts';

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // ... function logic ...
    
    return new Response(
      JSON.stringify({ success: true, data: result }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
```

## CORS Headers Included
- `Access-Control-Allow-Origin: *` - Allows requests from any origin
- `Access-Control-Allow-Headers: authorization, x-client-info, apikey, content-type` - Allows necessary headers

## Deployment Notes
- These changes need to be deployed to the Supabase project
- Use `supabase functions deploy` to deploy the updated edge functions
- The CORS configuration is permissive (`*` for origin) which is suitable for this use case
- For stricter security, consider limiting allowed origins to specific domains

## Testing
After deployment, verify that:
1. Frontend can successfully invoke edge functions without CORS errors
2. OPTIONS preflight requests receive proper CORS headers
3. All API endpoints respond with CORS headers in both success and error cases

## Affected Functions
All 54 edge functions in `/supabase/functions/` have been updated, including:
- listSitePlugins
- listSiteThemes
- testSiteConnection
- installPlugin
- updatePlugin
- And 49 more...
