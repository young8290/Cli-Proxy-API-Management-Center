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
});
