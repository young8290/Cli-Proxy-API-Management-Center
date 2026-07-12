import type { QuotaPresentationLevel } from './quotaPresentation';
import { presentQuota } from './quotaPresentation';

export type QuotaFilterRecord = {
  name: string;
  provider: string;
  level: QuotaPresentationLevel;
};

export function filterQuotaFiles<T extends QuotaFilterRecord>(
  records: T[],
  provider: string,
  level: QuotaPresentationLevel | 'all'
): T[] {
  return records.filter(
    (record) =>
      (provider === 'all' || record.provider === provider) &&
      (level === 'all' || record.level === level)
  );
}

export function quotaLevelFromState(state: unknown): QuotaPresentationLevel {
  if (!state || typeof state !== 'object') return 'unknown';
  const record = state as Record<string, unknown>;
  if (record.status !== 'success') return 'unknown';
  const percentages: number[] = [];
  const visit = (value: unknown): void => {
    if (!value || typeof value !== 'object') return;
    if (Array.isArray(value)) return value.forEach(visit);
    Object.entries(value as Record<string, unknown>).forEach(([key, child]) => {
      if ((key === 'remainingPercent' || key === 'remaining') && typeof child === 'number')
        percentages.push(child);
      else visit(child);
    });
  };
  visit(record);
  return presentQuota({
    status: 'success',
    remainingPercent: percentages.length ? Math.min(...percentages) : null,
  }).level;
}
