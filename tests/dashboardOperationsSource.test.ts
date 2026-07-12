// @ts-expect-error Bun test runtime types are not included in the production tsconfig.
import { describe, expect, test } from 'bun:test';

const source = await Bun.file(new URL('../src/pages/DashboardPage.tsx', import.meta.url)).text();

describe('dashboard operations overview wiring', () => {
  test('loads dashboard resources with settled isolation', () => {
    expect(source).toContain('Promise.allSettled');
    expect(source).toContain('apiKeyUsageApi.getUsage()');
    expect(source).toContain('authFilesApi.list()');
  });

  test('links operators to API access, accounts, quota, and logs', () => {
    ['/api-access', '/auth-files', '/quota', '/logs'].forEach((path) => {
      expect(source).toContain(`to="${path}"`);
    });
  });

  test('exposes loading and error feedback to assistive technology', () => {
    expect(source).toContain('role="status"');
    expect(source).toContain('role="alert"');
    expect(source).toContain('IconRefreshCw');
  });
});
