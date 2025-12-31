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

// Map environment variables
const mappings = {
  'VITE_SUPABASE_URL': process.env.SUPABASE_URL,
  'VITE_SUPABASE_ANON_KEY': process.env.SUPABASE_ANON_KEY,
};

// Create .env file with available variables
const envLines = Object.entries(mappings)
  .filter(([, value]) => value && value.trim())
  .map(([key, value]) => `${key}=${value}`);

if (envLines.length > 0) {
  fs.writeFileSync(envFile, envLines.join('\n') + '\n');
  console.log(`✓ Created ${envFile} with ${envLines.length} variable(s)`);
  console.log('Variables:', envLines.map(line => line.split('=')[0]).join(', '));
} else {
  console.error('✗ Warning: No Supabase environment variables found');
  console.error('Available env vars:', Object.keys(process.env).filter(k => k.includes('SUPABASE')).join(', ') || 'none');
  process.exit(1);
}
