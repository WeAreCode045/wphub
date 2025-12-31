import { createClient, SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY as string

if (!supabaseUrl || !supabaseKey) {
  // Keep this lightweight — in dev you'll set these in your .env
  // Throwing helps catch misconfiguration early.
  throw new Error('VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY must be set')
}

const supabase: SupabaseClient = createClient(supabaseUrl, supabaseKey)

export default supabase
export { supabase }
