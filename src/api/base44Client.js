// Direct Supabase client - replaces Base44 adapter
import { supabaseClientDirect } from './supabaseClientDirect';

// Deprecation notice: keep this shim temporarily to avoid breaking imports.
if (typeof console !== 'undefined') {
	console.warn('[deprecation] `base44Client` shim is deprecated. Import `src/api/entities` or `supabaseClientDirect` instead. This shim will be removed in a future release.');
}

// Export the direct client with the same interface as the old Base44 client
export const base44 = supabaseClientDirect;
