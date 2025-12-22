import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ SUPABASE_URL en SUPABASE_SERVICE_ROLE_KEY moeten worden ingesteld');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Alle tabellen om te controleren
const TABLES = [
  'users',
  'sites',
  'plugins',
  'themes',
  'teams',
  'team_roles',
  'team_members',
  'projects',
  'project_templates',
  'messages',
  'notifications',
  'activity_logs',
  'support_tickets',
  'subscription_plans',
  'user_subscriptions',
  'invoices',
  'site_settings',
  'connectors',
  'plugin_installations',
];

async function verifyMigration() {
  console.log('🔍 Verificatie van migratie naar Supabase\n');
  console.log('='.repeat(60));
  
  const results = [];
  let totalRecords = 0;
  
  for (const table of TABLES) {
    try {
      // Tel aantal records
      const { count, error } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true });
      
      if (error) {
        console.log(`❌ ${table.padEnd(25)} ERROR: ${error.message}`);
        results.push({ table, count: 0, status: 'error', error: error.message });
      } else {
        const countStr = count !== null ? count.toString().padStart(6) : '     ?';
        const icon = count > 0 ? '✅' : '⚠️ ';
        console.log(`${icon} ${table.padEnd(25)} ${countStr} records`);
        results.push({ table, count: count || 0, status: count > 0 ? 'ok' : 'empty' });
        totalRecords += count || 0;
      }
    } catch (error) {
      console.log(`❌ ${table.padEnd(25)} EXCEPTION: ${error.message}`);
      results.push({ table, count: 0, status: 'exception', error: error.message });
    }
  }
  
  console.log('='.repeat(60));
  console.log(`\n📊 Totaal: ${totalRecords} records over ${TABLES.length} tabellen\n`);
  
  // Samenvatting
  const okTables = results.filter(r => r.status === 'ok').length;
  const emptyTables = results.filter(r => r.status === 'empty').length;
  const errorTables = results.filter(r => r.status === 'error' || r.status === 'exception').length;
  
  console.log('📈 Samenvatting:');
  console.log(`   ✅ Tabellen met data: ${okTables}`);
  console.log(`   ⚠️  Lege tabellen: ${emptyTables}`);
  console.log(`   ❌ Fouten: ${errorTables}`);
  
  if (errorTables > 0) {
    console.log('\n🔴 Tabellen met fouten:');
    results
      .filter(r => r.status === 'error' || r.status === 'exception')
      .forEach(r => {
        console.log(`   - ${r.table}: ${r.error}`);
      });
  }
  
  // Test enkele relaties
  console.log('\n🔗 Test relaties:');
  await testRelations();
  
  console.log('\n✨ Verificatie voltooid!');
}

async function testRelations() {
  // Test 1: Sites met teams
  try {
    const { data, error } = await supabase
      .from('sites')
      .select('name, teams(name)')
      .limit(5);
    
    if (error) {
      console.log('   ⚠️  Sites -> Teams: Kan niet testen');
    } else {
      const withTeams = data?.filter(s => s.teams).length || 0;
      console.log(`   ✅ Sites -> Teams: ${withTeams}/${data?.length || 0} sites hebben een team`);
    }
  } catch (e) {
    console.log('   ⚠️  Sites -> Teams: Schema mogelijk niet volledig');
  }
  
  // Test 2: Projects met sites
  try {
    const { data, error } = await supabase
      .from('projects')
      .select('name, sites(name)')
      .limit(5);
    
    if (error) {
      console.log('   ⚠️  Projects -> Sites: Kan niet testen');
    } else {
      const withSites = data?.filter(p => p.sites).length || 0;
      console.log(`   ✅ Projects -> Sites: ${withSites}/${data?.length || 0} projects hebben een site`);
    }
  } catch (e) {
    console.log('   ⚠️  Projects -> Sites: Schema mogelijk niet volledig');
  }
  
  // Test 3: User subscriptions met plans
  try {
    const { data, error } = await supabase
      .from('user_subscriptions')
      .select('id, subscription_plans(name)')
      .limit(5);
    
    if (error) {
      console.log('   ⚠️  User Subscriptions -> Plans: Kan niet testen');
    } else {
      const withPlans = data?.filter(s => s.subscription_plans).length || 0;
      console.log(`   ✅ User Subscriptions -> Plans: ${withPlans}/${data?.length || 0} subscriptions hebben een plan`);
    }
  } catch (e) {
    console.log('   ⚠️  User Subscriptions -> Plans: Schema mogelijk niet volledig');
  }
}

// Voer verificatie uit
verifyMigration().catch(error => {
  console.error('\n💥 Fatale fout:', error);
  process.exit(1);
});
