#!/usr/bin/env node

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false }}
);

async function checkReferences() {
  const { data: users } = await supabase.from('users').select('id, email');
  const validUserIds = new Set(users.map(u => u.id));
  
  console.log('Valid user IDs:', validUserIds.size);
  console.log('\nChecking references in all tables...\n');
  
  // Sites
  const { data: sites } = await supabase.from('sites').select('id, name, owner_id');
  const invalidSites = sites.filter(s => s.owner_id && !validUserIds.has(s.owner_id));
  console.log(`Sites: ${sites.length} total, ${invalidSites.length} with invalid owner_id`);
  if (invalidSites.length > 0) {
    invalidSites.slice(0,5).forEach(s => console.log(`  - ${s.name}: owner_id=${s.owner_id.slice(0,8)}...`));
  }
  
  // Plugins
  const { data: plugins } = await supabase.from('plugins').select('id, name, owner_id');
  const invalidPlugins = plugins.filter(p => p.owner_id && !validUserIds.has(p.owner_id));
  console.log(`\nPlugins: ${plugins.length} total, ${invalidPlugins.length} with invalid owner_id`);
  if (invalidPlugins.length > 0) {
    invalidPlugins.slice(0,5).forEach(p => console.log(`  - ${p.name}: owner_id=${p.owner_id.slice(0,8)}...`));
  }
  
  // Teams
  const { data: teams } = await supabase.from('teams').select('id, name, owner_id');
  const invalidTeams = teams.filter(t => t.owner_id && !validUserIds.has(t.owner_id));
  console.log(`\nTeams: ${teams.length} total, ${invalidTeams.length} with invalid owner_id`);
  if (invalidTeams.length > 0) {
    invalidTeams.slice(0,5).forEach(t => console.log(`  - ${t.name}: owner_id=${t.owner_id.slice(0,8)}...`));
  }
  
  // Activity logs
  const { data: logs } = await supabase.from('activity_logs').select('id, user_id, action');
  const invalidLogs = logs.filter(l => l.user_id && !validUserIds.has(l.user_id));
  console.log(`\nActivity Logs: ${logs.length} total, ${invalidLogs.length} with invalid user_id`);
  
  // Projects
  const { data: projects } = await supabase.from('projects').select('id, name, owner_id');
  const invalidProjects = projects.filter(p => p.owner_id && !validUserIds.has(p.owner_id));
  console.log(`\nProjects: ${projects.length} total, ${invalidProjects.length} with invalid owner_id`);
  
  const totalInvalid = invalidSites.length + invalidPlugins.length + invalidTeams.length + 
                       invalidLogs.length + invalidProjects.length;
  
  console.log(`\n📊 Total invalid references: ${totalInvalid}`);
  
  if (totalInvalid > 0) {
    console.log('\n⚠️  These references need to be updated!');
    console.log('   Available user IDs:');
    users.forEach(u => console.log(`     - ${u.email}: ${u.id}`));
  }
}

checkReferences()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
