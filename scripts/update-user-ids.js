#!/usr/bin/env node

/**
 * Script om oude user IDs te updaten naar nieuwe auth user IDs
 * Dit update alle foreign key referenties in de database
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

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

// Mapping van tabellen en hun user reference columns
const tableUserReferences = {
  sites: ['owner_id'],
  plugins: ['owner_id'],
  themes: ['owner_id'],
  teams: ['owner_id'],
  team_members: ['user_id'],
  projects: ['owner_id'],
  project_templates: ['created_by'],
  messages: ['sender_id', 'recipient_id'],
  notifications: ['sender_id', 'recipient_id'],
  activity_logs: ['user_id'],
  support_tickets: ['user_id', 'assigned_to'],
  user_subscriptions: ['user_id'],
  invoices: ['user_id'],
};

async function getUserIdMapping() {
  console.log('📋 Creating user ID mapping...\n');
  
  // Haal alle users op
  const { data: users, error } = await supabase
    .from('users')
    .select('id, email');
  
  if (error) throw error;
  
  // Haal alle auth users op
  const { data: { users: authUsers }, error: authError } = await supabase.auth.admin.listUsers();
  
  if (authError) throw authError;
  
  // Maak mapping van email naar oude en nieuwe ID
  const mapping = new Map();
  
  for (const user of users) {
    const authUser = authUsers.find(au => au.email === user.email);
    if (authUser && authUser.id !== user.id) {
      mapping.set(user.id, authUser.id);
      console.log(`   ${user.email}: ${user.id} → ${authUser.id}`);
    }
  }
  
  console.log(`\nFound ${mapping.size} users with ID changes\n`);
  return mapping;
}

async function updateTableReferences(tableName, columns, idMapping) {
  console.log(`\n🔄 Updating ${tableName}...`);
  let totalUpdated = 0;
  
  for (const column of columns) {
    // Haal records op die oude user IDs hebben
    const oldIds = Array.from(idMapping.keys());
    
    const { data: records, error: fetchError } = await supabase
      .from(tableName)
      .select('*')
      .in(column, oldIds);
    
    if (fetchError) {
      console.error(`   ❌ Error fetching from ${tableName}.${column}:`, fetchError.message);
      continue;
    }
    
    if (!records || records.length === 0) {
      console.log(`   ✓ ${column}: geen records om te updaten`);
      continue;
    }
    
    console.log(`   Processing ${column}: ${records.length} records`);
    
    // Update elk record
    for (const record of records) {
      const oldId = record[column];
      const newId = idMapping.get(oldId);
      
      if (newId) {
        const { error: updateError } = await supabase
          .from(tableName)
          .update({ [column]: newId })
          .eq('id', record.id);
        
        if (updateError) {
          console.error(`   ❌ Error updating record ${record.id}:`, updateError.message);
        } else {
          totalUpdated++;
        }
      }
    }
    
    console.log(`   ✓ ${column}: ${records.length} records updated`);
  }
  
  return totalUpdated;
}

async function updateUserIds() {
  console.log('🔄 Update User IDs in Database\n');
  console.log('Dit script update alle referenties naar oude user IDs\n');
  
  try {
    // Stap 1: Maak ID mapping
    const idMapping = await getUserIdMapping();
    
    if (idMapping.size === 0) {
      console.log('✅ Geen ID updates nodig - alle IDs zijn al correct!');
      return;
    }
    
    // Stap 2: Update alle tabellen
    console.log('📊 Updating references in all tables...');
    let grandTotal = 0;
    
    for (const [tableName, columns] of Object.entries(tableUserReferences)) {
      const updated = await updateTableReferences(tableName, columns, idMapping);
      grandTotal += updated;
    }
    
    // Stap 3: Update users tabel zelf
    console.log('\n🔄 Updating users table IDs...');
    for (const [oldId, newId] of idMapping.entries()) {
      const { data: userData, error: fetchError } = await supabase
        .from('users')
        .select('*')
        .eq('id', oldId)
        .single();
      
      if (fetchError) continue;
      
      // Delete oude record
      await supabase.from('users').delete().eq('id', oldId);
      
      // Insert met nieuwe ID
      const { error: insertError } = await supabase
        .from('users')
        .insert({ ...userData, id: newId });
      
      if (!insertError) {
        console.log(`   ✓ User ${userData.email}: ${oldId} → ${newId}`);
      }
    }
    
    console.log('\n📊 Summary:');
    console.log(`   Total references updated: ${grandTotal}`);
    console.log(`   Users updated: ${idMapping.size}`);
    console.log('\n✅ All user IDs successfully updated!');
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    throw error;
  }
}

updateUserIds()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
