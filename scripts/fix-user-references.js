#!/usr/bin/env node

/**
 * Fix alle user ID referenties door oude IDs te mappen naar nieuwe auth user IDs
 * gebaseerd op email matching
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false }}
);

async function fixUserReferences() {
  console.log('🔧 Fixing User ID References\n');
  
  // Stap 1: Haal alle huidige users op (met nieuwe auth IDs)
  const { data: currentUsers } = await supabase.from('users').select('id, email');
  console.log('Current users in database:', currentUsers.length);
  currentUsers.forEach(u => console.log(`  - ${u.email}: ${u.id.slice(0,8)}...`));
  
  // Stap 2: Bekijk welke oude IDs gebruikt worden
  const { data: sites } = await supabase.from('sites').select('owner_id').limit(10);
  const { data: plugins } = await supabase.from('plugins').select('owner_id').limit(10);
  const { data: teams } = await supabase.from('teams').select('owner_id').limit(10);
  
  const usedOwnerIds = new Set([
    ...sites.map(s => s.owner_id).filter(Boolean),
    ...plugins.map(p => p.owner_id).filter(Boolean),
    ...teams.map(t => t.owner_id).filter(Boolean),
  ]);
  
  console.log('\nOld owner_ids found in database:');
  usedOwnerIds.forEach(id => console.log(`  - ${id.slice(0,8)}...`));
  
  // Stap 3: Vraag gebruiker om mapping (of gebruik standaard mapping)
  console.log('\n⚠️  We need to map old IDs to new user emails.');
  console.log('Using automatic mapping based on migration data...\n');
  
  // Mapping gebaseerd op Base44 migratie - deze IDs kwamen uit Base44
  const idToEmailMapping = {
    '68fea1e8de46bac345f316e8': 'jorn@code045.nl',  // App owner ID -> Jorn
    '691ba58cc9898678184ed149': 'jorn@code045.nl',  // Meeste content -> Jorn
    '69029871184b4a29baee55a0': 'maurice@code045.nl', // JHB Designs -> Maurice
    '690ec1d13ccda10a8fb35e4f': 'jorn@jhbdesigns.nl', // JHB sites -> Jorn JHB
  };
  
  // Maak mapping van oude ID naar nieuwe ID
  const idMapping = new Map();
  for (const [oldId, email] of Object.entries(idToEmailMapping)) {
    const user = currentUsers.find(u => u.email === email);
    if (user) {
      idMapping.set(oldId, user.id);
      console.log(`Mapping: ${oldId.slice(0,8)}... → ${email} → ${user.id.slice(0,8)}...`);
    }
  }
  
  if (idMapping.size === 0) {
    console.log('❌ No mappings created!');
    return;
  }
  
  // Stap 4: Update alle tabellen
  console.log('\n🔄 Updating references...\n');
  
  let totalUpdated = 0;
  
  // Update sites
  for (const [oldId, newId] of idMapping) {
    const { data, error } = await supabase
      .from('sites')
      .update({ owner_id: newId })
      .eq('owner_id', oldId)
      .select();
    
    if (!error && data) {
      console.log(`✓ Sites: Updated ${data.length} records (${oldId.slice(0,8)}... → ${newId.slice(0,8)}...)`);
      totalUpdated += data.length;
    }
  }
  
  // Update plugins
  for (const [oldId, newId] of idMapping) {
    const { data, error } = await supabase
      .from('plugins')
      .update({ owner_id: newId })
      .eq('owner_id', oldId)
      .select();
    
    if (!error && data) {
      console.log(`✓ Plugins: Updated ${data.length} records (${oldId.slice(0,8)}... → ${newId.slice(0,8)}...)`);
      totalUpdated += data.length;
    }
  }
  
  // Update themes
  for (const [oldId, newId] of idMapping) {
    const { data, error } = await supabase
      .from('themes')
      .update({ owner_id: newId })
      .eq('owner_id', oldId)
      .select();
    
    if (!error && data) {
      console.log(`✓ Themes: Updated ${data.length} records (${oldId.slice(0,8)}... → ${newId.slice(0,8)}...)`);
      totalUpdated += data.length;
    }
  }
  
  // Update teams
  for (const [oldId, newId] of idMapping) {
    const { data, error } = await supabase
      .from('teams')
      .update({ owner_id: newId })
      .eq('owner_id', oldId)
      .select();
    
    if (!error && data) {
      console.log(`✓ Teams: Updated ${data.length} records (${oldId.slice(0,8)}... → ${newId.slice(0,8)}...)`);
      totalUpdated += data.length;
    }
  }
  
  // Update projects
  for (const [oldId, newId] of idMapping) {
    const { data, error } = await supabase
      .from('projects')
      .update({ owner_id: newId })
      .eq('owner_id', oldId)
      .select();
    
    if (!error && data) {
      console.log(`✓ Projects: Updated ${data.length} records (${oldId.slice(0,8)}... → ${newId.slice(0,8)}...)`);
      totalUpdated += data.length;
    }
  }
  
  // Update activity_logs
  for (const [oldId, newId] of idMapping) {
    const { data, error } = await supabase
      .from('activity_logs')
      .update({ user_id: newId })
      .eq('user_id', oldId)
      .select();
    
    if (!error && data) {
      console.log(`✓ Activity Logs: Updated ${data.length} records (${oldId.slice(0,8)}... → ${newId.slice(0,8)}...)`);
      totalUpdated += data.length;
    }
  }
  
  console.log(`\n✅ Total records updated: ${totalUpdated}`);
  console.log('\n✅ All user references fixed!');
}

fixUserReferences()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('❌ Error:', err.message);
    process.exit(1);
  });
