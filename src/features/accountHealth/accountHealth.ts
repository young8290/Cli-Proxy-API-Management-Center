import type { AuthFileItem } from '@/types/authFile';
import { parseTimestampMs } from '@/utils/timestamp';

export type AccountHealthKind =
  | 'disabled'
  | 'unavailable'
  | 'retrying'
  | 'error'
  | 'healthy'
  | 'unknown';

export interface AccountHealth {
  kind: AccountHealthKind;
  message?: string;
  lastRefresh?: string | number;
  nextRetryAfter?: string | number;
}

export const numericCount = (value: unknown): number => {
  if (typeof value !== 'number' && typeof value !== 'string') return 0;
  const parsed = typeof value === 'number' ? value : Number(value.trim());
  return Number.isFinite(parsed) ? parsed : 0;
};

const sortableTimestamp = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.abs(value) < 1e12 ? value * 1000 : value;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const numeric = Number(trimmed);
    if (Number.isFinite(numeric)) {
      return Math.abs(numeric) < 1e12 ? numeric * 1000 : numeric;
    }
  }

  const parsed = parseTimestampMs(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const latestTimestampValue = (values: unknown[]): string | number | undefined => {
  let latestValue: string | number | undefined;
  let latestTimestamp = Number.NEGATIVE_INFINITY;

  values.forEach((value) => {
    if (typeof value !== 'string' && typeof value !== 'number') return;
    const timestamp = sortableTimestamp(value);
    if (timestamp === null || timestamp <= latestTimestamp) return;
    latestTimestamp = timestamp;
    latestValue = value;
  });

  return latestValue;
};

const backendTimestampValue = (values: unknown[]): string | number | undefined => {
  const latest = latestTimestampValue(values);
  if (latest !== undefined) return latest;

  return values.find(
    (value): value is string | number =>
      (typeof value === 'string' && value.trim().length > 0) ||
      (typeof value === 'number' && Number.isFinite(value))
  );
};

export const accountTimestamp = (item: AuthFileItem): number | null => {
  const timestamps = [
    item.lastRefresh,
    item['last_refresh'],
    item['nextRetryAfter'],
    item['next_retry_after'],
  ]
    .map(sortableTimestamp)
    .filter((value): value is number => value !== null);

  return timestamps.length > 0 ? Math.max(...timestamps) : null;
};

export const deriveAccountHealth = (item: AuthFileItem): AccountHealth => {
  const status = typeof item.status === 'string' ? item.status.trim().toLowerCase() : '';
  const rawMessage = item['status_message'] ?? item.statusMessage;
  const message = typeof rawMessage === 'string' ? rawMessage.trim() : '';
  const lastRefresh = backendTimestampValue([item.lastRefresh, item['last_refresh']]);
  const nextRetryAfter = backendTimestampValue([
    item['nextRetryAfter'],
    item['next_retry_after'],
  ]);
  const details = {
    ...(message ? { message } : {}),
    ...(lastRefresh !== undefined ? { lastRefresh } : {}),
    ...(nextRetryAfter !== undefined ? { nextRetryAfter } : {}),
  };

  if (item.disabled === true || status === 'disabled') return { kind: 'disabled', ...details };
  if (item.unavailable === true) return { kind: 'unavailable', ...details };
  if (nextRetryAfter !== undefined) return { kind: 'retrying', ...details };
  if (status === 'error' || message) return { kind: 'error', ...details };
  if (status === 'active') return { kind: 'healthy', ...details };
  return { kind: 'unknown', ...details };
};
