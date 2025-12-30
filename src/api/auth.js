import { supabase } from './supabaseClient.js';

/**
 * Sign up a new user using the publishable client.
 * - Writes auth user via `supabase.auth.signUp`
 * - Attempts to create a profile row in `users` table using the new user's id.
 * Note: Role changes that require admin privileges will fail here unless your RLS
 * policies explicitly allow the anonymous user to perform them. Do NOT add
 * service-role keys to the frontend.
 */
export async function signUpWithProfile({ email, password, profile = {} }) {
  const { data, error } = await supabase.auth.signUp(
    { email, password },
    { data: profile }
  );

  if (error) return { error };

  const userId = data?.user?.id;
  if (!userId) return { data };

  // Try to create a profile row. This will obey RLS — if your policies
  // prevent anonymous inserts, this will return an error and should be
  // handled by a server-side process instead.
  const profileRow = { id: userId, email, ...profile };
  const { error: insertError } = await supabase.from('users').insert([profileRow]);

  return { data, insertError };
}

/**
 * Update the `role` field for the current user if allowed by RLS.
 * Returns `{ error }` if the update fails. Prefer server-side role changes
 * in a controlled flow if you require strict authorization.
 */
export async function updateUserRoleIfAllowed(userId, newRole) {
  const { error } = await supabase.from('users').update({ role: newRole }).eq('id', userId);
  return { error };
}

/**
 * Create a role-change request record for later review/acceptance by an admin.
 * This is useful when direct role updates from the frontend are not permitted.
 */
export async function requestRoleChange(userId, requestedRole, note = '') {
  const { data, error } = await supabase.from('role_change_requests').insert([
    { user_id: userId, requested_role: requestedRole, note }
  ]);
  return { data, error };
}

export default {
  signUpWithProfile,
  updateUserRoleIfAllowed,
  requestRoleChange,
};
