import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { apiKeyUsageApi } from '@/services/api/apiKeyUsage';
import { normalizeRecentRequestUsageEntry, type ApiKeyUsageResponse } from '@/utils/recentRequests';
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
  const summary = useMemo(
    () =>
      Object.entries(data).reduce(
        (result, [provider, entries]) => {
          Object.values(entries).forEach((raw) => {
            const entry = normalizeRecentRequestUsageEntry(raw);
            result.success += entry.success;
            result.failed += entry.failed;
            const current = result.providers.get(provider) ?? { success: 0, failed: 0 };
            current.success += entry.success;
            current.failed += entry.failed;
            result.providers.set(provider, current);
            entry.recentRequests
              .filter((bucket) => bucket.failed > 0)
              .forEach((bucket) =>
                result.failures.push({ provider, time: bucket.time, count: bucket.failed })
              );
          });
          return result;
        },
        {
          success: 0,
          failed: 0,
          providers: new Map<string, { success: number; failed: number }>(),
          failures: [] as { provider: string; time?: string; count: number }[],
        }
      ),
    [data]
  );
  const total = summary.success + summary.failed;
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
              <dd>{total}</dd>
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
              <dd>{total ? `${((summary.success / total) * 100).toFixed(1)}%` : '—'}</dd>
            </div>
          </dl>
          <p>
            {t('request_stats.period', {
              time: sessionStart.toLocaleString(i18n.language),
            })}
          </p>
          <section>
            <h2>{t('request_stats.by_provider')}</h2>
            {[...summary.providers].map(([name, value]) => (
              <p key={name}>
                {name}: {value.success + value.failed}
              </p>
            ))}
          </section>
          <section>
            <h2>{t('request_stats.by_model')}</h2>
            <p>{t('request_stats.unavailable')}</p>
            <h2>{t('request_stats.by_account')}</h2>
            <p>{t('request_stats.unavailable')}</p>
          </section>
          <section>
            <h2>{t('request_stats.recent_failures')}</h2>
            {summary.failures.length ? (
              summary.failures
                .slice(-10)
                .reverse()
                .map((failure, index) => (
                  <p key={`${failure.provider}-${failure.time}-${index}`}>
                    {failure.provider} · {failure.time ?? t('request_stats.time_unavailable')} ·{' '}
                    {failure.count}
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
