#!/usr/bin/env node
// Generates version info file with a monotonically increasing build number and timestamp.
import { writeFileSync, readFileSync, existsSync, mkdirSync, renameSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Support custom output path via environment variable
const outPath = process.env.VERSION_OUTPUT_PATH || join(__dirname, '..', 'src', 'version.json');
let version = 0;

try {
  if (existsSync(outPath)) {
    const prev = JSON.parse(readFileSync(outPath, 'utf8'));
    version = Number(prev.version || 0);
  }
} catch (error) {
  // Reset to 0 on any parse errors (malformed JSON)
  console.warn('Warning: Could not read existing version, starting from 0');
  version = 0;
}

let nextVersion = version + 1;

// Handle version overflow at Number.MAX_SAFE_INTEGER
if (nextVersion > Number.MAX_SAFE_INTEGER) {
  console.warn('Warning: Version overflow detected, resetting to 1');
  nextVersion = 1;
}

const now = new Date();
const pad = (n) => String(n).padStart(2, '0');
const stamp = `${pad(now.getDate())}-${pad(now.getMonth() + 1)}-${String(now.getFullYear()).slice(-2)} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;

const payload = { version: nextVersion, timestamp: stamp, iso: now.toISOString() };

try {
  // Ensure parent directory exists
  const dir = dirname(outPath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  
  // Use atomic write operation for concurrency safety
  const tempPath = `${outPath}.tmp`;
  writeFileSync(tempPath, JSON.stringify(payload, null, 2));
  
  // Atomic rename (prevents race conditions)
  renameSync(tempPath, outPath);
  
  console.log(`Generated version v${nextVersion} at ${stamp}`);
} catch (error) {
  console.error('Failed to write version file');
  if (error.code === 'EACCES') {
    console.error('Permission denied - check file/directory permissions');
  } else if (error.code === 'ENOSPC') {
    console.error('No space left on device');
  }
  process.exit(1);
}