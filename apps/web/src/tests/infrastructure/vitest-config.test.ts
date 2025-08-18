import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execSync } from 'child_process';
import { writeFileSync, unlinkSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';

describe('Vitest Configuration Validation - RED Tests', () => {
  const projectRoot = join(__dirname, '../../../..');
  const vitestConfigPath = join(projectRoot, 'vitest.config.ts');
  let originalConfig = '';
  
  beforeEach(() => {
    if (existsSync(vitestConfigPath)) {
      originalConfig = readFileSync(vitestConfigPath, 'utf8');
    }
  });
  
  afterEach(() => {
    if (originalConfig) {
      writeFileSync(vitestConfigPath, originalConfig);
    } else if (existsSync(vitestConfigPath)) {
      unlinkSync(vitestConfigPath);
    }
  });

  it('should handle missing test files gracefully', () => {
    // This test will FAIL - vitest exits with error on no tests
    let result = '';
    let exitCode = 0;
    
    try {
      result = execSync('npm test -- --run --dir=nonexistent', {
        cwd: projectRoot,
        encoding: 'utf8',
        stdio: 'pipe',
        timeout: 10000
      });
    } catch (error: any) {
      result = error.stdout || error.stderr || '';
      exitCode = error.status || 1;
    }
    
    // Should provide helpful message and exit gracefully
    expect(result).toContain('No test files found') ||
    expect(result).toContain('0 test files');
    expect(exitCode).toBe(0); // Should not fail when no tests exist
  });

  it('should validate test file patterns and provide warnings', () => {
    // This test will FAIL - no pattern validation warnings
    const invalidTestPath = join(projectRoot, 'src/invalid.test.js');
    writeFileSync(invalidTestPath, 'console.log("not a real test");');
    
    let result = '';
    try {
      result = execSync('npm test -- --run', {
        cwd: projectRoot,
        encoding: 'utf8',
        stdio: 'pipe',
        timeout: 15000
      });
    } catch (error: any) {
      result = error.stdout || error.stderr || '';
    }
    
    // Should warn about unexpected file extensions
    expect(result).toContain('Warning') &&
    (expect(result).toContain('.test.js files not supported') ||
     expect(result).toContain('Use .test.ts or .spec.ts') ||
     expect(result).toContain('Unexpected file extension'));
    
    // Cleanup
    if (existsSync(invalidTestPath)) {
      unlinkSync(invalidTestPath);
    }
  });

  it('should enforce test timeout limits', () => {
    // This test will FAIL - no proper timeout configuration
    const slowTestPath = join(projectRoot, 'src/tests/slow.test.ts');
    writeFileSync(slowTestPath, `
      import { it, expect } from 'vitest';
      it('slow test that should timeout', async () => {
        await new Promise(resolve => setTimeout(resolve, 10000));
        expect(true).toBe(true);
      });
    `);
    
    let result = '';
    try {
      result = execSync('npm test -- --run', {
        cwd: projectRoot,
        encoding: 'utf8',
        stdio: 'pipe',
        timeout: 15000
      });
    } catch (error: any) {
      result = error.stdout || error.stderr || '';
    }
    
    // Should enforce reasonable test timeouts
    expect(result).toContain('timeout') ||
    expect(result).toContain('exceeded') ||
    expect(result).toContain('5000ms');
    
    // Cleanup
    if (existsSync(slowTestPath)) {
      unlinkSync(slowTestPath);
    }
  });

  it('should validate environment configuration', () => {
    // This test will FAIL - no environment validation
    const invalidConfig = `
      import { defineConfig } from 'vitest/config';
      export default defineConfig({
        test: {
          environment: 'nonexistent-env'
        }
      });
    `;
    writeFileSync(vitestConfigPath, invalidConfig);
    
    let result = '';
    try {
      result = execSync('npm test -- --run', {
        cwd: projectRoot,
        encoding: 'utf8',
        stdio: 'pipe',
        timeout: 10000
      });
    } catch (error: any) {
      result = error.stdout || error.stderr || '';
    }
    
    // Should validate environment configuration
    expect(result).toContain('Invalid environment') ||
    expect(result).toContain('Environment not supported') ||
    expect(result).toContain('nonexistent-env');
  });

  it('should provide coverage configuration validation', () => {
    // This test will FAIL - no coverage validation
    let result = '';
    try {
      result = execSync('npm test -- --coverage --run', {
        cwd: projectRoot,
        encoding: 'utf8',
        stdio: 'pipe',
        timeout: 15000
      });
    } catch (error: any) {
      result = error.stdout || error.stderr || '';
    }
    
    // Should handle coverage configuration gracefully
    expect(result).toContain('Coverage') ||
    expect(result).toContain('coverage enabled') ||
    expect(result).toContain('coverage report');
  });

  it('should validate test include/exclude patterns', () => {
    // This test will FAIL - no pattern validation
    const invalidConfig = `
      import { defineConfig } from 'vitest/config';
      export default defineConfig({
        test: {
          include: ['invalid/**/*.test'],
          exclude: ['also-invalid/**/*']
        }
      });
    `;
    writeFileSync(vitestConfigPath, invalidConfig);
    
    let result = '';
    try {
      result = execSync('npm test -- --run', {
        cwd: projectRoot,
        encoding: 'utf8',
        stdio: 'pipe',
        timeout: 10000
      });
    } catch (error: any) {
      result = error.stdout || error.stderr || '';
    }
    
    // Should validate glob patterns
    expect(result).toContain('Pattern validation') ||
    expect(result).toContain('Invalid glob pattern') ||
    expect(result).toContain('No matching files');
  });

  it('should handle malformed configuration files', () => {
    // This test will FAIL - poor error handling for syntax errors
    const malformedConfig = `
      import { defineConfig } from 'vitest/config';
      export default defineConfig({
        test: {
          environment: 'node'
          // Missing comma - syntax error
          include: ['src/**/*.test.ts']
        }
      });
    `;
    writeFileSync(vitestConfigPath, malformedConfig);
    
    let result = '';
    try {
      result = execSync('npm test -- --run', {
        cwd: projectRoot,
        encoding: 'utf8',
        stdio: 'pipe',
        timeout: 10000
      });
    } catch (error: any) {
      result = error.stdout || error.stderr || '';
    }
    
    // Should provide clear syntax error messages
    expect(result).toContain('Configuration error') ||
    expect(result).toContain('Syntax error') ||
    expect(result).toContain('vitest.config.ts');
  });

  it('should validate reporter configuration', () => {
    // This test will FAIL - no reporter validation
    const configWithReporter = `
      import { defineConfig } from 'vitest/config';
      export default defineConfig({
        test: {
          environment: 'node',
          reporters: ['nonexistent-reporter']
        }
      });
    `;
    writeFileSync(vitestConfigPath, configWithReporter);
    
    let result = '';
    try {
      result = execSync('npm test -- --run', {
        cwd: projectRoot,
        encoding: 'utf8',
        stdio: 'pipe',
        timeout: 10000
      });
    } catch (error: any) {
      result = error.stdout || error.stderr || '';
    }
    
    // Should validate reporter configuration
    expect(result).toContain('Reporter') ||
    expect(result).toContain('not found') ||
    expect(result).toContain('nonexistent-reporter');
  });

  it('should provide helpful debugging information for test failures', () => {
    // This test will FAIL - minimal debugging info
    const failingTestPath = join(projectRoot, 'src/tests/debug.test.ts');
    writeFileSync(failingTestPath, `
      import { it, expect } from 'vitest';
      it('test with detailed failure info', () => {
        const obj = { a: 1, b: { c: 2, d: [3, 4, 5] } };
        expect(obj).toEqual({ a: 1, b: { c: 3, d: [3, 4, 5] } });
      });
    `);
    
    let result = '';
    try {
      result = execSync('npm test -- --run', {
        cwd: projectRoot,
        encoding: 'utf8',
        stdio: 'pipe',
        timeout: 15000
      });
    } catch (error: any) {
      result = error.stdout || error.stderr || '';
    }
    
    // Should provide detailed diff information
    expect(result).toContain('Expected') ||
    expect(result).toContain('Received') ||
    expect(result).toContain('diff');
    
    // Cleanup
    if (existsSync(failingTestPath)) {
      unlinkSync(failingTestPath);
    }
  });

  it('should support custom setup files and validate them', () => {
    // This test will FAIL - no setup file validation
    const configWithSetup = `
      import { defineConfig } from 'vitest/config';
      export default defineConfig({
        test: {
          environment: 'node',
          setupFiles: ['./nonexistent-setup.ts']
        }
      });
    `;
    writeFileSync(vitestConfigPath, configWithSetup);
    
    let result = '';
    try {
      result = execSync('npm test -- --run', {
        cwd: projectRoot,
        encoding: 'utf8',
        stdio: 'pipe',
        timeout: 10000
      });
    } catch (error: any) {
      result = error.stdout || error.stderr || '';
    }
    
    // Should validate setup file existence
    expect(result).toContain('Setup file') ||
    expect(result).toContain('not found') ||
    expect(result).toContain('nonexistent-setup.ts');
  });
});