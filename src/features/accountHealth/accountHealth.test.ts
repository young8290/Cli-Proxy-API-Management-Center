// @ts-expect-error Bun test runtime types are not included in the production tsconfig.
import { describe, expect, test } from 'bun:test';
import { accountTimestamp, deriveAccountHealth, numericCount } from './accountHealth';

describe('numericCount', () => {
  test('returns finite numbers from numeric values and strings, otherwise zero', () => {
    expect(numericCount(7)).toBe(7);
    expect(numericCount(' 12.5 ')).toBe(12.5);
    expect(numericCount(Number.POSITIVE_INFINITY)).toBe(0);
    expect(numericCount('not-a-number')).toBe(0);
    expect(numericCount(null)).toBe(0);
  });
});

describe('accountTimestamp', () => {
  test('returns the newest parseable refresh or retry timestamp for sorting', () => {
    expect(
      accountTimestamp({
        name: 'account.json',
        lastRefresh: '2026-01-01T00:00:00Z',
        next_retry_after: '2026-02-01T00:00:00Z',
      })
    ).toBe(Date.parse('2026-02-01T00:00:00Z'));
    expect(accountTimestamp({ name: 'seconds.json', lastRefresh: 1_700_000_000 })).toBe(
      1_700_000_000_000
    );
    expect(
      accountTimestamp({
        name: 'invalid.json',
        lastRefresh: 'invalid',
        nextRetryAfter: 'also-invalid',
      })
    ).toBeNull();
  });
});

describe('deriveAccountHealth', () => {
  test('applies disabled, unavailable, retrying, error, healthy, unknown precedence', () => {
    const retryAt = '2026-02-01T00:00:00Z';
    const cases = [
      {
        item: {
          name: 'disabled-flag.json',
          disabled: true,
          unavailable: true,
          status: 'error',
          statusMessage: 'backend error',
          nextRetryAfter: retryAt,
        },
        kind: 'disabled',
      },
      { item: { name: 'disabled-status.json', status: ' disabled ' }, kind: 'disabled' },
      {
        item: {
          name: 'unavailable.json',
          unavailable: true,
          status: 'error',
          nextRetryAfter: retryAt,
        },
        kind: 'unavailable',
      },
      {
        item: { name: 'retrying.json', status: 'error', next_retry_after: retryAt },
        kind: 'retrying',
      },
      { item: { name: 'error.json', status: 'error' }, kind: 'error' },
      { item: { name: 'healthy.json', status: ' ACTIVE ' }, kind: 'healthy' },
      { item: { name: 'unknown.json', status: 'paused' }, kind: 'unknown' },
      { item: { name: 'missing.json' }, kind: 'unknown' },
    ] as const;

    cases.forEach(({ item, kind }) => {
      expect(deriveAccountHealth(item).kind).toBe(kind);
    });
  });

  test('preserves backend error text and normalized timestamp field names', () => {
    expect(
      deriveAccountHealth({
        name: 'error.json',
        status: 'error',
        status_message: 'quota exhausted by backend',
        last_refresh: '2026-01-01T00:00:00Z',
      })
    ).toEqual({
      kind: 'error',
      message: 'quota exhausted by backend',
      lastRefresh: '2026-01-01T00:00:00Z',
    });

    expect(
      deriveAccountHealth({
        name: 'retrying.json',
        status: 'error',
        lastRefresh: '2026-01-02T00:00:00Z',
        nextRetryAfter: '2026-01-03T00:00:00Z',
      })
    ).toEqual({
      kind: 'retrying',
      lastRefresh: '2026-01-02T00:00:00Z',
      nextRetryAfter: '2026-01-03T00:00:00Z',
    });
  });

  test('uses backend health fields instead of guessing from quota, counts, or colors', () => {
    expect(
      deriveAccountHealth({
        name: 'active.json',
        status: 'active',
        quota: 0,
        success: 0,
        color: 'red',
      }).kind
    ).toBe('healthy');

    expect(
      deriveAccountHealth({
        name: 'unknown.json',
        quota: 100,
        success: 25,
        color: 'green',
      }).kind
    ).toBe('unknown');
  });

  test('treats explicit backend error and retry fields as authoritative', () => {
    expect(
      deriveAccountHealth({
        name: 'message-error.json',
        status: 'active',
        status_message: 'token expired',
      })
    ).toEqual({ kind: 'error', message: 'token expired' });

    expect(
      deriveAccountHealth({
        name: 'opaque-retry.json',
        status: 'active',
        last_refresh: 'backend-refresh-marker',
        next_retry_after: 'backend-retry-marker',
      })
    ).toEqual({
      kind: 'retrying',
      lastRefresh: 'backend-refresh-marker',
      nextRetryAfter: 'backend-retry-marker',
    });
  });

  test('uses the first non-blank backend error message across field aliases', () => {
    expect(
      deriveAccountHealth({
        name: 'blank-snake-message.json',
        status: 'active',
        status_message: '   ',
        statusMessage: 'camelCase backend error',
      })
    ).toEqual({ kind: 'error', message: 'camelCase backend error' });

    expect(
      deriveAccountHealth({
        name: 'conflicting-messages.json',
        status: 'active',
        status_message: 'snake_case backend error',
        statusMessage: 'camelCase backend error',
      })
    ).toEqual({ kind: 'error', message: 'snake_case backend error' });
  });
});
