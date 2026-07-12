// @ts-expect-error Bun test runtime types are not included in the production tsconfig.
import { describe, expect, test } from 'bun:test';
import type { AuthFileItem } from '@/types';
import { resolveQuotaVisibility } from './quotaVisibility';

const providerFiles: AuthFileItem[] = [
  { name: 'alice.json', type: 'claude' },
  { name: 'bob.json', type: 'claude' },
  { name: 'codex.json', type: 'codex' },
];

describe('resolveQuotaVisibility', () => {
  test('keeps the complete provider lifecycle set while hiding non-matching cards', () => {
    const result = resolveQuotaVisibility(
      providerFiles,
      (file) => file.type === 'claude',
      new Set(['alice.json'])
    );

    expect(result.providerFiles.map((file) => file.name)).toEqual(['alice.json', 'bob.json']);
    expect(result.visibleFiles.map((file) => file.name)).toEqual(['alice.json']);
  });

  test('an empty search result hides all cards without emptying the provider lifecycle set', () => {
    const result = resolveQuotaVisibility(
      providerFiles,
      (file) => file.type === 'claude',
      new Set()
    );

    expect(result.providerFiles.map((file) => file.name)).toEqual(['alice.json', 'bob.json']);
    expect(result.visibleFiles).toEqual([]);
  });

  test('an omitted visibility filter shows all provider files', () => {
    const result = resolveQuotaVisibility(providerFiles, (file) => file.type === 'claude');
    expect(result.visibleFiles).toEqual(result.providerFiles);
  });
});
