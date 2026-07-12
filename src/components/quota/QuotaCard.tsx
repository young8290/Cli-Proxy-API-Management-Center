/**
 * Generic quota card component.
 */

import { useTranslation } from 'react-i18next';
import type { ReactElement, ReactNode } from 'react';
import type { TFunction } from 'i18next';
import { Button } from '@/components/ui/Button';
import { IconInfo, IconRefreshCw } from '@/components/ui/icons';
import type { AuthFileItem, ResolvedTheme, ThemeColors } from '@/types';
import { presentQuota, type QuotaPresentation } from '@/features/quota/quotaPresentation';
import { TYPE_COLORS } from '@/utils/quota';
import styles from '@/pages/QuotaPage.module.scss';

type QuotaStatus = 'idle' | 'loading' | 'success' | 'error';

export interface QuotaStatusState {
  status: QuotaStatus;
  error?: string;
  errorStatus?: number;
}

export interface QuotaProgressBarProps {
  percent: number | null;
  detailKey?: string;
  resetAt?: string | number;
}

export function QuotaProgressBar({ percent, detailKey, resetAt }: QuotaProgressBarProps) {
  const { t } = useTranslation();
  const presentation = presentQuota({
    status: 'success',
    remainingPercent: percent,
    detail: detailKey,
    resetAt,
  });
  const fillClass =
    presentation.level === 'sufficient'
      ? styles.quotaBarFillHigh
      : presentation.level === 'low'
        ? styles.quotaBarFillMedium
        : presentation.level === 'critical'
          ? styles.quotaBarFillLow
          : styles.quotaBarFillUnknown;
  const widthPercent = Math.round((presentation.percent ?? 0) * 100) / 100;
  const accessibleLabel = `${t(presentation.labelKey)}: ${t(presentation.detailKey)}`;

  return (
    <div className={styles.quotaProgress} data-quota-level={presentation.level}>
      <div className={styles.quotaBar} aria-label={accessibleLabel} title={accessibleLabel}>
        <div
          className={`${styles.quotaBarFill} ${fillClass}`}
          style={{ width: `${widthPercent}%` }}
        />
      </div>
      {presentation.level === 'unknown' && (
        <div className={styles.quotaUnknownDetail}>
          <IconInfo size={14} />
          <span>{t(presentation.labelKey)}</span>
          <span aria-hidden="true">·</span>
          <span>{t(presentation.detailKey)}</span>
        </div>
      )}
    </div>
  );
}

const QuotaStateMessage = ({
  presentation,
  children,
}: {
  presentation: QuotaPresentation;
  children?: ReactNode;
}) => {
  const { t } = useTranslation();
  return (
    <div className={styles.quotaStateMessage} data-quota-level={presentation.level}>
      <span className={styles.quotaStateHeading}>
        <IconInfo size={15} />
        {t(presentation.labelKey)}
      </span>
      <span>{t(presentation.detailKey)}</span>
      {children}
    </div>
  );
};

export interface QuotaRenderHelpers {
  styles: typeof styles;
  QuotaProgressBar: (props: QuotaProgressBarProps) => ReactElement;
}

interface QuotaCardProps<TState extends QuotaStatusState> {
  item: AuthFileItem;
  quota?: TState;
  resolvedTheme: ResolvedTheme;
  i18nPrefix: string;
  cardClassName: string;
  defaultType: string;
  canRefresh?: boolean;
  onRefresh?: () => void;
  resetQuotaAction?: ReactNode;
  renderQuotaItems: (quota: TState, t: TFunction, helpers: QuotaRenderHelpers) => ReactNode;
}

export function QuotaCard<TState extends QuotaStatusState>({
  item,
  quota,
  resolvedTheme,
  i18nPrefix,
  cardClassName,
  defaultType,
  canRefresh = false,
  onRefresh,
  resetQuotaAction,
  renderQuotaItems,
}: QuotaCardProps<TState>) {
  const { t } = useTranslation();

  const displayType = item.type || item.provider || defaultType;
  const typeColorSet = TYPE_COLORS[displayType] || TYPE_COLORS.unknown;
  const typeColor: ThemeColors =
    resolvedTheme === 'dark' && typeColorSet.dark ? typeColorSet.dark : typeColorSet.light;

  const quotaStatus = quota?.status ?? 'idle';
  const quotaLoading = quotaStatus === 'loading';
  const quotaErrorMessage = resolveQuotaErrorMessage(
    t,
    quota?.errorStatus,
    quota?.error || t('common.unknown_error')
  );
  const idleMessageKey = `${i18nPrefix}.idle`;
  const idlePresentation = presentQuota({ status: 'not-refreshed' });
  const errorPresentation = presentQuota({
    status: quota?.errorStatus === 404 ? 'unsupported' : 'fetch-error',
  });

  const getTypeLabel = (type: string): string => {
    const key = `auth_files.filter_${type}`;
    const translated = t(key);
    if (translated !== key) return translated;
    if (type.toLowerCase() === 'iflow') return 'iFlow';
    return type.charAt(0).toUpperCase() + type.slice(1);
  };

  return (
    <div className={`${styles.fileCard} ${cardClassName}`}>
      <div className={styles.cardHeader}>
        <span
          className={styles.typeBadge}
          style={{
            backgroundColor: typeColor.bg,
            color: typeColor.text,
            ...(typeColor.border ? { border: typeColor.border } : {}),
          }}
        >
          {getTypeLabel(displayType)}
        </span>
        <span className={styles.fileName}>{item.name}</span>
      </div>

      <div className={styles.quotaSection}>
        {quotaLoading ? (
          <div className={styles.quotaMessage}>{t(`${i18nPrefix}.loading`)}</div>
        ) : quotaStatus === 'idle' ? (
          onRefresh ? (
            <button
              type="button"
              className={styles.quotaMessageAction}
              onClick={onRefresh}
              disabled={!canRefresh}
            >
              <QuotaStateMessage presentation={idlePresentation}>
                <span>{t(idleMessageKey)}</span>
              </QuotaStateMessage>
            </button>
          ) : (
            <QuotaStateMessage presentation={idlePresentation}>
              <span>{t(idleMessageKey)}</span>
            </QuotaStateMessage>
          )
        ) : quotaStatus === 'error' ? (
          <QuotaStateMessage presentation={errorPresentation}>
            <span className={styles.quotaError}>
              {t(`${i18nPrefix}.load_failed`, {
                message: quotaErrorMessage,
              })}
            </span>
          </QuotaStateMessage>
        ) : quota ? (
          renderQuotaItems(quota, t, { styles, QuotaProgressBar })
        ) : (
          <QuotaStateMessage presentation={idlePresentation}>
            <span>{t(idleMessageKey)}</span>
          </QuotaStateMessage>
        )}
      </div>

      {(resetQuotaAction || (onRefresh && quotaStatus !== 'idle')) && (
        <div className={styles.quotaCardActions}>
          {resetQuotaAction}
          {onRefresh && quotaStatus !== 'idle' && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className={styles.quotaRefreshButton}
              onClick={onRefresh}
              disabled={!canRefresh || quotaLoading}
              loading={quotaLoading}
              title={t('auth_files.quota_refresh_hint')}
            >
              {!quotaLoading && <IconRefreshCw size={14} />}
              {t('auth_files.quota_refresh_single')}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

const resolveQuotaErrorMessage = (
  t: TFunction,
  status: number | undefined,
  fallback: string
): string => {
  if (status === 404) return t('common.quota_update_required');
  if (status === 403) return t('common.quota_check_credential');
  return fallback;
};
