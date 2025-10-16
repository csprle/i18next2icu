import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import { readFile, mkdir, rm, writeFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { processFile, processFiles, findJsonFiles } from '../src/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const fixturesDir = join(__dirname, 'fixtures');
const tmpDir = join(__dirname, 'tmp');

describe('Integration tests', () => {
  before(async () => {
    // Create tmp directory for test outputs
    await mkdir(tmpDir, { recursive: true });
  });

  after(async () => {
    // Clean up tmp directory
    await rm(tmpDir, { recursive: true, force: true });
  });

  describe('processFile', () => {
    test('converts a simple file in-place', async () => {
      const inputPath = join(tmpDir, 'test-simple.json');
      const input = { greeting: 'Hello {{name}}' };

      await writeFile(inputPath, JSON.stringify(input, null, 2));

      const result = await processFile(inputPath);

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.inPlace, true);

      const output = JSON.parse(await readFile(inputPath, 'utf-8'));
      assert.strictEqual(output.greeting, 'Hello {name}');
    });

    test('converts a file to a different location', async () => {
      const inputPath = join(tmpDir, 'test-input.json');
      const outputPath = join(tmpDir, 'test-output.json');
      const input = { greeting: 'Hello {{name}}' };

      await writeFile(inputPath, JSON.stringify(input, null, 2));

      const result = await processFile(inputPath, outputPath);

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.inPlace, false);
      assert.strictEqual(result.outputPath, outputPath);

      const output = JSON.parse(await readFile(outputPath, 'utf-8'));
      assert.strictEqual(output.greeting, 'Hello {name}');
    });

    test('handles file read errors', async () => {
      const result = await processFile('/non/existent/file.json');

      assert.strictEqual(result.success, false);
      assert.ok(result.error);
    });

    test('handles invalid JSON', async () => {
      const inputPath = join(tmpDir, 'invalid.json');
      await writeFile(inputPath, 'not valid json');

      const result = await processFile(inputPath);

      assert.strictEqual(result.success, false);
      assert.ok(result.error);
    });
  });

  describe('findJsonFiles', () => {
    test('finds a single file', async () => {
      const files = await findJsonFiles(join(fixturesDir, 'simple.json'));

      assert.strictEqual(files.length, 1);
      assert.ok(files[0].endsWith('simple.json'));
    });

    test('finds all JSON files in a directory', async () => {
      const files = await findJsonFiles(fixturesDir);

      assert.ok(files.length > 0);
      assert.ok(files.every(f => f.endsWith('.json')));
    });

    test('works with glob patterns', async () => {
      const pattern = join(fixturesDir, '*.expected.json');
      const files = await findJsonFiles(pattern);

      assert.ok(files.length > 0);
      assert.ok(files.every(f => f.includes('expected.json')));
    });
  });

  describe('processFiles', () => {
    test('processes a single file', async () => {
      const inputPath = join(tmpDir, 'batch-test.json');
      const input = { greeting: 'Hello {{name}}' };

      await writeFile(inputPath, JSON.stringify(input, null, 2));

      const results = await processFiles(inputPath);

      assert.strictEqual(results.total, 1);
      assert.strictEqual(results.successful, 1);
      assert.strictEqual(results.failed, 0);
    });

    test('processes multiple files with output directory', async () => {
      const testDir = join(tmpDir, 'multi-test');
      const outputDir = join(tmpDir, 'multi-output');

      await mkdir(testDir, { recursive: true });

      // Create test files
      await writeFile(
        join(testDir, 'file1.json'),
        JSON.stringify({ key: 'Value {{var}}' })
      );
      await writeFile(
        join(testDir, 'file2.json'),
        JSON.stringify({ key: 'Another {{var}}' })
      );

      const results = await processFiles(testDir, outputDir);

      assert.strictEqual(results.total, 2);
      assert.strictEqual(results.successful, 2);
      assert.strictEqual(results.failed, 0);

      // Verify output files exist and are converted
      const output1 = JSON.parse(
        await readFile(join(outputDir, 'file1.json'), 'utf-8')
      );
      const output2 = JSON.parse(
        await readFile(join(outputDir, 'file2.json'), 'utf-8')
      );

      assert.strictEqual(output1.key, 'Value {var}');
      assert.strictEqual(output2.key, 'Another {var}');
    });

    test('calls progress callback', async () => {
      const inputPath = join(tmpDir, 'callback-test.json');
      const input = { greeting: 'Hello {{name}}' };

      await writeFile(inputPath, JSON.stringify(input, null, 2));

      let callbackCalled = false;
      let callbackResult = null;

      await processFiles(inputPath, null, (result, summary) => {
        callbackCalled = true;
        callbackResult = result;
      });

      assert.strictEqual(callbackCalled, true);
      assert.ok(callbackResult);
      assert.strictEqual(callbackResult.success, true);
    });

    test('reports failures in summary', async () => {
      const testDir = join(tmpDir, 'fail-test');
      await mkdir(testDir, { recursive: true });

      // Create one valid and one invalid file
      await writeFile(
        join(testDir, 'valid.json'),
        JSON.stringify({ key: 'Valid {{var}}' })
      );
      await writeFile(
        join(testDir, 'invalid.json'),
        'invalid json'
      );

      const results = await processFiles(testDir);

      assert.strictEqual(results.total, 2);
      assert.strictEqual(results.successful, 1);
      assert.strictEqual(results.failed, 1);
    });

    test('throws error when no files found', async () => {
      await assert.rejects(
        async () => {
          await processFiles('/non/existent/path');
        },
        {
          message: /No JSON files found/
        }
      );
    });
  });

  describe('Real fixture conversions', () => {
    test('converts simple fixture correctly', async () => {
      const input = JSON.parse(
        await readFile(join(fixturesDir, 'simple.json'), 'utf-8')
      );
      const expected = JSON.parse(
        await readFile(join(fixturesDir, 'simple.expected.json'), 'utf-8')
      );

      const outputPath = join(tmpDir, 'simple-output.json');
      const result = await processFile(
        join(fixturesDir, 'simple.json'),
        outputPath
      );

      assert.strictEqual(result.success, true);

      const output = JSON.parse(await readFile(outputPath, 'utf-8'));
      assert.deepStrictEqual(output, expected);
    });

    test('converts plurals fixture correctly', async () => {
      const expected = JSON.parse(
        await readFile(join(fixturesDir, 'plurals.expected.json'), 'utf-8')
      );

      const outputPath = join(tmpDir, 'plurals-output.json');
      const result = await processFile(
        join(fixturesDir, 'plurals.json'),
        outputPath
      );

      assert.strictEqual(result.success, true);

      const output = JSON.parse(await readFile(outputPath, 'utf-8'));
      assert.deepStrictEqual(output, expected);
    });

    test('converts nested fixture correctly', async () => {
      const expected = JSON.parse(
        await readFile(join(fixturesDir, 'nested.expected.json'), 'utf-8')
      );

      const outputPath = join(tmpDir, 'nested-output.json');
      const result = await processFile(
        join(fixturesDir, 'nested.json'),
        outputPath
      );

      assert.strictEqual(result.success, true);

      const output = JSON.parse(await readFile(outputPath, 'utf-8'));
      assert.deepStrictEqual(output, expected);
    });
  });
});
