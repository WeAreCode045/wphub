#!/usr/bin/env node

console.log('🔍 Base44 Credentials Finder\n');
console.log('Om je Base44 app credentials te vinden:\n');

console.log('1️⃣  Open je Base44 app in een browser:');
console.log('   https://wp-plugin-hub-45f316e7.base44.app\n');

console.log('2️⃣  Na inloggen, kijk naar de URL in je browser');
console.log('   De URL zou parameters moeten bevatten zoals:\n');
console.log('   https://wp-plugin-hub-45f316e7.base44.app?app_id=XXX&server_url=https://...\n');

console.log('3️⃣  Kopieer de waarden en update je .env bestand:\n');
console.log('   VITE_BASE44_APP_ID=<waarde van app_id>');
console.log('   VITE_BASE44_BACKEND_URL=<waarde van server_url>\n');

console.log('📝 Alternatief: Als je toegang hebt tot Base44 dashboard:');
console.log('   - Ga naar je app settings in Base44');
console.log('   - Zoek naar "App ID" en "Backend URL"\n');

console.log('💡 Veel voorkomende Base44 backend URLs:');
console.log('   - https://api.base44.com');
console.log('   - https://eu.api.base44.com');
console.log('   - https://us.api.base44.com\n');

console.log('Zodra je deze hebt ingevuld, run: npm run migrate');
