# Type-Safe Monorepo Architecture with Zod

## Overview

This repository now uses a **centralized type system with Zod validation** across the entire monorepo. All types and runtime validation schemas are defined in `packages/types` and shared between:

- **Frontend** (React + TypeScript + Vite)
- **Backend** (Supabase Edge Functions + Deno)
- **Shared utilities** (@wphub/api-client, @wphub/edge-utils)

## Architecture Principles

### 1. Single Source of Truth
All types live in `packages/types/src/`:
- `database.ts` - Base entities, enums, common types
- `user.ts` - User authentication and profile types
- `site.ts` - WordPress site management types
- `plugin.ts` - Plugin management types
- `team.ts` - Team collaboration types
- `messaging.ts` - Messages and notifications
- `activity.ts` - Activity logging types
- `connector.ts` - Connector plugin types
- `subscription.ts` - Billing and subscription types
- `settings.ts` - Settings and preferences
- `api.ts` - Edge Function request/response types

### 2. Zod for Runtime Validation
Every type has a corresponding Zod schema:
```typescript
// Schema definition (with validation)
export const UserRowSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  full_name: z.string().optional(),
  // ... more fields with validation
});

// Type inference (for TypeScript)
export type UserRow = z.infer<typeof UserRowSchema>;
export type User = UserRow; // Compatibility alias
```

### 3. Naming Conventions

**Zod Schemas:**
- PascalCase + `Schema` suffix
- Example: `ParsePluginZipRequestSchema`, `UserRowSchema`

**TypeScript Types:**
- PascalCase without suffix
- Example: `ParsePluginZipRequest`, `UserRow`
- Compatibility aliases: `User`, `Site`, `Plugin` (same as `*Row` types)

**Database Row Types:**
- PascalCase + `Row` suffix  
- Example: `UserRow`, `SiteRow`, `PluginRow`
- These represent actual database table rows

**API Types:**
- Request: PascalCase + `Request`
- Response: PascalCase + `Response`  
- Example: `ListSitePluginsRequest`, `ListSitePluginsResponse`

## Usage Examples

### Frontend (React)

#### 1. Using Types from @wphub/types
```typescript
import { User, Site, PluginRow } from '@wphub/types';

function UserProfile({ user }: { user: User }) {
  return <div>{user.email}</div>;
}
```

#### 2. Form Validation with Zod
```typescript
import { CreateSiteInputSchema } from '@wphub/types';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

function CreateSiteForm() {
  const form = useForm({
    resolver: zodResolver(CreateSiteInputSchema),
  });

  const onSubmit = (data) => {
    // data is type-safe and validated!
    console.log(data); // type: CreateSiteInput
  };

  return <form onSubmit={form.handleSubmit(onSubmit)}>...</form>;
}
```

#### 3. Type-Safe API Calls
```typescript
import { createEdgeClient } from '@wphub/api-client';
import { supabase } from './supabaseClient';

const client = createEdgeClient(supabase);

// Fully typed request and response
const result = await client.parsePluginZip({ file_url: 'https://...' });
//    ^? ParsePluginZipResponse

if (result.success) {
  console.log(result.data?.name); // TypeScript knows data exists
}
```

#### 4. Manual Validation
```typescript
import { UserRegistrationSchema } from '@wphub/types';

const formData = { email: 'user@example.com', password: 'secret' };

try {
  const validated = UserRegistrationSchema.parse(formData);
  // validated is type-safe!
} catch (error) {
  if (error instanceof z.ZodError) {
    console.error(error.errors); // Detailed validation errors
  }
}
```

### Edge Functions (Deno)

#### 1. Import Types
```typescript
import { 
  ParsePluginZipRequestSchema,
  ParsePluginZipResponse,
  z
} from '../_shared/types.ts';
```

#### 2. Validate Request Input
```typescript
Deno.serve(async (req) => {
  try {
    const body = await req.json();
    
    // Validate with Zod
    const validatedInput = ParsePluginZipRequestSchema.parse(body);
    
    // validatedInput is now type-safe!
    const { file_url } = validatedInput;
    
    // ... process request
    
  } catch (error) {
    if (error instanceof z.ZodError) {
      const response: ParsePluginZipResponse = {
        success: false,
        error: `Validation error: ${error.errors.map(e => e.message).join(', ')}`
      };
      return new Response(JSON.stringify(response), { status: 400 });
    }
  }
});
```

#### 3. Type-Safe Responses
```typescript
const response: ParsePluginZipResponse = {
  success: true,
  data: {
    name: 'My Plugin',
    slug: 'my-plugin',
    version: '1.0.0',
  }
};

return new Response(JSON.stringify(response), {
  headers: { 'Content-Type': 'application/json' }
});
```

## Development Workflow

### Type Changes
1. Edit types in `packages/types/src/*.ts`
2. Add Zod validation rules
3. Export schema and inferred type
4. Run `pnpm typecheck` to verify
5. Update imports in consuming code

### Adding New Types
1. Determine domain (user, site, plugin, etc.)
2. Add schema to appropriate file in `packages/types/src/`
3. Follow naming conventions (PascalCase + Schema)
4. Export from `packages/types/src/index.ts`
5. Use in Edge Functions and frontend

### ESLint Rules
The repository enforces:
- ❌ No local type definitions (use @wphub/types)
- ❌ No direct `supabase.functions.invoke()` (use @wphub/api-client)
- ❌ No direct `fetch()` to Edge Functions
- ✅ Use Zod schemas for validation
- ✅ PascalCase naming for types

Run `pnpm lint` to check for violations.

## Migration Guide

### Migrating Frontend Code

**Before:**
```typescript
// Local type definition
interface User {
  id: string;
  email: string;
}

// Direct API call
const result = await supabase.functions.invoke('parsePluginZip', {
  body: { file_url }
});
```

**After:**
```typescript
import { User } from '@wphub/types';
import { createEdgeClient } from '@wphub/api-client';

// Use centralized type
const user: User = { ... };

// Type-safe API call
const client = createEdgeClient(supabase);
const result = await client.parsePluginZip({ file_url });
```

### Migrating Edge Functions

**Before:**
```typescript
const body = await req.json();
const { file_url } = body;

if (!file_url || typeof file_url !== 'string') {
  return new Response('Invalid input', { status: 400 });
}
```

**After:**
```typescript
import { ParsePluginZipRequestSchema, z } from '../_shared/types.ts';

try {
  const body = await req.json();
  const validated = ParsePluginZipRequestSchema.parse(body);
  const { file_url } = validated; // Type-safe!
} catch (error) {
  if (error instanceof z.ZodError) {
    return new Response(JSON.stringify({
      success: false,
      error: error.errors.map(e => e.message).join(', ')
    }), { status: 400 });
  }
}
```

## Benefits

### 1. Type Safety Across Stack
- Frontend knows exact API contract
- Edge Functions validate input automatically
- No runtime type mismatches

### 2. Single Source of Truth
- Change types once, affects everywhere
- No duplication between frontend and backend
- Consistency guaranteed

### 3. Runtime Validation
- Catch invalid data before processing
- Better error messages for users
- Prevent security issues from malformed input

### 4. Developer Experience
- Autocomplete for all types
- Catch errors at compile time
- Refactoring is safe and easy

### 5. Documentation
- Zod schemas are self-documenting
- Types show exactly what's required/optional
- Validation rules are explicit

## Troubleshooting

### "Cannot find module '@wphub/types'"
Run `pnpm install` in workspace root.

### "Zod is not defined"
Add `import { z } from 'zod'` or `import { z } from '@wphub/types'`.

### "Schema validation failed"
Check the Zod error details for which field failed validation and why.

### ESLint errors about local types
Move the type to `packages/types` and import it.

### Edge Function can't import Zod
Use the Deno CDN import in `_shared/types.ts`:
```typescript
export { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';
```

## Scripts

```bash
# Type checking
pnpm typecheck              # Check TypeScript types
pnpm typecheck:watch        # Watch mode

# Linting
pnpm lint                   # Run ESLint
pnpm lint:fix               # Auto-fix issues

# Development
pnpm dev                    # Start dev server

# Build
pnpm build                  # Build for production
```

## Resources

- [Zod Documentation](https://zod.dev/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)
- [React Hook Form + Zod](https://react-hook-form.com/get-started#SchemaValidation)
