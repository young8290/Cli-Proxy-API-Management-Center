// @ts-expect-error Bun test runtime types are not included in the production tsconfig.
import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

const quotaCardSource = readFileSync(
  new URL('../src/components/quota/QuotaCard.tsx', import.meta.url),
  'utf8'
);
const quotaConfigSource = readFileSync(
  new URL('../src/components/quota/quotaConfigs.ts', import.meta.url),
  'utf8'
);

describe('quota presentation wiring', () => {
  test('uses presentations in the shared card layer and does not synthesize Codex usage', () => {
    expect(quotaCardSource).toContain("from '@/features/quota/quotaPresentation'");
    expect(quotaCardSource).toContain('data-quota-level');
    expect(quotaCardSource).toContain("status: 'not-refreshed'");
    expect(quotaCardSource).toContain("'fetch-error'");
    expect(quotaConfigSource).not.toContain("isLimitReached && resetLabel !== '-' ? 100");
  });
});
