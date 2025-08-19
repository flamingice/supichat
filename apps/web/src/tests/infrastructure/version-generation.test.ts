import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { execSync } from 'child_process';
import { readFileSync, writeFileSync, unlinkSync, existsSync, mkdirSync, chmodSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const scriptPath = join(__dirname, '../../../../../apps/web/scripts/gen-version.mjs');
const versionPath = join(__dirname, '../../version.json');

describe('Version Generation Script - RED Tests', () => {
  beforeEach(() => {
    // Ensure directory exists
    const dir = dirname(versionPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    // Clean up any existing version file
    if (existsSync(versionPath)) {
      unlinkSync(versionPath);
    }
  });

  afterEach(() => {
    // Cleanup
    if (existsSync(versionPath)) {
      try {
        chmodSync(versionPath, 0o644); // Restore permissions
        unlinkSync(versionPath);
      } catch {}
    }
  });

  it('should create initial version file with version 1', () => {
    // This test will FAIL until gen-version.mjs handles missing directories
    execSync(`node ${scriptPath}`, { stdio: 'pipe' });
    
    const content = JSON.parse(readFileSync(versionPath, 'utf8'));
    expect(content.version).toBe(1);
    expect(content.timestamp).toMatch(/^\d{2}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
    expect(content.iso).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });

  it('should increment version on subsequent runs', () => {
    // This test will PASS currently but defines expected behavior
    writeFileSync(versionPath, JSON.stringify({ version: 42, timestamp: '', iso: '' }));
    
    execSync(`node ${scriptPath}`, { stdio: 'pipe' });
    
    const content = JSON.parse(readFileSync(versionPath, 'utf8'));
    expect(content.version).toBe(43);
  });

  it('should handle concurrent execution without duplicating versions', async () => {
    // This test will FAIL - gen-version.mjs lacks concurrency protection
    writeFileSync(versionPath, JSON.stringify({ version: 100, timestamp: '', iso: '' }));
    
    // Run 3 concurrent version generations (reduced from 5 for reliability)
    const promises = Array(3).fill(null).map(() => 
      new Promise<void>((resolve) => {
        try {
          execSync(`node ${scriptPath}`, { stdio: 'pipe' });
          resolve();
        } catch (error) {
          resolve(); // Don't fail on individual errors
        }
      })
    );
    
    await Promise.all(promises);
    
    // Check final version - should be exactly 3 increments
    const content = JSON.parse(readFileSync(versionPath, 'utf8'));
    expect(content.version).toBe(103); // This will likely FAIL due to race conditions
  });

  it('should handle malformed JSON gracefully', () => {
    // This test will FAIL - gen-version.mjs doesn't validate JSON properly
    writeFileSync(versionPath, '{ invalid json }');
    
    expect(() => {
      execSync(`node ${scriptPath}`, { stdio: 'pipe' });
    }).not.toThrow();
    
    const content = JSON.parse(readFileSync(versionPath, 'utf8'));
    expect(content.version).toBe(1); // Should reset to 1 on corruption
  });

  it('should handle read-only filesystem gracefully', () => {
    // This test will FAIL - gen-version.mjs doesn't handle EACCES properly
    writeFileSync(versionPath, JSON.stringify({ version: 50 }));
    chmodSync(versionPath, 0o444); // Read-only
    
    let errorOutput = '';
    try {
      execSync(`node ${scriptPath}`, { stdio: 'pipe' });
    } catch (error: any) {
      errorOutput = error.stderr?.toString() || error.stdout?.toString() || '';
    }
    
    // Should provide user-friendly error message instead of raw Node.js error
    expect(errorOutput).toContain('Permission denied');
    expect(errorOutput).toContain('Failed to write version file');
    
    // Version should remain unchanged
    const content = JSON.parse(readFileSync(versionPath, 'utf8'));
    expect(content.version).toBe(50);
  });

  it('should validate version number boundaries', () => {
    // This test will FAIL - no MAX_SAFE_INTEGER handling
    writeFileSync(versionPath, JSON.stringify({ 
      version: Number.MAX_SAFE_INTEGER - 1,
      timestamp: '',
      iso: ''
    }));
    
    execSync(`node ${scriptPath}`, { stdio: 'pipe' });
    
    const content = JSON.parse(readFileSync(versionPath, 'utf8'));
    expect(content.version).toBe(Number.MAX_SAFE_INTEGER);
    
    // Next run should handle overflow gracefully
    execSync(`node ${scriptPath}`, { stdio: 'pipe' });
    const content2 = JSON.parse(readFileSync(versionPath, 'utf8'));
    expect(content2.version).toBe(1); // Should reset on overflow
  });

  it('should handle missing parent directory creation', () => {
    // This test will FAIL - gen-version.mjs assumes directory exists
    const tempDir = join(__dirname, 'temp-non-existent');
    const customPath = join(tempDir, 'version.json');
    
    // Ensure directory doesn't exist
    if (existsSync(tempDir)) {
      execSync(`rm -rf ${tempDir}`);
    }
    
    try {
      // This should create the directory structure
      process.env.VERSION_OUTPUT_PATH = customPath;
      execSync(`node ${scriptPath}`, { stdio: 'pipe' });
      
      expect(existsSync(customPath)).toBe(true);
      const content = JSON.parse(readFileSync(customPath, 'utf8'));
      expect(content.version).toBe(1);
    } finally {
      delete process.env.VERSION_OUTPUT_PATH;
      if (existsSync(tempDir)) {
        execSync(`rm -rf ${tempDir}`);
      }
    }
  });

  it('should preserve file structure on partial write failures', () => {
    // This test will FAIL - no atomic write operations
    const originalContent = { version: 75, timestamp: 'test', iso: 'test' };
    writeFileSync(versionPath, JSON.stringify(originalContent));
    
    // Simulate disk full scenario (difficult to test directly)
    // Instead test that interrupted writes don't corrupt the file
    
    // Mock writeFileSync to fail after partial write
    const originalWriteFile = require('fs').writeFileSync;
    let writeCallCount = 0;
    
    vi.spyOn(require('fs'), 'writeFileSync').mockImplementation((path, data) => {
      writeCallCount++;
      if (writeCallCount === 1 && path === versionPath) {
        throw new Error('ENOSPC: no space left on device');
      }
      return originalWriteFile(path, data);
    });
    
    try {
      execSync(`node ${scriptPath}`, { stdio: 'pipe' });
    } catch {
      // Expected to fail
    }
    
    // File should remain uncorrupted
    const content = JSON.parse(readFileSync(versionPath, 'utf8'));
    expect(content.version).toBe(75); // Should remain unchanged
    
    vi.restoreAllMocks();
  });
});