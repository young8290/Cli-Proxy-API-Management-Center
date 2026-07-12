import type { AuthFileItem } from '@/types';

export interface QuotaVisibility {
  providerFiles: AuthFileItem[];
  visibleFiles: AuthFileItem[];
}

export function resolveQuotaRefreshTargets<T extends { name: string }>(
  providerFiles: T[],
  _visibleNames?: ReadonlySet<string>
): T[] {
  return providerFiles;
}

export function resolveQuotaVisibility(
  files: AuthFileItem[],
  providerFilter: (file: AuthFileItem) => boolean,
  visibleNames?: ReadonlySet<string>
): QuotaVisibility {
  const providerFiles = files.filter(providerFilter);
  const visibleFiles = visibleNames
    ? providerFiles.filter((file) => visibleNames.has(file.name))
    : providerFiles;
  return { providerFiles, visibleFiles };
}
