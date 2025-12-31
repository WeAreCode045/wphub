#!/usr/bin/env node

/**
 * Maps Supabase environment variables to Vite-prefixed versions
 * This ensures VITE_* variables are available during build
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envFile = path.join(__dirname, '..', '.env.production');

console.log('Environment variable setup for Vite build');
console.log('=========================================');

// Check what SUPABASE variables are available
const availableSupabaseVars = Object.entries(process.env)
  .filter(([key]) => key.startsWith('SUPABASE'))
  .reduce((acc, [key, val]) => {
    acc[key] = val ? `${val.substring(0, 20)}...` : 'EMPTY';
    return acc;
  }, {});

console.log('Available SUPABASE variables:', Object.keys(availableSupabaseVars).join(', '));
if (Object.keys(availableSupabaseVars).length > 0) {
  Object.entries(availableSupabaseVars).forEach(([key, val]) => {
    console.log(`  ${key}: ${val}`);
  });
}

// Map environment variables
const mappings = {
  'VITE_SUPABASE_URL': process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
  'VITE_SUPABASE_ANON_KEY': process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY,
};

console.log('\nMapping variables:');
Object.entries(mappings).forEach(([key, val]) => {
  console.log(`  ${key}: ${val ? 'SET' : 'NOT SET'}`);
});

// Create .env file with available variables
const envLines = Object.entries(mappings)
  .filter(([, value]) => value && value.trim())
  .map(([key, value]) => `${key}=${value}`);

if (envLines.length > 0) {
  fs.writeFileSync(envFile, envLines.join('\n') + '\n');
  console.log(`\n✓ Created ${envFile} with ${envLines.length} variable(s)`);
  console.log('Variables set:', envLines.map(line => line.split('=')[0]).join(', '));
} else {
  console.error('\n✗ FATAL: Missing required Supabase environment variables!');
  console.error('Expected: SUPABASE_URL, SUPABASE_ANON_KEY');
  console.error('\nVerify in Vercel:');
  console.error('1. Go to Project Settings → Integrations');
  console.error('2. Check if Supabase integration is connected');
  console.error('3. Ensure environment variables are added to your deployment');
  process.exit(1);
}
