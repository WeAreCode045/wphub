#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { createPublicKey } = require('crypto');

const jwkPath = path.resolve(__dirname, '..', 'keys', 'supabase_jwk.json');
if (!fs.existsSync(jwkPath)) {
  console.error('JWK file not found:', jwkPath);
  process.exit(1);
}

const jwk = JSON.parse(fs.readFileSync(jwkPath, 'utf8'));

try {
  const keyObject = createPublicKey({ key: jwk, format: 'jwk' });
  const pem = keyObject.export({ type: 'spki', format: 'pem' });
  const outPath = path.resolve(__dirname, '..', 'keys', 'supabase_pub.pem');
  fs.writeFileSync(outPath, pem);
  console.log('Wrote PEM to', outPath);
} catch (err) {
  console.error('Failed to convert JWK to PEM:', err.message || err);
  process.exit(2);
}
