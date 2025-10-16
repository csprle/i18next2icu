# i18next2icu

Convert i18next JSON translation files to ICU MessageFormat v1 with ease.

## Features

- Convert i18next interpolation syntax to ICU format
- Automatically handle plural forms
- Process single files, entire directories, or glob patterns
- In-place conversion or output to a separate directory
- Beautiful CLI output with progress indicators
- Preserves nested JSON structure

## Installation

```bash
npm install -g i18next2icu
```

Or use directly with npx:

```bash
npx i18next2icu <input> [options]
```

## Usage

### Basic Usage

Convert a single file (in-place):
```bash
i18next2icu translations.json
```

Convert a directory (in-place):
```bash
i18next2icu ./locales
```

Convert with output directory:
```bash
i18next2icu ./locales -o ./output
```

Use glob patterns:
```bash
i18next2icu "./locales/**/*.json" -o ./converted
```

### CLI Options

```
i18next2icu <input> [options]

Arguments:
  input                    Input file, directory, or glob pattern

Options:
  -o, --output <path>      Output directory (default: overwrites input files)
  -V, --version            Output the version number
  -h, --help              Display help for command
```

## Conversion Examples

### Interpolation

**i18next format:**
```json
{
  "welcome": "Hello {{name}}!"
}
```

**ICU format:**
```json
{
  "welcome": "Hello {name}!"
}
```

### Plurals

**i18next format:**
```json
{
  "item_zero": "No items",
  "item_one": "{{count}} item",
  "item_other": "{{count}} items"
}
```

**ICU format:**
```json
{
  "item": "{count, plural, =0{No items} one{{count} item} other{{count} items}}"
}
```

### Nested Objects

**i18next format:**
```json
{
  "user": {
    "greeting": "Hello {{name}}",
    "farewell": "Goodbye {{name}}"
  }
}
```

**ICU format:**
```json
{
  "user": {
    "greeting": "Hello {name}",
    "farewell": "Goodbye {name}"
  }
}
```

### Complex Example

**Before (i18next):**
```json
{
  "welcome": "Welcome back, {{username}}!",
  "notifications_zero": "You have no new notifications",
  "notifications_one": "You have {{count}} new notification",
  "notifications_other": "You have {{count}} new notifications",
  "settings": {
    "profile": {
      "title": "Profile Settings",
      "description": "Manage your profile information"
    }
  }
}
```

**After (ICU):**
```json
{
  "welcome": "Welcome back, {username}!",
  "notifications": "{count, plural, =0{You have no new notifications} one{You have {count} new notification} other{You have {count} new notifications}}",
  "settings": {
    "profile": {
      "title": "Profile Settings",
      "description": "Manage your profile information"
    }
  }
}
```

## Supported Features

- ✅ Basic interpolation: `{{variable}}` → `{variable}`
- ✅ Plural forms: `key_zero`, `key_one`, `key_other` → ICU plural syntax
- ✅ Nested objects and deep structures
- ✅ Multiple files and directories
- ⚠️ Nesting references: `$t(key)` → Converted to `[REF:key]` (requires manual handling)

## Notes

- **Nesting:** i18next's `$t()` nesting syntax is converted to `[REF:key]` as ICU doesn't have direct equivalent. You'll need to handle these references manually in your code.
- **Context:** i18next context variants need to be restructured based on your specific use case.
- **Backup:** When using in-place conversion, consider backing up your files first.

## Development

```bash
# Clone the repository
git clone <repository-url>
cd i18next2icu

# Install dependencies
npm install

# Run the CLI
npm start -- <input> [options]
```

## Testing

The project includes a comprehensive test suite using Node.js built-in test runner.

### Running Tests Locally

```bash
# Run all tests
npm test

# Run with verbose output
npm test -- --test-reporter=spec
```

### Test Structure

- `test/converter.test.js` - Unit tests for conversion logic
  - Interpolation conversion
  - Plural form handling
  - Nested object processing
  - Edge cases

- `test/integration.test.js` - Integration tests
  - File processing
  - Directory handling
  - Glob patterns
  - Error handling

- `test/fixtures/` - Test fixtures with expected outputs

### Continuous Integration

Tests run automatically on:
- Every push to main/master/develop branches
- All pull requests
- Multiple Node.js versions (18.x, 20.x, 22.x)

See `.github/workflows/test.yml` for CI configuration.

## Publishing

This package uses automated publishing via GitHub Actions.

### Versioning and Publishing

The project follows [Semantic Versioning](https://semver.org/):

```bash
# Patch release (bug fixes): 1.0.0 → 1.0.1
npm run version:patch

# Minor release (new features, backwards compatible): 1.0.0 → 1.1.0
npm run version:minor

# Major release (breaking changes): 1.0.0 → 2.0.0
npm run version:major
```

**What happens when you run these commands:**

1. Tests run automatically (`prepublishOnly`)
2. Version number bumps in `package.json`
3. Git commit is created with version bump
4. Git tag is created (e.g., `v1.0.1`)
5. Changes are pushed to GitHub
6. Tag is pushed to GitHub
7. GitHub Action triggers automatically
8. Tests run in CI
9. Package publishes to npm
10. GitHub Release is created

### Manual Publishing (alternative)

If you prefer to publish manually:

```bash
# Make sure you're logged in
npm login

# Publish to npm
npm publish
```

### Before Publishing

- Update `CHANGELOG.md` with your changes
- Ensure all tests pass: `npm test`
- Review changes: `git status` and `git diff`

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
