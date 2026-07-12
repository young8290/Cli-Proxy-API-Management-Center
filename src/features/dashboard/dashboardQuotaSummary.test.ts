// @ts-expect-error Bun test runtime types are not included in the production tsconfig.
import { describe, expect, test } from 'bun:test';
import { buildDashboardQuotaSummary } from './dashboardQuotaSummary';

describe('buildDashboardQuotaSummary', () => {
  test('summarizes low quota and upcoming resets from real quota states', () => {
    const now = Date.parse('2026-07-12T00:00:00Z');
    const summary = buildDashboardQuotaSummary(
      {
        antigravityQuota: {
          'ag.json': {
            status: 'success',
            groups: [
              {
                id: 'models',
                label: 'Models',
                buckets: [
                  {
                    id: 'flash',
                    label: 'Flash',
                    remainingFraction: 0.15,
                    resetTime: '2026-07-12T08:00:00Z',
                  },
                ],
              },
            ],
          },
        },
        claudeQuota: {
          'claude.json': {
            status: 'success',
            windows: [{ id: 'weekly', label: 'Weekly', usedPercent: 30, resetLabel: '-' }],
          },
        },
        codexQuota: {},
        kimiQuota: {},
        xaiQuota: {},
      },
      2,
      now
    );

    expect(summary).toEqual({
      expected: 2,
      loaded: 2,
      loading: 0,
      errors: 0,
      low: 1,
      refreshingSoon: 1,
    });
  });

  test('reports quota read failures and unknown credentials honestly', () => {
    expect(
      buildDashboardQuotaSummary(
        {
          antigravityQuota: {},
          claudeQuota: {
            'broken.json': { status: 'error', windows: [], error: 'quota request failed' },
          },
          codexQuota: {},
          kimiQuota: {},
          xaiQuota: {},
        },
        3,
        Date.now()
      )
    ).toEqual({
      expected: 3,
      loaded: 0,
      loading: 0,
      errors: 1,
      low: 0,
      refreshingSoon: 0,
    });
  });
});
