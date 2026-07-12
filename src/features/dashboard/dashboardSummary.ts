import { accountTimestamp, deriveAccountHealth } from '@/features/accountHealth/accountHealth';
import type { AccountHealthKind } from '@/features/accountHealth/accountHealth';
import type { AuthFileItem } from '@/types/authFile';
import { normalizeRecentRequestUsageEntry, type ApiKeyUsageResponse } from '@/utils/recentRequests';

export interface DashboardAccountSummary {
  total: number;
  healthy: number;
  error: number;
  disabled: number;
  unavailable: number;
  retrying: number;
}

export interface DashboardRequestSummary {
  success: number;
  failure: number;
  successRate: number | null;
}

export interface DashboardRecentError {
  name: string;
  type?: string;
  kind: Extract<AccountHealthKind, 'error' | 'unavailable' | 'retrying'>;
  message?: string;
  timestamp: number | null;
  lastRefresh?: string | number;
  nextRetryAfter?: string | number;
}

export interface DashboardSummary {
  accounts: DashboardAccountSummary;
  requests: DashboardRequestSummary;
  recentErrors: DashboardRecentError[];
}

const RECENT_ERROR_KINDS = new Set<AccountHealthKind>(['error', 'unavailable', 'retrying']);

export function buildDashboardSummary(
  authFiles: readonly AuthFileItem[],
  usage: ApiKeyUsageResponse
): DashboardSummary {
  const accounts: DashboardAccountSummary = {
    total: authFiles.length,
    healthy: 0,
    error: 0,
    disabled: 0,
    unavailable: 0,
    retrying: 0,
  };

  const recentErrors = authFiles
    .map((item, index) => {
      const health = deriveAccountHealth(item);
      if (health.kind in accounts && health.kind !== 'unknown') {
        accounts[health.kind] += 1;
      }

      if (!RECENT_ERROR_KINDS.has(health.kind)) return null;

      return {
        entry: {
          name: item.name,
          ...(item.type ? { type: item.type } : {}),
          kind: health.kind as DashboardRecentError['kind'],
          ...(health.message ? { message: health.message } : {}),
          timestamp: accountTimestamp(item),
          ...(health.lastRefresh !== undefined ? { lastRefresh: health.lastRefresh } : {}),
          ...(health.nextRetryAfter !== undefined ? { nextRetryAfter: health.nextRetryAfter } : {}),
        },
        index,
      };
    })
    .filter((value): value is { entry: DashboardRecentError; index: number } => value !== null)
    .sort((left, right) => {
      const leftTimestamp = left.entry.timestamp ?? Number.NEGATIVE_INFINITY;
      const rightTimestamp = right.entry.timestamp ?? Number.NEGATIVE_INFINITY;
      return rightTimestamp - leftTimestamp || left.index - right.index;
    })
    .slice(0, 5)
    .map(({ entry }) => entry);

  let success = 0;
  let failure = 0;
  Object.values(usage ?? {}).forEach((providerEntries) => {
    if (!providerEntries || typeof providerEntries !== 'object' || Array.isArray(providerEntries)) {
      return;
    }
    Object.values(providerEntries).forEach((rawEntry) => {
      const entry = normalizeRecentRequestUsageEntry(rawEntry);
      success += entry.success;
      failure += entry.failed;
    });
  });
  const totalRequests = success + failure;

  return {
    accounts,
    requests: {
      success,
      failure,
      successRate: totalRequests > 0 ? (success / totalRequests) * 100 : null,
    },
    recentErrors,
  };
}
