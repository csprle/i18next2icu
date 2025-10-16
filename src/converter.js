/**
 * Converts i18next format strings to ICU MessageFormat v1
 */

/**
 * Convert i18next interpolation {{variable}} to ICU {variable}
 * @param {string} text - The text to convert
 * @returns {string} Converted text
 */
function convertInterpolation(text) {
  if (typeof text !== 'string') return text;

  // Convert {{variable}} to {variable}
  // Also handles {{variable, format}} to {variable, format}
  return text.replace(/\{\{([^}]+)\}\}/g, '{$1}');
}

/**
 * Detect if a key is part of a plural form
 * @param {string} key - The key name
 * @returns {Object|null} Plural info or null
 */
function parsePluralKey(key) {
  const match = key.match(/^(.+)_(zero|one|two|few|many|other)$/);
  if (match) {
    return {
      baseKey: match[1],
      form: match[2]
    };
  }
  return null;
}

/**
 * Group plural forms together
 * @param {Object} translations - The translation object
 * @returns {Object} Processed translations with plurals grouped
 */
function groupPlurals(translations) {
  const result = {};
  const pluralGroups = {};

  for (const [key, value] of Object.entries(translations)) {
    const pluralInfo = parsePluralKey(key);

    if (pluralInfo) {
      // This is a plural form
      if (!pluralGroups[pluralInfo.baseKey]) {
        pluralGroups[pluralInfo.baseKey] = {};
      }
      pluralGroups[pluralInfo.baseKey][pluralInfo.form] = value;
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      // Nested object
      result[key] = groupPlurals(value);
    } else {
      // Regular key
      result[key] = value;
    }
  }

  // Convert plural groups to ICU format
  for (const [baseKey, forms] of Object.entries(pluralGroups)) {
    result[baseKey] = createICUPlural(forms);
  }

  return result;
}

/**
 * Create ICU plural format from plural forms
 * @param {Object} forms - Object with plural forms (zero, one, other, etc.)
 * @returns {string} ICU plural format string
 */
function createICUPlural(forms) {
  const parts = [];

  // Map i18next plural forms to ICU
  const formMapping = {
    zero: '=0',
    one: 'one',
    two: 'two',
    few: 'few',
    many: 'many',
    other: 'other'
  };

  for (const [form, text] of Object.entries(forms)) {
    const icuForm = formMapping[form] || form;
    const convertedText = convertInterpolation(text);
    parts.push(`${icuForm}{${convertedText}}`);
  }

  // Use 'count' as the default variable name for plurals
  return `{count, plural, ${parts.join(' ')}}`;
}

/**
 * Convert nested $t() references to ICU format
 * Note: ICU doesn't have direct nesting support, this is a best-effort conversion
 * @param {string} text - The text to convert
 * @returns {string} Converted text
 */
function convertNesting(text) {
  if (typeof text !== 'string') return text;

  // Convert $t(key) to a note that nesting needs manual handling
  // ICU doesn't support this directly
  return text.replace(/\$t\(([^)]+)\)/g, (match, key) => {
    return `[REF:${key}]`;
  });
}

/**
 * Convert a single translation value
 * @param {any} value - The value to convert
 * @returns {any} Converted value
 */
function convertValue(value) {
  if (typeof value === 'string') {
    let converted = convertInterpolation(value);
    converted = convertNesting(converted);
    return converted;
  } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    return convertTranslations(value);
  }
  return value;
}

/**
 * Convert i18next translations to ICU format
 * @param {Object} translations - The i18next translation object
 * @returns {Object} ICU formatted translations
 */
export function convertTranslations(translations) {
  // First, group plural forms
  const grouped = groupPlurals(translations);

  // Then convert all values
  const result = {};
  for (const [key, value] of Object.entries(grouped)) {
    result[key] = convertValue(value);
  }

  return result;
}

/**
 * Convert an entire i18next JSON file structure
 * @param {Object} data - The parsed JSON data
 * @returns {Object} Converted data
 */
export function convertFile(data) {
  return convertTranslations(data);
}
