import { supabaseAdmin } from './supabaseClient.js';

/**
 * Maak een Supabase Auth user aan voor een user in de users tabel
 * Deze functie moet server-side gebruikt worden (met service role key)
 */
export async function createAuthUserFromUserRecord(userRecord) {
  const { id, email, full_name, role } = userRecord;
  
  try {
    // Check of auth user al bestaat
    const { data: existingAuthUser } = await supabaseAdmin.auth.admin.getUserById(id);
    
    if (existingAuthUser?.user) {
      console.log(`Auth user already exists for ${email}`);
      return { success: true, authUser: existingAuthUser.user, created: false };
    }
  } catch (error) {
    // User bestaat niet, ga door met aanmaken
  }
  
  // Genereer een random temporary wachtwoord
  const tempPassword = generateRandomPassword();
  
  // Maak auth user aan
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    id: id, // Gebruik hetzelfde ID
    email: email,
    password: tempPassword,
    email_confirm: true, // Auto-confirm email
    user_metadata: {
      full_name: full_name || email.split('@')[0],
      role: role || 'user',
    }
  });
  
  if (authError) {
    console.error('Error creating auth user:', authError);
    throw authError;
  }
  
  console.log(`✅ Created auth user for ${email}`);
  console.log(`   Temporary password: ${tempPassword}`);
  console.log(`   ⚠️  User should reset password via password reset flow`);
  
  return { 
    success: true, 
    authUser: authData.user, 
    created: true,
    tempPassword: tempPassword // Only return this in development/setup
  };
}

/**
 * Sync alle users uit de users tabel naar auth.users
 */
export async function syncAllUsersToAuth() {
  console.log('🔄 Starting user sync to auth.users...\n');
  
  // Haal alle users op die nog geen auth user hebben
  const { data: users, error } = await supabaseAdmin
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
      console.error(`Failed to create auth user for ${user.email}:`, error.message);
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

function generateRandomPassword(length = 16) {
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
  let password = '';
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  for (let i = 0; i < length; i++) {
    password += charset[array[i] % charset.length];
  }
  return password;
}
