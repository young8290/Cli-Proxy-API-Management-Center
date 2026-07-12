import { describe, expect, test } from 'bun:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Navigate } from 'react-router-dom';
import '../src/i18n';
import { ApiAccessPage } from '../src/features/apiAccess/ApiAccessPage';
import * as apiAccess from '../src/features/apiAccess/apiAccess';
import * as mainRoutesModule from '../src/router/MainRoutes';
import { useAuthStore } from '../src/stores';

describe('API access route metadata', () => {
  test('wires the API access page and legacy redirect in the route config consumed by MainRoutes', () => {
    const createMainRoutes = Reflect.get(mainRoutesModule, 'createMainRoutes');

    expect(typeof createMainRoutes).toBe('function');
    if (typeof createMainRoutes !== 'function') return;

    const routes = createMainRoutes(false);
    const apiAccessRoute = routes.find((route: { path: string }) => route.path === '/api-access');
    const legacyRoute = routes.find((route: { path: string }) => route.path === '/api-keys');

    expect(apiAccessRoute?.element.type).toBe(ApiAccessPage);
    expect(legacyRoute?.element.type).toBe(Navigate);
    expect(legacyRoute?.element.props).toMatchObject({ to: '/api-access', replace: true });
  });
});

describe('API access workspace helpers', () => {
  test('keeps the models panel loading until its first request completes', () => {
    const getModelsPanelState = Reflect.get(apiAccess, 'getModelsPanelState');

    expect(typeof getModelsPanelState).toBe('function');
    if (typeof getModelsPanelState !== 'function') return;

    expect(
      getModelsPanelState({
        hasCompletedRequest: false,
        isLoading: false,
        error: null,
        totalModels: 0,
        visibleModels: 0,
      })
    ).toBe('loading');
  });

  test('shows the empty models state only after a completed request', () => {
    const getModelsPanelState = Reflect.get(apiAccess, 'getModelsPanelState');

    expect(typeof getModelsPanelState).toBe('function');
    if (typeof getModelsPanelState !== 'function') return;

    expect(
      getModelsPanelState({
        hasCompletedRequest: true,
        isLoading: false,
        error: null,
        totalModels: 0,
        visibleModels: 0,
      })
    ).toBe('empty');
  });

  test('masks API keys by default while preserving the first and last four characters', () => {
    const maskApiKey = Reflect.get(apiAccess, 'maskApiKey');

    expect(typeof maskApiKey).toBe('function');
    if (typeof maskApiKey !== 'function') return;

    const masked = maskApiKey('sk-live-1234567890-secret');
    expect(masked).toStartWith('sk-l');
    expect(masked).toEndWith('cret');
    expect(masked).not.toContain('1234567890');
  });

  test('filters models case-insensitively by name, alias, or description', () => {
    const filterModelsByQuery = Reflect.get(apiAccess, 'filterModelsByQuery');

    expect(typeof filterModelsByQuery).toBe('function');
    if (typeof filterModelsByQuery !== 'function') return;

    const models = [
      { name: 'gpt-5-mini', alias: 'Fast GPT' },
      { name: 'claude-sonnet-4', description: 'Balanced reasoning' },
      { name: 'gemini-2.5-pro' },
    ];

    expect(filterModelsByQuery(models, 'FAST')).toEqual([models[0]]);
    expect(filterModelsByQuery(models, 'reasoning')).toEqual([models[1]]);
    expect(filterModelsByQuery(models, '  ')).toEqual(models);
  });
});

describe('API access example language controls', () => {
  test('uses an aria-labelled pressed-button group without incomplete tab semantics', () => {
    const authState = useAuthStore.getState();
    const previousApiBase = authState.apiBase;
    const previousConnectionStatus = authState.connectionStatus;
    authState.apiBase = 'https://relay.example.com';
    authState.connectionStatus = 'connected';

    try {
      const markup = renderToStaticMarkup(createElement(ApiAccessPage));

      expect(markup).toContain('role="group"');
      expect(markup).toContain('aria-pressed="true"');
      expect(markup).not.toContain('role="tablist"');
      expect(markup).not.toContain('role="tab"');
    } finally {
      authState.apiBase = previousApiBase;
      authState.connectionStatus = previousConnectionStatus;
    }
  });
});
