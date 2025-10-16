import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import { readFile, mkdir, rm, writeFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import yaml from 'js-yaml';
import { processFile, processFiles, findJsonFiles, findTranslationFiles } from '../src/index.js';

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

    test('finds all translation files in a directory', async () => {
      const files = await findJsonFiles(fixturesDir);

      assert.ok(files.length > 0);
      // Should find both JSON and YAML files
      const hasJson = files.some(f => f.endsWith('.json'));
      const hasYaml = files.some(f => f.endsWith('.yaml') || f.endsWith('.yml'));
      assert.ok(hasJson, 'Should find JSON files');
      assert.ok(hasYaml, 'Should find YAML files');
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
          message: /No translation files found/
        }
      );
    });
  });

  describe('findTranslationFiles', () => {
    test('finds YAML files in a directory', async () => {
      const files = await findTranslationFiles(fixturesDir);

      const yamlFiles = files.filter(f => f.endsWith('.yaml') || f.endsWith('.yml'));
      assert.ok(yamlFiles.length > 0, 'Should find YAML files');
    });

    test('finds both JSON and YAML files', async () => {
      const files = await findTranslationFiles(fixturesDir);

      const jsonFiles = files.filter(f => f.endsWith('.json'));
      const yamlFiles = files.filter(f => f.endsWith('.yaml') || f.endsWith('.yml'));

      assert.ok(jsonFiles.length > 0, 'Should find JSON files');
      assert.ok(yamlFiles.length > 0, 'Should find YAML files');
    });
  });

  describe('YAML conversions', () => {
    test('converts YAML file in-place', async () => {
      const inputPath = join(tmpDir, 'test-yaml.yaml');
      const input = { greeting: 'Hello {{name}}' };

      await writeFile(inputPath, yaml.dump(input));

      const result = await processFile(inputPath);

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.inputFormat, 'yaml');
      assert.strictEqual(result.outputFormat, 'yaml');

      const output = yaml.load(await readFile(inputPath, 'utf-8'));
      assert.strictEqual(output.greeting, 'Hello {name}');
    });

    test('converts YAML to JSON', async () => {
      const inputPath = join(tmpDir, 'test-yaml-in.yaml');
      const outputPath = join(tmpDir, 'test-json-out.json');
      const input = { greeting: 'Hello {{name}}' };

      await writeFile(inputPath, yaml.dump(input));

      const result = await processFile(inputPath, outputPath);

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.inputFormat, 'yaml');
      assert.strictEqual(result.outputFormat, 'json');

      const output = JSON.parse(await readFile(outputPath, 'utf-8'));
      assert.strictEqual(output.greeting, 'Hello {name}');
    });

    test('converts JSON to YAML', async () => {
      const inputPath = join(tmpDir, 'test-json-in.json');
      const outputPath = join(tmpDir, 'test-yaml-out.yaml');
      const input = { greeting: 'Hello {{name}}' };

      await writeFile(inputPath, JSON.stringify(input, null, 2));

      const result = await processFile(inputPath, outputPath);

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.inputFormat, 'json');
      assert.strictEqual(result.outputFormat, 'yaml');

      const output = yaml.load(await readFile(outputPath, 'utf-8'));
      assert.strictEqual(output.greeting, 'Hello {name}');
    });

    test('converts YAML plurals correctly', async () => {
      const inputPath = join(tmpDir, 'test-yaml-plurals.yaml');
      const input = {
        item_zero: 'No items',
        item_one: '{{count}} item',
        item_other: '{{count}} items'
      };

      await writeFile(inputPath, yaml.dump(input));

      const result = await processFile(inputPath);

      assert.strictEqual(result.success, true);

      const output = yaml.load(await readFile(inputPath, 'utf-8'));
      assert.ok(output.item.includes('plural'));
      assert.ok(output.item.includes('=0{No items}'));
    });

    test('converts YAML with multiline strings', async () => {
      const inputPath = join(tmpDir, 'test-yaml-multiline.yaml');
      const input = {
        welcome: 'Hello {{name}},\nWelcome to our platform!\nWe are glad you are here.',
        description: 'This is a multi-line description.\nIt spans multiple lines.\nVariables like {{count}} work too.'
      };

      await writeFile(inputPath, yaml.dump(input));

      const result = await processFile(inputPath);

      assert.strictEqual(result.success, true);

      const output = yaml.load(await readFile(inputPath, 'utf-8'));
      assert.ok(output.welcome.includes('{name}'), 'Should convert variable');
      assert.ok(output.welcome.includes('\n'), 'Should preserve newlines');
      assert.ok(output.description.includes('{count}'), 'Should convert variable in multiline');
    });

    test('converts multiline YAML plurals', async () => {
      const inputPath = join(tmpDir, 'test-yaml-multiline-plurals.yaml');
      const input = {
        notification_zero: 'No new messages',
        notification_one: 'You have {{count}} new message.\nPlease check your inbox.',
        notification_other: 'You have {{count}} new messages.\nPlease check your inbox.'
      };

      await writeFile(inputPath, yaml.dump(input));

      const result = await processFile(inputPath);

      assert.strictEqual(result.success, true);

      const output = yaml.load(await readFile(inputPath, 'utf-8'));
      assert.ok(output.notification, 'Should create notification key');
      assert.ok(output.notification.includes('plural'), 'Should have plural format');
      assert.ok(output.notification.includes('{count}'), 'Should convert variables');
    });

    test('converts nested multiline YAML', async () => {
      const inputPath = join(tmpDir, 'test-yaml-nested-multiline.yaml');
      const input = {
        error: {
          title: 'Error occurred',
          message: 'An error has occurred: {{errorMessage}}\nPlease try again later.'
        }
      };

      await writeFile(inputPath, yaml.dump(input));

      const result = await processFile(inputPath);

      assert.strictEqual(result.success, true);

      const output = yaml.load(await readFile(inputPath, 'utf-8'));
      assert.strictEqual(output.error.title, 'Error occurred');
      assert.ok(output.error.message.includes('{errorMessage}'));
      assert.ok(output.error.message.includes('\n'));
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
