# Migration Plan: Monorepo with Shared Types

## ✅ Phase 1: Infrastructure (COMPLETED)

- [x] Create pnpm workspace configuration
- [x] Create base TypeScript configuration with path aliases
- [x] Set up monorepo folder structure

## ✅ Phase 2: Shared Packages (COMPLETED)

### @wphub/types
- [x] Create package structure
- [x] Migrate entity types from JSON files to TypeScript
- [x] Define API request/response types for all Edge Functions
- [x] Export centralized type index

**Domain Coverage:**
- [x] database.ts - Base types
- [x] user.ts - User management
- [x] site.ts - WordPress sites
- [x] plugin.ts - Plugin management
- [x] team.ts - Team collaboration
- [x] messaging.ts - Messages/notifications
- [x] activity.ts - Activity logging
- [x] connector.ts - Connector plugin
- [x] subscription.ts - Billing
- [x] settings.ts - Settings
- [x] api.ts - Edge Function types

### @wphub/api-client
- [x] Create type-safe Edge Function client
- [x] Export callEdge utility with generics
- [x] Create typed wrapper for all 54 Edge Functions
- [x] Add error handling utilities

### @wphub/edge-utils
- [x] Extract CORS utilities
- [x] Create auth helpers (requireAuth, isAdmin, etc.)
- [x] Create response formatters (successResponse, errorResponse)
- [x] Add error handling utilities

## 🔄 Phase 3: Frontend Migration (IN PROGRESS)

### Update Import Paths
- [ ] Update `src/api/entities.js` to use `@wphub/types`
- [ ] Update `src/api/supabaseClient.js` to use `@wphub/api-client`
- [ ] Update all React components importing entity types
- [ ] Update all pages using API calls
- [ ] Update hooks and contexts

### Update Vite Configuration
- [ ] Add path aliases to vite.config.js
- [ ] Update jsconfig.json/tsconfig.json with workspace references
- [ ] Test hot module replacement with workspace packages

## 📝 Phase 4: Edge Functions Migration (PENDING)

### Update All 54 Edge Functions
For each function:
- [ ] Replace local CORS with `import { corsHeaders } from '@wphub/edge-utils/cors'`
- [ ] Replace auth logic with `import { requireAuth } from '@wphub/edge-utils/auth'`
- [ ] Replace response creation with `@wphub/edge-utils/response`
- [ ] Add request/response types from `@wphub/types/api`
- [ ] Test function still deploys and works

**Functions to Update:**
- [ ] parsePluginZip
- [ ] activatePlugin
- [ ] deactivatePlugin
- [ ] installPlugin
- [ ] uninstallPlugin
- [ ] updatePlugin
- [ ] enablePluginForSite
- [ ] togglePluginState
- [ ] getPluginCommands
- [ ] getPluginFileUrl
- [ ] listSitePlugins
- [ ] listSiteThemes
- [ ] syncSiteData
- [ ] requestSiteTransfer
- [ ] handleSiteTransferRequest
- [ ] declineSiteTransfer
- [ ] getConnectorVersion
- [ ] generateConnectorPlugin
- [ ] sendMessage
- [ ] searchWordPressPlugins
- [ ] searchWordPressThemes
- [ ] getWordPressPluginData
- [ ] downloadPluginFromWordPress
- [ ] createCheckoutSession
- [ ] assignManualSubscription
- [ ] handleStripeWebhook
- [ ] importStripeInvoices
- [ ] createDefaultTeamRoles
- [ ] syncAllSitesPlugins
- [ ] (and 25 more functions...)

## ✅ Phase 5: Testing & Validation (PENDING)

### Type Checking
- [ ] Run `pnpm typecheck` and fix all errors
- [ ] Ensure no type duplications remain
- [ ] Verify path aliases resolve correctly

### Functionality Testing
- [ ] Test all Edge Functions still work
- [ ] Test frontend builds successfully
- [ ] Test API client works with real Supabase instance
- [ ] Test hot reload works in development

### Deployment Testing
- [ ] Deploy Edge Functions to Supabase
- [ ] Build and deploy frontend
- [ ] Verify production functionality

## 🎯 Phase 6: Cleanup (PENDING)

- [ ] Remove old `src/entities/*.json` files (keep for reference initially)
- [ ] Remove duplicate type definitions
- [ ] Update documentation
- [ ] Add type examples to README
- [ ] Create migration guide for future development

## 📊 Progress Tracking

**Packages Created:** 3/3 ✅
**Types Migrated:** ~15 domain files ✅
**Frontend Files Updated:** 0/~50 🔄
**Edge Functions Updated:** 0/54 ⏳
**Tests Passing:** ⏳

## 🚨 Rollback Plan

If issues arise:
1. Keep existing code intact during migration
2. Run both old and new systems in parallel
3. Commit frequently with clear messages
4. Can revert to pre-monorepo state via git

## 💡 Next Actions

1. **Install workspace dependencies**: `pnpm install`
2. **Update Vite config** with path aliases
3. **Migrate `src/api/entities.js`** to use `@wphub/types`
4. **Update one Edge Function** as proof of concept
5. **Test end-to-end** before proceeding with full migration
