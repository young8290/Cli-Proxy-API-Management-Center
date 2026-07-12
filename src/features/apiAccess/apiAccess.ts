import type { ModelInfo } from '@/utils/models';

export interface ApiEndpoints {
  serviceOrigin: string;
  openAiBaseUrl: string;
  modelsUrl: string;
}

export const API_ACCESS_ROUTE = {
  path: '/api-access',
  legacyPath: '/api-keys',
} as const;

export const maskApiKey = (value: string): string => {
  if (value.length <= 8) return '•'.repeat(Math.max(value.length, 8));
  return `${value.slice(0, 4)}${'•'.repeat(8)}${value.slice(-4)}`;
};

export const filterModelsByQuery = (models: ModelInfo[], query: string): ModelInfo[] => {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return models;

  return models.filter((model) =>
    [model.name, model.alias, model.description].some((value) =>
      value?.toLowerCase().includes(normalizedQuery)
    )
  );
};

const withoutTrailingSlash = (value: string): string => value.replace(/\/+$/, '');
const explicitScheme = /^([a-z][a-z\d+.-]*):(?=\/\/|[^\d])/i;

const shellSingleQuote = (value: string): string => `'${value.replace(/'/g, `'"'"'`)}'`;

export const deriveApiEndpoints = (input: string): ApiEndpoints => {
  const address = input.trim();
  if (!address) throw new Error('API address is required');

  const scheme = address.match(explicitScheme)?.[1]?.toLowerCase();
  if (scheme && scheme !== 'http' && scheme !== 'https') {
    throw new Error('API address must use HTTP or HTTPS');
  }

  let url: URL;
  try {
    url = new URL(scheme ? address : `http://${address}`);
  } catch {
    throw new Error('Invalid API address');
  }

  if ((url.protocol !== 'http:' && url.protocol !== 'https:') || !url.hostname) {
    throw new Error('API address must use HTTP or HTTPS');
  }

  const serviceOrigin = withoutTrailingSlash(url.origin);
  const openAiBaseUrl = `${serviceOrigin}/v1`;

  return {
    serviceOrigin,
    openAiBaseUrl,
    modelsUrl: `${openAiBaseUrl}/models`,
  };
};

export const buildCurlExample = (openAiBaseUrl: string, modelId: string): string => {
  const baseUrl = withoutTrailingSlash(openAiBaseUrl);
  const body = `{
    "model": ${JSON.stringify(modelId)},
    "messages": [{"role": "user", "content": "Hello"}]
  }`;

  return `curl ${baseUrl}/chat/completions \\
  -H "Authorization: Bearer <API_KEY>" \\
  -H "Content-Type: application/json" \\
  -d ${shellSingleQuote(body)}`;
};

export const buildPythonExample = (openAiBaseUrl: string, modelId: string): string => {
  const baseUrl = withoutTrailingSlash(openAiBaseUrl);

  return `from openai import OpenAI

client = OpenAI(
    api_key="<API_KEY>",
    base_url=${JSON.stringify(baseUrl)},
)

response = client.chat.completions.create(
    model=${JSON.stringify(modelId)},
    messages=[{"role": "user", "content": "Hello"}],
)

print(response.choices[0].message.content)`;
};

export const buildJavaScriptExample = (openAiBaseUrl: string, modelId: string): string => {
  const baseUrl = withoutTrailingSlash(openAiBaseUrl);

  return `import OpenAI from "openai";

const client = new OpenAI({
  apiKey: "<API_KEY>",
  baseURL: ${JSON.stringify(baseUrl)},
});

const response = await client.chat.completions.create({
  model: ${JSON.stringify(modelId)},
  messages: [{ role: "user", content: "Hello" }],
});

console.log(response.choices[0].message.content);`;
};
