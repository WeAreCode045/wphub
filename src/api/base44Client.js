// Direct Supabase client - replaces Base44 adapter
import { supabaseClientDirect } from './supabaseClientDirect';

// Export the direct client with the same interface as Base44
export const base44 = supabaseClientDirect;
