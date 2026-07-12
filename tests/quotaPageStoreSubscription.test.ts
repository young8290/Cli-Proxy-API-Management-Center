import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { QuotaPage } from '../src/pages/QuotaPage';
import { authFilesApi } from '../src/services/api/authFiles';
import { useQuotaStore } from '../src/stores/useQuotaStore';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe('QuotaPage quota-store subscription', () => {
  let renderer: ReactTestRenderer | undefined;
  let originalList: typeof authFilesApi.list;
  let originalConsoleError: typeof console.error;
  let unsubscribe: (() => void) | undefined;

  beforeEach(() => {
    originalList = authFilesApi.list;
    originalConsoleError = console.error;
    authFilesApi.list = async () => ({ files: [] });
    console.error = (...args: unknown[]) => {
      if (String(args[0]).includes('react-test-renderer is deprecated')) return;
      originalConsoleError(...args);
    };
    useQuotaStore.getState().clearQuotaCache();
  });

  afterEach(async () => {
    authFilesApi.list = originalList;
    console.error = originalConsoleError;
    unsubscribe?.();
    unsubscribe = undefined;
    if (renderer) {
      await act(async () => renderer?.unmount());
      renderer = undefined;
    }
  });

  test('mounts without an unstable external-store snapshot loop', async () => {
    await act(async () => {
      renderer = create(React.createElement(QuotaPage));
    });

    expect(renderer?.toJSON()).not.toBeNull();
  });

  test('prunes stale quota state once when the auth-file set actually changes', async () => {
    useQuotaStore.getState().setXaiQuota({
      'removed-account.json': { status: 'success', billing: null },
    });
    let xaiQuotaChanges = 0;
    unsubscribe = useQuotaStore.subscribe((state, previousState) => {
      if (state.xaiQuota !== previousState.xaiQuota) xaiQuotaChanges += 1;
    });

    await act(async () => {
      renderer = create(React.createElement(QuotaPage));
    });

    expect(useQuotaStore.getState().xaiQuota).toEqual({});
    expect(xaiQuotaChanges).toBe(1);
  });
});
