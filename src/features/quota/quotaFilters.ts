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

export function quotaLevelFromState(provider: string, state: unknown): QuotaPresentationLevel {
  if (!state || typeof state !== 'object') return 'unknown';
  const record = state as Record<string, unknown>;
  if (record.status !== 'success') return 'unknown';
  const presentations = (
    provider === 'antigravity'
      ? ((record.groups as Array<{ buckets?: Array<{ remainingFraction?: number }> }>) ?? []).flatMap(
          (group) =>
            (group.buckets ?? []).map((bucket) =>
              presentQuota({
                status: 'success',
                remainingPercent:
                  typeof bucket.remainingFraction === 'number'
                    ? bucket.remainingFraction * 100
                    : null,
              })
            )
        )
      : provider === 'kimi'
        ? ((record.rows as Array<{ used?: number; limit?: number }>) ?? []).map((row) =>
            presentQuota({
              status: 'success',
              remainingPercent:
                typeof row.used === 'number' && typeof row.limit === 'number' && row.limit > 0
                  ? ((row.limit - row.used) / row.limit) * 100
                  : null,
            })
          )
        : provider === 'xai'
          ? [
              presentQuota({
                status: 'success',
                usedPercent: (record.billing as { usedPercent?: number } | null)?.usedPercent,
              }),
            ]
          : ((record.windows as Array<{ usedPercent?: number | null }>) ?? []).map((window) =>
              presentQuota({ status: 'success', usedPercent: window.usedPercent })
            )
  ).filter((presentation) => presentation.level !== 'unknown');

  if (presentations.length === 0) return 'unknown';
  return presentations.reduce((lowest, current) =>
    (current.percent ?? 101) < (lowest.percent ?? 101) ? current : lowest
  ).level;
}
