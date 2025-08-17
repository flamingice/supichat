export type VersionInfo = { version: number; timestamp: string; iso: string };

let cached: VersionInfo | null = null;
export function getVersion(): VersionInfo | null {
  if (cached) return cached;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    cached = require('../version.json');
    return cached;
  } catch {
    return null;
  }
}
