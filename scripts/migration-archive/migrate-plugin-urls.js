#!/usr/bin/env node

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false }}
);

async function migratePluginUrls() {
  console.log('Starting plugin URL migration...\n');

  try {
    // Get all plugins with versions
    const { data: plugins, error } = await supabase
      .from('plugins')
      .select('id, name, versions')
      .not('versions', 'is', null);

    if (error) {
      throw error;
    }

    console.log(`Found ${plugins.length} plugins to process\n`);

    let processedCount = 0;
    let migratedCount = 0;
    let errorCount = 0;

    for (const plugin of plugins) {
      console.log(`Processing plugin: ${plugin.name} (ID: ${plugin.id})`);

      if (!plugin.versions || !Array.isArray(plugin.versions)) {
        console.log(`  Skipping - no versions array`);
        continue;
      }

      let hasChanges = false;
      const updatedVersions = plugin.versions.map(version => {
        if (!version.download_url) {
          return version;
        }

        // Skip if already migrated or WordPress.org URL
        if (version.download_url.includes('supabase') || version.download_url.includes('wordpress.org')) {
          return version;
        }

        // Replace base44.app URLs with the existing Supabase storage URLs
        if (version.download_url.includes('base44.app')) {
          // Extract the path after the last slash
          const urlParts = version.download_url.split('/');
          const fileName = urlParts[urlParts.length - 1];

          // Create new URL pointing to the existing Supabase storage
          const newUrl = `https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/${urlParts[urlParts.length - 2]}/${fileName}`;

          console.log(`  Migrating version ${version.version}:`);
          console.log(`    From: ${version.download_url}`);
          console.log(`    To:   ${newUrl}`);

          hasChanges = true;
          migratedCount++;

          return {
            ...version,
            download_url: newUrl
          };
        }

        return version;
      });

      // Update plugin if there were changes
      if (hasChanges) {
        const { error: updateError } = await supabase
          .from('plugins')
          .update({ versions: updatedVersions })
          .eq('id', plugin.id);

        if (updateError) {
          console.error(`Error updating plugin ${plugin.name}:`, updateError);
          errorCount++;
        } else {
          console.log(`  ✅ Updated plugin ${plugin.name}`);
        }
      } else {
        console.log(`  No changes needed for plugin ${plugin.name}`);
      }

      processedCount++;
      console.log(`  Progress: ${processedCount}/${plugins.length} plugins processed\n`);
    }

    console.log('\nMigration completed!');
    console.log(`Total plugins processed: ${processedCount}`);
    console.log(`URLs migrated: ${migratedCount}`);
    console.log(`Errors: ${errorCount}`);

  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

// Run the migration
migratePluginUrls();