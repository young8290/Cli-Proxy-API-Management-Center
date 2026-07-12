export type StatusBlockState = 'success' | 'failure' | 'mixed' | 'idle';

export interface StatusBlockDetail {
  success: number;
  failure: number;
  rate: number;
  startTime: number;
  endTime: number;
}

export interface StatusBarData {
  blocks: StatusBlockState[];
  blockDetails: StatusBlockDetail[];
  successRate: number;
  totalSuccess: number;
  totalFailure: number;
}

export interface RecentRequestBucket {
  time?: string;
  success: number;
  failed: number;
}

export interface RecentRequestUsageEntry {
  success: number;
  failed: number;
  recentRequests: RecentRequestBucket[];
}

export type ApiKeyUsageResponse = Record<
  string,
  Record<
    string,
    {
      success?: unknown;
      failed?: unknown;
      recent_requests?: unknown;
      recentRequests?: unknown;
    }
  >
>;

export type ApiKeyUsageDistribution = {
  name: string;
  success: number;
  failed: number;
};

export type ApiKeyUsageSummary = {
  total: number;
  success: number;
  failed: number;
  providers: ApiKeyUsageDistribution[];
  accounts: ApiKeyUsageDistribution[];
  models: ApiKeyUsageDistribution[];
  failures: Array<{ provider: string; account: string; time?: string; count: number }>;
};

const maskedAccountLabel = (provider: string, compositeKey: string): string => {
  const separator = compositeKey.lastIndexOf('|');
  const baseUrl = separator >= 0 ? compositeKey.slice(0, separator) : '';
  let origin = baseUrl;
  try {
    origin = new URL(baseUrl).host;
  } catch {
    // Keep the non-secret base URL text when it is not a complete URL.
  }
  return `${origin || provider} · ••••${compositeKey.slice(separator + 1).slice(-4)}`;
};

const sortedDistributions = (
  values: Map<string, { success: number; failed: number }>
): ApiKeyUsageDistribution[] =>
  [...values].map(([name, counts]) => ({ name, ...counts })).sort((left, right) => {
    const volumeDifference = right.success + right.failed - (left.success + left.failed);
    return volumeDifference || left.name.localeCompare(right.name);
  });

export function summarizeApiKeyUsage(input: ApiKeyUsageResponse): ApiKeyUsageSummary {
  let success = 0;
  let failed = 0;
  const providers = new Map<string, { success: number; failed: number }>();
  const accounts = new Map<string, { success: number; failed: number }>();
  const models = new Map<string, { success: number; failed: number }>();
  const failures: ApiKeyUsageSummary['failures'] = [];

  Object.entries(input).forEach(([provider, entries]) => {
    Object.entries(entries).forEach(([compositeKey, raw]) => {
      const entry = normalizeRecentRequestUsageEntry(raw);
      const account = maskedAccountLabel(provider, compositeKey);
      success += entry.success;
      failed += entry.failed;
      const providerCounts = providers.get(provider) ?? { success: 0, failed: 0 };
      providerCounts.success += entry.success;
      providerCounts.failed += entry.failed;
      providers.set(provider, providerCounts);
      accounts.set(account, { success: entry.success, failed: entry.failed });

      const rawRecord = raw as Record<string, unknown>;
      const model = typeof rawRecord.model === 'string' ? rawRecord.model.trim() : '';
      if (model) models.set(model, { success: entry.success, failed: entry.failed });

      entry.recentRequests
        .filter((bucket) => bucket.failed > 0)
        .forEach((bucket) =>
          failures.push({ provider, account, time: bucket.time, count: bucket.failed })
        );
    });
  });

  return {
    total: success + failed,
    success,
    failed,
    providers: sortedDistributions(providers),
    accounts: sortedDistributions(accounts),
    models: sortedDistributions(models),
    failures,
  };
}

const RECENT_REQUEST_BLOCK_COUNT = 20;
const RECENT_REQUEST_BLOCK_DURATION_MS = 10 * 60 * 1000;

const toFiniteNumber = (value: unknown): number => {
  const numberValue = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(numberValue) ? numberValue : 0;
};

export function normalizeUsageTotal(value: unknown): number {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return 0;
    }
    const numberValue = Number(trimmed);
    return Number.isFinite(numberValue) ? numberValue : 0;
  }
  return 0;
}

export function buildRecentRequestCompositeKey(baseUrl: unknown, apiKey: unknown): string {
  const normalizedBaseUrl = String(baseUrl ?? '').trim();
  const normalizedApiKey = String(apiKey ?? '').trim();
  return `${normalizedBaseUrl}|${normalizedApiKey}`;
}

export function normalizeRecentRequestAuthIndex(value: unknown): string | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value.toString();
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }
  return null;
}

export function normalizeRecentRequestBuckets(input: unknown): RecentRequestBucket[] {
  if (!Array.isArray(input)) {
    return [];
  }

  return input.slice(-RECENT_REQUEST_BLOCK_COUNT).map((item) => {
    const record = item && typeof item === 'object' ? (item as Record<string, unknown>) : {};
    const time = typeof record.time === 'string' ? record.time : undefined;

    return {
      ...(time ? { time } : {}),
      success: toFiniteNumber(record.success),
      failed: toFiniteNumber(record.failed),
    };
  });
}

export function normalizeRecentRequestUsageEntry(input: unknown): RecentRequestUsageEntry {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return {
      success: 0,
      failed: 0,
      recentRequests: [],
    };
  }

  const record = input as Record<string, unknown>;

  return {
    success: normalizeUsageTotal(record.success),
    failed: normalizeUsageTotal(record.failed),
    recentRequests: normalizeRecentRequestBuckets(record.recent_requests ?? record.recentRequests),
  };
}

export function mergeRecentRequestBucketGroups(
  groups: RecentRequestBucket[][]
): RecentRequestBucket[] {
  const normalizedGroups = groups
    .map((group) => normalizeRecentRequestBuckets(group))
    .filter((group) => group.length > 0);

  if (normalizedGroups.length === 0) {
    return [];
  }

  const mergedLength = Math.min(
    RECENT_REQUEST_BLOCK_COUNT,
    Math.max(...normalizedGroups.map((group) => group.length))
  );
  const merged: RecentRequestBucket[] = Array.from({ length: mergedLength }, () => ({
    success: 0,
    failed: 0,
  }));

  normalizedGroups.forEach((group) => {
    const tail = group.slice(-mergedLength);
    const offset = mergedLength - tail.length;

    tail.forEach((bucket, index) => {
      const target = merged[offset + index];
      target.success += bucket.success;
      target.failed += bucket.failed;
      if (!target.time && bucket.time) {
        target.time = bucket.time;
      }
    });
  });

  return merged;
}

export function sumRecentRequests(buckets: RecentRequestBucket[]): {
  success: number;
  failure: number;
} {
  return normalizeRecentRequestBuckets(buckets).reduce(
    (total, bucket) => ({
      success: total.success + bucket.success,
      failure: total.failure + bucket.failed,
    }),
    { success: 0, failure: 0 }
  );
}

export function latestRecentRequestTime(buckets: RecentRequestBucket[]): string | undefined {
  const activeBuckets = normalizeRecentRequestBuckets(buckets).filter(
    (bucket) => bucket.success + bucket.failed > 0 && bucket.time
  );
  const datedBuckets = activeBuckets.filter((bucket) => Number.isFinite(Date.parse(bucket.time!)));
  if (datedBuckets.length > 0) {
    return datedBuckets.sort((left, right) => Date.parse(right.time!) - Date.parse(left.time!))[0]
      ?.time;
  }
  return activeBuckets[activeBuckets.length - 1]?.time;
}

export function statusBarDataFromRecentRequests(buckets: RecentRequestBucket[]): StatusBarData {
  const normalizedBuckets = normalizeRecentRequestBuckets(buckets);
  const emptyBucketCount = Math.max(0, RECENT_REQUEST_BLOCK_COUNT - normalizedBuckets.length);
  const blockStats = [
    ...Array.from({ length: emptyBucketCount }, () => ({ success: 0, failed: 0 })),
    ...normalizedBuckets.slice(-RECENT_REQUEST_BLOCK_COUNT),
  ];

  const now = Date.now();
  const windowStart = now - RECENT_REQUEST_BLOCK_COUNT * RECENT_REQUEST_BLOCK_DURATION_MS;

  const blocks: StatusBlockState[] = [];
  const blockDetails: StatusBarData['blockDetails'] = [];
  let totalSuccess = 0;
  let totalFailure = 0;

  blockStats.forEach((bucket, index) => {
    const success = bucket.success;
    const failure = bucket.failed;
    const total = success + failure;

    totalSuccess += success;
    totalFailure += failure;

    if (total === 0) {
      blocks.push('idle');
    } else if (failure === 0) {
      blocks.push('success');
    } else if (success === 0) {
      blocks.push('failure');
    } else {
      blocks.push('mixed');
    }

    const blockStartTime = windowStart + index * RECENT_REQUEST_BLOCK_DURATION_MS;
    blockDetails.push({
      success,
      failure,
      rate: total > 0 ? success / total : -1,
      startTime: blockStartTime,
      endTime: blockStartTime + RECENT_REQUEST_BLOCK_DURATION_MS,
    });
  });

  const total = totalSuccess + totalFailure;

  return {
    blocks,
    blockDetails,
    successRate: total > 0 ? (totalSuccess / total) * 100 : 100,
    totalSuccess,
    totalFailure,
  };
}
