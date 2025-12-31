export async function getSupabase() {
  return await import('./supabaseClient');
}

export default getSupabase;
