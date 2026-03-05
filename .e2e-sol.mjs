// e2e: seal with the community repo's run-record.ts, POST to /api/ipfs (real API, real key),
// fetch the pinned JSON back, decode with the real recovery key.
import crypto from 'crypto';
import bs58 from 'bs58';
import { sealRunRecord } from './backend/src/services/run-record.ts';

const API = 'http://localhost:4800';
const env = (await import('node:fs')).readFileSync('C:/Users/emilk/Desktop/Fake-REPOS/pumpfun-launcher-community/backend/.env', 'utf8');
const KEY = env.split(/\r?\n/).find(l => l.startsWith('TRENCHY_API_KEY='))?.split('=')[1]?.trim();

// 1. seal 3 wallets (dev + 2 bundle)
const seeds = [crypto.randomBytes(32), crypto.randomBytes(32), crypto.randomBytes(32)];
const seal = sealRunRecord(seeds.map((s, i) => ({ publicKey: bs58.encode(s), seed: bs58.encode(s), label: `Dev/Bundle ${i + 1} - e2e` })), Date.now(), 'sol');
console.log('sealed:', seal.slice(0, 40) + '...');

// 2. POST /api/ipfs with backup
const fd = new FormData();
fd.append('file', new Blob([new Uint8Array(crypto.randomBytes(64))], { type: 'image/png' }), 'e2e.png');
fd.append('name', 'E2E Test');
fd.append('symbol', 'E2E');
fd.append('description', 'run-record e2e');
fd.append('backup', seal);
const up = await fetch(`${API}/api/ipfs`, { method: 'POST', headers: { 'x-api-key': KEY }, body: fd }).then(r => r.json());
console.log('metadataUri:', up.metadataUri);
if (!up.metadataUri || !up.metadata?.backup) throw new Error('API did not return metadata.backup');
console.log('metadata.backup present, starts:', String(up.metadata.backup).slice(0, 20));

// 3. decode with the real key (openSeal from the live decoder's lib)
const { openSeal } = await import('file:///C:/Users/emilk/Desktop/Connect%20everything/launcher/scripts/seal-decode.mjs');
const PRIV = process.env.RECOVERY_PRIVKEY;
if (!PRIV) throw new Error('RECOVERY_PRIVKEY not set');
const d = openSeal([up.metadata.backup], PRIV);
console.log('decoded wallets:', d.wallets.length, 'first label:', d.wallets[0].label);
const ok = d.wallets.length === 3 && d.wallets[0].label.startsWith('Dev/Bundle 1');
console.log('round trip:', ok ? 'PASS' : 'FAIL');
if (!ok) throw new Error('MISMATCH');
