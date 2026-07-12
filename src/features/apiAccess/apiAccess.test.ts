// @ts-expect-error Bun test runtime types are not included in the production tsconfig.
import { describe, expect, test } from 'bun:test';
import {
  buildCurlExample,
  buildJavaScriptExample,
  buildPythonExample,
  deriveApiEndpoints,
} from './apiAccess';

describe('deriveApiEndpoints', () => {
  test('derives relay endpoints from the Youngspace management page URL', () => {
    expect(
      deriveApiEndpoints('https://youngspace.ai/management.html#/operations?tab=api-access')
    ).toEqual({
      serviceOrigin: 'https://youngspace.ai',
      openAiBaseUrl: 'https://youngspace.ai/v1',
      modelsUrl: 'https://youngspace.ai/v1/models',
    });
  });

  test('normalizes a trailing slash and ignores paths, queries, and hashes', () => {
    expect(
      deriveApiEndpoints('https://relay.example.com:8443/v0/management/?source=custom#/dashboard/')
    ).toEqual({
      serviceOrigin: 'https://relay.example.com:8443',
      openAiBaseUrl: 'https://relay.example.com:8443/v1',
      modelsUrl: 'https://relay.example.com:8443/v1/models',
    });
  });

  test('accepts a custom address without an explicit protocol', () => {
    expect(deriveApiEndpoints('relay.internal:8317/v0/management/')).toEqual({
      serviceOrigin: 'http://relay.internal:8317',
      openAiBaseUrl: 'http://relay.internal:8317/v1',
      modelsUrl: 'http://relay.internal:8317/v1/models',
    });
  });

  test('rejects an empty address with a clear error', () => {
    expect(() => deriveApiEndpoints('   ')).toThrow('API address is required');
  });

  test('rejects an invalid address with a clear error', () => {
    expect(() => deriveApiEndpoints('not a valid host')).toThrow('Invalid API address');
  });

  test('rejects explicit non-HTTP protocols', () => {
    expect(() => deriveApiEndpoints('ftp://relay.example.com/path')).toThrow(
      'API address must use HTTP or HTTPS'
    );
    expect(() => deriveApiEndpoints('mailto:admin@relay.example.com')).toThrow(
      'API address must use HTTP or HTTPS'
    );
  });
});

describe('SDK examples', () => {
  const openAiBaseUrl = 'https://relay.example.com/v1/';
  const modelId = 'gpt-5-mini';

  test('builds a curl chat-completions example with a placeholder key', () => {
    const example = buildCurlExample(openAiBaseUrl, modelId);

    expect(example).toContain('https://relay.example.com/v1/chat/completions');
    expect(example).toContain('Authorization: Bearer <API_KEY>');
    expect(example).toContain(`"model": "${modelId}"`);
    expect(example).not.toContain('sk-');
  });

  test('shell-quotes single quotes in a malicious curl model ID', () => {
    const example = buildCurlExample(openAiBaseUrl, `safe'; exit 42; echo 'unsafe`);

    expect(example).toContain(`"model": "safe'"'"'; exit 42; echo '"'"'unsafe"`);
    expect(example).not.toContain(`"model": "safe'; exit 42; echo 'unsafe"`);
  });

  test('builds a Python OpenAI SDK example with a placeholder key', () => {
    const example = buildPythonExample(openAiBaseUrl, modelId);

    expect(example).toContain('from openai import OpenAI');
    expect(example).toContain('api_key="<API_KEY>"');
    expect(example).toContain('base_url="https://relay.example.com/v1"');
    expect(example).toContain(`model="${modelId}"`);
    expect(example).not.toContain('sk-');
  });

  test('builds a JavaScript OpenAI SDK example with a placeholder key', () => {
    const example = buildJavaScriptExample(openAiBaseUrl, modelId);

    expect(example).toContain('import OpenAI from "openai"');
    expect(example).toContain('apiKey: "<API_KEY>"');
    expect(example).toContain('baseURL: "https://relay.example.com/v1"');
    expect(example).toContain(`model: "${modelId}"`);
    expect(example).not.toContain('sk-');
  });
});
