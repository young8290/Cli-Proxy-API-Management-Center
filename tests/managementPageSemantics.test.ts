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
});
