// @ts-expect-error Bun test runtime types are not included in the production tsconfig.
import { describe, expect, test } from 'bun:test';
import type { AuthFileItem } from '../src/types/authFile';
import * as quotaLoading from '../src/features/authFiles/quotaLoading';

const deferred = () => {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
};

describe('auth file quota loading', () => {
  test('keeps loading until a queued latest auth-file batch finishes', async () => {
    const first = deferred();
    const second = deferred();
    const secondStarted = deferred();
    const batches: string[][] = [];
    const loading: boolean[] = [];
    const controller = quotaLoading.createQuotaLoadBatchController(
      async (files: AuthFileItem[]) => {
        batches.push(files.map((file) => file.name));
        if (batches.length === 2) secondStarted.resolve();
        await (batches.length === 1 ? first.promise : second.promise);
      },
      (value: boolean) => loading.push(value)
    );

    const running = controller.request([{ name: 'old.json', type: 'claude' }]);
    controller.request([{ name: 'new.json', type: 'claude' }]);
    first.resolve();
    await secondStarted.promise;

    expect(batches).toEqual([['old.json'], ['new.json']]);
    expect(loading).toEqual([true]);

    second.resolve();
    await running;
    expect(loading).toEqual([true, false]);
  });

  test('reloads a same-name credential when its quota input signature changes', () => {
    const original: AuthFileItem = {
      name: 'account.json',
      type: 'claude',
      provider: 'anthropic',
      modified: 1,
      size: 100,
      authIndex: 7,
    };
    const loaded = new Map([
      ['account.json', quotaLoading.buildAuthFileQuotaInputSignature(original)],
    ]);

    expect(quotaLoading.selectAuthFilesNeedingQuotaLoad([original], loaded)).toEqual([]);
    expect(
      quotaLoading.selectAuthFilesNeedingQuotaLoad([{ ...original, modified: 2 }], loaded)
    ).toEqual([{ ...original, modified: 2 }]);
    expect(
      quotaLoading.selectAuthFilesNeedingQuotaLoad([{ ...original, authIndex: 8 }], loaded)
    ).toEqual([{ ...original, authIndex: 8 }]);
  });
});
