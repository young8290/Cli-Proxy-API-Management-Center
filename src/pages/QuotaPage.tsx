/**
 * Quota management page - coordinates the three quota sections.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Input } from '@/components/ui/Input';
import {
  IconAlertTriangle,
  IconCheckCircle2,
  IconInfo,
  IconSearch,
  IconTimer,
} from '@/components/ui/icons';
import { useHeaderRefresh } from '@/hooks/useHeaderRefresh';
import { useAuthStore } from '@/stores';
import { authFilesApi } from '@/services/api';
import {
  CRITICAL_QUOTA_THRESHOLD_PERCENT,
  LOW_QUOTA_THRESHOLD_PERCENT,
} from '@/features/quota/quotaPresentation';
import {
  QuotaSection,
  ANTIGRAVITY_CONFIG,
  CLAUDE_CONFIG,
  CODEX_CONFIG,
  KIMI_CONFIG,
  XAI_CONFIG,
} from '@/components/quota';
import type { AuthFileItem } from '@/types';
import styles from './QuotaPage.module.scss';
import type { QuotaPresentationLevel } from '@/features/quota/quotaPresentation';
import { resolveAuthProvider } from '@/utils/quota';
import { useQuotaStore } from '@/stores/useQuotaStore';
import { quotaLevelFromState } from '@/features/quota/quotaFilters';

export function QuotaPage() {
  const { t } = useTranslation();
  const connectionStatus = useAuthStore((state) => state.connectionStatus);
  const quotaState = useQuotaStore((state) => ({
    antigravity: state.antigravityQuota,
    claude: state.claudeQuota,
    codex: state.codexQuota,
    kimi: state.kimiQuota,
    xai: state.xaiQuota,
  }));

  const [files, setFiles] = useState<AuthFileItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [providerFilter, setProviderFilter] = useState('all');
  const [levelFilter, setLevelFilter] = useState<QuotaPresentationLevel | 'all'>('all');

  const disableControls = connectionStatus !== 'connected';

  const loadFiles = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await authFilesApi.list();
      setFiles(data?.files || []);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : t('notification.refresh_failed');
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [t]);

  useHeaderRefresh(loadFiles);

  useEffect(() => {
    loadFiles();
  }, [loadFiles]);

  const filteredFiles = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return files.filter(
      (file) =>
        (providerFilter === 'all' || resolveAuthProvider(file) === providerFilter) &&
        (levelFilter === 'all' ||
          quotaLevelFromState(
            resolveAuthProvider(file),
            quotaState[resolveAuthProvider(file) as keyof typeof quotaState]?.[file.name]
          ) === levelFilter) &&
        (!query ||
          [
            file.name,
            file.type,
            file.provider,
            file.email,
            file.account,
            file.user,
            file.label,
          ].some((value) => typeof value === 'string' && value.toLowerCase().includes(query)))
    );
  }, [files, searchQuery, providerFilter, levelFilter, quotaState]);
  const visibleNames = useMemo(
    () => new Set(filteredFiles.map((file) => file.name)),
    [filteredFiles]
  );

  return (
    <div className={styles.container}>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>{t('quota_management.title')}</h1>
        <p className={styles.description}>{t('quota_management.description')}</p>
      </div>

      <div className={styles.quotaOverview}>
        <label>
          {t('quota_management.provider_filter')}
          <select
            value={providerFilter}
            onChange={(event) => setProviderFilter(event.target.value)}
          >
            <option value="all">{t('quota_management.filter_all')}</option>
            {[...new Set(files.map(resolveAuthProvider))].sort().map((provider) => (
              <option key={provider} value={provider}>
                {provider}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t('quota_management.level_filter')}
          <select
            value={levelFilter}
            onChange={(event) =>
              setLevelFilter(event.target.value as QuotaPresentationLevel | 'all')
            }
          >
            <option value="all">{t('quota_management.filter_all')}</option>
            {(['sufficient', 'low', 'critical', 'unknown'] as const).map((level) => (
              <option key={level} value={level}>
                {t(`quota_management.level_${level}`)}
              </option>
            ))}
          </select>
        </label>
        <div className={styles.quotaSearch}>
          <Input
            type="search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            label={t('quota_management.search_label')}
            placeholder={t('quota_management.search_placeholder')}
            rightElement={<IconSearch size={16} className={styles.searchIcon} />}
          />
          <span className={styles.searchResultCount} aria-live="polite">
            {t('quota_management.search_result_count', {
              count: filteredFiles.length,
              total: files.length,
            })}
          </span>
        </div>

        <div className={styles.quotaLegend} aria-label={t('quota_management.legend_title')}>
          <span className={styles.legendTitle}>{t('quota_management.legend_title')}</span>
          <span className={`${styles.legendItem} ${styles.legendSufficient}`}>
            <IconCheckCircle2 size={15} />
            {t('quota_management.legend_sufficient', { low: LOW_QUOTA_THRESHOLD_PERCENT })}
          </span>
          <span className={`${styles.legendItem} ${styles.legendLow}`}>
            <IconAlertTriangle size={15} />
            {t('quota_management.legend_low', {
              critical: CRITICAL_QUOTA_THRESHOLD_PERCENT,
              low: LOW_QUOTA_THRESHOLD_PERCENT,
            })}
          </span>
          <span className={`${styles.legendItem} ${styles.legendCritical}`}>
            <IconAlertTriangle size={15} />
            {t('quota_management.legend_critical', {
              critical: CRITICAL_QUOTA_THRESHOLD_PERCENT,
            })}
          </span>
          <span className={`${styles.legendItem} ${styles.legendUnknown}`}>
            <IconInfo size={15} />
            {t('quota_management.level_unknown')}
          </span>
        </div>

        <div className={styles.quotaExplanations}>
          <span>
            <IconTimer size={15} />
            {t('quota_management.reset_explanation')}
          </span>
          <span>
            <IconInfo size={15} />
            {t('quota_management.unknown_explanation')}
          </span>
        </div>
      </div>

      {error && (
        <div className={styles.errorBox} role="alert">
          {error}
        </div>
      )}

      <QuotaSection
        config={CLAUDE_CONFIG}
        files={files}
        visibleNames={visibleNames}
        loading={loading}
        disabled={disableControls}
      />
      <QuotaSection
        config={ANTIGRAVITY_CONFIG}
        files={files}
        visibleNames={visibleNames}
        loading={loading}
        disabled={disableControls}
      />
      <QuotaSection
        config={CODEX_CONFIG}
        files={files}
        visibleNames={visibleNames}
        loading={loading}
        disabled={disableControls}
      />
      <QuotaSection
        config={XAI_CONFIG}
        files={files}
        visibleNames={visibleNames}
        loading={loading}
        disabled={disableControls}
      />
      <QuotaSection
        config={KIMI_CONFIG}
        files={files}
        visibleNames={visibleNames}
        loading={loading}
        disabled={disableControls}
      />
    </div>
  );
}
