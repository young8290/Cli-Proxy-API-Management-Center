export interface ApiEndpoints {
  serviceOrigin: string;
  openAiBaseUrl: string;
  modelsUrl: string;
}

const withoutTrailingSlash = (value: string): string => value.replace(/\/+$/, '');

export const deriveApiEndpoints = (input: string): ApiEndpoints => {
  const address = input.trim();
  const url = new URL(/^https?:\/\//i.test(address) ? address : `http://${address}`);
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

  return `curl ${baseUrl}/chat/completions \\
  -H "Authorization: Bearer <API_KEY>" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": ${JSON.stringify(modelId)},
    "messages": [{"role": "user", "content": "Hello"}]
  }'`;
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
