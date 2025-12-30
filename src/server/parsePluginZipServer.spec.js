import assert from 'assert';
import { parsePluginZip } from './parsePluginZipServer.js';

async function runTests() {
  console.log('Running parsePluginZip basic test...');
  const testUrl = 'https://github.com/woocommerce/woocommerce/archive/refs/heads/trunk.zip';
  try {
    const result = await parsePluginZip(testUrl);
    assert.ok(result.fileNames && result.fileNames.length > 0, 'Should list files from zip');
    console.log('OK: file list length =', result.fileNames.length);
  } catch (err) {
    console.error('Test failed:', err);
    process.exitCode = 1;
  }
}

if (process.env.NODE_ENV !== 'production') runTests();
