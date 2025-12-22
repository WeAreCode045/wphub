import { base44 } from '../src/api/base44Client.js';

// Script om sample data te inspecteren en het schema te analyseren
const ENTITIES = [
  'User',
  'Site',
  'Plugin',
  'Theme',
  'Team',
  'TeamRole',
  'Project',
  'Message',
  'Notification',
  'ActivityLog',
];

async function inspectEntity(entityName) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`📋 ${entityName}`);
  console.log('='.repeat(60));
  
  try {
    if (!base44.entities[entityName]) {
      console.log('⚠️  Entity niet beschikbaar in SDK');
      return;
    }

    // Haal sample data op (max 5 items)
    const items = await base44.entities[entityName].list('-created_date', 5);
    
    if (items.length === 0) {
      console.log('⚠️  Geen data beschikbaar');
      return;
    }
    
    console.log(`✅ Gevonden: ${items.length} items\n`);
    
    // Analyseer eerste item
    const sample = items[0];
    const fields = Object.keys(sample);
    
    console.log('Velden:');
    fields.forEach(field => {
      const value = sample[field];
      const type = typeof value;
      let typeDesc = type;
      
      if (value === null) {
        typeDesc = 'null';
      } else if (Array.isArray(value)) {
        typeDesc = `array[${value.length}]`;
        if (value.length > 0) {
          typeDesc += ` (${typeof value[0]})`;
        }
      } else if (type === 'object') {
        typeDesc = `object (${Object.keys(value).length} keys)`;
      }
      
      console.log(`  - ${field.padEnd(25)} ${typeDesc}`);
    });
    
    // Toon sample JSON
    console.log('\nSample JSON:');
    console.log(JSON.stringify(sample, null, 2).substring(0, 500));
    if (JSON.stringify(sample).length > 500) {
      console.log('...(truncated)');
    }
    
  } catch (error) {
    console.error(`❌ Fout: ${error.message}`);
  }
}

async function inspect() {
  console.log('🔍 Base44 Entity Inspector\n');
  console.log('Dit script helpt om de structuur van Base44 entities te analyseren');
  
  for (const entityName of ENTITIES) {
    await inspectEntity(entityName);
  }
  
  console.log('\n\n✨ Inspectie voltooid!');
}

inspect().catch(error => {
  console.error('\n💥 Fatale fout:', error);
  process.exit(1);
});
