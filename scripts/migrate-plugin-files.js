#!/usr/bin/env node

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import https from 'https';
import http from 'http';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false }}
);

// Helper function to download file from URL
function downloadFile(url, destPath, maxRedirects = 5) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https:') ? https : http;

    const request = protocol.get(url, (response) => {
      // Handle redirects
      if (response.statusCode === 301 || response.statusCode === 302) {
        if (maxRedirects === 0) {
          reject(new Error('Too many redirects'));
          return;
        }
        const redirectUrl = response.headers.location;
        console.log(`    Redirecting to: ${redirectUrl}`);
        downloadFile(redirectUrl, destPath, maxRedirects - 1).then(resolve).catch(reject);
        return;
      }

      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download file: ${response.statusCode} ${response.statusMessage}`));
        return;
      }

      const fileStream = fs.createWriteStream(destPath);
      response.pipe(fileStream);

      fileStream.on('finish', () => {
        fileStream.close();
        resolve();
      });

      fileStream.on('error', (err) => {
        fs.unlink(destPath, () => {}); // Delete the file on error
        reject(err);
      });
    });

    request.on('error', (err) => {
      reject(err);
    });

    request.setTimeout(30000, () => {
      request.destroy();
      reject(new Error('Download timeout'));
    });
  });
}

// Helper function to upload file to Supabase storage
async function uploadToSupabase(filePath, fileName, bucket = 'uploads') {
  try {
    const fileBuffer = fs.readFileSync(filePath);

    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(`plugins/${fileName}`, fileBuffer, {
        contentType: 'application/zip',
        upsert: false
      });

    if (error) {
      throw error;
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from(bucket)
      .getPublicUrl(`plugins/${fileName}`);

    return urlData.publicUrl;
  } catch (error) {
    console.error(`Error uploading ${fileName}:`, error);
    throw error;
  }
}

async function migratePluginFiles() {
  console.log('Starting plugin file migration to Supabase storage...\n');

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

    // Create temp directory for downloads
    const tempDir = path.join(__dirname, '..', 'temp_plugins');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    for (const plugin of plugins) {
      console.log(`Processing plugin: ${plugin.name} (ID: ${plugin.id})`);

      if (!plugin.versions || !Array.isArray(plugin.versions)) {
        console.log(`  Skipping - no versions array`);
        continue;
      }

      const updatedVersions = [];

      for (const version of plugin.versions) {
        if (!version.download_url) {
          console.log(`  Skipping version ${version.version} - no download_url`);
          updatedVersions.push(version);
          continue;
        }

        // Check if URL is already a Supabase storage URL or WordPress.org URL
        if (version.download_url.includes('supabase') || version.download_url.includes('wordpress.org')) {
          console.log(`  Skipping version ${version.version} - already migrated or WordPress.org URL`);
          updatedVersions.push(version);
          continue;
        }

        try {
          console.log(`  Migrating version ${version.version}...`);

          // Generate unique filename
          const fileName = `${plugin.id}_${version.version}_${Date.now()}.zip`;
          const tempFilePath = path.join(tempDir, fileName);

          // Download file
          console.log(`    Downloading from: ${version.download_url}`);
          await downloadFile(version.download_url, tempFilePath);

          // Upload to Supabase storage
          console.log(`    Uploading to Supabase storage...`);
          const newUrl = await uploadToSupabase(tempFilePath, fileName);

          // Update version with new URL
          updatedVersions.push({
            ...version,
            download_url: newUrl
          });

          // Clean up temp file
          fs.unlinkSync(tempFilePath);

          console.log(`    ✅ Migrated to: ${newUrl}`);
          migratedCount++;

        } catch (error) {
          console.error(`    ❌ Error migrating version ${version.version}:`, error.message);
          // Keep original URL on error
          updatedVersions.push(version);
          errorCount++;
        }
      }

      // Update plugin with new versions
      if (updatedVersions.length > 0) {
        const { error: updateError } = await supabase
          .from('plugins')
          .update({ versions: updatedVersions })
          .eq('id', plugin.id);

        if (updateError) {
          console.error(`Error updating plugin ${plugin.name}:`, updateError);
          errorCount++;
        } else {
          console.log(`  Updated plugin ${plugin.name} with ${updatedVersions.length} versions`);
        }
      }

      processedCount++;
      console.log(`  Progress: ${processedCount}/${plugins.length} plugins processed\n`);
    }

    // Clean up temp directory
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch (error) {
      console.warn('Warning: Could not clean up temp directory:', error.message);
    }

    console.log('\nMigration completed!');
    console.log(`Total plugins processed: ${processedCount}`);
    console.log(`Files migrated: ${migratedCount}`);
    console.log(`Errors: ${errorCount}`);

  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

// Run the migration
migratePluginFiles();