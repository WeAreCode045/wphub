#!/usr/bin/env node

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false }}
);

async function checkLinks() {
  const { data: users } = await supabase.from('users').select('id, email');
  const validIds = new Set(users.map(u => u.id));
  
  console.log('Valid User IDs:');
  users.forEach(u => console.log('  -', u.email, ':', u.id));
  
  console.log('\n📋 Checking Sites:');
  const { data: sites } = await supabase.from('sites').select('id, name, owner_id, owner_type');
  let invalidSites = 0;
  sites.forEach(s => {
    const isValid = !s.owner_id || validIds.has(s.owner_id);
    const mark = isValid ? '✅' : '❌';
    if (!isValid) invalidSites++;
    console.log(`${mark} ${s.name} | owner_id: ${s.owner_id?.slice(0,8)}... | type: ${s.owner_type}`);
  });
  
  console.log('\n📋 Checking Teams:');
  const { data: teams } = await supabase.from('teams').select('id, name, owner_id');
  let invalidTeams = 0;
  teams.forEach(t => {
    const isValid = !t.owner_id || validIds.has(t.owner_id);
    const mark = isValid ? '✅' : '❌';
    if (!isValid) invalidTeams++;
    console.log(`${mark} ${t.name} | owner_id: ${t.owner_id?.slice(0,8)}...`);
  });
  
  console.log('\n📋 Checking User Subscriptions:');
  const { data: subs } = await supabase.from('user_subscriptions').select('id, user_id, status');
  let invalidSubs = 0;
  subs.forEach(s => {
    const isValid = !s.user_id || validIds.has(s.user_id);
    const mark = isValid ? '✅' : '❌';
    if (!isValid) invalidSubs++;
    console.log(`${mark} Sub ${s.id.slice(0,8)}... | user_id: ${s.user_id?.slice(0,8)}... | status: ${s.status}`);
  });
  
  console.log('\n📊 Summary:');
  console.log(`  Sites: ${invalidSites} invalid out of ${sites.length}`);
  console.log(`  Teams: ${invalidTeams} invalid out of ${teams.length}`);
  console.log(`  Subscriptions: ${invalidSubs} invalid out of ${subs.length}`);
}

checkLinks()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
