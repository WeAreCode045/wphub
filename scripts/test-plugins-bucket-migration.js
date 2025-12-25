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

    request.setTimeout(60000, () => { // 60 second timeout for large files
      request.destroy();
      reject(new Error('Download timeout'));
    });
  });
}

// Helper function to upload file to Supabase storage
async function uploadToPluginsBucket(filePath, fileName) {
  try {
    const fileBuffer = fs.readFileSync(filePath);

    const { data, error } = await supabase.storage
      .from('Plugins')
      .upload(fileName, fileBuffer, {
        contentType: 'application/zip',
        upsert: false
      });

    if (error) {
      throw error;
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('Plugins')
      .getPublicUrl(fileName);

    return urlData.publicUrl;
  } catch (error) {
    console.error(`Error uploading ${fileName}:`, error);
    throw error;
  }
}

async function testMigration() {
  console.log('Testing plugin migration to Plugins bucket...\n');

  try {
    // Get one plugin with external Supabase URL for testing
    const { data: plugins, error } = await supabase
      .from('plugins')
      .select('id, name, versions')
      .not('versions', 'is', null)
      .limit(1);

    if (error) {
      throw error;
    }

    if (plugins.length === 0) {
      console.log('No plugins found');
      return;
    }

    const plugin = plugins[0];
    console.log(`Testing with plugin: ${plugin.name} (ID: ${plugin.id})`);

    // Find a version with external Supabase URL
    const testVersion = plugin.versions.find(v =>
      v.download_url &&
      v.download_url.includes('qtrypzzcjebvfcihiynt.supabase.co')
    );

    if (!testVersion) {
      console.log('No external Supabase URLs found to test');
      return;
    }

    console.log(`Testing version ${testVersion.version}...`);
    console.log(`Original URL: ${testVersion.download_url}`);

    // Create temp directory
    const tempDir = path.join(__dirname, '..', 'temp_test');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    // Extract filename from URL
    const urlParts = testVersion.download_url.split('/');
    const fileName = urlParts[urlParts.length - 1];
    const tempFilePath = path.join(tempDir, fileName);

    // Download file
    console.log('Downloading file...');
    await downloadFile(testVersion.download_url, tempFilePath);

    const stats = fs.statSync(tempFilePath);
    console.log(`Downloaded ${Math.round(stats.size / 1024 / 1024 * 100) / 100} MB`);

    // Upload to Plugins bucket
    console.log('Uploading to Plugins bucket...');
    const newUrl = await uploadToPluginsBucket(tempFilePath, fileName);

    console.log(`✅ Successfully migrated to: ${newUrl}`);

    // Clean up
    fs.unlinkSync(tempFilePath);
    fs.rmSync(tempDir, { recursive: true, force: true });

    console.log('Test completed successfully!');

  } catch (error) {
    console.error('Test failed:', error);
  }
}

testMigration();