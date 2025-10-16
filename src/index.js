import fs from 'fs/promises';
import path from 'path';
import { glob } from 'glob';
import { convertFile } from './converter.js';

/**
 * Process a single file
 * @param {string} inputPath - Input file path
 * @param {string|null} outputPath - Output file path (null for in-place)
 * @returns {Promise<Object>} Result object
 */
export async function processFile(inputPath, outputPath = null) {
  try {
    // Read the input file
    const content = await fs.readFile(inputPath, 'utf-8');
    const data = JSON.parse(content);

    // Convert the data
    const converted = convertFile(data);

    // Determine output path
    const finalOutputPath = outputPath || inputPath;

    // Write the output file
    await fs.writeFile(
      finalOutputPath,
      JSON.stringify(converted, null, 2) + '\n',
      'utf-8'
    );

    return {
      success: true,
      inputPath,
      outputPath: finalOutputPath,
      inPlace: !outputPath
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
 * Find all JSON files in a directory
 * @param {string} inputPath - Directory path or glob pattern
 * @returns {Promise<string[]>} Array of file paths
 */
export async function findJsonFiles(inputPath) {
  const stats = await fs.stat(inputPath).catch(() => null);

  if (stats && stats.isFile()) {
    // Single file
    return [inputPath];
  } else if (stats && stats.isDirectory()) {
    // Directory - find all JSON files
    const pattern = path.join(inputPath, '**/*.json');
    return await glob(pattern, { nodir: true });
  } else {
    // Treat as glob pattern
    return await glob(inputPath, { nodir: true });
  }
}

/**
 * Process multiple files
 * @param {string} inputPath - Input path or pattern
 * @param {string|null} outputPath - Output directory (null for in-place)
 * @param {Function} progressCallback - Callback for progress updates
 * @returns {Promise<Object>} Results summary
 */
export async function processFiles(inputPath, outputPath = null, progressCallback = null) {
  const files = await findJsonFiles(inputPath);

  if (files.length === 0) {
    throw new Error(`No JSON files found at: ${inputPath}`);
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
