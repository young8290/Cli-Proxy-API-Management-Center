// @ts-expect-error Bun test runtime types are not included in the production tsconfig.
import { describe, expect, test } from 'bun:test';
import {
  CRITICAL_QUOTA_THRESHOLD_PERCENT,
  LOW_QUOTA_THRESHOLD_PERCENT,
  presentQuota,
} from './quotaPresentation';

describe('presentQuota', () => {
  test('classifies real remaining percentages with exported account thresholds', () => {
    expect(LOW_QUOTA_THRESHOLD_PERCENT).toBe(20);
    expect(CRITICAL_QUOTA_THRESHOLD_PERCENT).toBe(10);

    expect(presentQuota({ status: 'success', remainingPercent: 75 }).level).toBe('sufficient');
    expect(
      presentQuota({ status: 'success', remainingPercent: LOW_QUOTA_THRESHOLD_PERCENT }).level
    ).toBe('low');
    expect(
      presentQuota({ status: 'success', remainingPercent: CRITICAL_QUOTA_THRESHOLD_PERCENT }).level
    ).toBe('critical');
  });

  test('converts a real used percentage without changing provider-native detail metadata', () => {
    expect(
      presentQuota({
        status: 'success',
        usedPercent: 85,
        providerUnit: 'requests',
        detail: 'quota_management.detail_requests_remaining',
        resetAt: '2026-07-13T00:00:00Z',
      })
    ).toEqual({
      level: 'low',
      labelKey: 'quota_management.level_low',
      detailKey: 'quota_management.detail_requests_remaining',
      percent: 15,
      resetAt: '2026-07-13T00:00:00Z',
    });
  });

  test('does not fabricate a percentage from provider units or descriptive text', () => {
    expect(
      presentQuota({
        status: 'success',
        providerUnit: 'credits',
        detail: 'quota_management.detail_provider_native',
      })
    ).toEqual({
      level: 'unknown',
      labelKey: 'quota_management.level_unknown',
      detailKey: 'quota_management.detail_provider_native',
    });
  });

  test('distinguishes unsupported, fetch errors, and credentials that were not refreshed', () => {
    expect(presentQuota({ status: 'unsupported' })).toEqual({
      level: 'unknown',
      labelKey: 'quota_management.level_unknown',
      detailKey: 'quota_management.detail_unsupported',
    });
    expect(presentQuota({ status: 'fetch-error' })).toEqual({
      level: 'unknown',
      labelKey: 'quota_management.level_unknown',
      detailKey: 'quota_management.detail_fetch_error',
    });
    expect(presentQuota({ status: 'not-refreshed' })).toEqual({
      level: 'unknown',
      labelKey: 'quota_management.level_unknown',
      detailKey: 'quota_management.detail_not_refreshed',
    });
  });

  test('keeps a provider limit-reached detail unknown when no real percentage exists', () => {
    expect(
      presentQuota({
        status: 'success',
        usedPercent: null,
        providerUnit: 'provider-limit',
        detail: 'quota_management.detail_provider_limit_reached',
        resetAt: 1_800_000_000_000,
      })
    ).toEqual({
      level: 'unknown',
      labelKey: 'quota_management.level_unknown',
      detailKey: 'quota_management.detail_provider_limit_reached',
    });
  });
});
