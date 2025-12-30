
import { supabaseClientDirect } from './supabaseClient';

// Re-export the canonical Supabase-backed API used across the app.
export const Query = supabaseClientDirect.Query;

// auth sdk:
export const User = supabaseClientDirect.auth;

// Expose entities namespace for backward-compatible access (use `entities.X` in new code)
export const entities = supabaseClientDirect.entities;

// Re-export functions/integrations/auth for callers that used the old shim
export const functions = supabaseClientDirect.functions;
export const integrations = supabaseClientDirect.integrations;
export const auth = supabaseClientDirect.auth;