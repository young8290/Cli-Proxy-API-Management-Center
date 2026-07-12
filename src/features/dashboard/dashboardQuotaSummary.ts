import type {
  AntigravityQuotaState,
  ClaudeQuotaState,
  CodexQuotaState,
  KimiQuotaState,
  XaiQuotaState,
} from '@/types';

export interface DashboardQuotaSnapshot {
  antigravityQuota: Record<string, AntigravityQuotaState>;
  claudeQuota: Record<string, ClaudeQuotaState>;
  codexQuota: Record<string, CodexQuotaState>;
  kimiQuota: Record<string, KimiQuotaState>;
  xaiQuota: Record<string, XaiQuotaState>;
}

export interface DashboardQuotaSummary {
  expected: number;
  loaded: number;
  loading: number;
  errors: number;
  low: number;
  refreshingSoon: number;
}

const LOW_REMAINING_PERCENT = 20;
const REFRESH_SOON_MS = 24 * 60 * 60 * 1000;

const isLowRemaining = (remaining: number | null): boolean =>
  remaining !== null && Number.isFinite(remaining) && remaining <= LOW_REMAINING_PERCENT;

const isSoon = (value: unknown, now: number): boolean => {
  if (typeof value !== 'string' && typeof value !== 'number') return false;
  const timestamp = typeof value === 'number' ? value : Date.parse(value);
  return Number.isFinite(timestamp) && timestamp > now && timestamp - now <= REFRESH_SOON_MS;
};

export function buildDashboardQuotaSummary(
  snapshot: DashboardQuotaSnapshot,
  expected: number,
  now = Date.now()
): DashboardQuotaSummary {
  const loaded = new Set<string>();
  const loading = new Set<string>();
  const errors = new Set<string>();
  const low = new Set<string>();
  const refreshingSoon = new Set<string>();

  const recordStatus = (name: string, state: { status: string }) => {
    if (state.status === 'success') loaded.add(name);
    if (state.status === 'loading') loading.add(name);
    if (state.status === 'error') errors.add(name);
  };

  Object.entries(snapshot.antigravityQuota).forEach(([name, state]) => {
    recordStatus(name, state);
    state.groups.forEach((group) =>
      group.buckets.forEach((bucket) => {
        if (isLowRemaining(bucket.remainingFraction * 100)) low.add(name);
        if (isSoon(bucket.resetTime, now)) refreshingSoon.add(name);
      })
    );
  });

  Object.entries(snapshot.claudeQuota).forEach(([name, state]) => {
    recordStatus(name, state);
    state.windows.forEach((window) => {
      if (isLowRemaining(window.usedPercent === null ? null : 100 - window.usedPercent)) {
        low.add(name);
      }
      if (isSoon(window.resetLabel, now)) refreshingSoon.add(name);
    });
  });

  Object.entries(snapshot.codexQuota).forEach(([name, state]) => {
    recordStatus(name, state);
    state.windows.forEach((window) => {
      if (isLowRemaining(window.usedPercent === null ? null : 100 - window.usedPercent)) {
        low.add(name);
      }
      if (isSoon(window.resetLabel, now)) refreshingSoon.add(name);
    });
  });

  Object.entries(snapshot.kimiQuota).forEach(([name, state]) => {
    recordStatus(name, state);
    state.rows.forEach((row) => {
      const remaining = row.limit > 0 ? ((row.limit - row.used) / row.limit) * 100 : null;
      if (isLowRemaining(remaining)) low.add(name);
      if (isSoon(row.resetHint, now)) refreshingSoon.add(name);
    });
  });

  Object.entries(snapshot.xaiQuota).forEach(([name, state]) => {
    recordStatus(name, state);
    const usedPercent = state.billing?.usedPercent ?? state.billing?.usagePercent ?? null;
    if (isLowRemaining(usedPercent === null ? null : 100 - usedPercent)) low.add(name);
    if (isSoon(state.billing?.billingPeriodEnd, now) || isSoon(state.billing?.periodEnd, now)) {
      refreshingSoon.add(name);
    }
  });

  return {
    expected,
    loaded: loaded.size,
    loading: loading.size,
    errors: errors.size,
    low: low.size,
    refreshingSoon: refreshingSoon.size,
  };
}
