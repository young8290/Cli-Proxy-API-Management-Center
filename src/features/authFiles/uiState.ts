import {
  deriveAccountHealth,
  type AccountHealthKind,
} from '@/features/accountHealth/accountHealth';
import type { AuthFileItem } from '@/types/authFile';
import type {
  AntigravityQuotaState,
  ClaudeQuotaState,
  CodexQuotaState,
  KimiQuotaState,
  XaiQuotaState,
} from '@/types/quota';

export const AUTH_FILES_SORT_MODES = ['default', 'az', 'priority'] as const;
export const AUTH_FILES_STATUS_FILTER_MODES = ['all', 'enabled', 'disabled', 'problem'] as const;

export type AuthFilesSortMode = (typeof AUTH_FILES_SORT_MODES)[number];
export type AuthFilesStatusFilterMode = (typeof AUTH_FILES_STATUS_FILTER_MODES)[number];
export type AuthFileHealthFilter = AccountHealthKind | 'all';

export interface AuthFileQuotaSnapshot {
  antigravityQuota: Record<string, AntigravityQuotaState>;
  claudeQuota: Record<string, ClaudeQuotaState>;
  codexQuota: Record<string, CodexQuotaState>;
  kimiQuota: Record<string, KimiQuotaState>;
  xaiQuota: Record<string, XaiQuotaState>;
}

export interface AuthFileQuotaDiagnostic {
  status: 'idle' | 'loading' | 'success' | 'error';
  remainingPercent: number | null;
  low: boolean;
  error?: string;
}

export interface AuthFileFilterOptions {
  health?: AuthFileHealthFilter;
  provider?: string;
  lowQuotaOnly?: boolean;
  lowQuotaNames?: ReadonlySet<string>;
  search?: string;
}

const AUTH_FILE_HEALTH_RANK: Record<AccountHealthKind, number> = {
  error: 0,
  unavailable: 1,
  retrying: 2,
  disabled: 3,
  healthy: 4,
  unknown: 5,
};

const normalizeProvider = (file: AuthFileItem): string =>
  String(file.provider ?? file.type ?? 'unknown')
    .trim()
    .toLowerCase();

const wildcardPattern = (value: string): RegExp | null => {
  if (!value.includes('*')) return null;
  const escaped = value
    .split('*')
    .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('.*');
  return new RegExp(escaped, 'i');
};

export const filterAndSortAuthFiles = (
  files: readonly AuthFileItem[],
  options: AuthFileFilterOptions = {}
): AuthFileItem[] => {
  const provider = options.provider?.trim().toLowerCase() ?? 'all';
  const health = options.health ?? 'all';
  const search = options.search?.trim() ?? '';
  const searchLower = search.toLowerCase();
  const searchPattern = wildcardPattern(search);

  return files
    .map((file, originalIndex) => ({ file, originalIndex, health: deriveAccountHealth(file).kind }))
    .filter(({ file, health: fileHealth }) => {
      const fileProvider = normalizeProvider(file);
      if (provider !== 'all' && fileProvider !== provider) return false;
      if (health !== 'all' && fileHealth !== health) return false;
      if (options.lowQuotaOnly && !options.lowQuotaNames?.has(file.name)) return false;
      if (!search) return true;
      return [file.name, fileProvider].some((value) =>
        searchPattern ? searchPattern.test(value) : value.toLowerCase().includes(searchLower)
      );
    })
    .sort(
      (a, b) =>
        AUTH_FILE_HEALTH_RANK[a.health] - AUTH_FILE_HEALTH_RANK[b.health] ||
        a.originalIndex - b.originalIndex
    )
    .map(({ file }) => file);
};

const finitePercent = (value: unknown): number | null => {
  const number = typeof value === 'string' ? Number(value.trim()) : value;
  return typeof number === 'number' && Number.isFinite(number)
    ? Math.max(0, Math.min(100, number))
    : null;
};

const minimumPercent = (values: Array<number | null>): number | null => {
  const finite = values.filter((value): value is number => value !== null);
  return finite.length > 0 ? Math.min(...finite) : null;
};

const diagnostic = (
  state: { status: AuthFileQuotaDiagnostic['status']; error?: string },
  remainingPercent: number | null
): AuthFileQuotaDiagnostic => ({
  status: state.status,
  remainingPercent,
  low: remainingPercent !== null && remainingPercent <= 20,
  ...(state.error ? { error: state.error } : {}),
});

export const buildAuthFileQuotaDiagnostics = (
  snapshot: AuthFileQuotaSnapshot
): Map<string, AuthFileQuotaDiagnostic> => {
  const result = new Map<string, AuthFileQuotaDiagnostic>();

  Object.entries(snapshot.antigravityQuota).forEach(([name, state]) => {
    const remaining = minimumPercent(
      state.groups.flatMap((group) =>
        group.buckets.map((bucket) => finitePercent(bucket.remainingFraction * 100))
      )
    );
    result.set(name, diagnostic(state, remaining));
  });
  Object.entries(snapshot.claudeQuota).forEach(([name, state]) => {
    const remaining = minimumPercent(
      state.windows.map((window) => {
        const used = finitePercent(window.usedPercent);
        return used === null ? null : 100 - used;
      })
    );
    result.set(name, diagnostic(state, remaining));
  });
  Object.entries(snapshot.codexQuota).forEach(([name, state]) => {
    const remaining = minimumPercent(
      state.windows.map((window) => {
        const used = finitePercent(window.usedPercent);
        return used === null ? null : 100 - used;
      })
    );
    result.set(name, diagnostic(state, remaining));
  });
  Object.entries(snapshot.kimiQuota).forEach(([name, state]) => {
    const remaining = minimumPercent(
      state.rows.map((row) =>
        row.limit > 0 ? finitePercent(((row.limit - row.used) / row.limit) * 100) : null
      )
    );
    result.set(name, diagnostic(state, remaining));
  });
  Object.entries(snapshot.xaiQuota).forEach(([name, state]) => {
    const used = finitePercent(state.billing?.usedPercent ?? state.billing?.usagePercent);
    result.set(name, diagnostic(state, used === null ? null : 100 - used));
  });

  return result;
};

export type AuthFilesUiState = {
  filter?: string;
  problemOnly?: boolean;
  disabledOnly?: boolean;
  statusFilterMode?: AuthFilesStatusFilterMode;
  compactMode?: boolean;
  search?: string;
  page?: number;
  pageSize?: number;
  regularPageSize?: number;
  compactPageSize?: number;
  sortMode?: AuthFilesSortMode;
  healthFilter?: AuthFileHealthFilter;
  lowQuotaOnly?: boolean;
};

const AUTH_FILES_UI_STATE_KEY = 'authFilesPage.uiState';
const AUTH_FILES_COMPACT_MODE_KEY = 'authFilesPage.compactMode';
const AUTH_FILES_SORT_MODE_SET = new Set<AuthFilesSortMode>(AUTH_FILES_SORT_MODES);
const AUTH_FILES_STATUS_FILTER_MODE_SET = new Set<AuthFilesStatusFilterMode>(
  AUTH_FILES_STATUS_FILTER_MODES
);

export const isAuthFilesSortMode = (value: unknown): value is AuthFilesSortMode =>
  typeof value === 'string' && AUTH_FILES_SORT_MODE_SET.has(value as AuthFilesSortMode);

export const isAuthFilesStatusFilterMode = (value: unknown): value is AuthFilesStatusFilterMode =>
  typeof value === 'string' &&
  AUTH_FILES_STATUS_FILTER_MODE_SET.has(value as AuthFilesStatusFilterMode);

const readAuthFilesUiStateFromStorage = (
  storage: Pick<Storage, 'getItem'> | null | undefined
): AuthFilesUiState | null => {
  if (!storage) return null;
  const raw = storage.getItem(AUTH_FILES_UI_STATE_KEY);
  if (!raw) return null;
  const parsed = JSON.parse(raw) as AuthFilesUiState;
  return parsed && typeof parsed === 'object' ? parsed : null;
};

export const readAuthFilesUiState = (): AuthFilesUiState | null => {
  if (typeof window === 'undefined') return null;
  try {
    return (
      readAuthFilesUiStateFromStorage(window.localStorage) ??
      readAuthFilesUiStateFromStorage(window.sessionStorage)
    );
  } catch {
    return null;
  }
};

export const writeAuthFilesUiState = (state: AuthFilesUiState) => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(AUTH_FILES_UI_STATE_KEY, JSON.stringify(state));
  } catch {
    // ignore
  }
  try {
    window.sessionStorage.removeItem(AUTH_FILES_UI_STATE_KEY);
  } catch {
    // ignore
  }
};

export const readPersistedAuthFilesCompactMode = (): boolean | null => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(AUTH_FILES_COMPACT_MODE_KEY);
    if (raw === null) return null;
    return JSON.parse(raw) === true;
  } catch {
    return null;
  }
};

export const writePersistedAuthFilesCompactMode = (compactMode: boolean) => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(AUTH_FILES_COMPACT_MODE_KEY, JSON.stringify(compactMode));
  } catch {
    // ignore
  }
};
