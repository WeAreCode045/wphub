import { createClient } from '@supabase/supabase-js'

// Handle both Vite (import.meta.env) and Node.js (process.env) environments
const getEnvVar = (key, defaultValue) => {
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    return import.meta.env[key] || defaultValue
  }
  return process.env[key] || defaultValue
}

const supabaseUrl = getEnvVar('VITE_SUPABASE_URL', 'https://ossyxxlplvqakowiwbok.supabase.co')
const supabaseAnonKey = getEnvVar('VITE_SUPABASE_ANON_KEY', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9zc3l4eGxwbHZxYWtvd2l3Ym9rIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTgzNjI2OCwiZXhwIjoyMDgxNDEyMjY4fQ.hZ330-2WmvJP_2x2YMm5NkfHf9y2hOWMc9dTGPIRRno')

export const supabase = createClient(supabaseUrl, supabaseAnonKey)