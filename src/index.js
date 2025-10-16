import fs from 'fs/promises';
import path from 'path';
import { glob } from 'glob';
import yaml from 'js-yaml';
import { convertFile } from './converter.js';

/**
 * Detect file format based on extension
 * @param {string} filePath - File path
 * @returns {string} 'json' or 'yaml'
 */
function detectFileFormat(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return (ext === '.yaml' || ext === '.yml') ? 'yaml' : 'json';
}

/**
 * Parse file content based on format
 * @param {string} content - File content
 * @param {string} format - 'json' or 'yaml'
 * @returns {Object} Parsed data
 */
function parseContent(content, format) {
  if (format === 'yaml') {
    return yaml.load(content);
  }
  return JSON.parse(content);
}

/**
 * Stringify data based on format
 * @param {Object} data - Data to stringify
 * @param {string} format - 'json' or 'yaml'
 * @returns {string} Stringified data
 */
function stringifyData(data, format) {
  if (format === 'yaml') {
    return yaml.dump(data, {
      indent: 2,
      lineWidth: -1,
      noRefs: true
    });
  }
  return JSON.stringify(data, null, 2) + '\n';
}

/**
 * Process a single file
 * @param {string} inputPath - Input file path
 * @param {string|null} outputPath - Output file path (null for in-place)
 * @returns {Promise<Object>} Result object
 */
export async function processFile(inputPath, outputPath = null) {
  try {
    // Detect input format
    const inputFormat = detectFileFormat(inputPath);

    // Read the input file
    const content = await fs.readFile(inputPath, 'utf-8');
    const data = parseContent(content, inputFormat);

    // Convert the data
    const converted = convertFile(data);

    // Determine output path and format
    const finalOutputPath = outputPath || inputPath;
    const outputFormat = detectFileFormat(finalOutputPath);

    // Write the output file
    await fs.writeFile(
      finalOutputPath,
      stringifyData(converted, outputFormat),
      'utf-8'
    );

    return {
      success: true,
      inputPath,
      outputPath: finalOutputPath,
      inPlace: !outputPath,
      inputFormat,
      outputFormat
    };
  } catch (error) {
    return {
      success: false,
      inputPath,
      error: error.message
    };
  }
}

/**
 * Find all translation files (JSON and YAML) in a directory
 * @param {string} inputPath - Directory path or glob pattern
 * @returns {Promise<string[]>} Array of file paths
 */
export async function findTranslationFiles(inputPath) {
  const stats = await fs.stat(inputPath).catch(() => null);

  if (stats && stats.isFile()) {
    // Single file
    return [inputPath];
  } else if (stats && stats.isDirectory()) {
    // Directory - find all JSON and YAML files
    const jsonPattern = path.join(inputPath, '**/*.json');
    const yamlPattern = path.join(inputPath, '**/*.{yaml,yml}');
    const [jsonFiles, yamlFiles] = await Promise.all([
      glob(jsonPattern, { nodir: true }),
      glob(yamlPattern, { nodir: true })
    ]);
    return [...jsonFiles, ...yamlFiles].sort();
  } else {
    // Treat as glob pattern
    return await glob(inputPath, { nodir: true });
  }
}

// Maintain backward compatibility
export const findJsonFiles = findTranslationFiles;

/**
 * Process multiple files
 * @param {string} inputPath - Input path or pattern
 * @param {string|null} outputPath - Output directory (null for in-place)
 * @param {Function} progressCallback - Callback for progress updates
 * @returns {Promise<Object>} Results summary
 */
export async function processFiles(inputPath, outputPath = null, progressCallback = null) {
  const files = await findTranslationFiles(inputPath);

  if (files.length === 0) {
    throw new Error(`No translation files found at: ${inputPath}`);
  }

  const results = {
    total: files.length,
    successful: 0,
    failed: 0,
    files: []
  };

  for (const file of files) {
    let targetPath = null;

    if (outputPath) {
      // Calculate relative path and create corresponding output path
      const stats = await fs.stat(inputPath).catch(() => null);
      let relativePath;

      if (stats && stats.isDirectory()) {
        relativePath = path.relative(inputPath, file);
      } else {
        relativePath = path.basename(file);
      }

      targetPath = path.join(outputPath, relativePath);

      // Ensure output directory exists
      await fs.mkdir(path.dirname(targetPath), { recursive: true });
    }

    const result = await processFile(file, targetPath);
    results.files.push(result);

    if (result.success) {
      results.successful++;
    } else {
      results.failed++;
    }

    if (progressCallback) {
      progressCallback(result, results);
    }
  }

  return results;
}
