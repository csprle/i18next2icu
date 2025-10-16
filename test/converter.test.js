import { test, describe } from 'node:test';
import assert from 'node:assert';
import { convertTranslations, convertFile } from '../src/converter.js';

describe('Converter', () => {
  describe('Basic interpolation', () => {
    test('converts {{variable}} to {variable}', () => {
      const input = {
        greeting: 'Hello {{name}}!'
      };
      const expected = {
        greeting: 'Hello {name}!'
      };
      const result = convertTranslations(input);
      assert.deepStrictEqual(result, expected);
    });

    test('converts multiple variables in one string', () => {
      const input = {
        message: 'Hello {{firstName}} {{lastName}}!'
      };
      const expected = {
        message: 'Hello {firstName} {lastName}!'
      };
      const result = convertTranslations(input);
      assert.deepStrictEqual(result, expected);
    });

    test('handles strings without variables', () => {
      const input = {
        static: 'This is a static string'
      };
      const expected = {
        static: 'This is a static string'
      };
      const result = convertTranslations(input);
      assert.deepStrictEqual(result, expected);
    });
  });

  describe('Plural forms', () => {
    test('converts basic plural forms', () => {
      const input = {
        item_zero: 'No items',
        item_one: '{{count}} item',
        item_other: '{{count}} items'
      };
      const result = convertTranslations(input);

      assert.strictEqual(typeof result.item, 'string');
      assert.ok(result.item.includes('plural'));
      assert.ok(result.item.includes('=0{No items}'));
      assert.ok(result.item.includes('one{{count} item}'));
      assert.ok(result.item.includes('other{{count} items}'));
    });

    test('converts plurals with all forms', () => {
      const input = {
        message_zero: 'zero',
        message_one: 'one',
        message_two: 'two',
        message_few: 'few',
        message_many: 'many',
        message_other: 'other'
      };
      const result = convertTranslations(input);

      assert.strictEqual(typeof result.message, 'string');
      assert.ok(result.message.includes('=0{zero}'));
      assert.ok(result.message.includes('one{one}'));
      assert.ok(result.message.includes('two{two}'));
      assert.ok(result.message.includes('few{few}'));
      assert.ok(result.message.includes('many{many}'));
      assert.ok(result.message.includes('other{other}'));
    });
  });

  describe('Nested objects', () => {
    test('converts nested objects', () => {
      const input = {
        user: {
          greeting: 'Hello {{name}}',
          farewell: 'Goodbye {{name}}'
        }
      };
      const expected = {
        user: {
          greeting: 'Hello {name}',
          farewell: 'Goodbye {name}'
        }
      };
      const result = convertTranslations(input);
      assert.deepStrictEqual(result, expected);
    });

    test('converts deeply nested objects', () => {
      const input = {
        level1: {
          level2: {
            level3: {
              message: 'Deep {{value}}'
            }
          }
        }
      };
      const expected = {
        level1: {
          level2: {
            level3: {
              message: 'Deep {value}'
            }
          }
        }
      };
      const result = convertTranslations(input);
      assert.deepStrictEqual(result, expected);
    });

    test('converts plurals in nested objects', () => {
      const input = {
        user: {
          notification_zero: 'No notifications',
          notification_one: '{{count}} notification',
          notification_other: '{{count}} notifications'
        }
      };
      const result = convertTranslations(input);

      assert.ok(result.user.notification);
      assert.ok(result.user.notification.includes('plural'));
    });
  });

  describe('Mixed content', () => {
    test('handles mix of regular keys and plurals', () => {
      const input = {
        welcome: 'Welcome {{user}}',
        item_zero: 'No items',
        item_one: '{{count}} item',
        item_other: '{{count}} items',
        goodbye: 'Goodbye {{user}}'
      };
      const result = convertTranslations(input);

      assert.strictEqual(result.welcome, 'Welcome {user}');
      assert.strictEqual(result.goodbye, 'Goodbye {user}');
      assert.ok(result.item.includes('plural'));
    });
  });

  describe('Nesting references', () => {
    test('converts $t() references to [REF:key] format', () => {
      const input = {
        nested: 'This uses $t(other.key)'
      };
      const expected = {
        nested: 'This uses [REF:other.key]'
      };
      const result = convertTranslations(input);
      assert.deepStrictEqual(result, expected);
    });
  });

  describe('Edge cases', () => {
    test('handles empty object', () => {
      const input = {};
      const expected = {};
      const result = convertTranslations(input);
      assert.deepStrictEqual(result, expected);
    });

    test('preserves non-string values', () => {
      const input = {
        number: 123,
        boolean: true,
        null: null
      };
      const result = convertTranslations(input);
      assert.strictEqual(result.number, 123);
      assert.strictEqual(result.boolean, true);
      assert.strictEqual(result.null, null);
    });

    test('handles special characters in variables', () => {
      const input = {
        message: 'Hello {{user_name}}!'
      };
      const expected = {
        message: 'Hello {user_name}!'
      };
      const result = convertTranslations(input);
      assert.deepStrictEqual(result, expected);
    });
  });

  describe('convertFile', () => {
    test('works as alias for convertTranslations', () => {
      const input = {
        test: 'Hello {{name}}'
      };
      const expected = {
        test: 'Hello {name}'
      };
      const result = convertFile(input);
      assert.deepStrictEqual(result, expected);
    });
  });
});
