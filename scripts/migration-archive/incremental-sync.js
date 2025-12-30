import { createClient } from '@supabase/supabase-js';
import { base44 } from '../src/api/base44Client.js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ SUPABASE_URL en SUPABASE_SERVICE_ROLE_KEY moeten worden ingesteld');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Entities die incrementeel gesynchroniseerd moeten worden
const SYNC_ENTITIES = [
  'Site',
  'Plugin',
  'Theme',
  'Message',
  'Notification',
  'ActivityLog',
  'SupportTicket',
];

const TABLE_MAPPING = {
  'Site': 'sites',
  'Plugin': 'plugins',
  'Theme': 'themes',
  'Message': 'messages',
  'Notification': 'notifications',
  'ActivityLog': 'activity_logs',
  'SupportTicket': 'support_tickets',
};

function transformData(entityName, data) {
  const { _id, _created_at, _updated_at, ...rest } = data;
  
  if (data.id) {
    rest.base44_id = data.id;
  }
  
  if (data.created_date) {
    try {
      rest.created_at = new Date(data.created_date).toISOString();
    } catch (e) {
      rest.created_at = new Date().toISOString();
    }
  }
  
  if (data.updated_date) {
    try {
      rest.updated_at = new Date(data.updated_date).toISOString();
    } catch (e) {
      rest.updated_at = new Date().toISOString();
    }
  }
  
  return rest;
}

async function syncEntity(entityName, since) {
  console.log(`\n📦 Synchroniseren van ${entityName}...`);
  
  try {
    const tableName = TABLE_MAPPING[entityName];
    if (!tableName) {
      console.warn(`⚠️  Geen table mapping voor ${entityName}`);
      return { synced: 0, errors: 0 };
    }

    // Haal recente updates op van Base44
    const allData = await base44.entities[entityName].list('-updated_date', 1000);
    
    // Filter op basis van since timestamp
    const recentData = since 
      ? allData.filter(item => {
          const updatedDate = item.updated_date || item.created_date;
          return updatedDate && new Date(updatedDate) > since;
        })
      : allData;
    
    console.log(`   Gevonden: ${recentData.length} nieuwe/gewijzigde records`);
    
    if (recentData.length === 0) {
      console.log(`   ✅ Geen updates gevonden`);
      return { synced: 0, errors: 0 };
    }

    // Sync in batches
    const BATCH_SIZE = 50;
    let synced = 0;
    let errors = 0;

    for (let i = 0; i < recentData.length; i += BATCH_SIZE) {
      const batch = recentData.slice(i, i + BATCH_SIZE);
      const transformedBatch = batch.map(item => transformData(entityName, item));

      try {
        const { error } = await supabase
          .from(tableName)
          .upsert(transformedBatch, { onConflict: 'base44_id' });

        if (error) {
          console.error(`   ❌ Batch fout: ${error.message}`);
          errors += batch.length;
        } else {
          synced += batch.length;
          console.log(`   ✅ Batch gesynchroniseerd: ${batch.length} records`);
        }
      } catch (error) {
        console.error(`   ❌ Onverwachte fout: ${error.message}`);
        errors += batch.length;
      }
    }

    console.log(`   ✨ Klaar: ${synced} gesynchroniseerd, ${errors} fouten`);
    return { synced, errors };

  } catch (error) {
    console.error(`❌ Fout bij synchroniseren van ${entityName}:`, error.message);
    return { synced: 0, errors: 1 };
  }
}

async function incrementalSync() {
  console.log('🔄 Incrementele synchronisatie Base44 -> Supabase\n');
  console.log('='.repeat(60));
  
  const startTime = Date.now();
  
  // Bepaal sinds wanneer we synchroniseren (laatste 24 uur)
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  console.log(`📅 Synchroniseren vanaf: ${since.toISOString()}\n`);

  const results = {
    totalSynced: 0,
    totalErrors: 0,
  };

  // Synchroniseer elke entity
  for (const entityName of SYNC_ENTITIES) {
    const { synced, errors } = await syncEntity(entityName, since);
    results.totalSynced += synced;
    results.totalErrors += errors;
  }

  // Toon statistieken
  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  
  console.log('\n' + '='.repeat(60));
  console.log('📊 Synchronisatie Statistieken');
  console.log('='.repeat(60));
  console.log(`⏱️  Duur: ${duration}s`);
  console.log(`✅ Gesynchroniseerd: ${results.totalSynced}`);
  console.log(`❌ Fouten: ${results.totalErrors}`);
  console.log('='.repeat(60));

  if (results.totalErrors > 0) {
    console.log('\n⚠️  Synchronisatie voltooid met fouten');
    process.exit(1);
  } else {
    console.log('\n✨ Synchronisatie succesvol voltooid!');
    process.exit(0);
  }
}

// Voer incrementele sync uit
incrementalSync().catch(error => {
  console.error('\n💥 Fatale fout:', error);
  process.exit(1);
});
