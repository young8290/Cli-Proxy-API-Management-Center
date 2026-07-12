export const LOW_QUOTA_THRESHOLD_PERCENT = 20;
export const CRITICAL_QUOTA_THRESHOLD_PERCENT = 10;

export type QuotaPresentationLevel = 'sufficient' | 'low' | 'critical' | 'unknown';
export type QuotaPresentationStatus = 'success' | 'unsupported' | 'fetch-error' | 'not-refreshed';

export interface QuotaPresentationInput {
  status: QuotaPresentationStatus;
  remainingPercent?: number | null;
  usedPercent?: number | null;
  resetAt?: string | number;
  providerUnit?: string;
  detail?: string;
}

export interface QuotaPresentation {
  level: QuotaPresentationLevel;
  labelKey: string;
  detailKey: string;
  percent?: number;
  resetAt?: string | number;
}

const UNKNOWN_DETAIL_KEYS: Record<Exclude<QuotaPresentationStatus, 'success'>, string> = {
  unsupported: 'quota_management.detail_unsupported',
  'fetch-error': 'quota_management.detail_fetch_error',
  'not-refreshed': 'quota_management.detail_not_refreshed',
};

const finitePercent = (value: number | null | undefined): number | undefined => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
  return Math.min(100, Math.max(0, value));
};

export function presentQuota(input: QuotaPresentationInput): QuotaPresentation {
  if (input.status !== 'success') {
    return {
      level: 'unknown',
      labelKey: 'quota_management.level_unknown',
      detailKey: UNKNOWN_DETAIL_KEYS[input.status],
    };
  }

  const remainingPercent = finitePercent(input.remainingPercent);
  const usedPercent = finitePercent(input.usedPercent);
  const percent = remainingPercent ?? (usedPercent === undefined ? undefined : 100 - usedPercent);

  if (percent === undefined) {
    return {
      level: 'unknown',
      labelKey: 'quota_management.level_unknown',
      detailKey: input.detail ?? 'quota_management.detail_no_percentage',
    };
  }

  const level: Exclude<QuotaPresentationLevel, 'unknown'> =
    percent <= CRITICAL_QUOTA_THRESHOLD_PERCENT
      ? 'critical'
      : percent <= LOW_QUOTA_THRESHOLD_PERCENT
        ? 'low'
        : 'sufficient';

  return {
    level,
    labelKey: `quota_management.level_${level}`,
    detailKey: input.detail ?? 'quota_management.detail_remaining_percent',
    percent,
    ...(input.resetAt !== undefined ? { resetAt: input.resetAt } : {}),
  };
}
