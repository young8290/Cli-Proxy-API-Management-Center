// @ts-expect-error Bun test runtime types are not included in the production tsconfig.
import { describe, expect, test } from 'bun:test';

const readSource = (path: string) => Bun.file(new URL(path, import.meta.url)).text();

describe('management page feedback semantics', () => {
  test('labels API access loading and error feedback for assistive technology', async () => {
    const source = await readSource('../src/features/apiAccess/ApiAccessPage.tsx');

    expect(source).toContain('role="status"');
    expect(source).toContain('role="alert"');
  });

  test('labels account, quota, plugin, store, and system errors as alerts', async () => {
    const sources = await Promise.all(
      [
        '../src/pages/AuthFilesPage.tsx',
        '../src/pages/QuotaPage.tsx',
        '../src/features/plugins/PluginsPage.tsx',
        '../src/features/plugins/PluginStorePage.tsx',
        '../src/pages/SystemPage.tsx',
      ].map(readSource)
    );

    sources.forEach((source) => expect(source).toContain('role="alert"'));
  });

  test('gives config search navigation icon buttons explicit accessible names', async () => {
    const source = await readSource('../src/pages/ConfigPage.tsx');

    expect(source).toContain("aria-label={t('config_management.search_prev'");
    expect(source).toContain("aria-label={t('config_management.search_next'");
    expect(source).toContain("aria-label={t('config_management.search_button'");
  });

  test('shows compact visible labels for Config and Provider search fields', async () => {
    const [config, configStyles, provider, providerStyles] = await Promise.all(
      [
        '../src/pages/ConfigPage.tsx',
        '../src/pages/ConfigPage.module.scss',
        '../src/features/providers/components/ProviderResourcePanel.tsx',
        '../src/features/providers/components/ProviderResourcePanel.module.scss',
      ].map(readSource)
    );

    expect(config).toContain('htmlFor="config-source-search"');
    expect(config).toContain('id="config-source-search"');
    expect(provider).toContain('htmlFor="provider-resource-search"');
    expect(provider).toContain('id="provider-resource-search"');
    expect(config).toContain('className={styles.searchLabel}');
    expect(provider).toContain('className={styles.searchLabel}');
    expect(configStyles).toContain('.searchLabel');
    expect(providerStyles).toContain('.searchLabel');
    expect(configStyles).not.toContain('.visuallyHidden');
    expect(providerStyles).not.toContain('.visuallyHidden');
  });

  test('announces Config load and parse failures assertively', async () => {
    const source = await readSource('../src/pages/ConfigPage.tsx');

    expect(source.match(/role="alert"/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
    expect(source.match(/aria-live="assertive"/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
  });

  test('announces OAuth, logs, and provider loading or status changes', async () => {
    const [oauth, logs, providers, providerPanel] = await Promise.all(
      [
        '../src/pages/OAuthPage.tsx',
        '../src/pages/LogsPage.tsx',
        '../src/features/providers/ProvidersWorkbenchPage.tsx',
        '../src/features/providers/components/ProviderResourcePanel.tsx',
      ].map(readSource)
    );

    expect(oauth).toContain("role={state.status === 'error' ? 'alert' : 'status'}");
    expect(logs).toContain('<div className="hint" role="status">');
    expect(providers).toContain('role="status"');
    expect(providerPanel).toContain("aria-label={t('providersPage.table.filterPlaceholder')}");
  });

  test('labels collapsed navigation drawers when only their icon is visible', async () => {
    const source = await readSource('../src/components/layout/MainLayout.tsx');

    expect(source).toContain('aria-label={showSidebarLabels ? undefined : item.label}');
    expect(source).toContain("aria-label={t('header.refresh_all')}");
    expect(source).toContain("aria-label={t('header.logout')}");
  });

  test('labels AuthFileCard download, settings, and delete icon buttons', async () => {
    const source = await readSource('../src/features/authFiles/components/AuthFileCard.tsx');

    expect(source).toContain("aria-label={t('auth_files.download_button')}");
    expect(source).toContain("aria-label={t('auth_files.prefix_proxy_button')}");
    expect(source).toContain("aria-label={t('auth_files.delete_button')}");
  });
});
