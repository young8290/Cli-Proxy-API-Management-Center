// @ts-expect-error Bun test runtime types are not included in the production tsconfig.
import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import type { AuthFileItem } from '../src/types/authFile';
import * as uiState from '../src/features/authFiles/uiState';

type QuotaSnapshot = {
  antigravityQuota: Record<string, unknown>;
  claudeQuota: Record<string, unknown>;
  codexQuota: Record<string, unknown>;
  kimiQuota: Record<string, unknown>;
  xaiQuota: Record<string, unknown>;
};

const filterAndSortAuthFiles = uiState.filterAndSortAuthFiles as (
  files: readonly AuthFileItem[],
  filters: {
    health?: string;
    provider?: string;
    lowQuotaOnly?: boolean;
    lowQuotaNames?: ReadonlySet<string>;
    search?: string;
  }
) => AuthFileItem[];

const buildAuthFileQuotaDiagnostics = uiState.buildAuthFileQuotaDiagnostics as (
  snapshot: QuotaSnapshot
) => Map<string, { remainingPercent: number | null; low: boolean }>;

describe('auth file health filtering', () => {
  test('renders the required account diagnostics without removing card actions', () => {
    const source = readFileSync(
      new URL('../src/features/authFiles/components/AuthFileCard.tsx', import.meta.url),
      'utf8'
    );

    [
      'auth_files.diagnostic_account',
      'auth_files.diagnostic_provider',
      'auth_files.diagnostic_status',
      'auth_files.diagnostic_quota',
      'auth_files.diagnostic_recent',
      'auth_files.diagnostic_last_refresh',
      'auth_files.diagnostic_next_retry',
      'auth_files.diagnostic_error',
    ].forEach((key) => expect(source).toContain(key));
    expect(source).toContain('quotaDiagnostic.remainingPercent');
    expect(source).toContain('onShowModels(file)');
    expect(source).toContain('onDownload(file.name)');
    expect(source).toContain('onOpenPrefixProxyEditor(file)');
    expect(source).toContain('onDelete(file.name)');
    expect(source).toContain('onToggleStatus(file, value)');
  });

  test('combines health, provider, low quota, and name/provider text filters', () => {
    const files: AuthFileItem[] = [
      { name: 'alice.json', provider: 'claude', status: 'error' },
      { name: 'bob.json', provider: 'claude', status: 'active' },
      { name: 'carol.json', provider: 'codex', status: 'error' },
    ];

    expect(
      filterAndSortAuthFiles(files, {
        health: 'error',
        provider: 'claude',
        lowQuotaOnly: true,
        lowQuotaNames: new Set(['alice.json', 'bob.json']),
        search: 'ali',
      }).map((file) => file.name)
    ).toEqual(['alice.json']);

    expect(filterAndSortAuthFiles(files, { search: 'CODEX' }).map((file) => file.name)).toEqual([
      'carol.json',
    ]);
  });

  test('uses the visible type for provider filtering and searches type and provider aliases', () => {
    const files: AuthFileItem[] = [
      { name: 'claude.json', type: 'claude', provider: 'anthropic', status: 'active' },
    ];

    expect(filterAndSortAuthFiles(files, { provider: 'claude' })).toEqual(files);
    expect(filterAndSortAuthFiles(files, { provider: 'anthropic' })).toEqual([]);
    expect(filterAndSortAuthFiles(files, { search: 'claude' })).toEqual(files);
    expect(filterAndSortAuthFiles(files, { search: 'anthropic' })).toEqual(files);
  });

  test('actively loads all supported quotas before showing low-quota filter results', () => {
    const source = readFileSync(new URL('../src/pages/AuthFilesPage.tsx', import.meta.url), 'utf8');

    [
      'useQuotaLoader(ANTIGRAVITY_CONFIG)',
      'useQuotaLoader(CLAUDE_CONFIG)',
      'useQuotaLoader(CODEX_CONFIG)',
      'useQuotaLoader(KIMI_CONFIG)',
      'useQuotaLoader(XAI_CONFIG)',
      'loadAntigravityQuota',
      'loadClaudeQuota',
      'loadCodexQuota',
      'loadKimiQuota',
      'loadXaiQuota',
    ].forEach((snippet) => expect(source).toContain(snippet));
    expect(source).toContain('lowQuotaLoading');
    expect(source).toContain('lowQuotaError');
    expect(source).toContain("lowQuotaOnly && lowQuotaLoading");
  });

  test('exposes full diagnostic errors through accessible disclosure controls', () => {
    const source = readFileSync(
      new URL('../src/features/authFiles/components/AuthFileCard.tsx', import.meta.url),
      'utf8'
    );

    expect(source).toContain('<details');
    expect(source).toContain('<summary');
    expect(source).not.toContain('<dd title={diagnosticError}>{diagnosticError || \'-\'}</dd>');
  });

  test('sorts by the required health priority and preserves original order inside a status', () => {
    const files: AuthFileItem[] = [
      { name: 'healthy.json', status: 'active' },
      { name: 'error-first.json', status: 'error' },
      { name: 'disabled.json', disabled: true },
      { name: 'unknown.json' },
      { name: 'error-second.json', status_message: 'expired' },
      { name: 'retrying.json', next_retry_after: '2026-07-13T00:00:00Z' },
      { name: 'unavailable.json', unavailable: true },
    ];
    const original = files.map((file) => file.name);

    expect(filterAndSortAuthFiles(files, {}).map((file) => file.name)).toEqual([
      'error-first.json',
      'error-second.json',
      'unavailable.json',
      'retrying.json',
      'disabled.json',
      'healthy.json',
      'unknown.json',
    ]);
    expect(files.map((file) => file.name)).toEqual(original);
  });

  test('derives low quota diagnostics from the real provider quota shapes', () => {
    const diagnostics = buildAuthFileQuotaDiagnostics({
      antigravityQuota: {
        'ag.json': {
          status: 'success',
          groups: [{ buckets: [{ remainingFraction: 0.15 }] }],
        },
      },
      claudeQuota: {
        'claude.json': { status: 'success', windows: [{ usedPercent: 90 }] },
      },
      codexQuota: {
        'codex.json': { status: 'success', windows: [{ usedPercent: 40 }] },
      },
      kimiQuota: {
        'kimi.json': { status: 'success', rows: [{ used: 95, limit: 100 }] },
      },
      xaiQuota: {
        'xai.json': { status: 'success', billing: { usedPercent: 75 } },
      },
    });

    expect(diagnostics.get('ag.json')).toMatchObject({ remainingPercent: 15, low: true });
    expect(diagnostics.get('claude.json')).toMatchObject({ remainingPercent: 10, low: true });
    expect(diagnostics.get('codex.json')).toMatchObject({ remainingPercent: 60, low: false });
    expect(diagnostics.get('kimi.json')).toMatchObject({ remainingPercent: 5, low: true });
    expect(diagnostics.get('xai.json')).toMatchObject({ remainingPercent: 25, low: false });
  });
});
