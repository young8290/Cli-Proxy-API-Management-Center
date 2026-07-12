import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import {
  latestRecentRequestTime,
  summarizeApiKeyUsage,
} from '../src/utils/recentRequests';
import {
  filterQuotaFiles,
  quotaLevelFromState,
  type QuotaFilterRecord,
} from '../src/features/quota/quotaFilters';
import { resolveQuotaRefreshTargets } from '../src/components/quota/quotaVisibility';

describe('observability workflow gaps', () => {
  test('finds the latest valid recent request timestamp', () => {
    expect(
      latestRecentRequestTime([
        { time: '2026-01-01T00:00:00Z', success: 1, failed: 0 },
        { time: 'invalid', success: 0, failed: 1 },
        { time: '2026-01-02T00:00:00Z', success: 0, failed: 1 },
      ])
    ).toBe('2026-01-02T00:00:00Z');
    expect(latestRecentRequestTime([])).toBeUndefined();
  });

  test('uses the latest non-empty backend time bucket label', () => {
    expect(
      latestRecentRequestTime([
        { time: '10:00-10:10', success: 1, failed: 0 },
        { time: '10:10-10:20', success: 0, failed: 2 },
        { time: '10:20-10:30', success: 0, failed: 0 },
      ])
    ).toBe('10:10-10:20');
  });

  test('summarizes providers and masked accounts without inventing model data', () => {
    const summary = summarizeApiKeyUsage({
      codex: {
        'https://relay.example/v1|super-secret-key': {
          success: 8,
          failed: 2,
          recent_requests: [{ time: '10:00-10:10', success: 0, failed: 2 }],
        },
      },
    });

    expect(summary.total).toBe(10);
    expect(summary.providers).toEqual([{ name: 'codex', success: 8, failed: 2 }]);
    expect(summary.accounts).toHaveLength(1);
    expect(summary.accounts[0]?.name).toContain('relay.example');
    expect(summary.accounts[0]?.name).not.toContain('super-secret-key');
    expect(summary.models).toEqual([]);
    expect(summary.failures[0]).toMatchObject({ provider: 'codex', count: 2 });
  });

  test('keeps colliding masked account labels as separate provider identities', () => {
    const summary = summarizeApiKeyUsage({
      codex: {
        'https://relay.example/v1|codex-secret-same': { success: 2, failed: 0 },
      },
      claude: {
        'https://relay.example/v1|claude-secret-same': { success: 3, failed: 1 },
      },
    });

    expect(summary.accounts).toHaveLength(2);
    expect(new Set(summary.accounts.map((account) => account.id)).size).toBe(2);
    expect(summary.accounts.reduce((total, account) => total + account.success, 0)).toBe(5);
  });

  test('filters quota records by provider and presented level', () => {
    const records: QuotaFilterRecord[] = [
      { name: 'a', provider: 'claude', level: 'critical' },
      { name: 'b', provider: 'codex', level: 'sufficient' },
    ];
    expect(filterQuotaFiles(records, 'claude', 'critical').map((item) => item.name)).toEqual(['a']);
    expect(filterQuotaFiles(records, 'all', 'unknown')).toEqual([]);
  });

  test('derives the most constrained level from real loaded quota state', () => {
    expect(
      quotaLevelFromState('codex', {
        status: 'success',
        windows: [{ usedPercent: 20 }, { usedPercent: 92 }],
      })
    ).toBe('critical');
    expect(
      quotaLevelFromState('antigravity', {
        status: 'success',
        groups: [{ buckets: [{ remainingFraction: 0.15 }] }],
      })
    ).toBe('low');
    expect(
      quotaLevelFromState('kimi', {
        status: 'success',
        rows: [{ used: 75, limit: 100 }],
      })
    ).toBe('sufficient');
    expect(quotaLevelFromState('codex', { status: 'idle' })).toBe('unknown');
  });

  test('refreshes every provider credential even when a level filter hides unloaded cards', () => {
    const providerFiles = [{ name: 'loaded-low' }, { name: 'not-loaded-yet' }];
    const visibleNames = new Set(['loaded-low']);

    expect(resolveQuotaRefreshTargets(providerFiles, visibleNames)).toEqual(providerFiles);
    expect(quotaLevelFromState('codex', { status: 'idle' })).toBe('unknown');
    expect(
      quotaLevelFromState('codex', {
        status: 'success',
        windows: [{ usedPercent: 85 }],
      })
    ).toBe('low');
  });

  test('wires a standalone request statistics route and navigation item', () => {
    const routes = readFileSync('src/router/MainRoutes.tsx', 'utf8');
    const layout = readFileSync('src/components/layout/MainLayout.tsx', 'utf8');
    expect(routes).toContain("path: '/request-stats'");
    expect(layout).toContain("path: '/request-stats'");
  });

  test('request statistics page renders real account distribution and honest runtime context', () => {
    const page = readFileSync('src/pages/RequestStatsPage.tsx', 'utf8');
    expect(page).toContain('summarizeApiKeyUsage(data)');
    expect(page).toContain("t('request_stats.observation_started'");
    expect(page).toContain("t('request_stats.restart_notice')");
    expect(page).not.toContain("<p>{t('request_stats.unavailable')}</p>\n            <h2>{t('request_stats.by_account')}");
  });
});
