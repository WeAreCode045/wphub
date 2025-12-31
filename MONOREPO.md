# WPHub Monorepo

A monorepo architecture for the WPHub WordPress plugin management platform.

## 📁 Structure

```
wphub/
├── packages/
│   ├── types/              # Shared TypeScript types
│   ├── api-client/         # Frontend API client for Edge Functions
│   └── edge-utils/         # Edge Function utilities (Deno)
├── src/                    # React frontend application
├── supabase/
│   └── functions/          # Supabase Edge Functions (Deno)
├── pnpm-workspace.yaml     # pnpm workspace configuration
└── tsconfig.base.json      # Base TypeScript configuration
```

## 🎯 Packages

### @wphub/types

Centralized TypeScript type definitions shared across frontend and backend.

**Domain Types:**
- `database.ts` - Base entity types and common types
- `user.ts` - User entity and authentication types
- `site.ts` - WordPress site management types
- `plugin.ts` - Plugin management types
- `team.ts` - Team collaboration types
- `messaging.ts` - Messages and notifications
- `activity.ts` - Activity logging types
- `connector.ts` - Connector plugin types
- `subscription.ts` - Billing and subscription types
- `settings.ts` - Settings and preferences
- `api.ts` - Edge Function request/response types

**Usage:**
```typescript
import type { User, Site, Plugin } from '@wphub/types';
import type { ParsePluginZipRequest, ParsePluginZipResponse } from '@wphub/types';
```

### @wphub/api-client

Type-safe API client for calling Supabase Edge Functions from the React frontend.

**Features:**
- Typed Edge Function invocation
- Automatic error handling
- Full TypeScript autocomplete for all Edge Functions

**Usage:**
```typescript
import { createEdgeClient } from '@wphub/api-client';

const client = createEdgeClient(supabase);

// Fully typed!
const result = await client.parsePluginZip({
  storage_path: 'path/to/plugin.zip'
});
```

### @wphub/edge-utils

Utilities for Supabase Edge Functions (Deno runtime).

**Modules:**
- `cors.ts` - CORS header management
- `auth.ts` - Authentication helpers
- `response.ts` - Response formatting utilities

**Usage:**
```typescript
// In Supabase Edge Functions
import { corsHeaders, requireAuth, successResponse, errorResponse } from '@wphub/edge-utils';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  
  try {
    const user = await requireAuth(supabase);
    // ... your logic
    return successResponse(data);
  } catch (error) {
    return errorResponse(error.message);
  }
});
```

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- pnpm 8+
- Supabase CLI

### Installation

```bash
# Install all dependencies
pnpm install

# Type check all packages
pnpm typecheck

# Run frontend dev server
pnpm dev
```

### Development Workflow

1. **Add new types**: Edit files in `packages/types/src/`
2. **Update API client**: Modify `packages/api-client/src/edge-client.ts`
3. **Edge Functions**: Use `@wphub/edge-utils` for auth, CORS, and responses
4. **Frontend**: Import types from `@wphub/types` and use `@wphub/api-client`

## 📝 Type Safety Benefits

### Before (Duplicated Types)
```typescript
// In Edge Function
interface Site {
  id: string;
  name: string;
  // ...
}

// In Frontend (different definition!)
interface Site {
  id: string;
  name: string;
  // ...
}
```

### After (Single Source of Truth)
```typescript
// packages/types/src/site.ts
export interface Site {
  id: string;
  name: string;
  // ...
}

// Used everywhere with imports
import type { Site } from '@wphub/types';
```

## 🔧 TypeScript Configuration

- **tsconfig.base.json**: Base configuration with path aliases
- **packages/*/tsconfig.json**: Package-specific configurations extending base
- Path aliases configured for seamless imports across workspace

## 📦 Deployment

### Edge Functions
```bash
# Deploy with type-checked code
pnpm typecheck
supabase functions deploy
```

### Frontend
```bash
# Build with type checking
pnpm typecheck
pnpm build
```

## 🎨 Architecture Principles

1. **Single Source of Truth**: One canonical definition per type
2. **Type Safety**: Full TypeScript coverage across frontend and backend
3. **Zero Duplication**: Shared types prevent drift between systems
4. **Developer Experience**: Autocomplete and type checking everywhere
5. **Maintainability**: Changes propagate automatically across all consumers

## 🔄 Migration Notes

All existing types have been migrated from:
- `src/entities/*.json` → `packages/types/src/*.ts`
- Inline types in components → `@wphub/types`
- Edge Function types → `@wphub/types/api`

## 📚 Additional Resources

- [pnpm Workspaces](https://pnpm.io/workspaces)
- [TypeScript Project References](https://www.typescriptlang.org/docs/handbook/project-references.html)
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)
