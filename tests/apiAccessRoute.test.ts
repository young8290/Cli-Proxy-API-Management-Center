import { describe, expect, test } from 'bun:test';
import * as apiAccess from '../src/features/apiAccess/apiAccess';

describe('API access route metadata', () => {
  test('defines the canonical workspace route and legacy API keys redirect', () => {
    expect(Reflect.get(apiAccess, 'API_ACCESS_ROUTE')).toEqual({
      path: '/api-access',
      legacyPath: '/api-keys',
    });
  });
});

describe('API access workspace helpers', () => {
  test('masks API keys by default while preserving the first and last four characters', () => {
    const maskApiKey = Reflect.get(apiAccess, 'maskApiKey');

    expect(typeof maskApiKey).toBe('function');
    if (typeof maskApiKey !== 'function') return;

    const masked = maskApiKey('sk-live-1234567890-secret');
    expect(masked).toStartWith('sk-l');
    expect(masked).toEndWith('cret');
    expect(masked).not.toContain('1234567890');
  });

  test('filters models case-insensitively by name, alias, or description', () => {
    const filterModelsByQuery = Reflect.get(apiAccess, 'filterModelsByQuery');

    expect(typeof filterModelsByQuery).toBe('function');
    if (typeof filterModelsByQuery !== 'function') return;

    const models = [
      { name: 'gpt-5-mini', alias: 'Fast GPT' },
      { name: 'claude-sonnet-4', description: 'Balanced reasoning' },
      { name: 'gemini-2.5-pro' },
    ];

    expect(filterModelsByQuery(models, 'FAST')).toEqual([models[0]]);
    expect(filterModelsByQuery(models, 'reasoning')).toEqual([models[1]]);
    expect(filterModelsByQuery(models, '  ')).toEqual(models);
  });
});
