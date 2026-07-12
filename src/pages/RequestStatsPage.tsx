import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { apiKeyUsageApi } from '@/services/api/apiKeyUsage';
import { summarizeApiKeyUsage, type ApiKeyUsageResponse } from '@/utils/recentRequests';
import styles from './QuotaPage.module.scss';

export function RequestStatsPage() {
  const { t, i18n } = useTranslation();
  const [data, setData] = useState<ApiKeyUsageResponse>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sessionStart] = useState(() => new Date());
  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setData(await apiKeyUsageApi.getUsage());
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.unknown_error'));
    } finally {
      setLoading(false);
    }
  }, [t]);
  useEffect(() => {
    void load();
  }, [load]);
  const summary = useMemo(() => summarizeApiKeyUsage(data), [data]);
  return (
    <main className={styles.container} aria-busy={loading}>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>{t('request_stats.title')}</h1>
        <p className={styles.description}>{t('request_stats.description')}</p>
      </div>
      {loading && <p role="status">{t('request_stats.loading')}</p>}
      {error && (
        <div role="alert">
          {error}{' '}
          <Button size="sm" onClick={load}>
            {t('request_stats.retry')}
          </Button>
        </div>
      )}
      {!loading && !error && (
        <>
          <dl className={styles.quotaLegend}>
            <div>
              <dt>{t('request_stats.total')}</dt>
              <dd>{summary.total}</dd>
            </div>
            <div>
              <dt>{t('stats.success')}</dt>
              <dd>{summary.success}</dd>
            </div>
            <div>
              <dt>{t('stats.failure')}</dt>
              <dd>{summary.failed}</dd>
            </div>
            <div>
              <dt>{t('request_stats.success_rate')}</dt>
              <dd>
                {summary.total
                  ? `${((summary.success / summary.total) * 100).toFixed(1)}%`
                  : '—'}
              </dd>
            </div>
          </dl>
          <p>
            {t('request_stats.observation_started', {
              time: sessionStart.toLocaleString(i18n.language),
            })}
          </p>
          <p>{t('request_stats.restart_notice')}</p>
          <section>
            <h2>{t('request_stats.by_provider')}</h2>
            {summary.providers.map((value) => (
              <p key={value.name}>
                {value.name}: {value.success + value.failed}
              </p>
            ))}
          </section>
          <section>
            <h2>{t('request_stats.by_model')}</h2>
            {summary.models.length ? (
              summary.models.map((value) => (
                <p key={value.name}>
                  {value.name}: {value.success + value.failed}
                </p>
              ))
            ) : (
              <p>{t('request_stats.unavailable')}</p>
            )}
            <h2>{t('request_stats.by_account')}</h2>
            {summary.accounts.length ? (
              summary.accounts.map((value) => (
                <p key={value.name}>
                  {value.name}: {value.success + value.failed}
                </p>
              ))
            ) : (
              <p>{t('request_stats.unavailable')}</p>
            )}
          </section>
          <section>
            <h2>{t('request_stats.recent_failures')}</h2>
            {summary.failures.length ? (
              summary.failures
                .slice(-10)
                .reverse()
                .map((failure, index) => (
                  <p key={`${failure.provider}-${failure.time}-${index}`}>
                    {failure.provider} · {failure.account} ·{' '}
                    {failure.time ?? t('request_stats.time_unavailable')} · {failure.count}
                  </p>
                ))
            ) : (
              <p>{t('request_stats.no_failures')}</p>
            )}
          </section>
        </>
      )}
    </main>
  );
}
