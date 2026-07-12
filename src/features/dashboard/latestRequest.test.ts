// @ts-expect-error Bun test runtime types are not included in the production tsconfig.
import { describe, expect, test } from 'bun:test';
import { createLatestRequest } from './latestRequest';

describe('createLatestRequest', () => {
  test('allows only the newest generation to commit or finish loading', () => {
    const requests = createLatestRequest();
    const first = requests.begin();
    const second = requests.begin();

    expect(requests.isLatest(first)).toBe(false);
    expect(requests.isLatest(second)).toBe(true);
    expect(requests.commit(first, () => 'old')).toBeUndefined();
    expect(requests.commit(second, () => 'new')).toBe('new');
  });

  test('prevents an older auth result from continuing into the quota chain', async () => {
    const requests = createLatestRequest();
    const quotaLoads: string[][] = [];
    const first = requests.begin();
    const second = requests.begin();

    const continueToQuota = async (generation: number, files: string[]) => {
      const accepted = requests.commit(generation, () => files);
      if (accepted) quotaLoads.push(accepted);
    };

    await continueToQuota(second, ['new.json']);
    await continueToQuota(first, ['old.json']);

    expect(quotaLoads).toEqual([['new.json']]);
  });
});
