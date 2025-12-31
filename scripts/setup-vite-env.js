#!/usr/bin/env node

/**
 * Maps Supabase environment variables to Vite-prefixed versions
 * This ensures VITE_* variables are available during build
 */

const fs = require('fs');
const path = require('path');

const envFile = path.join(__dirname, '..', '.env.local');

// Get values from process.env (set by Vercel)
const mappings = {
  'VITE_SUPABASE_URL': process.env.SUPABASE_URL,
  'VITE_SUPABASE_ANON_KEY': process.env.SUPABASE_ANON_KEY,
  'VITE_SUPABASE_SERVICE_ROLE_KEY': process.env.SUPABASE_SERVICE_ROLE_KEY,
};

// Only write if values exist
const envContent = Object.entries(mappings)
  .filter(([, value]) => value)
  .map(([key, value]) => `${key}=${value}`)
  .join('\n');

if (envContent) {
  fs.writeFileSync(envFile, envContent + '\n');
  console.log('✓ Created .env.local with VITE_* variables');
} else {
  console.warn('⚠ Warning: Supabase environment variables not found');
}
