#!/usr/bin/env node

/**
 * Script om wachtwoord te resetten voor een bestaande user
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import readline from 'readline';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing environment variables');
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

async function resetPassword() {
  console.log('\n🔑 Reset User Password\n');
  
  const email = await question('Email adres: ');
  const newPassword = await question('Nieuw wachtwoord (min. 6 karakters): ');
  
  console.log('\n⏳ Wachtwoord updaten...\n');
  
  try {
    // Haal user op uit database
    const { data: users, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('email', email);
    
    if (userError) throw userError;
    
    if (!users || users.length === 0) {
      console.log('❌ User niet gevonden in database');
      rl.close();
      return;
    }
    
    const user = users[0];
    console.log(`✅ User gevonden: ${user.full_name || user.email}`);
    console.log(`   Role: ${user.role}`);
    console.log(`   ID: ${user.id}\n`);
    
    // Update wachtwoord via auth admin API
    const { data: authData, error: authError } = await supabase.auth.admin.updateUserById(
      user.id,
      { password: newPassword }
    );
    
    if (authError) throw authError;
    
    console.log('✅ Wachtwoord succesvol geüpdatet!\n');
    console.log('Je kunt nu inloggen met:');
    console.log(`   Email: ${email}`);
    console.log(`   Wachtwoord: [het nieuwe wachtwoord]\n`);
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
  } finally {
    rl.close();
  }
}

resetPassword();
