#!/usr/bin/env node

/**
 * Script om alle users uit de users tabel te synchroniseren naar Supabase Auth
 * Dit maakt auth users aan voor alle bestaande users in de database
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

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

function generateRandomPassword(length = 16) {
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
  let password = '';
  for (let i = 0; i < length; i++) {
    password += charset[Math.floor(Math.random() * charset.length)];
  }
  return password;
}

async function createAuthUserFromUserRecord(userRecord) {
  const { id, email, full_name, role } = userRecord;
  
  try {
    // Check of auth user al bestaat
    const { data: existingAuthUser } = await supabase.auth.admin.getUserById(id);
    
    if (existingAuthUser?.user) {
      console.log(`   ℹ️  Auth user already exists for ${email}`);
      return { success: true, authUser: existingAuthUser.user, created: false };
    }
  } catch (error) {
    // User bestaat niet, ga door met aanmaken
  }
  
  // Genereer een random temporary wachtwoord
  const tempPassword = generateRandomPassword();
  
  // Maak auth user aan
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: email,
    password: tempPassword,
    email_confirm: true, // Auto-confirm email
    user_metadata: {
      full_name: full_name || email.split('@')[0],
      role: role || 'user',
    }
  });
  
  if (authError) {
    throw authError;
  }
  
  // Update user record met correct auth ID
  if (authData.user.id !== id) {
    await supabase
      .from('users')
      .update({ id: authData.user.id })
      .eq('id', id);
  }
  
  console.log(`   ✅ Created auth user for ${email}`);
  
  return { 
    success: true, 
    authUser: authData.user, 
    created: true,
  };
}

async function syncAllUsersToAuth() {
  console.log('🔄 Starting user sync to auth.users...\n');
  
  // Haal alle users op die nog geen auth user hebben
  const { data: users, error } = await supabase
    .from('users')
    .select('*')
    .not('email', 'is', null);
  
  if (error) {
    console.error('Error fetching users:', error);
    throw error;
  }
  
  console.log(`Found ${users.length} users to check\n`);
  
  let created = 0;
  let existing = 0;
  let failed = 0;
  
  for (const user of users) {
    try {
      const result = await createAuthUserFromUserRecord(user);
      if (result.created) {
        created++;
      } else {
        existing++;
      }
    } catch (error) {
      console.error(`   ❌ Failed for ${user.email}:`, error.message);
      failed++;
    }
  }
  
  console.log('\n📊 Sync Summary:');
  console.log(`   ✅ Created: ${created}`);
  console.log(`   ℹ️  Already existed: ${existing}`);
  console.log(`   ❌ Failed: ${failed}`);
  console.log(`   📝 Total: ${users.length}`);
  
  return { created, existing, failed, total: users.length };
}

// Run the sync
console.log('🔐 Sync Users naar Supabase Auth\n');
console.log('Dit script maakt auth users aan voor alle users in de database');
console.log('die nog geen auth account hebben.\n');

syncAllUsersToAuth()
  .then(result => {
    console.log('\n✅ Sync completed!');
    if (result.created > 0) {
      console.log('\n⚠️  BELANGRIJK: De aangemaakte users hebben een random temporary password.');
      console.log('   Users moeten hun wachtwoord resetten via de "Wachtwoord vergeten" flow.');
    }
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Sync failed:', error.message);
    process.exit(1);
  });
