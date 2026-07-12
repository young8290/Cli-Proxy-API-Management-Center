import type { AuthFileItem } from '@/types/authFile';
import { isDisabledAuthFile, resolveAuthProvider } from '@/utils/quota';

const QUOTA_PROVIDERS = new Set(['antigravity', 'claude', 'codex', 'kimi', 'xai']);

export const buildAuthFileQuotaInputSignature = (file: AuthFileItem): string =>
  JSON.stringify([
    file.name,
    file.type ?? null,
    file.provider ?? null,
    file.modified ?? null,
    file.size ?? null,
    file.authIndex ?? file['auth_index'] ?? null,
  ]);

export const selectAuthFilesNeedingQuotaLoad = (
  files: readonly AuthFileItem[],
  loadedSignatures: ReadonlyMap<string, string>
): AuthFileItem[] =>
  files.filter(
    (file) =>
      !isDisabledAuthFile(file) &&
      QUOTA_PROVIDERS.has(resolveAuthProvider(file)) &&
      loadedSignatures.get(file.name) !== buildAuthFileQuotaInputSignature(file)
  );

export const createQuotaLoadBatchController = (
  loadBatch: (files: AuthFileItem[]) => Promise<void>,
  setLoading: (loading: boolean) => void
) => {
  let pending: AuthFileItem[] | null = null;
  let running: Promise<void> | null = null;

  const drain = async () => {
    setLoading(true);
    try {
      while (pending) {
        const batch = pending;
        pending = null;
        await loadBatch(batch);
      }
    } finally {
      setLoading(false);
      running = null;
    }
  };

  return {
    request(files: AuthFileItem[]): Promise<void> {
      pending = files;
      if (!running) running = drain();
      return running;
    },
  };
};
