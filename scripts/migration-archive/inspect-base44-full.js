import * as dotenv from 'dotenv';
dotenv.config();

const base44AppId = process.env.VITE_BASE44_APP_ID;
const base44ApiKey = '90b9134429824eaa84994aaf30ad9895';

async function fetchBase44Entity(entityName) {
  const url = `https://app.base44.com/api/apps/${base44AppId}/entities/${entityName}`;
  
  const response = await fetch(url, {
    headers: {
      'api_key': base44ApiKey,
      'Content-Type': 'application/json'
    }
  });
  
  if (!response.ok) {
    console.log(`❌ ${entityName}: HTTP ${response.status}`);
    return null;
  }
  
  return await response.json();
}

async function inspectEntity(entityName) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`📋 ${entityName}`);
  console.log('='.repeat(70));
  
  const data = await fetchBase44Entity(entityName);
  
  if (!data || !Array.isArray(data) || data.length === 0) {
    console.log('⚠️  Geen data beschikbaar\n');
    return;
  }
  
  console.log(`✅ ${data.length} records gevonden\n`);
  
  // Verzamel alle unieke velden
  const allFields = new Set();
  data.forEach(item => {
    Object.keys(item).forEach(key => allFields.add(key));
  });
  
  console.log(`Velden (${allFields.size}):`);
  const sortedFields = Array.from(allFields).sort();
  
  sortedFields.forEach(field => {
    const sample = data.find(item => item[field] !== undefined && item[field] !== null);
    if (sample) {
      const value = sample[field];
      let type = typeof value;
      
      if (value === null) type = 'null';
      else if (Array.isArray(value)) type = `array[${value.length}]`;
      else if (type === 'object') type = `object`;
      
      console.log(`  ${field.padEnd(35)} ${type}`);
    } else {
      console.log(`  ${field.padEnd(35)} (altijd null)`);
    }
  });
  
  // Toon sample record
  console.log('\n📄 Sample record (eerste item):');
  console.log(JSON.stringify(data[0], null, 2).substring(0, 800));
  if (JSON.stringify(data[0]).length > 800) console.log('...(truncated)');
}

const entities = [
  'User', 'Site', 'Plugin', 'Theme', 'Team', 'TeamRole',
  'Project', 'ProjectTemplate', 'Message', 'Notification',
  'ActivityLog', 'SupportTicket', 'SubscriptionPlan',
  'UserSubscription', 'Invoice', 'SiteSettings', 'Connector'
];

console.log('🔍 Base44 Entity Inspector - Analyseer alle velden\n');

for (const entity of entities) {
  await inspectEntity(entity);
}

console.log('\n\n✨ Inspectie voltooid!');
