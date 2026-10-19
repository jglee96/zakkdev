import "server-only";

type AwsCredentials = {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
};

type AwsCredentialProvider = () => Promise<AwsCredentials>;

export class FinanceAwsConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FinanceAwsConfigError";
  }
}

export type FinanceAwsCredentialMode = "local-static" | "vercel-oidc" | "default-chain";

const LOCAL_CREDENTIALS: AwsCredentials = {
  accessKeyId: "local",
  secretAccessKey: "local",
};

export function isVercelRuntime(env: Partial<NodeJS.ProcessEnv> = process.env): boolean {
  return env.VERCEL === "1" || Boolean(env.VERCEL_ENV);
}

export function resolveFinanceLocalDynamoEndpoint(
  env: Partial<NodeJS.ProcessEnv> = process.env,
): string | undefined {
  if (!env.FINANCE_DYNAMODB_ENDPOINT) {
    return undefined;
  }

  const url = new URL(env.FINANCE_DYNAMODB_ENDPOINT);
  const isLocal = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (
    env.NODE_ENV === "production" ||
    !isLocal ||
    url.protocol !== "http:" ||
    url.username ||
    url.password
  ) {
    throw new FinanceAwsConfigError("FINANCE_DYNAMODB_ENDPOINT is not allowed in this environment");
  }

  return url.origin;
}

export function resolveFinanceAwsCredentialMode(
  env: Partial<NodeJS.ProcessEnv> = process.env,
): FinanceAwsCredentialMode {
  if (resolveFinanceLocalDynamoEndpoint(env)) {
    return "local-static";
  }
  if (isVercelRuntime(env) && env.AWS_ROLE_ARN?.trim()) {
    return "vercel-oidc";
  }
  return "default-chain";
}

type FinanceAwsClientConfig = {
  region: string;
  endpoint?: string;
  maxAttempts?: number;
  credentials?: AwsCredentials | AwsCredentialProvider;
};

let vercelOidcModule: typeof import("@vercel/functions/oidc") | undefined;

function loadVercelOidcModule(): typeof import("@vercel/functions/oidc") {
  if (!vercelOidcModule) {
    // Lazy load so non-Vercel hosts never bundle or resolve @vercel/functions.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    vercelOidcModule = require("@vercel/functions/oidc") as typeof import("@vercel/functions/oidc");
  }
  return vercelOidcModule;
}

export function getVercelOidcCredentialProvider(
  roleArn: string,
): AwsCredentialProvider {
  const { awsCredentialsProvider } = loadVercelOidcModule();
  return awsCredentialsProvider({ roleArn });
}

/** Apply finance AWS credential selection to SDK client config (DynamoDB, Scheduler, etc.). */
export function applyFinanceAwsClientConfig<T extends FinanceAwsClientConfig>(
  clientConfig: T,
  env: Partial<NodeJS.ProcessEnv> = process.env,
): T {
  const mode = resolveFinanceAwsCredentialMode(env);
  switch (mode) {
    case "local-static":
      return { ...clientConfig, credentials: LOCAL_CREDENTIALS };
    case "vercel-oidc": {
      const roleArn = env.AWS_ROLE_ARN?.trim();
      if (!roleArn) {
        throw new FinanceAwsConfigError("AWS_ROLE_ARN is required for Vercel OIDC credentials");
      }
      return { ...clientConfig, credentials: getVercelOidcCredentialProvider(roleArn) };
    }
    case "default-chain":
      return clientConfig;
    default: {
      const never: never = mode;
      throw new FinanceAwsConfigError(`Unhandled finance AWS credential mode: ${never}`);
    }
  }
}
