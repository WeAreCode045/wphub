// Supabase adapter - behoudt Base44 API interface maar gebruikt Supabase
import { supabaseAdapter } from './supabaseAdapter';

// Export de adapter met dezelfde interface als Base44
export const base44 = supabaseAdapter;

// Voor backwards compatibility, export ook oude Base44 client indien nodig
// import { createClient } from '@base44/sdk';
// import { appParams } from '@/lib/app-params';
// const { appId, serverUrl, token, functionsVersion } = appParams;
// export const base44Original = createClient({
//   appId,
//   serverUrl,
//   token,
//   functionsVersion,
//   requiresAuth: false
// });
