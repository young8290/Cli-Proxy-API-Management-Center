import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { latestRecentRequestTime } from '../src/utils/recentRequests';
import {
  filterQuotaFiles,
  quotaLevelFromState,
  type QuotaFilterRecord,
} from '../src/features/quota/quotaFilters';

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
      quotaLevelFromState({
        status: 'success',
        windows: [{ remainingPercent: 80 }, { remainingPercent: 8 }],
      })
    ).toBe('critical');
    expect(quotaLevelFromState({ status: 'idle' })).toBe('unknown');
  });

  test('wires a standalone request statistics route and navigation item', () => {
    const routes = readFileSync('src/router/MainRoutes.tsx', 'utf8');
    const layout = readFileSync('src/components/layout/MainLayout.tsx', 'utf8');
    expect(routes).toContain("path: '/request-stats'");
    expect(layout).toContain("path: '/request-stats'");
  });
});
