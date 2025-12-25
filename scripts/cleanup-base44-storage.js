#!/usr/bin/env node

// Script om oude base44 localStorage keys op te ruimen
// Dit script kan worden uitgevoerd in de browser console

console.log('🧹 Opruimen oude base44 localStorage keys...');

// Lijst van oude base44 keys die moeten worden verwijderd
const oldKeys = [
  'base44_app_id',
  'base44_server_url',
  'base44_token',
  'base44_from_url',
  'base44_functions_version'
];

let cleanedCount = 0;

oldKeys.forEach(key => {
  if (localStorage.getItem(key)) {
    localStorage.removeItem(key);
    console.log(`✅ Verwijderd: ${key}`);
    cleanedCount++;
  }
});

if (cleanedCount > 0) {
  console.log(`\n🎉 ${cleanedCount} oude base44 localStorage keys zijn opgeschoond!`);
  console.log('De app gebruikt nu wphub_ prefixed keys.');
} else {
  console.log('\n✨ Geen oude base44 keys gevonden om op te ruimen.');
}

// Toon huidige wphub keys
const wphubKeys = Object.keys(localStorage).filter(key => key.startsWith('wphub_'));
if (wphubKeys.length > 0) {
  console.log('\n📋 Huidige wphub localStorage keys:');
  wphubKeys.forEach(key => {
    console.log(`   ${key}: ${localStorage.getItem(key)}`);
  });
}

export default {};