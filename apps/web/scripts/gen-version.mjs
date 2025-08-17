#!/usr/bin/env node
// Generates version info file with a monotonically increasing build number and timestamp.
import { writeFileSync, readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const outPath = join(__dirname, '..', 'src', 'version.json');
let version = 0;
try {
  if (existsSync(outPath)) {
    const prev = JSON.parse(readFileSync(outPath, 'utf8'));
    version = Number(prev.version || 0);
  }
} catch {}

const nextVersion = version + 1;
const now = new Date();
const pad = (n) => String(n).padStart(2, '0');
const stamp = `${pad(now.getDate())}-${pad(now.getMonth() + 1)}-${String(now.getFullYear()).slice(-2)} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;

const payload = { version: nextVersion, timestamp: stamp, iso: now.toISOString() };
writeFileSync(outPath, JSON.stringify(payload, null, 2));
console.log(`Generated version v${nextVersion} at ${stamp}`);
