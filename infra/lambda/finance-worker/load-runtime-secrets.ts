import { GetSecretValueCommand, SecretsManagerClient } from "@aws-sdk/client-secrets-manager";

let loaded = false;

async function readSecretValue(secretArn: string, region: string): Promise<string | undefined> {
  const client = new SecretsManagerClient({ region });
  const response = await client.send(new GetSecretValueCommand({ SecretId: secretArn }));
  const raw = response.SecretString;
  if (!raw) {
    return undefined;
  }
  try {
    const parsed = JSON.parse(raw) as Record<string, string>;
    return parsed.apiKey || parsed.API_KEY || parsed.key || raw;
  } catch {
    return raw;
  }
}

/** Loads API keys from Secrets Manager into process.env once per cold start. */
export async function loadRuntimeSecretsFromEnv(env: NodeJS.ProcessEnv = process.env): Promise<void> {
  if (loaded) {
    return;
  }
  const region = env.AWS_REGION || env.AWS_DEFAULT_REGION || "ap-northeast-2";

  if (!env.OPENROUTER_API_KEY && env.OPENROUTER_SECRET_ARN) {
    const key = await readSecretValue(env.OPENROUTER_SECRET_ARN, region);
    if (key) {
      env.OPENROUTER_API_KEY = key;
    }
  }

  if (!env.OPENDART_API_KEY && env.OPENDART_SECRET_ARN) {
    const key = await readSecretValue(env.OPENDART_SECRET_ARN, region);
    if (key) {
      env.OPENDART_API_KEY = key;
    }
  }

  loaded = true;
}
