#!/usr/bin/env node

/**
 * Script om een admin user aan te maken in Supabase
 * Voer uit met: node scripts/create-admin-user.js
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import readline from 'readline';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function createAdminUser() {
  console.log('\n🔐 Admin User Aanmaken voor Supabase\n');
  
  const email = await question('Email adres: ');
  const password = await question('Wachtwoord (min. 6 karakters): ');
  const fullName = await question('Volledige naam (optioneel): ') || email.split('@')[0];
  
  console.log('\n⏳ Admin user aanmaken...\n');
  
  try {
    // Maak auth user aan met metadata
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Email is automatisch bevestigd
      user_metadata: {
        full_name: fullName,
        role: 'admin', // Admin role in metadata voor trigger
      }
    });
    
    if (authError) throw authError;
    
    console.log('✅ Auth user aangemaakt:', authData.user.id);
    
    // Database trigger heeft automatisch user record aangemaakt
    // Update role naar admin (trigger maakt standaard 'user' aan)
    const { data: userData, error: userError } = await supabase
      .from('users')
      .update({
        role: 'admin',
        full_name: fullName,
      })
      .eq('id', authData.user.id)
      .select()
      .single();
    
    if (userError) {
      console.log('⚠️  Warning: Could not update user role to admin:', userError.message);
      console.log('💡 Run the sync-auth-users.sql script first in Supabase SQL Editor');
    } else {
      console.log('✅ User role updated to admin');
    }
    
    console.log('\n🎉 Admin user succesvol aangemaakt!\n');
    console.log('Email:', email);
    console.log('Role: admin');
    console.log('Status: active');
    console.log('\n✅ Je kunt nu inloggen op /login\n');
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    
    if (error.message.includes('already registered')) {
      console.log('\n💡 User bestaat al. Probeer een ander email adres.\n');
    }
  } finally {
    rl.close();
  }
}

createAdminUser();
