import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  IconAlertTriangle,
  IconCheckCircle2,
  IconKey,
  IconNetwork,
  IconRefreshCw,
  IconShield,
  IconTimer,
} from '@/components/ui/icons';
import { Skeleton } from '@/components/ui/Skeleton';
import { useAuthStore, useConfigStore, useModelsStore } from '@/stores';
import { apiKeyUsageApi, authFilesApi } from '@/services/api';
import { useApiKeysForModels } from '@/hooks/useApiKeysForModels';
import { buildDashboardSummary } from '@/features/dashboard/dashboardSummary';
import { buildDashboardQuotaSummary } from '@/features/dashboard/dashboardQuotaSummary';
import { createLatestRequest } from '@/features/dashboard/latestRequest';
import { useQuotaLoader } from '@/components/quota/useQuotaLoader';
import {
  ANTIGRAVITY_CONFIG,
  CLAUDE_CONFIG,
  CODEX_CONFIG,
  KIMI_CONFIG,
  XAI_CONFIG,
} from '@/components/quota/quotaConfigs';
import { formatDateValue } from '@/utils/format';
import { getDashboardModelsStatValue } from '@/utils/dashboard';
import type { AuthFileItem } from '@/types/authFile';
import type { ApiKeyUsageResponse } from '@/utils/recentRequests';
import styles from './DashboardPage.module.scss';

const EMPTY_USAGE: ApiKeyUsageResponse = {};

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : typeof error === 'string' ? error : 'Request failed';

function useDelayedLoading(loading: boolean, delay = 300): boolean {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!loading) {
      setVisible(false);
      return;
    }
    const timer = window.setTimeout(() => setVisible(true), delay);
    return () => window.clearTimeout(timer);
  }, [delay, loading]);

  return visible;
}

function RetryState({ message, onRetry }: { message: string; onRetry: () => void }) {
  const { t } = useTranslation();
  return (
    <div className={styles.errorState} role="alert">
      <IconAlertTriangle size={18} aria-hidden="true" />
      <span>{message}</span>
      <button type="button" className={styles.retryButton} onClick={onRetry}>
        <IconRefreshCw size={16} aria-hidden="true" />
        {t('dashboard.retry')}
      </button>
    </div>
  );
}

export function DashboardPage() {
  const { t, i18n } = useTranslation();
  const connectionStatus = useAuthStore((state) => state.connectionStatus);
  const serverVersion = useAuthStore((state) => state.serverVersion);
  const serverBuildDate = useAuthStore((state) => state.serverBuildDate);
  const apiBase = useAuthStore((state) => state.apiBase);
  const config = useConfigStore((state) => state.config);
  const fetchConfig = useConfigStore((state) => state.fetchConfig);
  const models = useModelsStore((state) => state.models);
  const modelsLoading = useModelsStore((state) => state.loading);
  const modelsError = useModelsStore((state) => state.error);
  const fetchModelsFromStore = useModelsStore((state) => state.fetchModels);
  const resolveApiKeysForModels = useApiKeysForModels();
  const { quota: antigravityQuota, loadQuota: loadAntigravityQuota } =
    useQuotaLoader(ANTIGRAVITY_CONFIG);
  const { quota: claudeQuota, loadQuota: loadClaudeQuota } = useQuotaLoader(CLAUDE_CONFIG);
  const { quota: codexQuota, loadQuota: loadCodexQuota } = useQuotaLoader(CODEX_CONFIG);
  const { quota: kimiQuota, loadQuota: loadKimiQuota } = useQuotaLoader(KIMI_CONFIG);
  const { quota: xaiQuota, loadQuota: loadXaiQuota } = useQuotaLoader(XAI_CONFIG);

  const [authFiles, setAuthFiles] = useState<AuthFileItem[]>([]);
  const [authFilesLoading, setAuthFilesLoading] = useState(false);
  const [authFilesError, setAuthFilesError] = useState<string | null>(null);
  const [usage, setUsage] = useState<ApiKeyUsageResponse>(EMPTY_USAGE);
  const [usageLoading, setUsageLoading] = useState(false);
  const [usageError, setUsageError] = useState<string | null>(null);
  const [configLoading, setConfigLoading] = useState(false);
  const [configError, setConfigError] = useState<string | null>(null);
  const [quotaLoading, setQuotaLoading] = useState(false);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<number | null>(null);
  const authRequests = useRef(createLatestRequest()).current;
  const usageRequests = useRef(createLatestRequest()).current;
  const configRequests = useRef(createLatestRequest()).current;
  const quotaRequests = useRef(createLatestRequest()).current;
  const dashboardRequests = useRef(createLatestRequest()).current;

  const quotaConfigs = useMemo(
    () => [CLAUDE_CONFIG, ANTIGRAVITY_CONFIG, CODEX_CONFIG, XAI_CONFIG, KIMI_CONFIG],
    []
  );

  const quotaFiles = useMemo(
    () =>
      authFiles.filter((file) => quotaConfigs.some((quotaConfig) => quotaConfig.filterFn(file))),
    [authFiles, quotaConfigs]
  );

  const loadQuotas = useCallback(
    async (files: AuthFileItem[]) => {
      const generation = quotaRequests.begin();
      setQuotaLoading(true);
      const ignoreSectionLoading = () => undefined;
      try {
        await Promise.allSettled([
          loadClaudeQuota(files.filter(CLAUDE_CONFIG.filterFn), ignoreSectionLoading),
          loadAntigravityQuota(files.filter(ANTIGRAVITY_CONFIG.filterFn), ignoreSectionLoading),
          loadCodexQuota(files.filter(CODEX_CONFIG.filterFn), ignoreSectionLoading),
          loadXaiQuota(files.filter(XAI_CONFIG.filterFn), ignoreSectionLoading),
          loadKimiQuota(files.filter(KIMI_CONFIG.filterFn), ignoreSectionLoading),
        ]);
      } finally {
        quotaRequests.commit(generation, () => setQuotaLoading(false));
      }
    },
    [
      loadAntigravityQuota,
      loadClaudeQuota,
      loadCodexQuota,
      loadKimiQuota,
      loadXaiQuota,
      quotaRequests,
    ]
  );

  const loadAuthFiles = useCallback(async () => {
    const generation = authRequests.begin();
    setAuthFilesLoading(true);
    setAuthFilesError(null);
    try {
      const response = await authFilesApi.list();
      return (
        authRequests.commit(generation, () => {
          setAuthFiles(response.files);
          return response.files;
        }) ?? null
      );
    } catch (error) {
      if (!authRequests.isLatest(generation)) return null;
      authRequests.commit(generation, () => setAuthFilesError(errorMessage(error)));
      throw error;
    } finally {
      authRequests.commit(generation, () => setAuthFilesLoading(false));
    }
  }, [authRequests]);

  const loadUsage = useCallback(async () => {
    const generation = usageRequests.begin();
    setUsageLoading(true);
    setUsageError(null);
    try {
      const response = await apiKeyUsageApi.getUsage();
      usageRequests.commit(generation, () => setUsage(response));
      return response;
    } catch (error) {
      usageRequests.commit(generation, () => setUsageError(errorMessage(error)));
      throw error;
    } finally {
      usageRequests.commit(generation, () => setUsageLoading(false));
    }
  }, [usageRequests]);

  const loadConfig = useCallback(async () => {
    const generation = configRequests.begin();
    setConfigLoading(true);
    setConfigError(null);
    try {
      return await fetchConfig();
    } catch (error) {
      configRequests.commit(generation, () => setConfigError(errorMessage(error)));
      throw error;
    } finally {
      configRequests.commit(generation, () => setConfigLoading(false));
    }
  }, [configRequests, fetchConfig]);

  const loadModels = useCallback(async () => {
    if (!apiBase) return [];
    const apiKeys = await resolveApiKeysForModels();
    return fetchModelsFromStore(apiBase, apiKeys[0]);
  }, [apiBase, fetchModelsFromStore, resolveApiKeysForModels]);

  const loadDashboard = useCallback(async () => {
    const generation = dashboardRequests.begin();
    const authFilesRequest = loadAuthFiles();
    const quotaRequest = authFilesRequest.then((files) => (files ? loadQuotas(files) : undefined));
    await Promise.allSettled([
      authFilesRequest,
      quotaRequest,
      loadUsage(),
      loadConfig(),
      loadModels(),
    ]);
    dashboardRequests.commit(generation, () => setLastRefreshedAt(Date.now()));
  }, [dashboardRequests, loadAuthFiles, loadConfig, loadModels, loadQuotas, loadUsage]);

  const retryAccountsAndQuota = useCallback(async () => {
    try {
      const files = await loadAuthFiles();
      if (files) await loadQuotas(files);
    } catch {
      // Per-module error state is rendered in the dependent cards.
    }
  }, [loadAuthFiles, loadQuotas]);

  useEffect(() => {
    if (connectionStatus !== 'connected') return;
    void loadDashboard();
  }, [connectionStatus, loadDashboard]);

  const authFilesSkeleton = useDelayedLoading(authFilesLoading && authFiles.length === 0);
  const usageSkeleton = useDelayedLoading(usageLoading && Object.keys(usage).length === 0);
  const configSkeleton = useDelayedLoading(configLoading && !config);
  const modelsSkeleton = useDelayedLoading(modelsLoading && models.length === 0);
  const quotaSkeleton = useDelayedLoading(quotaLoading);
  const summary = useMemo(() => buildDashboardSummary(authFiles, usage), [authFiles, usage]);
  const quotaSummary = useMemo(
    () =>
      buildDashboardQuotaSummary(
        { antigravityQuota, claudeQuota, codexQuota, kimiQuota, xaiQuota },
        quotaFiles.map((file) => file.name)
      ),
    [antigravityQuota, claudeQuota, codexQuota, kimiQuota, quotaFiles, xaiQuota]
  );
  const serviceUrl = apiBase ? apiBase.replace(/\/+$/, '') : '-';
  const endpoint = serviceUrl === '-' ? '-' : `${serviceUrl}/v1`;
  const serverBuildDateDisplay = formatDateValue(serverBuildDate, i18n.language);
  const successRate =
    summary.requests.successRate === null
      ? t('dashboard.no_requests')
      : `${summary.requests.successRate.toFixed(1)}%`;
  const connectionLabel = t(
    connectionStatus === 'connected'
      ? 'common.connected'
      : connectionStatus === 'connecting'
        ? 'common.connecting'
        : 'common.disconnected'
  );

  return (
    <main className={styles.dashboard}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>{t('dashboard.operations_eyebrow')}</p>
          <h1>{t('dashboard.operations_title')}</h1>
          <p className={styles.subtitle}>{t('dashboard.operations_subtitle')}</p>
        </div>
        <button type="button" className={styles.refreshButton} onClick={() => void loadDashboard()}>
          <IconRefreshCw size={18} aria-hidden="true" />
          {t('dashboard.refresh')}
        </button>
      </header>

      <section
        className={`${styles.serviceBanner} ${styles[connectionStatus === 'connected' ? 'healthy' : connectionStatus === 'connecting' ? 'warning' : 'critical']}`}
        role="status"
        aria-live="polite"
      >
        <div className={styles.statusIcon}>
          {connectionStatus === 'connected' ? (
            <IconCheckCircle2 size={24} aria-hidden="true" />
          ) : (
            <IconAlertTriangle size={24} aria-hidden="true" />
          )}
        </div>
        <div className={styles.serviceCopy}>
          <span className={styles.cardLabel}>{t('dashboard.service_status')}</span>
          <strong>{connectionLabel}</strong>
          <span>{t('dashboard.service_status_desc')}</span>
        </div>
        <dl className={styles.serviceMeta}>
          <div>
            <dt>{t('dashboard.service_url')}</dt>
            <dd className={styles.mono}>{serviceUrl}</dd>
          </div>
          <div>
            <dt>{t('dashboard.version')}</dt>
            <dd>{serverVersion ? `v${serverVersion.replace(/^[vV]+/, '')}` : '-'}</dd>
          </div>
          <div>
            <dt>{t('dashboard.build_date')}</dt>
            <dd>{serverBuildDateDisplay || '-'}</dd>
          </div>
          <div>
            <dt>{t('dashboard.last_refreshed')}</dt>
            <dd>
              {lastRefreshedAt
                ? new Intl.DateTimeFormat(i18n.language, { timeStyle: 'medium' }).format(
                    lastRefreshedAt
                  )
                : '-'}
            </dd>
          </div>
        </dl>
      </section>

      <div className={styles.metricGrid}>
        <section className={styles.metricCard}>
          <div className={styles.cardHeader}>
            <IconShield size={22} aria-hidden="true" />
            <span>{t('dashboard.account_health')}</span>
            <Link to="/auth-files" className={styles.cardAction}>
              {t('dashboard.view_accounts')}
            </Link>
          </div>
          {authFilesSkeleton ? (
            <div role="status" className={styles.skeletonStack} aria-label={t('dashboard.loading')}>
              <Skeleton width="42%" height={34} />
              <Skeleton width="88%" height={16} />
            </div>
          ) : authFilesError ? (
            <RetryState message={authFilesError} onRetry={() => void retryAccountsAndQuota()} />
          ) : (
            <>
              <strong className={styles.metricValue}>{summary.accounts.healthy}</strong>
              <span className={styles.metricCaption}>
                {t('dashboard.healthy_of_total', {
                  healthy: summary.accounts.healthy,
                  total: summary.accounts.total,
                })}
              </span>
              <div className={styles.statusBreakdown}>
                <span>{t('dashboard.error_count', { count: summary.accounts.error })}</span>
                <span>{t('dashboard.retrying_count', { count: summary.accounts.retrying })}</span>
                <span>{t('dashboard.disabled_count', { count: summary.accounts.disabled })}</span>
              </div>
            </>
          )}
        </section>

        <section className={styles.metricCard}>
          <div className={styles.cardHeader}>
            <IconNetwork size={22} aria-hidden="true" />
            <span>{t('dashboard.request_quality')}</span>
          </div>
          {usageSkeleton ? (
            <div role="status" className={styles.skeletonStack} aria-label={t('dashboard.loading')}>
              <Skeleton width="48%" height={34} />
              <Skeleton width="80%" height={16} />
            </div>
          ) : usageError && Object.keys(usage).length === 0 ? (
            <RetryState
              message={usageError}
              onRetry={() => void loadUsage().catch(() => undefined)}
            />
          ) : (
            <>
              <strong className={styles.metricValue}>{successRate}</strong>
              <span className={styles.metricCaption}>{t('dashboard.success_rate')}</span>
              <div className={styles.statusBreakdown}>
                <span>{t('dashboard.success_count', { count: summary.requests.success })}</span>
                <span>{t('dashboard.failure_count', { count: summary.requests.failure })}</span>
                <span>{t('dashboard.recent_requests', { count: summary.requests.recent })}</span>
              </div>
            </>
          )}
        </section>

        <section
          className={`${styles.metricCard} ${quotaSummary.low > 0 || quotaSummary.errors > 0 ? styles.warningCard : ''}`}
        >
          <div className={styles.cardHeader}>
            <IconTimer size={22} aria-hidden="true" />
            <span>{t('dashboard.quota_alerts')}</span>
            <Link to="/quota" className={styles.cardAction}>
              {t('dashboard.view_quota')}
            </Link>
          </div>
          {authFilesSkeleton || quotaSkeleton ? (
            <div role="status" className={styles.skeletonStack} aria-label={t('dashboard.loading')}>
              <Skeleton width="30%" height={34} />
              <Skeleton width="74%" height={16} />
            </div>
          ) : authFilesError ? (
            <RetryState message={authFilesError} onRetry={() => void retryAccountsAndQuota()} />
          ) : (
            <>
              <strong className={styles.metricValue}>
                {quotaSummary.expected === 0 ? '-' : quotaSummary.low}
              </strong>
              <span className={styles.metricCaption}>
                {quotaSummary.expected === 0
                  ? t('dashboard.quota_unknown')
                  : quotaSummary.low > 0
                    ? t('dashboard.quota_low_detected')
                    : t('dashboard.quota_no_alerts')}
              </span>
              <div className={styles.statusBreakdown}>
                <span>
                  {t('dashboard.quota_refreshing_soon', { count: quotaSummary.refreshingSoon })}
                </span>
                <span>{t('dashboard.quota_read_errors', { count: quotaSummary.errors })}</span>
                <span>
                  {t('dashboard.quota_unknown_count', {
                    count: Math.max(
                      0,
                      quotaSummary.expected -
                        quotaSummary.loaded -
                        quotaSummary.loading -
                        quotaSummary.errors
                    ),
                  })}
                </span>
              </div>
              {quotaSummary.errors > 0 ? (
                <RetryState
                  message={t('dashboard.quota_read_failed', { count: quotaSummary.errors })}
                  onRetry={() => void loadQuotas(quotaFiles)}
                />
              ) : null}
            </>
          )}
        </section>
      </div>

      <section className={styles.endpointCard}>
        <div className={styles.sectionTitleRow}>
          <div>
            <p className={styles.eyebrow}>{t('dashboard.api_summary')}</p>
            <h2>{t('dashboard.api_endpoint')}</h2>
          </div>
          <Link to="/api-access" className={styles.actionLink}>
            {t('dashboard.open_api_access')}
          </Link>
        </div>
        {configSkeleton || modelsSkeleton ? (
          <div role="status" className={styles.endpointGrid} aria-label={t('dashboard.loading')}>
            <Skeleton height={58} />
            <Skeleton height={58} />
            <Skeleton height={58} />
          </div>
        ) : (
          <dl className={styles.endpointGrid}>
            <div>
              <dt>{t('dashboard.service_url')}</dt>
              <dd className={styles.mono}>{serviceUrl}</dd>
            </div>
            <div>
              <dt>{t('dashboard.openai_base_url')}</dt>
              <dd className={styles.mono}>{endpoint}</dd>
            </div>
            <div>
              <dt>{t('dashboard.api_keys')}</dt>
              <dd>{configError && !config ? '-' : (config?.apiKeys?.length ?? 0)}</dd>
            </div>
            <div>
              <dt>{t('dashboard.available_models')}</dt>
              <dd>{getDashboardModelsStatValue(models.length, modelsLoading, modelsError)}</dd>
            </div>
          </dl>
        )}
        {configError && !config ? (
          <RetryState
            message={configError}
            onRetry={() => void loadConfig().catch(() => undefined)}
          />
        ) : null}
        {modelsError && models.length === 0 ? (
          <RetryState
            message={modelsError}
            onRetry={() => void loadModels().catch(() => undefined)}
          />
        ) : null}
      </section>

      <section className={styles.incidentCard}>
        <div className={styles.sectionTitleRow}>
          <div>
            <p className={styles.eyebrow}>{t('dashboard.recent_activity')}</p>
            <h2>{t('dashboard.recent_incidents')}</h2>
          </div>
          <div className={styles.sectionActions}>
            <Link to="/auth-files" className={styles.actionLink}>
              {t('dashboard.view_accounts')}
            </Link>
            <Link to="/logs" className={styles.actionLink}>
              {t('dashboard.view_logs')}
            </Link>
          </div>
        </div>
        {authFilesSkeleton ? (
          <div role="status" className={styles.incidentList} aria-label={t('dashboard.loading')}>
            <Skeleton height={58} />
            <Skeleton height={58} />
          </div>
        ) : authFilesError ? (
          <RetryState message={authFilesError} onRetry={() => void retryAccountsAndQuota()} />
        ) : summary.recentErrors.length === 0 ? (
          <div className={styles.emptyState}>
            <IconCheckCircle2 size={22} aria-hidden="true" />
            <span>{t('dashboard.no_recent_incidents')}</span>
          </div>
        ) : (
          <ul className={styles.incidentList}>
            {summary.recentErrors.map((incident) => (
              <li key={`${incident.name}-${incident.kind}`}>
                <IconAlertTriangle size={18} aria-hidden="true" />
                <div>
                  <strong>{incident.name}</strong>
                  <span>{incident.message || t(`dashboard.health_${incident.kind}`)}</span>
                  {incident.nextRetryAfter !== undefined ? (
                    <span>
                      {t('dashboard.next_retry', {
                        time:
                          formatDateValue(incident.nextRetryAfter, i18n.language) ||
                          t('dashboard.time_unknown'),
                      })}
                    </span>
                  ) : null}
                </div>
                <time>
                  {incident.timestamp
                    ? new Intl.DateTimeFormat(i18n.language, {
                        dateStyle: 'short',
                        timeStyle: 'short',
                      }).format(incident.timestamp)
                    : t('dashboard.time_unknown')}
                </time>
              </li>
            ))}
          </ul>
        )}
      </section>

      <footer className={styles.footerNote}>
        <IconKey size={15} aria-hidden="true" />
        {t('dashboard.data_isolation_note')}
      </footer>
    </main>
  );
}
