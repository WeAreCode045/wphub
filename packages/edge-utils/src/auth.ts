/**
 * Authentication utilities for Supabase Edge Functions
 */

import type { User } from '@wphub/types';

/** Supabase client type for Edge Functions */
export interface SupabaseEdgeClient {
  auth: {
    getUser: () => Promise<{ data: { user: User | null }; error: any }>;
  };
}

/**
 * Get authenticated user from request
 * Throws error if user is not authenticated
 */
export async function requireAuth(supabase: SupabaseEdgeClient): Promise<User> {
  const { data: { user }, error } = await supabase.auth.getUser();
  
  if (error || !user) {
    throw new Error('Unauthorized');
  }
  
  return user;
}

/**
 * Get authenticated user from request
 * Returns null if user is not authenticated
 */
export async function getAuthUser(supabase: SupabaseEdgeClient): Promise<User | null> {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

/**
 * Check if user has admin role
 */
export function isAdmin(user: User): boolean {
  return user.role === 'admin';
}

/**
 * Require admin role
 * Throws error if user is not an admin
 */
export function requireAdmin(user: User): void {
  if (!isAdmin(user)) {
    throw new Error('Forbidden: Admin access required');
  }
}

/**
 * Check if user has moderator role
 */
export function isModerator(user: User): boolean {
  return user.role === 'moderator' || user.role === 'admin';
}

/**
 * Require moderator role
 * Throws error if user is not a moderator or admin
 */
export function requireModerator(user: User): void {
  if (!isModerator(user)) {
    throw new Error('Forbidden: Moderator access required');
  }
}

/**
 * Extract bearer token from Authorization header
 */
export function extractBearerToken(req: Request): string | null {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.substring(7);
}

/**
 * Create Supabase client from request with auth context
 */
export function createClientFromRequest(
  req: Request,
  supabaseUrl: string,
  supabaseAnonKey: string,
  createClient: (url: string, key: string, options: any) => any
): any {
  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: req.headers.get('Authorization') || '',
      },
    },
  });
}
