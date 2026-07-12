// @ts-expect-error Bun test runtime types are not included in the production tsconfig.
import { describe, expect, test } from 'bun:test';
import * as apiAccess from '../src/features/apiAccess/apiAccess';
import * as format from '../src/utils/format';

const apiAccessPageSource = await Bun.file(
  new URL('../src/features/apiAccess/ApiAccessPage.tsx', import.meta.url)
).text();

describe('secret presentation', () => {
  test('masks a secret without exposing its middle and fully masks short values', () => {
    const maskSecret = Reflect.get(format, 'maskSecret');
    expect(typeof maskSecret).toBe('function');
    if (typeof maskSecret !== 'function') return;

    const secret = 'sk-live-1234567890-secret';
    const masked = maskSecret(secret);
    expect(masked).toStartWith('sk-l');
    expect(masked).toEndWith('cret');
    expect(masked).not.toContain('1234567890');
    expect(maskSecret('tiny')).toBe('••••••••');
  });

  test('creates copy feedback that cannot retain or echo the copied secret', () => {
    const createCopyFeedback = Reflect.get(apiAccess, 'createCopyFeedback');
    expect(typeof createCopyFeedback).toBe('function');
    if (typeof createCopyFeedback !== 'function') return;

    const secret = 'sk-live-do-not-retain';
    const success = createCopyFeedback(true);
    const failure = createCopyFeedback(false);

    expect(success).toEqual({ messageKey: 'api_access.copy_success', tone: 'success' });
    expect(failure).toEqual({ messageKey: 'api_access.copy_failed', tone: 'error' });
    expect(JSON.stringify([success, failure])).not.toContain(secret);
    expect(apiAccessPageSource).toContain('createCopyFeedback(copied)');
    expect(apiAccessPageSource).not.toContain('createCopyFeedback(copied, value)');
    expect(apiAccessPageSource).not.toContain('showNotification(value');
  });
});
