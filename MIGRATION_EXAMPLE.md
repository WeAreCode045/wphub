# Migration Example: parsePluginZip Edge Function

## Before (Current Implementation)

```typescript
// supabase/functions/parsePluginZip/index.ts
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )
    
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ... parsing logic ...
    
    return new Response(
      JSON.stringify({ success: true, slug, ...metadata }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
```

## After (With Monorepo Packages)

```typescript
// supabase/functions/parsePluginZip/index.ts
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders, handleCorsPreflight } from 'jsr:@wphub/edge-utils/cors';
import { requireAuth } from 'jsr:@wphub/edge-utils/auth';
import { successResponse, handleError } from 'jsr:@wphub/edge-utils/response';
import type { 
  ParsePluginZipRequest, 
  ParsePluginZipResponse,
  PluginMetadata 
} from 'jsr:@wphub/types';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return handleCorsPreflight();
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );
    
    // Type-safe auth with automatic error handling
    const user = await requireAuth(supabase);
    
    // Type-safe request body
    const body = await req.json() as ParsePluginZipRequest;
    
    // ... parsing logic (unchanged) ...
    const metadata: PluginMetadata = {
      name: pluginName,
      slug: pluginSlug,
      version: pluginVersion,
      // ...
    };
    
    // Type-safe response with automatic CORS
    return successResponse<ParsePluginZipResponse>({
      success: true,
      slug: metadata.slug,
      data: metadata
    });

  } catch (error) {
    // Automatic error handling with CORS
    return handleError(error);
  }
});
```

## Benefits of Migration

### 1. Type Safety
- ✅ Request body is fully typed
- ✅ Response structure is enforced
- ✅ No more typos in field names
- ✅ Autocomplete in your editor

### 2. Less Boilerplate
**Before:** 15+ lines of auth, CORS, and error handling  
**After:** 3 function calls with utilities

### 3. Consistency
- All Edge Functions use the same patterns
- CORS headers are centralized
- Error responses are standardized
- Auth logic is shared

### 4. Maintainability
- Change CORS policy in one place
- Update auth logic once
- Modify error format globally
- Types propagate automatically

### 5. Testing
```typescript
// Easy to test with typed inputs/outputs
const mockRequest: ParsePluginZipRequest = {
  storage_path: 'test/plugin.zip'
};

const response = await parsePluginZip(mockRequest);
// TypeScript knows the response structure
expect(response.data.slug).toBe('my-plugin');
```

## Migration Steps for One Function

1. **Add imports from packages**
   ```typescript
   import { corsHeaders, handleCorsPreflight } from 'jsr:@wphub/edge-utils/cors';
   import { requireAuth } from 'jsr:@wphub/edge-utils/auth';
   import { successResponse, handleError } from 'jsr:@wphub/edge-utils/response';
   ```

2. **Add types import**
   ```typescript
   import type { YourRequestType, YourResponseType } from 'jsr:@wphub/types';
   ```

3. **Replace CORS preflight**
   ```typescript
   // Before
   if (req.method === 'OPTIONS') {
     return new Response('ok', { headers: corsHeaders });
   }
   
   // After
   if (req.method === 'OPTIONS') {
     return handleCorsPreflight();
   }
   ```

4. **Replace auth logic**
   ```typescript
   // Before
   const { data: { user } } = await supabase.auth.getUser();
   if (!user) {
     return new Response(
       JSON.stringify({ error: 'Unauthorized' }),
       { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
     );
   }
   
   // After
   const user = await requireAuth(supabase);
   // Throws automatically if not authenticated
   ```

5. **Type request body**
   ```typescript
   const body = await req.json() as YourRequestType;
   ```

6. **Replace success responses**
   ```typescript
   // Before
   return new Response(
     JSON.stringify({ success: true, data }),
     { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
   );
   
   // After
   return successResponse({ success: true, data });
   ```

7. **Replace error handling**
   ```typescript
   // Before
   catch (error) {
     return new Response(
       JSON.stringify({ success: false, error: error.message }),
       { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
     );
   }
   
   // After
   catch (error) {
     return handleError(error);
   }
   ```

8. **Test the function**
   ```bash
   supabase functions deploy parsePluginZip
   # Test with actual requests
   ```

## Note: JSR Publishing

For Edge Functions to import from workspace packages, you'll need to either:

### Option A: Publish to JSR (Recommended for production)
```bash
# Publish packages to JSR
cd packages/types
npx jsr publish

cd ../edge-utils
npx jsr publish
```

### Option B: Use relative imports during development
```typescript
// Development alternative
import { corsHeaders } from '../_shared/cors.ts';
import type { ParsePluginZipRequest } from '../_shared/types.ts';
```

Then copy consolidated types to `_shared/types.ts` for Edge Functions.

### Option C: Bundle types with Edge Functions
Create a build step that copies types to each function's directory before deployment.

## Recommended Approach

For this project, I recommend **Option B with gradual migration**:

1. Keep `_shared/cors.ts` for now
2. Create `_shared/types.ts` that re-exports from `@wphub/types`
3. Gradually update functions to use shared types
4. Eventually publish to JSR for cleaner imports

This allows you to:
- ✅ Get type safety benefits immediately
- ✅ Keep deployment simple
- ✅ Migrate gradually without breaking existing functions
- ✅ Prepare for JSR publishing later
