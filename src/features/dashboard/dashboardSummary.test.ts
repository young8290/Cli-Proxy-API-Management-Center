// @ts-expect-error Bun test runtime types are not included in the production tsconfig.
import { describe, expect, test } from 'bun:test';
import type { AuthFileItem } from '@/types/authFile';
import type { ApiKeyUsageResponse } from '@/utils/recentRequests';
import { buildDashboardSummary } from './dashboardSummary';

describe('buildDashboardSummary', () => {
  test('aggregates account health without treating unknown accounts as healthy', () => {
    const accounts: AuthFileItem[] = [
      { name: 'healthy.json', status: 'active' },
      { name: 'error.json', status: 'error' },
      { name: 'disabled.json', disabled: true, status: 'error' },
      { name: 'unavailable.json', unavailable: true },
      { name: 'retrying.json', next_retry_after: '2026-07-12T02:00:00Z' },
      { name: 'unknown.json' },
    ];

    expect(buildDashboardSummary(accounts, {}).accounts).toEqual({
      total: 6,
      healthy: 1,
      error: 1,
      disabled: 1,
      unavailable: 1,
      retrying: 1,
    });
  });

  test('sums request totals across providers and returns a percentage success rate', () => {
    const usage: ApiKeyUsageResponse = {
      gemini: {
        'https://one.example|key-a': { success: 8, failed: 2 },
        'https://two.example|key-b': { success: '3', failed: '1' },
      },
      claude: {
        'https://three.example|key-c': { success: 9, failed: 1 },
      },
    };

    expect(buildDashboardSummary([], usage).requests).toEqual({
      success: 20,
      failure: 4,
      successRate: (20 / 24) * 100,
    });
  });

  test('uses null success rate when no requests are available', () => {
    expect(buildDashboardSummary([], {}).requests).toEqual({
      success: 0,
      failure: 0,
      successRate: null,
    });
  });

  test('returns at most five newest account errors without mutating the input array', () => {
    const accounts: AuthFileItem[] = [
      {
        name: 'old-error.json',
        type: 'gemini',
        status: 'error',
        status_message: 'old error',
        last_refresh: '2026-07-10T01:00:00Z',
      },
      {
        name: 'retrying.json',
        type: 'codex',
        next_retry_after: '2026-07-12T06:00:00Z',
      },
      {
        name: 'unavailable.json',
        unavailable: true,
        statusMessage: 'temporarily unavailable',
        lastRefresh: '2026-07-12T05:00:00Z',
      },
      {
        name: 'new-error.json',
        status: 'error',
        statusMessage: 'new error',
        lastRefresh: '2026-07-12T07:00:00Z',
      },
      {
        name: 'middle-error.json',
        status: 'error',
        lastRefresh: '2026-07-11T07:00:00Z',
      },
      { name: 'unknown-time-error.json', status: 'error' },
      { name: 'disabled.json', disabled: true, status: 'error' },
      { name: 'healthy.json', status: 'active' },
    ];
    const originalOrder = accounts.map((account) => account.name);

    const recentErrors = buildDashboardSummary(accounts, {}).recentErrors;

    expect(recentErrors.map((entry) => entry.name)).toEqual([
      'new-error.json',
      'retrying.json',
      'unavailable.json',
      'middle-error.json',
      'old-error.json',
    ]);
    expect(recentErrors[0]).toMatchObject({
      kind: 'error',
      message: 'new error',
      timestamp: Date.parse('2026-07-12T07:00:00Z'),
    });
    expect(recentErrors[1]).toMatchObject({
      kind: 'retrying',
      type: 'codex',
      timestamp: Date.parse('2026-07-12T06:00:00Z'),
    });
    expect(accounts.map((account) => account.name)).toEqual(originalOrder);
  });
});
