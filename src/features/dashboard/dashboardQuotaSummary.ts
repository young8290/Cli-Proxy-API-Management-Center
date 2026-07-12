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

export const parseQuotaResetTimestamp = (value: unknown, now: number): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.abs(value) < 1e12 ? value * 1000 : value;
  }
  if (typeof value !== 'string') return null;
  const text = value.trim();
  if (!text || text === '-') return null;

  if (/^\d{4}-\d{2}-\d{2}(?:T|\s)/.test(text)) {
    const parsed = Date.parse(text);
    return Number.isFinite(parsed) ? parsed : null;
  }

  const durationPattern =
    /(\d+(?:\.\d+)?)\s*(d|day|days|天|h|hr|hrs|hour|hours|小时|小時|m|min|mins|minute|minutes|分钟|分鐘|s|sec|secs|second|seconds|秒)/gi;
  let durationMs = 0;
  let durationMatch: RegExpExecArray | null;
  while ((durationMatch = durationPattern.exec(text)) !== null) {
    const amount = Number(durationMatch[1]);
    const unit = durationMatch[2].toLowerCase();
    if (unit === 'd' || unit.startsWith('day') || unit === '天') durationMs += amount * 86_400_000;
    else if (
      unit === 'h' ||
      unit.startsWith('hr') ||
      unit.startsWith('hour') ||
      unit === '小时' ||
      unit === '小時'
    )
      durationMs += amount * 3_600_000;
    else if (unit === 'm' || unit.startsWith('min') || unit === '分钟' || unit === '分鐘')
      durationMs += amount * 60_000;
    else durationMs += amount * 1000;
  }
  if (durationMs > 0) return now + durationMs;
  if (/^<\s*1\s*(?:m|min|minute|分钟|分鐘)/i.test(text)) return now + 30_000;

  const noYearMatch = text.match(
    /^(\d{1,2})(?:\/|月)(\d{1,2})(?:日)?(?:,|\s)+\s*(\d{1,2}):(\d{2})/
  );
  if (!noYearMatch) return null;
  const [, monthRaw, dayRaw, hourRaw, minuteRaw] = noYearMatch;
  const current = new Date(now);
  const build = (year: number) =>
    new Date(year, Number(monthRaw) - 1, Number(dayRaw), Number(hourRaw), Number(minuteRaw), 0, 0);
  let candidate = build(current.getFullYear());
  if (
    candidate.getMonth() !== Number(monthRaw) - 1 ||
    candidate.getDate() !== Number(dayRaw) ||
    candidate.getHours() !== Number(hourRaw) ||
    candidate.getMinutes() !== Number(minuteRaw)
  ) {
    return null;
  }
  if (candidate.getTime() <= now) candidate = build(current.getFullYear() + 1);
  return candidate.getTime();
};

const isSoon = (value: unknown, now: number): boolean => {
  const timestamp = parseQuotaResetTimestamp(value, now);
  if (timestamp === null) return false;
  return Number.isFinite(timestamp) && timestamp > now && timestamp - now <= REFRESH_SOON_MS;
};

export function buildDashboardQuotaSummary(
  snapshot: DashboardQuotaSnapshot,
  quotaFileNames: readonly string[],
  now = Date.now()
): DashboardQuotaSummary {
  const allowedNames = new Set(quotaFileNames);
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
    if (!allowedNames.has(name)) return;
    recordStatus(name, state);
    state.groups.forEach((group) =>
      group.buckets.forEach((bucket) => {
        if (isLowRemaining(bucket.remainingFraction * 100)) low.add(name);
        if (isSoon(bucket.resetTime, now)) refreshingSoon.add(name);
      })
    );
  });

  Object.entries(snapshot.claudeQuota).forEach(([name, state]) => {
    if (!allowedNames.has(name)) return;
    recordStatus(name, state);
    state.windows.forEach((window) => {
      if (isLowRemaining(window.usedPercent === null ? null : 100 - window.usedPercent)) {
        low.add(name);
      }
      if (isSoon(window.resetAt ?? window.resetLabel, now)) refreshingSoon.add(name);
    });
  });

  Object.entries(snapshot.codexQuota).forEach(([name, state]) => {
    if (!allowedNames.has(name)) return;
    recordStatus(name, state);
    state.windows.forEach((window) => {
      if (isLowRemaining(window.usedPercent === null ? null : 100 - window.usedPercent)) {
        low.add(name);
      }
      if (isSoon(window.resetAt ?? window.resetLabel, now)) refreshingSoon.add(name);
    });
  });

  Object.entries(snapshot.kimiQuota).forEach(([name, state]) => {
    if (!allowedNames.has(name)) return;
    recordStatus(name, state);
    state.rows.forEach((row) => {
      const remaining = row.limit > 0 ? ((row.limit - row.used) / row.limit) * 100 : null;
      if (isLowRemaining(remaining)) low.add(name);
      if (isSoon(row.resetAt ?? row.resetHint, now)) refreshingSoon.add(name);
    });
  });

  Object.entries(snapshot.xaiQuota).forEach(([name, state]) => {
    if (!allowedNames.has(name)) return;
    recordStatus(name, state);
    const usedPercent = state.billing?.usedPercent ?? state.billing?.usagePercent ?? null;
    if (isLowRemaining(usedPercent === null ? null : 100 - usedPercent)) low.add(name);
    if (isSoon(state.billing?.billingPeriodEnd, now) || isSoon(state.billing?.periodEnd, now)) {
      refreshingSoon.add(name);
    }
  });

  return {
    expected: allowedNames.size,
    loaded: loaded.size,
    loading: loading.size,
    errors: errors.size,
    low: low.size,
    refreshingSoon: refreshingSoon.size,
  };
}
