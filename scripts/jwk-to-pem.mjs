import fs from 'fs';
import path from 'path';
import { createPublicKey } from 'crypto';

const __dirname = path.resolve();
const jwkPath = path.join(__dirname, 'keys', 'supabase_jwk.json');
if (!fs.existsSync(jwkPath)) {
  console.error('JWK file not found:', jwkPath);
  process.exit(1);
}

const jwk = JSON.parse(fs.readFileSync(jwkPath, 'utf8'));

try {
  const keyObject = createPublicKey({ key: jwk, format: 'jwk' });
  const pem = keyObject.export({ type: 'spki', format: 'pem' });
  const outPath = path.join(__dirname, 'keys', 'supabase_pub.pem');
  fs.writeFileSync(outPath, pem);
  console.log('Wrote PEM to', outPath);
} catch (err) {
  console.error('Failed to convert JWK to PEM:', err.message || err);
  process.exit(2);
}
