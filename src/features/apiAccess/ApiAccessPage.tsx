import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import {
  IconCode,
  IconEye,
  IconEyeOff,
  IconKey,
  IconRefreshCw,
  IconSearch,
} from '@/components/ui/icons';
import { apiKeysApi } from '@/services/api';
import { useAuthStore, useModelsStore, useNotificationStore } from '@/stores';
import { copyToClipboard } from '@/utils/clipboard';
import {
  buildCurlExample,
  buildJavaScriptExample,
  buildPythonExample,
  deriveApiEndpoints,
  filterModelsByQuery,
  maskApiKey,
} from './apiAccess';
import styles from './ApiAccessPage.module.scss';

type ExampleLanguage = 'curl' | 'python' | 'javascript';

const EXAMPLE_LANGUAGES: ExampleLanguage[] = ['curl', 'python', 'javascript'];

export function ApiAccessPage() {
  const { t } = useTranslation();
  const apiBase = useAuthStore((state) => state.apiBase);
  const connectionStatus = useAuthStore((state) => state.connectionStatus);
  const models = useModelsStore((state) => state.models);
  const modelsLoading = useModelsStore((state) => state.loading);
  const modelsError = useModelsStore((state) => state.error);
  const fetchModels = useModelsStore((state) => state.fetchModels);
  const showNotification = useNotificationStore((state) => state.showNotification);

  const [apiKeys, setApiKeys] = useState<string[]>([]);
  const [keysLoading, setKeysLoading] = useState(false);
  const [keysError, setKeysError] = useState('');
  const [revealedKeys, setRevealedKeys] = useState<Set<number>>(() => new Set());
  const [modelQuery, setModelQuery] = useState('');
  const [selectedModel, setSelectedModel] = useState('');
  const [exampleLanguage, setExampleLanguage] = useState<ExampleLanguage>('curl');

  const endpoints = useMemo(() => {
    try {
      return deriveApiEndpoints(apiBase);
    } catch {
      return null;
    }
  }, [apiBase]);

  const loadWorkspace = useCallback(
    async (forceRefresh = false) => {
      if (connectionStatus !== 'connected' || !endpoints) return;

      setKeysLoading(true);
      setKeysError('');

      let keys: string[] = [];
      try {
        keys = await apiKeysApi.list();
        setApiKeys(keys);
        setRevealedKeys(new Set());
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : '';
        setApiKeys([]);
        setKeysError(message || t('api_access.keys_load_failed'));
      } finally {
        setKeysLoading(false);
      }

      try {
        const list = await fetchModels(endpoints.serviceOrigin, keys[0], forceRefresh);
        setSelectedModel((current) =>
          current && list.some((model) => model.name === current) ? current : (list[0]?.name ?? '')
        );
      } catch {
        setSelectedModel('');
      }
    },
    [connectionStatus, endpoints, fetchModels, t]
  );

  useEffect(() => {
    void loadWorkspace();
  }, [loadWorkspace]);

  const filteredModels = useMemo(
    () => filterModelsByQuery(models, modelQuery),
    [modelQuery, models]
  );

  const exampleModel = selectedModel || '<MODEL_ID>';
  const examples = useMemo(() => {
    if (!endpoints) return { curl: '', python: '', javascript: '' };
    return {
      curl: buildCurlExample(endpoints.openAiBaseUrl, exampleModel),
      python: buildPythonExample(endpoints.openAiBaseUrl, exampleModel),
      javascript: buildJavaScriptExample(endpoints.openAiBaseUrl, exampleModel),
    };
  }, [endpoints, exampleModel]);

  const handleCopy = async (value: string, label: string) => {
    const copied = await copyToClipboard(value);
    showNotification(
      copied ? t('api_access.copy_success', { label }) : t('api_access.copy_failed', { label }),
      copied ? 'success' : 'error'
    );
  };

  const toggleKeyVisibility = (index: number) => {
    setRevealedKeys((current) => {
      const next = new Set(current);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const handleRefresh = async () => {
    await loadWorkspace(true);
  };

  if (!endpoints) {
    return (
      <div className={styles.container}>
        <h1 className={styles.pageTitle}>{t('api_access.title')}</h1>
        <Card>
          <p className={styles.errorText}>{t('api_access.connection_unavailable')}</p>
        </Card>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <section className={styles.hero}>
        <div>
          <span className={styles.eyebrow}>{t('api_access.eyebrow')}</span>
          <h1 className={styles.pageTitle}>{t('api_access.title')}</h1>
          <p className={styles.subtitle}>{t('api_access.subtitle')}</p>
        </div>
        <Button
          variant="secondary"
          onClick={handleRefresh}
          loading={keysLoading || modelsLoading}
          aria-label={t('api_access.refresh')}
        >
          <IconRefreshCw size={16} />
          {t('api_access.refresh')}
        </Button>
      </section>

      <div className={styles.endpointGrid}>
        {[
          [t('api_access.service_origin'), endpoints.serviceOrigin],
          [t('api_access.openai_base_url'), endpoints.openAiBaseUrl],
          [t('api_access.models_endpoint'), endpoints.modelsUrl],
        ].map(([label, value]) => (
          <Card className={styles.endpointCard} key={label}>
            <span className={styles.cardLabel}>{label}</span>
            <code className={styles.endpointValue}>{value}</code>
            <Button
              variant="ghost"
              size="sm"
              className={styles.copyButton}
              onClick={() => handleCopy(value, label)}
              aria-label={t('api_access.copy_value_aria', { label })}
            >
              {t('common.copy')}
            </Button>
          </Card>
        ))}
      </div>

      <div className={styles.workspaceGrid}>
        <Card className={styles.keysCard}>
          <div className={styles.sectionHeader}>
            <div>
              <span className={styles.sectionIcon} aria-hidden="true">
                <IconKey size={18} />
              </span>
              <h2>{t('api_access.keys_title')}</h2>
              <p>{t('api_access.keys_description')}</p>
            </div>
            <span className={styles.countBadge}>{apiKeys.length}</span>
          </div>

          {keysLoading ? <p className={styles.mutedText}>{t('api_access.keys_loading')}</p> : null}
          {keysError ? <p className={styles.errorText}>{keysError}</p> : null}
          {!keysLoading && !keysError && apiKeys.length === 0 ? (
            <p className={styles.emptyText}>{t('api_access.keys_empty')}</p>
          ) : null}

          <div className={styles.keyList}>
            {apiKeys.map((apiKey, index) => {
              const isRevealed = revealedKeys.has(index);
              return (
                <div className={styles.keyRow} key={`${index}-${apiKey.slice(-4)}`}>
                  <div className={styles.keyIdentity}>
                    <span>{t('api_access.key_number', { number: index + 1 })}</span>
                    <code>{isRevealed ? apiKey : maskApiKey(apiKey)}</code>
                  </div>
                  <div className={styles.rowActions}>
                    <Button
                      variant="ghost"
                      size="sm"
                      className={styles.iconButton}
                      onClick={() => toggleKeyVisibility(index)}
                      aria-label={
                        isRevealed
                          ? t('api_access.hide_key_aria', { number: index + 1 })
                          : t('api_access.show_key_aria', { number: index + 1 })
                      }
                    >
                      {isRevealed ? <IconEyeOff size={16} /> : <IconEye size={16} />}
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleCopy(apiKey, t('api_access.api_key_label'))}
                      aria-label={t('api_access.copy_key_aria', { number: index + 1 })}
                    >
                      {t('common.copy')}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        <Card className={styles.modelsCard}>
          <div className={styles.sectionHeader}>
            <div>
              <span className={styles.sectionIcon} aria-hidden="true">
                <IconCode size={18} />
              </span>
              <h2>{t('api_access.models_title')}</h2>
              <p>{t('api_access.models_description')}</p>
            </div>
            <span className={styles.countBadge}>{models.length}</span>
          </div>

          <label className={styles.searchField}>
            <span className={styles.visuallyHidden}>{t('api_access.model_search_label')}</span>
            <IconSearch size={16} aria-hidden="true" />
            <input
              type="search"
              value={modelQuery}
              onChange={(event) => setModelQuery(event.target.value)}
              placeholder={t('api_access.model_search_placeholder')}
            />
          </label>

          {modelsLoading ? (
            <p className={styles.mutedText}>{t('api_access.models_loading')}</p>
          ) : null}
          {modelsError ? <p className={styles.errorText}>{modelsError}</p> : null}
          {!modelsLoading && !modelsError && filteredModels.length === 0 ? (
            <p className={styles.emptyText}>
              {models.length === 0
                ? t('api_access.models_empty')
                : t('api_access.models_no_results')}
            </p>
          ) : null}

          <div className={styles.modelList}>
            {filteredModels.map((model) => {
              const isSelected = selectedModel === model.name;
              return (
                <div
                  className={`${styles.modelRow} ${isSelected ? styles.modelRowSelected : ''}`}
                  key={model.name}
                >
                  <button
                    type="button"
                    className={styles.modelSelect}
                    onClick={() => setSelectedModel(model.name)}
                    aria-pressed={isSelected}
                  >
                    <span className={styles.modelName}>{model.name}</span>
                    {model.alias ? <span className={styles.modelAlias}>{model.alias}</span> : null}
                  </button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className={styles.copyButton}
                    onClick={() => handleCopy(model.name, t('api_access.model_label'))}
                    aria-label={t('api_access.copy_model_aria', { model: model.name })}
                  >
                    {t('common.copy')}
                  </Button>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      <Card className={styles.examplesCard}>
        <div className={styles.examplesHeader}>
          <div>
            <span className={styles.cardLabel}>{t('api_access.examples_eyebrow')}</span>
            <h2>{t('api_access.examples_title')}</h2>
            <p>{t('api_access.examples_description')}</p>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => handleCopy(examples[exampleLanguage], t('api_access.example_label'))}
            aria-label={t('api_access.copy_example_aria', {
              language: t(`api_access.languages.${exampleLanguage}`),
            })}
          >
            {t('api_access.copy_example')}
          </Button>
        </div>

        <div
          className={styles.exampleTabs}
          role="tablist"
          aria-label={t('api_access.example_language')}
        >
          {EXAMPLE_LANGUAGES.map((language) => (
            <button
              key={language}
              type="button"
              role="tab"
              aria-selected={exampleLanguage === language}
              className={exampleLanguage === language ? styles.exampleTabActive : ''}
              onClick={() => setExampleLanguage(language)}
            >
              {t(`api_access.languages.${language}`)}
            </button>
          ))}
        </div>

        <pre className={styles.codeBlock} tabIndex={0}>
          <code>{examples[exampleLanguage]}</code>
        </pre>
      </Card>
    </div>
  );
}
