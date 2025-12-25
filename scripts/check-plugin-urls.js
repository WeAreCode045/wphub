#!/usr/bin/env node

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false }}
);

async function checkPluginUrls() {
  console.log('Checking plugin download URLs...\n');

  try {
    const { data: plugins, error } = await supabase
      .from('plugins')
      .select('id, name, versions')
      .not('versions', 'is', null)
      .limit(10); // Check first 10 plugins

    if (error) {
      throw error;
    }

    console.log(`Found ${plugins.length} plugins with versions\n`);

    for (const plugin of plugins) {
      console.log(`Plugin: ${plugin.name} (ID: ${plugin.id})`);

      if (plugin.versions && Array.isArray(plugin.versions)) {
        plugin.versions.forEach((version, index) => {
          console.log(`  Version ${version.version}: ${version.download_url}`);
          if (version.download_url && !version.download_url.includes('supabase')) {
            console.log(`    ⚠️  Local URL detected`);
          } else if (version.download_url && version.download_url.includes('supabase')) {
            console.log(`    ✅ Already migrated`);
          }
        });
      }
      console.log('');
    }

  } catch (error) {
    console.error('Error:', error);
  }
}

checkPluginUrls();