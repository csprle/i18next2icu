#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { processFiles } from '../src/index.js';
import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Read package.json for version
const packageJson = JSON.parse(
  await readFile(join(__dirname, '../package.json'), 'utf-8')
);

const program = new Command();

// ASCII art banner
const banner = `
${chalk.cyan('╔═══════════════════════════════════════╗')}
${chalk.cyan('║')}     ${chalk.bold.yellow('i18next → ICU Converter')}      ${chalk.cyan('║')}
${chalk.cyan('╚═══════════════════════════════════════╝')}
`;

program
  .name('i18next2icu')
  .description('Convert i18next JSON/YAML translation files to ICU MessageFormat v1')
  .version(packageJson.version)
  .argument('<input>', 'Input file, directory, or glob pattern')
  .option('-o, --output <path>', 'Output directory (default: overwrites input files)')
  .action(async (input, options) => {
    console.log(banner);

    const outputPath = options.output || null;
    const spinner = ora({
      text: 'Scanning for translation files...',
      color: 'cyan'
    }).start();

    try {
      let processedCount = 0;

      const results = await processFiles(input, outputPath, (result, summary) => {
        processedCount++;

        if (result.success) {
          spinner.text = `Converting files... ${chalk.green(`${processedCount}/${summary.total}`)}`;
        } else {
          spinner.warn(
            `${chalk.yellow('Warning:')} Failed to convert ${chalk.dim(result.inputPath)}`
          );
          console.log(chalk.red(`  ✗ Error: ${result.error}`));
          spinner.start();
        }
      });

      spinner.succeed(chalk.bold.green('Conversion complete!'));

      // Summary
      console.log();
      console.log(chalk.bold('Summary:'));
      console.log(chalk.gray('─'.repeat(40)));
      console.log(`${chalk.cyan('Total files:')}     ${results.total}`);
      console.log(`${chalk.green('Successful:')}    ${results.successful}`);

      if (results.failed > 0) {
        console.log(`${chalk.red('Failed:')}        ${results.failed}`);
      }

      console.log(chalk.gray('─'.repeat(40)));

      // List processed files
      if (results.successful > 0) {
        console.log();
        console.log(chalk.bold('Converted files:'));

        const maxDisplay = 10;
        const displayFiles = results.files
          .filter(f => f.success)
          .slice(0, maxDisplay);

        displayFiles.forEach(file => {
          const inPlaceLabel = file.inPlace ? chalk.dim(' (in-place)') : '';
          console.log(`  ${chalk.green('✓')} ${chalk.dim(file.inputPath)}${inPlaceLabel}`);

          if (!file.inPlace) {
            console.log(`    ${chalk.cyan('→')} ${chalk.dim(file.outputPath)}`);
          }
        });

        if (results.successful > maxDisplay) {
          console.log(chalk.dim(`  ... and ${results.successful - maxDisplay} more`));
        }
      }

      // Mode indicator
      console.log();
      if (outputPath) {
        console.log(chalk.cyan('Mode:'), `Files saved to ${chalk.bold(outputPath)}`);
      } else {
        console.log(chalk.cyan('Mode:'), chalk.bold('In-place conversion (original files overwritten)'));
      }

      console.log();

      // Exit with error code if any failed
      if (results.failed > 0) {
        process.exit(1);
      }
    } catch (error) {
      spinner.fail(chalk.red('Conversion failed!'));
      console.error();
      console.error(chalk.red('Error:'), error.message);
      console.error();
      process.exit(1);
    }
  });

program.parse();
